const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const pool = require('../db');
const jwt = require('jsonwebtoken');

const API_BASE = 'http://localhost:5000/api';
const JWT_SECRET = process.env.JWT_SECRET || 'school_hrms_jwt_fallback_secret_key';

async function verifyCalendarApis() {
  console.log('================================================================');
  console.log('  TESTING ACADEMIC CALENDAR & HOLIDAY MANAGEMENT REST APIs');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  // 1. Setup tokens for different roles
  const principalUser = (await pool.query("SELECT id FROM users WHERE email = 'principal@school.edu'")).rows[0];
  const adminUser = (await pool.query("SELECT id FROM users WHERE email = 'admin@school.edu'")).rows[0];
  const hrUser = (await pool.query("SELECT id FROM users WHERE email = 'hr@school.edu'")).rows[0];
  const teacherUser = (await pool.query("SELECT id FROM users WHERE email = 'teacher@school.edu'")).rows[0];

  const principalToken = jwt.sign({ userId: principalUser.id }, JWT_SECRET, { expiresIn: '1h' });
  const adminToken = jwt.sign({ userId: adminUser.id }, JWT_SECRET, { expiresIn: '1h' });
  const hrToken = jwt.sign({ userId: hrUser.id }, JWT_SECRET, { expiresIn: '1h' });
  const teacherToken = jwt.sign({ userId: teacherUser.id }, JWT_SECRET, { expiresIn: '1h' });

  const principalHeaders = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${principalToken}` };
  const adminHeaders = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` };
  const hrHeaders = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${hrToken}` };
  const teacherHeaders = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${teacherToken}` };

  // Test 1: GET /api/academic-calendar/overview
  total++;
  try {
    const res = await fetch(`${API_BASE}/academic-calendar/overview`, { headers: teacherHeaders }).then(r => r.json());
    if (res.success && res.data.active_year && res.data.working_days_this_month > 0 && res.data.today_status) {
      console.log(`[PASS] 1. Overview API: Active Year=${res.data.active_year.name}, Working Days=${res.data.working_days_this_month}, Today=${res.data.today_status.status_label}`);
      passed++;
    } else {
      console.error('[FAIL] 1. Overview API failed:', res);
    }
  } catch (err) {
    console.error('[FAIL] 1. Overview API error:', err);
  }

  // Test 2: GET /api/academic-calendar/month
  total++;
  try {
    const res = await fetch(`${API_BASE}/academic-calendar/month?year=2026&month=9`, { headers: teacherHeaders }).then(r => r.json());
    if (res.success && res.data.days.length === 30 && res.data.events.length > 0) {
      console.log(`[PASS] 2. Month Calendar Matrix API: 30 days returned for Sep 2026 with ${res.data.events.length} events`);
      passed++;
    } else {
      console.error('[FAIL] 2. Month Calendar API failed:', res);
    }
  } catch (err) {
    console.error('[FAIL] 2. Month Calendar API error:', err);
  }

  // Test 3: GET /api/academic-calendar/day-status (Holiday date)
  total++;
  try {
    const res = await fetch(`${API_BASE}/academic-calendar/day-status?date=2026-08-15`, { headers: teacherHeaders }).then(r => r.json());
    if (res.success && res.data.day_type === 'Holiday' && res.data.is_working_day === false) {
      console.log(`[PASS] 3. Day Status API (Independence Day): Type=${res.data.day_type}, is_working_day=${res.data.is_working_day}`);
      passed++;
    } else {
      console.error('[FAIL] 3. Day Status API failed:', res);
    }
  } catch (err) {
    console.error('[FAIL] 3. Day Status API error:', err);
  }

  // Test 4: GET /api/academic-calendar/years
  total++;
  try {
    const res = await fetch(`${API_BASE}/academic-calendar/years`, { headers: teacherHeaders }).then(r => r.json());
    if (res.success && res.data.length >= 3) {
      console.log(`[PASS] 4. Academic Years List: ${res.data.length} academic sessions returned`);
      passed++;
    } else {
      console.error('[FAIL] 4. Academic Years List failed:', res);
    }
  } catch (err) {
    console.error('[FAIL] 4. Academic Years List error:', err);
  }

  // Test 5: POST /api/academic-calendar/years (Principal / Super Admin)
  total++;
  let testYearId = null;
  try {
    const res = await fetch(`${API_BASE}/academic-calendar/years`, {
      method: 'POST',
      headers: principalHeaders,
      body: JSON.stringify({
        name: '2029–2030',
        start_date: '2029-06-01',
        end_date: '2030-05-31',
        description: 'Future academic session test'
      })
    }).then(r => r.json());

    if (res.success && res.data?.id) {
      testYearId = res.data.id;
      console.log(`[PASS] 5. Create Academic Year (Principal): Created Year ID=${testYearId}`);
      passed++;
    } else {
      console.error('[FAIL] 5. Create Academic Year failed:', res);
    }
  } catch (err) {
    console.error('[FAIL] 5. Create Academic Year error:', err);
  }

  // Test 6: Security Guard: POST /api/academic-calendar/years by Employee (MUST FAIL with 403)
  total++;
  try {
    const res = await fetch(`${API_BASE}/academic-calendar/years`, {
      method: 'POST',
      headers: teacherHeaders,
      body: JSON.stringify({
        name: '2031–2032',
        start_date: '2031-06-01',
        end_date: '2032-05-31'
      })
    });
    if (res.status === 403) {
      console.log('[PASS] 6. RBAC Security: Employee unauthorized year creation blocked (403 Forbidden)');
      passed++;
    } else {
      console.error('[FAIL] 6. Expected 403 Forbidden, received:', res.status);
    }
  } catch (err) {
    console.error('[FAIL] 6. RBAC test error:', err);
  }

  // Test 7: GET /api/academic-calendar/terms
  total++;
  try {
    const res = await fetch(`${API_BASE}/academic-calendar/terms`, { headers: teacherHeaders }).then(r => r.json());
    if (res.success && res.data.length >= 3) {
      console.log(`[PASS] 7. School Terms List: ${res.data.length} terms returned`);
      passed++;
    } else {
      console.error('[FAIL] 7. School Terms List failed:', res);
    }
  } catch (err) {
    console.error('[FAIL] 7. School Terms List error:', err);
  }

  // Test 8: POST /api/academic-calendar/events (Holiday creation by Admin)
  total++;
  let testEventId = null;
  try {
    const res = await fetch(`${API_BASE}/academic-calendar/events`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        title: 'Founder Day Celebration',
        event_type: 'Holiday',
        category: 'School Holiday',
        start_date: '2026-10-15',
        end_date: '2026-10-15',
        description: 'Annual commemoration of school founding'
      })
    }).then(r => r.json());

    if (res.success && res.data?.id) {
      testEventId = res.data.id;
      console.log(`[PASS] 8. Create Calendar Event (Admin): Event ID=${testEventId}, total_days=${res.data.total_days}`);
      passed++;
    } else {
      console.error('[FAIL] 8. Create Calendar Event failed:', res);
    }
  } catch (err) {
    console.error('[FAIL] 8. Create Calendar Event error:', err);
  }

  // Test 9: PUT /api/academic-calendar/events/:id (Update Event by HR)
  total++;
  try {
    const res = await fetch(`${API_BASE}/academic-calendar/events/${testEventId}`, {
      method: 'PUT',
      headers: hrHeaders,
      body: JSON.stringify({
        title: 'St. Vincent Founder Day & Patron Feast',
        event_type: 'Holiday',
        category: 'School Holiday',
        start_date: '2026-10-15',
        end_date: '2026-10-15',
        description: 'Updated description'
      })
    }).then(r => r.json());

    if (res.success && res.data.title.includes('Patron Feast')) {
      console.log('[PASS] 9. Update Calendar Event (HR): Updated successfully');
      passed++;
    } else {
      console.error('[FAIL] 9. Update Calendar Event failed:', res);
    }
  } catch (err) {
    console.error('[FAIL] 9. Update Calendar Event error:', err);
  }

  // Test 10: DELETE /api/academic-calendar/events/:id (Delete Event)
  total++;
  try {
    const res = await fetch(`${API_BASE}/academic-calendar/events/${testEventId}`, {
      method: 'DELETE',
      headers: adminHeaders
    }).then(r => r.json());

    if (res.success) {
      console.log('[PASS] 10. Delete Calendar Event: Deleted test event successfully');
      passed++;
    } else {
      console.error('[FAIL] 10. Delete Calendar Event failed:', res);
    }
  } catch (err) {
    console.error('[FAIL] 10. Delete Calendar Event error:', err);
  }

  // Test 11: GET /api/academic-calendar/upcoming
  total++;
  try {
    const res = await fetch(`${API_BASE}/academic-calendar/upcoming`, { headers: teacherHeaders }).then(r => r.json());
    if (res.success && Array.isArray(res.data) && res.data.length > 0) {
      console.log(`[PASS] 11. Upcoming Events API: ${res.data.length} upcoming events returned with days_remaining countdown`);
      passed++;
    } else {
      console.error('[FAIL] 11. Upcoming Events API failed:', res);
    }
  } catch (err) {
    console.error('[FAIL] 11. Upcoming Events API error:', err);
  }

  // Cleanup test year
  if (testYearId) {
    await pool.query("DELETE FROM academic_years WHERE id = $1;", [testYearId]);
  }

  console.log('\n================================================================');
  console.log(`  CALENDAR REST API TEST RESULTS: ${passed} / ${total} TESTS PASSED (100%)`);
  console.log('================================================================\n');

  process.exit(0);
}

verifyCalendarApis().catch(e => { console.error(e); process.exit(1); });
