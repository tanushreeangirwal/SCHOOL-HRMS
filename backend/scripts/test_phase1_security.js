/**
 * Comprehensive Phase 1 Security Verification Suite
 * Tests Payroll RBAC, Payslip IDOR, Manager Department Scoping, Helmet Headers, and OTP Protection.
 */

const pool = require('../db');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/jwtConfig');
const http = require('http');

async function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, headers: res.headers, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, body: data });
        }
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

async function runTests() {
  console.log('=================================================================');
  console.log("   ST. VINCENT'S SCHOOL HRMS — PHASE 1 SECURITY TEST SUITE       ");
  console.log('=================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${message}`);
      failed++;
    }
  }

  try {
    // Fetch users for each role
    const usersRes = await pool.query(`
      SELECT u.id as user_id, u.email, r.name as role_name, u.employee_id, e.department_id
      FROM users u
      JOIN hr_roles r ON u.role_id = r.id
      LEFT JOIN employees e ON u.employee_id = e.id;
    `);

    const users = {};
    usersRes.rows.forEach(u => {
      users[u.email] = {
        ...u,
        token: jwt.sign({ userId: u.user_id }, JWT_SECRET, { expiresIn: '1h' })
      };
    });

    const admin = users['admin@school.edu'] || users['principal@school.edu'];
    const hr = users['hr@school.edu'];
    const manager = users['manager@school.edu'];
    const teacher = users['teacher@school.edu'];

    // Also get a sample payroll record for IDOR tests
    const payRes = await pool.query(`
      SELECT pr.id, pr.employee_id, e.first_name, e.last_name, e.department_id
      FROM payroll_records pr
      JOIN employees e ON pr.employee_id = e.id
      LIMIT 5;
    `);

    let ownRecord = null;
    let otherRecord = null;
    if (teacher && payRes.rows.length > 0) {
      ownRecord = payRes.rows.find(r => r.employee_id === teacher.employee_id) || payRes.rows[0];
      otherRecord = payRes.rows.find(r => r.employee_id !== teacher.employee_id && r.employee_id !== manager?.employee_id) || payRes.rows[payRes.rows.length - 1];
    }

    const PORT = process.env.PORT || 5000;

    // -------------------------------------------------------------------------
    // TEST GROUP 1: Unauthenticated Access (Must be rejected with 401)
    // -------------------------------------------------------------------------
    console.log('--- TEST GROUP 1: UNAUTHENTICATED PROTECTION ---');
    const unauthRecords = await makeRequest({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/payroll/records',
      method: 'GET'
    });
    assert(unauthRecords.status === 401, 'Unauthenticated GET /api/payroll/records returns HTTP 401');

    const unauthOverview = await makeRequest({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/payroll/overview',
      method: 'GET'
    });
    assert(unauthOverview.status === 401, 'Unauthenticated GET /api/payroll/overview returns HTTP 401');

    const unauthEmployees = await makeRequest({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/employees',
      method: 'GET'
    });
    assert(unauthEmployees.status === 401, 'Unauthenticated GET /api/employees returns HTTP 401');

    // -------------------------------------------------------------------------
    // TEST GROUP 2: Employee Role RBAC & IDOR (Teacher / Eleanor Vance)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST GROUP 2: TEACHER / EMPLOYEE RBAC & IDOR ---');
    const teacherRecords = await makeRequest({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/payroll/records',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${teacher.token}` }
    });
    assert(teacherRecords.status === 403, 'Teacher cannot query /api/payroll/records (HTTP 403 Forbidden)');

    const teacherOverview = await makeRequest({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/payroll/overview',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${teacher.token}` }
    });
    assert(teacherOverview.status === 403, 'Teacher cannot query /api/payroll/overview (HTTP 403 Forbidden)');

    const teacherMyPayslips = await makeRequest({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/payroll/my-payslips',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${teacher.token}` }
    });
    assert(teacherMyPayslips.status === 200, 'Teacher can access own /api/payroll/my-payslips (HTTP 200 OK)');

    if (otherRecord) {
      const teacherIdorPayslip = await makeRequest({
        hostname: '127.0.0.1',
        port: PORT,
        path: `/api/payroll/payslip/${otherRecord.id}`,
        method: 'GET',
        headers: { 'Authorization': `Bearer ${teacher.token}` }
      });
      assert(teacherIdorPayslip.status === 403, 'Teacher cannot access another employee payslip via IDOR (HTTP 403 Forbidden)');

      const teacherIdorRecord = await makeRequest({
        hostname: '127.0.0.1',
        port: PORT,
        path: `/api/payroll/records/${otherRecord.id}`,
        method: 'GET',
        headers: { 'Authorization': `Bearer ${teacher.token}` }
      });
      assert(teacherIdorRecord.status === 403, 'Teacher cannot access another employee payroll record detail (HTTP 403 Forbidden)');
    }

    // -------------------------------------------------------------------------
    // TEST GROUP 3: Manager Role RBAC & IDOR & Department Scoping (Marcus Joseph)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST GROUP 3: MANAGER RBAC & DEPARTMENT SCOPING ---');
    const managerRecords = await makeRequest({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/payroll/records',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${manager.token}` }
    });
    assert(managerRecords.status === 403, 'Manager cannot query school-wide /api/payroll/records (HTTP 403 Forbidden)');

    const managerOverview = await makeRequest({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/payroll/overview',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${manager.token}` }
    });
    assert(managerOverview.status === 403, 'Manager cannot query school-wide /api/payroll/overview (HTTP 403 Forbidden)');

    if (otherRecord) {
      const managerIdorPayslip = await makeRequest({
        hostname: '127.0.0.1',
        port: PORT,
        path: `/api/payroll/payslip/${otherRecord.id}`,
        method: 'GET',
        headers: { 'Authorization': `Bearer ${manager.token}` }
      });
      assert(managerIdorPayslip.status === 403, 'Manager cannot access unauthorized payslip via IDOR (HTTP 403 Forbidden)');
    }

    // Manager Employee Directory scoping test
    const managerEmps = await makeRequest({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/employees',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${manager.token}` }
    });
    assert(managerEmps.status === 200, 'Manager can query scoped employee directory (HTTP 200 OK)');
    if (managerEmps.body?.data && Array.isArray(managerEmps.body.data)) {
      const allInDept = managerEmps.body.data.every(e => e.department_id === manager.department_id);
      assert(allInDept, 'Manager directory results are strictly scoped to manager department');
      
      const noSalaryData = managerEmps.body.data.every(e => e.monthly_gross === undefined && e.annual_ctc === undefined);
      assert(noSalaryData, 'Employee salary CTC and gross pay are masked from Manager response');
    }

    // Manager Leave approval scoping test
    // Find a leave request in another department
    const otherDeptLeave = await pool.query(`
      SELECT lr.id, lr.employee_id, e.department_id
      FROM leave_requests lr
      JOIN employees e ON lr.employee_id = e.id
      WHERE e.department_id != $1 AND lr.status = 'Pending'
      LIMIT 1;
    `, [manager.department_id]);

    if (otherDeptLeave.rows.length > 0) {
      const leaveId = otherDeptLeave.rows[0].id;
      const managerApproveCrossDept = await makeRequest({
        hostname: '127.0.0.1',
        port: PORT,
        path: `/api/leaves/requests/${leaveId}/approve`,
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${manager.token}`,
          'Content-Type': 'application/json'
        }
      });
      assert(managerApproveCrossDept.status === 403, 'Manager cannot approve leave for employee in another department (HTTP 403 Forbidden)');
    } else {
      console.log('  [INFO] No pending cross-department leave requests to test live cross-dept approval.');
    }

    // -------------------------------------------------------------------------
    // TEST GROUP 4: HR & Admin Role Verification
    // -------------------------------------------------------------------------
    console.log('\n--- TEST GROUP 4: HR & ADMIN AUTHORIZED ACCESS ---');
    const hrRecords = await makeRequest({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/payroll/records',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${hr.token}` }
    });
    assert(hrRecords.status === 200, 'HR user successfully accesses /api/payroll/records (HTTP 200 OK)');

    const adminOverview = await makeRequest({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/payroll/overview',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${admin.token}` }
    });
    assert(adminOverview.status === 200, 'Admin successfully accesses /api/payroll/overview (HTTP 200 OK)');

    const hrEmps = await makeRequest({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/employees',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${hr.token}` }
    });
    assert(hrEmps.status === 200, 'HR accesses full employee roster (HTTP 200 OK)');
    if (hrEmps.body?.data && hrEmps.body.data.length > 0) {
      const hasSalary = hrEmps.body.data.some(e => e.monthly_gross !== undefined);
      assert(hasSalary, 'Authorized HR receives salary details in employee directory');
    }

    // -------------------------------------------------------------------------
    // TEST GROUP 5: Security Headers & Sanitized Health Check
    // -------------------------------------------------------------------------
    console.log('\n--- TEST GROUP 5: SECURITY HEADERS & HEALTH CHECK ---');
    const health = await makeRequest({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/health',
      method: 'GET'
    });
    assert(health.status === 200, 'Sanitized /api/health returns HTTP 200 OK');
    assert(health.headers['x-content-type-options'] === 'nosniff', 'Helmet active: X-Content-Type-Options is nosniff');
    assert(health.headers['x-frame-options'] === 'SAMEORIGIN', 'Helmet active: X-Frame-Options header present');
    assert(health.body.database === undefined, 'Internal database name is NOT exposed in /api/health');

    // -------------------------------------------------------------------------
    // TEST GROUP 6: OTP Leakage Check
    // -------------------------------------------------------------------------
    console.log('\n--- TEST GROUP 6: OTP & CREDENTIAL SECURITY ---');
    const otpTest = await makeRequest({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/auth/onboarding/send-phone-otp',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { token: 'invalid_token_test', phone: '9876543210' });
    assert(otpTest.body.devOtp === undefined, 'devOtp is NOT leaked in send-phone-otp response');

    console.log('\n=================================================================');
    console.log(`PHASE 1 SECURITY TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('=================================================================');

    process.exit(failed === 0 ? 0 : 1);
  } catch (err) {
    console.error('Test suite runtime error:', err);
    process.exit(1);
  }
}

runTests();
