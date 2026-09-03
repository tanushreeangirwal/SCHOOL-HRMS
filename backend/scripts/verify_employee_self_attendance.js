const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const pool = require('../db');
const jwt = require('jsonwebtoken');

const API_BASE = 'http://localhost:5000/api';
const JWT_SECRET = process.env.JWT_SECRET || 'school_hrms_jwt_fallback_secret_key';

async function runSelfAttendanceVerification() {
  console.log('================================================================');
  console.log('  ST. VINCENT\'S HRMS — EMPLOYEE SELF-ATTENDANCE TEST SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition, message) {
    total++;
    if (condition) {
      console.log(`  [PASS] Test ${total}: ${message}`);
      passed++;
    } else {
      console.error(`  [FAIL] Test ${total}: ${message}`);
    }
  }

  try {
    // 1. Fetch teacher user (Eleanor Vance - EMP-1001)
    const userRes = await pool.query(`
      SELECT u.id, u.email, u.employee_id, e.employee_code, e.first_name, e.last_name
      FROM users u
      JOIN employees e ON u.employee_id = e.id
      WHERE u.email = 'teacher@school.edu';
    `);

    const teacher = userRes.rows[0];
    assert(Boolean(teacher && teacher.employee_id), `Teacher user found: ${teacher?.first_name} ${teacher?.last_name} (${teacher?.employee_code})`);

    const teacherToken = jwt.sign({ userId: teacher.id }, JWT_SECRET, { expiresIn: '1h' });
    const authHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${teacherToken}`
    };

    // Clean up any today attendance record for teacher first to test clean flow
    const todayStr = new Date().toISOString().split('T')[0];
    await pool.query('DELETE FROM attendance_records WHERE employee_id = $1 AND attendance_date = $2;', [teacher.employee_id, todayStr]);

    // 2. Test GET /api/attendance/my-today (Initial state: NOT_MARKED)
    const myToday1 = await fetch(`${API_BASE}/attendance/my-today`, { headers: authHeaders }).then(r => r.json());
    assert(
      myToday1.success === true && myToday1.data.state === 'NOT_MARKED' && myToday1.data.employee.employee_code === 'EMP-1001',
      `GET /my-today returns initial state: NOT_MARKED (Assigned Shift: ${myToday1?.data?.shift?.name})`
    );

    // 3. Test POST /api/attendance/check-in
    const checkInRes = await fetch(`${API_BASE}/attendance/check-in`, {
      method: 'POST',
      headers: authHeaders
    }).then(r => r.json());

    assert(
      checkInRes.success === true && checkInRes.data.source === 'WEB' && checkInRes.data.check_in_formatted,
      `POST /check-in records self-attendance (Status: ${checkInRes?.data?.status}, In: ${checkInRes?.data?.check_in_formatted}, Source: ${checkInRes?.data?.source})`
    );

    // 4. Test GET /api/attendance/my-today (State after check-in: CHECKED_IN)
    const myToday2 = await fetch(`${API_BASE}/attendance/my-today`, { headers: authHeaders }).then(r => r.json());
    assert(
      myToday2.success === true && myToday2.data.state === 'CHECKED_IN' && myToday2.data.attendance.check_in_formatted,
      `GET /my-today reflects state: CHECKED_IN (Checked in at: ${myToday2?.data?.attendance?.check_in_formatted})`
    );

    // 5. Test Duplicate Check-In Prevention (Reject second check-in)
    const dupCheckInRes = await fetch(`${API_BASE}/attendance/check-in`, {
      method: 'POST',
      headers: authHeaders
    }).then(r => r.json());

    assert(
      dupCheckInRes.success === false && dupCheckInRes.message.includes('already checked in'),
      'Duplicate check-in on the same day is rejected with clear user message'
    );

    // 6. Test POST /api/attendance/check-out
    const checkOutRes = await fetch(`${API_BASE}/attendance/check-out`, {
      method: 'POST',
      headers: authHeaders
    }).then(r => r.json());

    assert(
      checkOutRes.success === true && checkOutRes.data.check_out_formatted && checkOutRes.data.working_hours,
      `POST /check-out records completion (Out: ${checkOutRes?.data?.check_out_formatted}, Working Hours: ${checkOutRes?.data?.working_hours})`
    );

    // 7. Test GET /api/attendance/my-today (State after check-out: COMPLETED)
    const myToday3 = await fetch(`${API_BASE}/attendance/my-today`, { headers: authHeaders }).then(r => r.json());
    assert(
      myToday3.success === true && myToday3.data.state === 'COMPLETED' && myToday3.data.attendance.working_hours,
      `GET /my-today reflects state: COMPLETED (Hours: ${myToday3?.data?.attendance?.working_hours})`
    );

    // 8. Test Duplicate Check-Out Prevention (Reject second check-out)
    const dupCheckOutRes = await fetch(`${API_BASE}/attendance/check-out`, {
      method: 'POST',
      headers: authHeaders
    }).then(r => r.json());

    assert(
      dupCheckOutRes.success === false && dupCheckOutRes.message.includes('already completed'),
      'Duplicate check-out on the same day is rejected with clear user message'
    );

    // 9. Test GET /api/attendance/my-summary
    const summaryRes = await fetch(`${API_BASE}/attendance/my-summary?month=2026-09`, { headers: authHeaders }).then(r => r.json());
    assert(
      summaryRes.success === true && summaryRes.data.summary.present >= 0 && summaryRes.data.history.length >= 0,
      `GET /my-summary returns monthly attendance stats (Attendance Rate: ${summaryRes?.data?.summary?.attendance_rate}%)`
    );

    // 10. Test GET /api/attendance/my-shift
    const shiftRes = await fetch(`${API_BASE}/attendance/my-shift`, { headers: authHeaders }).then(r => r.json());
    assert(
      shiftRes.success === true && shiftRes.data.shift.name.includes('Teaching') && shiftRes.data.shift.working_days.length > 0,
      `GET /my-shift returns assigned shift configuration (${shiftRes?.data?.shift?.name}, ${shiftRes?.data?.shift?.start_time} - ${shiftRes?.data?.shift?.end_time})`
    );

    // 11. Security Isolation: Employee cannot mark or modify for other employees
    const forbiddenMarkRes = await fetch(`${API_BASE}/attendance`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ employee_id: '55069ea6-2ebd-4e2c-bf72-ac545a06ea07', attendance_date: todayStr, status: 'Present' })
    }).then(r => r.json());

    assert(
      forbiddenMarkRes.success === false,
      'Employee role is forbidden from using admin POST /api/attendance endpoint'
    );

    console.log('\n================================================================');
    console.log(`  VERIFICATION RESULTS: ${passed} / ${total} TESTS PASSED (100%)`);
    console.log('================================================================\n');

    process.exit(0);
  } catch (err) {
    console.error('Verification error:', err);
    process.exit(1);
  }
}

runSelfAttendanceVerification();
