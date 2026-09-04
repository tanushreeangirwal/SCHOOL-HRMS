const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const http = require('http');
const pool = require('../db');
const jwt = require('jsonwebtoken');

// Require server or routes
const express = require('express');
const cors = require('cors');
const authRoutes = require('../routes/auth');
const employeeRoutes = require('../routes/employees');
const departmentRoutes = require('../routes/departments');
const calendarRoutes = require('../routes/academicCalendar');
const attendanceRoutes = require('../routes/attendance');

const JWT_SECRET = process.env.JWT_SECRET || 'school_hrms_jwt_fallback_secret_key';

async function runRealtimeCalendarTests() {
  console.log('================================================================');
  console.log('  TESTING REAL-TIME ACADEMIC CALENDAR SYNCHRONIZATION');
  console.log('================================================================\n');

  // Start test express server on ephemeral port
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  app.use('/api/employees', employeeRoutes);
  app.use('/api/departments', departmentRoutes);
  app.use('/api/academic-calendar', calendarRoutes);
  app.use('/api/attendance', attendanceRoutes);

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(5099, '127.0.0.1', resolve));
  const BASE_URL = 'http://127.0.0.1:5099/api';
  console.log('Test server listening on ' + BASE_URL);

  let passed = 0;
  let total = 0;
  let createdEventId = null;

  try {
    // 1. Get real users for RBAC tokens
    const adminUser = (await pool.query("SELECT id FROM users WHERE email = 'admin@school.edu'")).rows[0];
    const teacherUser = (await pool.query("SELECT id FROM users WHERE email = 'teacher@school.edu'")).rows[0];
    const principalUser = (await pool.query("SELECT id FROM users WHERE email = 'principal@school.edu'")).rows[0];

    const adminToken = jwt.sign({ userId: adminUser.id }, JWT_SECRET, { expiresIn: '1h' });
    const teacherToken = jwt.sign({ userId: teacherUser.id }, JWT_SECRET, { expiresIn: '1h' });
    const principalToken = jwt.sign({ userId: principalUser.id }, JWT_SECRET, { expiresIn: '1h' });

    const adminHeaders = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` };
    const teacherHeaders = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${teacherToken}` };
    const principalHeaders = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${principalToken}` };

    // Get Active Academic Year
    const yearRes = await pool.query("SELECT id, name FROM academic_years WHERE is_active = true LIMIT 1");
    const activeYearId = yearRes.rows[0]?.id;
    console.log(`Active Academic Year: ${yearRes.rows[0]?.name} (${activeYearId})\n`);

    // TEST 0: Check Sync Status Endpoint & SSE Endpoint
    total++;
    const syncStatusInitial = await fetch(`${BASE_URL}/academic-calendar/sync-status`, { headers: teacherHeaders }).then(r => r.json());
    if (syncStatusInitial.success && typeof syncStatusInitial.last_modified !== 'undefined') {
      console.log(`[PASS] 0. Sync Status API: last_modified=${syncStatusInitial.last_modified}, total_count=${syncStatusInitial.total_count}`);
      passed++;
    } else {
      console.error('[FAIL] 0. Sync Status API failed:', syncStatusInitial);
    }

    // Connect SSE client to test real-time broadcast
    const sseEventsReceived = [];
    const sseReq = http.request(`http://127.0.0.1:5099/api/academic-calendar/stream?token=${teacherToken}`, (res) => {
      res.on('data', (chunk) => {
        const str = chunk.toString();
        const lines = str.split('\n');
        for (const line of lines) {
          if (line.startsWith('data:')) {
            try {
              const data = JSON.parse(line.slice(5).trim());
              sseEventsReceived.push(data);
            } catch (e) {}
          }
        }
      });
    });
    sseReq.end();
    await new Promise(r => setTimeout(r, 400)); // wait for SSE connection handshake

    // TEST 1: CREATE an academic event (e.g. Mathematics Examination on 15 September 2026, 10:00 AM)
    total++;
    const createPayload = {
      title: 'Mathematics Examination',
      event_type: 'Non-Instructional',
      category: 'Exam Period / Term Tests',
      academic_year_id: activeYearId,
      start_date: '2026-09-15',
      end_date: '2026-09-15',
      start_time: '10:00 AM',
      end_time: '01:00 PM',
      description: 'Term 1 Mathematics Assessment for Secondary Classes [INCLUDE_SATURDAY]',
      is_working_day: false
    };

    const createRes = await fetch(`${BASE_URL}/academic-calendar/events`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify(createPayload)
    }).then(r => r.json());

    if (createRes.success && createRes.data && createRes.data.id) {
      createdEventId = createRes.data.id;
      console.log(`[PASS] 1. Event Created: ID=${createdEventId}, Title="${createRes.data.title}", Date=${createRes.data.start_date}, Time=${createRes.data.start_time}`);
      passed++;
    } else {
      console.error('[FAIL] 1. Event creation failed:', createRes);
    }

    await new Promise(r => setTimeout(r, 500)); // allow SSE broadcast

    // TEST 2: Verify it appears in Academic Calendar (overview & month matrix)
    total++;
    const monthRes = await fetch(`${BASE_URL}/academic-calendar/month?year=2026&month=9`, { headers: teacherHeaders }).then(r => r.json());
    const day15 = monthRes.data?.days?.find(d => d.date === '2026-09-15');
    const day15Event = day15?.events?.find(e => e.id === createdEventId);

    if (day15Event && day15Event.title === 'Mathematics Examination' && day15Event.start_time === '10:00 AM') {
      console.log(`[PASS] 2. Verified in Academic Calendar Month Matrix: Found on 2026-09-15 with time ${day15Event.start_time}`);
      passed++;
    } else {
      console.error('[FAIL] 2. Not found in month calendar on 2026-09-15:', day15);
    }

    // TEST 3: Verify it appears in Dashboard upcoming events widget
    total++;
    const overviewRes = await fetch(`${BASE_URL}/academic-calendar/overview`, { headers: principalHeaders }).then(r => r.json());
    const upcomingMatch = overviewRes.data?.upcoming_events?.find(e => e.id === createdEventId);

    if (upcomingMatch && upcomingMatch.title === 'Mathematics Examination' && upcomingMatch.start_time === '10:00 AM') {
      console.log(`[PASS] 3. Verified in Dashboard Upcoming Events widget: Title="${upcomingMatch.title}", Time="${upcomingMatch.start_time}"`);
      passed++;
    } else {
      console.error('[FAIL] 3. Not found in upcoming_events widget:', overviewRes.data?.upcoming_events);
    }

    // TEST 4: EDIT the event (change title and time)
    total++;
    const updatePayload = {
      ...createPayload,
      title: 'Advanced Mathematics Examination',
      start_time: '11:00 AM',
      end_time: '02:00 PM'
    };

    const updateRes = await fetch(`${BASE_URL}/academic-calendar/events/${createdEventId}`, {
      method: 'PUT',
      headers: adminHeaders,
      body: JSON.stringify(updatePayload)
    }).then(r => r.json());

    if (updateRes.success && updateRes.data.title === 'Advanced Mathematics Examination' && updateRes.data.start_time === '11:00 AM') {
      console.log(`[PASS] 4. Event Edited: Title="${updateRes.data.title}", New Time=${updateRes.data.start_time}`);
      passed++;
    } else {
      console.error('[FAIL] 4. Event edit failed:', updateRes);
    }

    await new Promise(r => setTimeout(r, 500));

    // TEST 5: Verify changed information propagates to overview
    total++;
    const overviewAfterEdit = await fetch(`${BASE_URL}/academic-calendar/overview`, { headers: teacherHeaders }).then(r => r.json());
    const editMatch = overviewAfterEdit.data?.upcoming_events?.find(e => e.id === createdEventId);

    if (editMatch && editMatch.title === 'Advanced Mathematics Examination' && editMatch.start_time === '11:00 AM') {
      console.log(`[PASS] 5. Propagated edit verified in central views: Title="${editMatch.title}", Time="${editMatch.start_time}"`);
      passed++;
    } else {
      console.error('[FAIL] 5. Edited info not propagated:', editMatch);
    }

    // TEST 6: RESCHEDULE the event (change date from 2026-09-15 to 2026-09-18)
    total++;
    const reschedulePayload = {
      ...updatePayload,
      start_date: '2026-09-18',
      end_date: '2026-09-18',
      start_time: '10:00 AM'
    };

    const rescheduleRes = await fetch(`${BASE_URL}/academic-calendar/events/${createdEventId}`, {
      method: 'PUT',
      headers: adminHeaders,
      body: JSON.stringify(reschedulePayload)
    }).then(r => r.json());

    const localStartDate = new Date(rescheduleRes.data?.start_date).toLocaleDateString('en-CA');
    if (rescheduleRes.success && (rescheduleRes.data.start_date.startsWith('2026-09-18') || localStartDate === '2026-09-18')) {
      console.log(`[PASS] 6. Event Rescheduled to 2026-09-18 (${rescheduleRes.data.start_date})`);
      passed++;
    } else {
      console.error('[FAIL] 6. Reschedule failed:', rescheduleRes);
    }

    await new Promise(r => setTimeout(r, 500));

    // TEST 7: Verify old date/time no longer shows event, and new date shows event
    total++;
    const monthAfterReschedule = await fetch(`${BASE_URL}/academic-calendar/month?year=2026&month=9`, { headers: teacherHeaders }).then(r => r.json());
    const day15After = monthAfterReschedule.data?.days?.find(d => d.date === '2026-09-15');
    const day18After = monthAfterReschedule.data?.days?.find(d => d.date === '2026-09-18');

    const foundOnOld = day15After?.events?.some(e => e.id === createdEventId);
    const foundOnNew = day18After?.events?.some(e => e.id === createdEventId);

    if (!foundOnOld && foundOnNew) {
      console.log(`[PASS] 7. Reschedule Verified: Removed from 2026-09-15 and now appears on 2026-09-18`);
      passed++;
    } else {
      console.error(`[FAIL] 7. Reschedule check failed: foundOnOld=${foundOnOld}, foundOnNew=${foundOnNew}`);
    }

    // TEST 8: CANCEL the event (set is_active = false)
    total++;
    const cancelRes = await fetch(`${BASE_URL}/academic-calendar/events/${createdEventId}/status`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ is_active: false })
    }).then(r => r.json());

    if (cancelRes.success && cancelRes.data.is_active === false) {
      console.log(`[PASS] 8. Event Status Updated to Cancelled / Inactive`);
      passed++;
    } else {
      console.error('[FAIL] 8. Cancel status toggle failed:', cancelRes);
    }

    await new Promise(r => setTimeout(r, 500));

    // TEST 9: Verify cancelled event disappears from active views
    total++;
    const overviewAfterCancel = await fetch(`${BASE_URL}/academic-calendar/overview`, { headers: teacherHeaders }).then(r => r.json());
    const foundInActiveOverview = overviewAfterCancel.data?.upcoming_events?.some(e => e.id === createdEventId);

    if (!foundInActiveOverview) {
      console.log(`[PASS] 9. Cancelled event verified absent from active dashboard views`);
      passed++;
    } else {
      console.error('[FAIL] 9. Cancelled event still present in active overview');
    }

    // TEST 10: DELETE the event
    total++;
    const deleteRes = await fetch(`${BASE_URL}/academic-calendar/events/${createdEventId}`, {
      method: 'DELETE',
      headers: adminHeaders
    }).then(r => r.json());

    if (deleteRes.success) {
      console.log(`[PASS] 10. Event Deleted from database`);
      passed++;
    } else {
      console.error('[FAIL] 10. Delete failed:', deleteRes);
    }

    await new Promise(r => setTimeout(r, 500));

    // TEST 11: Verify permanent removal from DB and views
    total++;
    const checkDb = await pool.query("SELECT id FROM calendar_events WHERE id = $1", [createdEventId]);
    if (checkDb.rows.length === 0) {
      console.log(`[PASS] 11. Verified Event completely removed from PostgreSQL single source of truth`);
      passed++;
      createdEventId = null; // Cleaned up
    } else {
      console.error('[FAIL] 11. Event still in DB:', checkDb.rows);
    }

    // TEST 12: Verify SSE Live Broadcast Stream captured all actions
    total++;
    const actionsSeen = sseEventsReceived.map(e => e.action);
    console.log(`[SSE Stream] Actions broadcast and received in real-time: ${actionsSeen.join(', ')}`);
    if (actionsSeen.includes('CREATE') && actionsSeen.includes('UPDATE') && actionsSeen.includes('CANCEL') && actionsSeen.includes('DELETE')) {
      console.log(`[PASS] 12. Real-time Live SSE stream received CREATE, UPDATE, CANCEL, and DELETE broadcasts`);
      passed++;
    } else {
      console.error('[FAIL] 12. Some SSE actions missing:', actionsSeen);
    }

    // Close SSE connection
    sseReq.destroy();

  } catch (err) {
    console.error('Fatal error during test run:', err);
  } finally {
    // If event still exists due to test failure, clean it up
    if (createdEventId) {
      try {
        await pool.query("DELETE FROM calendar_events WHERE id = $1", [createdEventId]);
        console.log(`[CLEANUP] Deleted test event ${createdEventId}`);
      } catch (e) {}
    }

    server.close();
    await pool.end();
  }

  console.log('\n================================================================');
  console.log(`  FINAL RESULT: ${passed}/${total} TESTS PASSED (${Math.round(passed / total * 100)}%)`);
  console.log('================================================================');

  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runRealtimeCalendarTests();
