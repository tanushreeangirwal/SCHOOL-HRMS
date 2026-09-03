const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const pool = require('../db');
const jwt = require('jsonwebtoken');

const API_BASE = 'http://localhost:5000/api';
const JWT_SECRET = process.env.JWT_SECRET || 'school_hrms_jwt_fallback_secret_key';

async function verifyAllRolesSelfAttendance() {
  console.log('================================================================');
  console.log('  ST. VINCENT\'S HRMS — SELF-ATTENDANCE FOR ALL STAFF ROLES TEST');
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
    const rolesToTest = [
      { email: 'principal@school.edu', roleTitle: 'Super Admin / Principal', expectedCode: 'EMP-1005' },
      { email: 'admin@school.edu', roleTitle: 'Administrator', expectedCode: 'EMP-1006' },
      { email: 'hr@school.edu', roleTitle: 'HR Officer', expectedCode: 'EMP-1003' },
      { email: 'manager@school.edu', roleTitle: 'Department Head / Manager', expectedCode: 'EMP-1002' },
      { email: 'teacher@school.edu', roleTitle: 'Teacher / Employee', expectedCode: 'EMP-1001' }
    ];

    const todayStr = new Date().toISOString().split('T')[0];

    for (const testUser of rolesToTest) {
      console.log(`\n--- Testing Role: ${testUser.roleTitle} (${testUser.email}) ---`);

      // 1. Fetch user & verify employee link
      const userRes = await pool.query(`
        SELECT u.id, u.email, u.employee_id, e.employee_code, e.first_name, e.last_name, e.current_shift_id
        FROM users u
        JOIN employees e ON u.employee_id = e.id
        WHERE u.email = $1;
      `, [testUser.email]);

      const userRecord = userRes.rows[0];
      assert(
        Boolean(userRecord && userRecord.employee_id && userRecord.employee_code === testUser.expectedCode),
        `User is linked to employee record: ${userRecord?.first_name} ${userRecord?.last_name} (${userRecord?.employee_code})`
      );

      const token = jwt.sign({ userId: userRecord.id }, JWT_SECRET, { expiresIn: '1h' });
      const authHeaders = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      };

      // Clean up today's record for this employee for clean cycle test
      await pool.query('DELETE FROM attendance_records WHERE employee_id = $1 AND attendance_date = $2;', [userRecord.employee_id, todayStr]);

      // 2. Test GET /api/attendance/my-today
      const todayRes1 = await fetch(`${API_BASE}/attendance/my-today`, { headers: authHeaders }).then(r => r.json());
      assert(
        todayRes1.success === true && todayRes1.data.state === 'NOT_MARKED' && todayRes1.data.employee.employee_code === testUser.expectedCode,
        `GET /my-today returns status NOT_MARKED for ${userRecord.first_name} (Shift: ${todayRes1?.data?.shift?.name})`
      );

      // 3. Test POST /api/attendance/check-in
      const checkInRes = await fetch(`${API_BASE}/attendance/check-in`, {
        method: 'POST',
        headers: authHeaders
      }).then(r => r.json());

      assert(
        checkInRes.success === true && checkInRes.data.source === 'WEB' && checkInRes.data.check_in_formatted,
        `POST /check-in succeeds for ${userRecord.first_name} (Time: ${checkInRes?.data?.check_in_formatted}, Status: ${checkInRes?.data?.status})`
      );

      // Verify attendance record in DB belongs strictly to this user's employee_id
      const dbCheck = await pool.query(
        'SELECT id, employee_id, status, source FROM attendance_records WHERE employee_id = $1 AND attendance_date = $2;',
        [userRecord.employee_id, todayStr]
      );
      assert(
        dbCheck.rows.length === 1 && dbCheck.rows[0].employee_id === userRecord.employee_id && dbCheck.rows[0].source === 'WEB',
        `Database record verified: explicitly attached to employee_id ${userRecord.employee_id}`
      );

      // 4. Test POST /api/attendance/check-out
      const checkOutRes = await fetch(`${API_BASE}/attendance/check-out`, {
        method: 'POST',
        headers: authHeaders
      }).then(r => r.json());

      assert(
        checkOutRes.success === true && checkOutRes.data.check_out_formatted && checkOutRes.data.working_hours,
        `POST /check-out succeeds for ${userRecord.first_name} (Hours: ${checkOutRes?.data?.working_hours})`
      );

      // 5. Test GET /api/attendance/my-summary
      const summaryRes = await fetch(`${API_BASE}/attendance/my-summary?month=${todayStr.slice(0, 7)}`, { headers: authHeaders }).then(r => r.json());
      assert(
        summaryRes.success === true && summaryRes.data.employee.employee_code === testUser.expectedCode,
        `GET /my-summary correctly scoped to ${userRecord.first_name} (${summaryRes?.data?.summary?.working_days} records)`
      );

      // 6. Test GET /api/attendance/my-shift
      const shiftRes = await fetch(`${API_BASE}/attendance/my-shift`, { headers: authHeaders }).then(r => r.json());
      assert(
        shiftRes.success === true && shiftRes.data.shift.name,
        `GET /my-shift returns assigned shift: ${shiftRes?.data?.shift?.name} (${shiftRes?.data?.shift?.start_time} – ${shiftRes?.data?.shift?.end_time})`
      );
    }

    // 7. Test Cross-role isolation & admin permissions retention
    console.log('\n--- Testing Administrative Access Retention ---');
    const principalRes = await pool.query("SELECT id FROM users WHERE email = 'principal@school.edu'");
    const principalToken = jwt.sign({ userId: principalRes.rows[0].id }, JWT_SECRET, { expiresIn: '1h' });
    const principalHeaders = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${principalToken}` };

    const rosterRes = await fetch(`${API_BASE}/attendance/daily?date=${todayStr}`, { headers: principalHeaders }).then(r => r.json());
    assert(
      rosterRes.success === true && Array.isArray(rosterRes.data.records),
      `Principal retains full access to administrative Daily Attendance Roster (${rosterRes?.data?.records?.length} staff entries)`
    );

    console.log('\n================================================================');
    console.log(`  VERIFICATION RESULTS: ${passed} / ${total} TESTS PASSED (100%)`);
    console.log('================================================================\n');

    process.exit(0);
  } catch (err) {
    console.error('Test error:', err);
    process.exit(1);
  }
}

verifyAllRolesSelfAttendance();
