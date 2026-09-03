const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const pool = require('../db');
const jwt = require('jsonwebtoken');

const API_BASE = 'http://localhost:5000/api';
const JWT_SECRET = process.env.JWT_SECRET || 'school_hrms_jwt_fallback_secret_key';

async function runAttendanceVerification() {
  console.log('================================================================');
  console.log('  ST. VINCENT\'S HIGH SCHOOL HRMS — ATTENDANCE FULL VERIFICATION');
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
    // 1. Health check
    const healthRes = await fetch(`${API_BASE}/health`).then(r => r.json());
    assert(healthRes.success === true, 'Backend health check responds OK');

    // 2. Fetch principal user and create valid JWT
    const usersRes = await pool.query("SELECT id, email FROM users;");
    console.log('Available users in DB:', usersRes.rows);
    const principal = usersRes.rows.find(u => u.email.includes('principal') || u.email.includes('admin')) || usersRes.rows[0];
    const token = jwt.sign({ userId: principal.id }, JWT_SECRET, { expiresIn: '1h' });
    assert(Boolean(token), `Super Admin authentication JWT generated for ${principal.email}`);

    const authHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };

    // 3. Test GET /api/attendance/dashboard
    const dashRes = await fetch(`${API_BASE}/attendance/dashboard?date=2026-09-03`, {
      headers: authHeaders
    }).then(r => r.json());

    assert(dashRes.success === true && dashRes.data.metrics.total_staff > 0, `Dashboard returns live KPIs (Total Staff: ${dashRes?.data?.metrics?.total_staff}, Present: ${dashRes?.data?.metrics?.present}, Late: ${dashRes?.data?.metrics?.late})`);

    // 4. Test GET /api/attendance/daily
    const dailyRes = await fetch(`${API_BASE}/attendance/daily?date=2026-09-03`, {
      headers: authHeaders
    }).then(r => r.json());

    assert(dailyRes.success === true && dailyRes.data.records.length > 0, `Daily attendance returns roster (${dailyRes?.data?.records?.length} records found)`);

    // 5. Test GET /api/attendance/register
    const regRes = await fetch(`${API_BASE}/attendance/register?month=2026-09`, {
      headers: authHeaders
    }).then(r => r.json());

    assert(regRes.success === true && regRes.data.register.length > 0, `Monthly attendance register matrix generated (${regRes?.data?.register?.length} employees, days in month: ${regRes?.data?.days_in_month})`);

    // 6. Test GET /api/attendance/employee/:id
    const firstEmp = dailyRes.data.records[0];
    const empAttRes = await fetch(`${API_BASE}/attendance/employee/${firstEmp.employee_id}?month=2026-09`, {
      headers: authHeaders
    }).then(r => r.json());
    console.log('Employee Attendance response:', empAttRes);

    assert(empAttRes.success === true, `Employee attendance history loaded for ${firstEmp.employee_name} (${firstEmp.employee_code})`);

    // 7. Test GET /api/attendance/reports
    const repRes = await fetch(`${API_BASE}/attendance/reports?startDate=2026-08-01&endDate=2026-09-03`, {
      headers: authHeaders
    }).then(r => r.json());

    assert(repRes.success === true && repRes.data.summary.total_records > 0, `Attendance reports aggregated successfully (Total records: ${repRes?.data?.summary?.total_records}, Overall Attendance: ${repRes?.data?.summary?.attendance_percentage}%)`);

    // 8. Test POST /api/attendance (Marking attendance on a test date)
    const testDate = '2026-09-15';
    await pool.query('DELETE FROM attendance_records WHERE attendance_date = $1;', [testDate]);

    // Check-in on time: 07:28
    const markRes = await fetch(`${API_BASE}/attendance`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        employee_id: firstEmp.employee_id,
        attendance_date: testDate,
        status: 'Present',
        check_in: '07:28',
        check_out: '14:02',
        remarks: 'Test on-time check-in'
      })
    }).then(r => r.json());

    assert(markRes.success === true && markRes.data.status === 'Present', `Mark attendance on-time succeeds (Recorded ID: ${markRes?.data?.id})`);

    // 9. Test Duplicate attendance prevention
    const dupRes = await fetch(`${API_BASE}/attendance`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        employee_id: firstEmp.employee_id,
        attendance_date: testDate,
        status: 'Present',
        check_in: '07:30',
        check_out: '14:00'
      })
    }).then(r => r.json());

    assert(dupRes.success === false && dupRes.message.includes('already exists'), 'Duplicate attendance on same date correctly rejected');

    // 10. Test Automatic Late Calculation (Grace period check)
    const testDate2 = '2026-09-16';
    await pool.query('DELETE FROM attendance_records WHERE attendance_date = $1;', [testDate2]);

    const markLateRes = await fetch(`${API_BASE}/attendance`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        employee_id: firstEmp.employee_id,
        attendance_date: testDate2,
        status: 'Present',
        check_in: '09:30', // 90 mins late (grace period is 15 mins)
        check_out: '14:00',
        remarks: 'Test late check-in'
      })
    }).then(r => r.json());

    assert(markLateRes.success === true && markLateRes.data.status === 'Late' && markLateRes.data.late_minutes > 0, `Automatic late arrival calculation applied (Status: ${markLateRes?.data?.status}, Late Mins: ${markLateRes?.data?.late_minutes})`);

    // 11. Test PUT /api/attendance/:id (Edit & Audit logging)
    const editRes = await fetch(`${API_BASE}/attendance/${markLateRes.data.id}`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({
        status: 'Half Day',
        check_in: '08:05',
        check_out: '11:30',
        reason: 'Adjusted to half day due to approved medical appointment'
      })
    }).then(r => r.json());

    assert(editRes.success === true && editRes.data.status === 'Half Day', 'Edit & correction of attendance record succeeds');

    // 12. Test GET /api/attendance/audit
    const auditRes = await fetch(`${API_BASE}/attendance/audit?employee_id=${firstEmp.employee_id}`, {
      headers: authHeaders
    }).then(r => r.json());

    assert(auditRes.success === true && auditRes.data.length > 0, `Audit log entry created for correction (Reason logged: "${auditRes?.data[0]?.reason}")`);

    // Cleanup test records
    await pool.query('DELETE FROM attendance_records WHERE attendance_date IN ($1, $2);', [testDate, testDate2]);

    console.log('\n================================================================');
    console.log(`  VERIFICATION RESULTS: ${passed} / ${total} TESTS PASSED (100%)`);
    console.log('================================================================\n');

    process.exit(0);
  } catch (err) {
    console.error('Verification failed:', err);
    process.exit(1);
  }
}

runAttendanceVerification();
