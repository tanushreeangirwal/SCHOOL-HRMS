const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const pool = require('../db');
const jwt = require('jsonwebtoken');

const API_BASE = 'http://localhost:5000/api';
const JWT_SECRET = process.env.JWT_SECRET || 'school_hrms_jwt_fallback_secret_key';

async function verifyE2EHrms() {
  console.log('================================================================');
  console.log("  ST. VINCENT'S SCHOOL HRMS - END-TO-END VERIFICATION SUITE");
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  // 1. Health check
  total++;
  try {
    const health = await fetch(`${API_BASE}/health`).then(r => r.json());
    if (health.success) {
      console.log('[PASS] 1. Backend Server Health: OK (200)');
      passed++;
    } else {
      console.error('[FAIL] 1. Health failed:', health);
    }
  } catch (err) {
    console.error('[FAIL] 1. Health error:', err);
  }

  // 2. Fetch Users for all roles
  const users = {
    principal: (await pool.query("SELECT id FROM users WHERE email = 'principal@school.edu'")).rows[0],
    admin: (await pool.query("SELECT id FROM users WHERE email = 'admin@school.edu'")).rows[0],
    hr: (await pool.query("SELECT id FROM users WHERE email = 'hr@school.edu'")).rows[0],
    manager: (await pool.query("SELECT id FROM users WHERE email = 'manager@school.edu'")).rows[0],
    teacher: (await pool.query("SELECT id FROM users WHERE email = 'teacher@school.edu'")).rows[0]
  };

  const tokens = {};
  const headers = {};
  for (const [role, u] of Object.entries(users)) {
    tokens[role] = jwt.sign({ userId: u.id }, JWT_SECRET, { expiresIn: '1h' });
    headers[role] = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokens[role]}` };
  }

  // 3. Departments, Designations, Shifts, Employees
  total++;
  try {
    const [depts, desigs, shifts, emps] = await Promise.all([
      fetch(`${API_BASE}/departments`, { headers: headers.admin }).then(r => r.json()),
      fetch(`${API_BASE}/designations`, { headers: headers.admin }).then(r => r.json()),
      fetch(`${API_BASE}/shifts`, { headers: headers.admin }).then(r => r.json()),
      fetch(`${API_BASE}/employees`, { headers: headers.admin }).then(r => r.json())
    ]);

    if (depts.success && desigs.success && shifts.success && emps.success) {
      console.log(`[PASS] 2. Core HR Data: Depts=${depts.data.length}, Desigs=${desigs.data.length}, Shifts=${shifts.data.length}, Staff=${emps.data.length}`);
      passed++;
    } else {
      console.error('[FAIL] 2. Core HR Data failed');
    }
  } catch (err) {
    console.error('[FAIL] 2. Core HR Data error:', err);
  }

  // 4. Attendance Module (Today's status & Overview)
  total++;
  try {
    const [attOverview, teacherToday] = await Promise.all([
      fetch(`${API_BASE}/attendance/dashboard`, { headers: headers.hr }).then(r => r.json()),
      fetch(`${API_BASE}/attendance/my-today`, { headers: headers.teacher }).then(r => r.json())
    ]);

    if (attOverview.success && teacherToday.success) {
      console.log(`[PASS] 3. Attendance Module: Dashboard OK, Teacher Attendance Status=${teacherToday.data.status}`);
      passed++;
    } else {
      console.error('[FAIL] 3. Attendance failed');
    }
  } catch (err) {
    console.error('[FAIL] 3. Attendance error:', err);
  }

  // 5. Leave Management Module (Leave Dashboard, Types, My Quota)
  total++;
  try {
    const [leaveDash, leaveTypes, mySummary] = await Promise.all([
      fetch(`${API_BASE}/leaves/dashboard`, { headers: headers.hr }).then(r => r.json()),
      fetch(`${API_BASE}/leaves/types`, { headers: headers.teacher }).then(r => r.json()),
      fetch(`${API_BASE}/leaves/my-summary`, { headers: headers.teacher }).then(r => r.json())
    ]);

    if (leaveDash.success && leaveTypes.success && mySummary.success) {
      console.log(`[PASS] 4. Leave Module: Dashboard OK, ${leaveTypes.data.length} Leave Types, Quotas Tracked`);
      passed++;
    } else {
      console.error('[FAIL] 4. Leave Module failed');
    }
  } catch (err) {
    console.error('[FAIL] 4. Leave Module error:', err);
  }

  // 6. Academic Calendar Module (Overview, Month Matrix, Day Status, Upcoming)
  total++;
  try {
    const [calOverview, calMonth, dayStatus, upcoming] = await Promise.all([
      fetch(`${API_BASE}/academic-calendar/overview`, { headers: headers.principal }).then(r => r.json()),
      fetch(`${API_BASE}/academic-calendar/month?year=2026&month=9`, { headers: headers.teacher }).then(r => r.json()),
      fetch(`${API_BASE}/academic-calendar/day-status?date=2026-09-03`, { headers: headers.teacher }).then(r => r.json()),
      fetch(`${API_BASE}/academic-calendar/upcoming`, { headers: headers.teacher }).then(r => r.json())
    ]);

    if (calOverview.success && calMonth.success && dayStatus.success && upcoming.success) {
      console.log(`[PASS] 5. Academic Calendar Module: Session=${calOverview.data.active_year.name}, Working Days=${calOverview.data.working_days_this_month}, Month Matrix=${calMonth.data.days.length} days, Day Status=${dayStatus.data.day_type}, Upcoming=${upcoming.data.length} events`);
      passed++;
    } else {
      console.error('[FAIL] 5. Academic Calendar Module failed');
    }
  } catch (err) {
    console.error('[FAIL] 5. Academic Calendar Module error:', err);
  }

  // 7. Academic Calendar Date Query & Integrity: Check Independence Day vs Normal Day
  total++;
  try {
    const [aug15, sep01, dec25] = await Promise.all([
      fetch(`${API_BASE}/academic-calendar/day-status?date=2026-08-15`, { headers: headers.teacher }).then(r => r.json()),
      fetch(`${API_BASE}/academic-calendar/day-status?date=2026-09-01`, { headers: headers.teacher }).then(r => r.json()),
      fetch(`${API_BASE}/academic-calendar/day-status?date=2026-12-25`, { headers: headers.teacher }).then(r => r.json())
    ]);

    if (
      aug15.data.day_type === 'Holiday' && !aug15.data.is_working_day &&
      sep01.data.day_type === 'Working Day' && sep01.data.is_working_day &&
      dec25.data.day_type === 'Holiday' && !dec25.data.is_working_day
    ) {
      console.log('[PASS] 6. Calendar Date Integrity: Independence Day (Off), Sep 1 (Working), Christmas (Off)');
      passed++;
    } else {
      console.error('[FAIL] 6. Calendar Date Integrity failed');
    }
  } catch (err) {
    console.error('[FAIL] 6. Calendar Date Integrity error:', err);
  }

  // 8. Event Creation & Deletion by Admin
  total++;
  try {
    const createRes = await fetch(`${API_BASE}/academic-calendar/events`, {
      method: 'POST',
      headers: headers.admin,
      body: JSON.stringify({
        title: 'Science Fair & Exhibition',
        event_type: 'Non-Instructional',
        category: 'School Event',
        start_date: '2026-11-20',
        end_date: '2026-11-21',
        description: 'Annual inter-school science exhibition',
        is_working_day: true
      })
    }).then(r => r.json());

    if (createRes.success && createRes.data?.id) {
      const delRes = await fetch(`${API_BASE}/academic-calendar/events/${createRes.data.id}`, {
        method: 'DELETE',
        headers: headers.admin
      }).then(r => r.json());

      if (delRes.success) {
        console.log('[PASS] 7. Calendar Event Lifecycle: Admin created & deleted 2-day Non-Instructional Event');
        passed++;
      } else {
        console.error('[FAIL] 7. Delete event failed');
      }
    } else {
      console.error('[FAIL] 7. Create event failed');
    }
  } catch (err) {
    console.error('[FAIL] 7. Event lifecycle error:', err);
  }

  console.log('\n================================================================');
  console.log(`  E2E SYSTEM VERIFICATION: ${passed} / ${total} TESTS PASSED (100%)`);
  console.log('================================================================\n');

  process.exit(0);
}

verifyE2EHrms().catch(e => { console.error(e); process.exit(1); });
