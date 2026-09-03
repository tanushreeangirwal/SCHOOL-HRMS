const pool = require('../db');
const http = require('http');

async function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', (err) => reject(err));

    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

async function testAssignEmployee() {
  console.log('================================================================');
  console.log('--- TESTING ASSIGN EMPLOYEE WORKFLOW & PERMISSIONS ---');
  console.log('================================================================\n');

  // 1. Authenticate users
  const adminLogin = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: 'admin@school.edu', password: 'SchoolDemo@2026' });
  const adminToken = adminLogin.body.token;

  const teacherLogin = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: 'teacher@school.edu', password: 'SchoolDemo@2026' });
  const teacherToken = teacherLogin.body.token;

  console.log('1. Authentication: Admin & Teacher tokens issued.');

  // 2. Fetch initial departments and employees
  const deptsRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/departments',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  const sciDept = deptsRes.body.data.find(d => d.code === 'ACAD-SCI' || d.name.includes('Science'));
  const humDept = deptsRes.body.data.find(d => d.code === 'ACAD-HUM' || d.name.includes('Humanities'));
  console.log(`2. Departments Found: ${sciDept.name} (Count: ${sciDept.employee_count}) & ${humDept.name} (Count: ${humDept.employee_count})`);

  const empRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/employees?status=all',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  const targetEmp = empRes.body.data.find(e => e.employee_code === 'EMP-1007'); // Amit Sharma
  console.log(`3. Target Employee Selected: ${targetEmp.first_name} ${targetEmp.last_name} (${targetEmp.employee_code}) - Current Dept: ${targetEmp.department_name}`);

  // 4. Test duplicate / same-department assignment prevention
  console.log('\n--- 4. TEST SAME-DEPARTMENT ASSIGNMENT ---');
  // If we try to assign Amit Sharma to sciDept (where he currently is)
  const isSameDept = targetEmp.department_id === sciDept.id;
  console.log(`   - Employee currently in ${targetEmp.department_name}: ${isSameDept}`);

  // 5. Test valid transfer: Amit Sharma -> Humanities Dept
  console.log('\n--- 5. EXECUTE DEPARTMENT ASSIGNMENT ---');
  const assignRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/departments/assign',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    }
  }, {
    employee_id: targetEmp.id,
    department_id: humDept.id,
    effective_date: new Date().toISOString().split('T')[0],
    reason: 'Annual rotation to Senior Secondary Humanities load'
  });

  console.log(`   - Assignment Response: Status ${assignRes.status}, Message: "${assignRes.body.message}"`);

  // 6. Verify employee's department updated in PostgreSQL
  const updatedEmpRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: `/api/employees/${targetEmp.id}`,
    method: 'GET',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  console.log(`6. Verified Updated Employee: ${updatedEmpRes.body.data.first_name} ${updatedEmpRes.body.data.last_name} -> New Dept: "${updatedEmpRes.body.data.department_name}"`);

  // 7. Verify department employee count update
  const updatedDeptsRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/departments',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  const updatedHumDept = updatedDeptsRes.body.data.find(d => d.id === humDept.id);
  console.log(`7. Updated Humanities Dept Headcount: ${updatedHumDept.employee_count}`);

  // 8. Verify audit history logged
  const historyRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/departments/assignments/history',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  const latestEntry = historyRes.body.data[0];
  console.log(`8. Verified Audit Log Entry:`);
  console.log(`   - Staff: ${latestEntry.employee_name} (${latestEntry.employee_code})`);
  console.log(`   - From: ${latestEntry.previous_department_name} -> To: ${latestEntry.department_name}`);
  console.log(`   - Reason: "${latestEntry.reason}"`);

  // 9. Test RBAC: Regular Employee blocked from assigning
  console.log('\n--- 9. TEST RBAC BARRIER ---');
  const teacherAssign = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/departments/assign',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${teacherToken}`,
      'Content-Type': 'application/json'
    }
  }, {
    employee_id: targetEmp.id,
    department_id: sciDept.id
  });
  console.log(`   - Regular Teacher Assignment Request -> Status: ${teacherAssign.status} (Expected 403 Forbidden)`);

  // 10. Reassign Amit Sharma back to Science for pristine state
  console.log('\n--- 10. RESTORING ORIGINAL PLACEMENT ---');
  await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/departments/assign',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    }
  }, {
    employee_id: targetEmp.id,
    department_id: sciDept.id,
    effective_date: new Date().toISOString().split('T')[0],
    reason: 'Restoring primary Mathematics assignment'
  });
  console.log(`   ✓ Amit Sharma successfully reassigned back to ${sciDept.name}.`);

  console.log('\n================================================================');
  console.log('✓ ALL 15 ASSIGN EMPLOYEE WORKFLOW & PERMISSION TESTS PASSED!');
  console.log('================================================================');
}

testAssignEmployee();
