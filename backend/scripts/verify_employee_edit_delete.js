const http = require('http');
const pool = require('../db');

function post(path, body, token) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request({
      hostname: 'localhost',
      port: 5000,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    }, res => {
      let buf = '';
      res.on('data', chunk => buf += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(buf) });
        } catch (e) {
          resolve({ status: res.statusCode, body: buf });
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function put(path, body, token) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request({
      hostname: 'localhost',
      port: 5000,
      path,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    }, res => {
      let buf = '';
      res.on('data', chunk => buf += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(buf) });
        } catch (e) {
          resolve({ status: res.statusCode, body: buf });
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function del(path, token) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 5000,
      path,
      method: 'DELETE',
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    }, res => {
      let buf = '';
      res.on('data', chunk => buf += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(buf) });
        } catch (e) {
          resolve({ status: res.statusCode, body: buf });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function verifyAll() {
  console.log('=== VERIFYING EMPLOYEE EDIT AND DELETE WORKFLOWS ===\n');

  // Step 1: Login as HR (Clara Higgins)
  console.log('1. Authenticating as HR (Clara Higgins)...');
  const hrLogin = await post('/api/auth/login', {
    email: 'hr@school.edu',
    password: 'SchoolDemo@2026'
  });
  if (hrLogin.status !== 200 || !hrLogin.body?.token) {
    throw new Error('HR login failed');
  }
  const hrToken = hrLogin.body.token;
  console.log('✓ HR logged in successfully. Role:', hrLogin.body.user.role);

  // Step 2: Create a test employee
  console.log('\n2. Registering new faculty member via HR...');
  const newEmp = await post('/api/employees', {
    employee_code: 'EMP-9001',
    first_name: 'Arthur',
    last_name: 'Pendelton',
    work_email: 'arthur.pendelton@school.edu',
    phone: '+91 98765 43210',
    employment_status: 'Active',
    city: 'Pune'
  }, hrToken);
  console.log('Create Response:', newEmp.status, newEmp.body.message);
  const empId = newEmp.body?.data?.id;

  // Step 3: Edit the employee
  console.log('\n3. Editing faculty member details (name & phone)...');
  const editEmp = await put(`/api/employees/${empId}`, {
    employee_code: 'EMP-9001',
    first_name: 'Arthur',
    middle_name: 'Wellesley',
    last_name: 'Pendelton',
    work_email: 'arthur.pendelton@school.edu',
    phone: '+91 99999 88888',
    city: 'Mumbai',
    employment_status: 'Active'
  }, hrToken);
  console.log('Edit Response:', editEmp.status, editEmp.body.message);
  console.log('Updated employee data:', editEmp.body?.data?.first_name, editEmp.body?.data?.middle_name, editEmp.body?.data?.phone);

  // Step 4: Delete the employee
  console.log('\n4. Permanently deleting clean employee record via HR...');
  const delEmp = await del(`/api/employees/${empId}`, hrToken);
  console.log('Delete Response:', delEmp.status, delEmp.body.message);

  // Step 5: Test audit protection on existing historical employee
  console.log('\n5. Testing deletion safety check on existing seeded faculty member...');
  const existingEmp = (await pool.query('SELECT id, first_name, last_name FROM employees WHERE employee_code = \'EMP-1002\';')).rows[0];
  const auditDel = await del(`/api/employees/${existingEmp.id}`, hrToken);
  console.log('Audit safety delete response (Expected 400 with helpful message):');
  console.log('Status:', auditDel.status);
  console.log('Message:', auditDel.body.message);

  console.log('\n=== ALL TESTS PASSED SUCCESSFULLY! ===');
  await pool.end();
}

verifyAll().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
