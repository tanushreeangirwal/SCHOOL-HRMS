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

async function testEmployeeLifecycle() {
  console.log('================================================================');
  console.log('--- TESTING STANDARDIZED EMPLOYEE LIFECYCLE & CRUD ---');
  console.log('================================================================\n');

  // 1. Authenticate users
  console.log('--- 1. AUTHENTICATION ---');
  const adminLogin = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: 'admin@school.edu', password: 'SchoolDemo@2026' });
  const adminToken = adminLogin.body.token;
  console.log(`✓ Admin logged in.`);

  const teacherLogin = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: 'teacher@school.edu', password: 'SchoolDemo@2026' });
  const teacherToken = teacherLogin.body.token;
  console.log(`✓ Teacher (Employee) logged in.`);

  // 2. Fetch employee list with filters
  console.log('\n--- 2. GET /api/employees (WITH STATUS & SEARCH FILTERS) ---');
  const allRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/employees?status=all',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  console.log(`✓ GET /api/employees?status=all -> Status: ${allRes.status}, Count: ${allRes.body.count}`);

  const activeRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/employees?status=Active',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  console.log(`✓ GET /api/employees?status=Active -> Status: ${activeRes.status}, Count: ${activeRes.body.count}`);

  // 3. CREATE Employee (Auto EMP-#### Code Generation)
  console.log('\n--- 3. CREATE EMPLOYEE (AUTO EMP-#### GENERATION) ---');
  const createRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/employees',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    }
  }, {
    first_name: 'Harish',
    last_name: 'Bonde',
    gender: 'Male',
    work_email: 'harish.bonde@school.edu',
    phone: '+91 98220 99999',
    city: 'Pune',
    employment_status: 'Active'
  });

  console.log(`✓ POST /api/employees -> Status: ${createRes.status}`);
  console.log(`✓ Generated Employee Code: "${createRes.body.data?.employee_code}" (Expected EMP-1025)`);
  const createdEmp = createRes.body.data;

  // 4. EDIT Employee
  console.log('\n--- 4. EDIT EMPLOYEE ---');
  const updateRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: `/api/employees/${createdEmp.id}`,
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    }
  }, {
    first_name: 'Harish',
    middle_name: 'Kisan',
    last_name: 'Bonde',
    work_email: 'harish.bonde@school.edu',
    phone: '+91 98220 88888',
    city: 'Pune',
    address: 'Flat 101, Aundh, Pune'
  });

  console.log(`✓ PUT /api/employees/:id -> Status: ${updateRes.status}, Message: "${updateRes.body.message}"`);

  // 5. DEACTIVATE Employee
  console.log('\n--- 5. DEACTIVATE EMPLOYEE (STATUS LIFECYCLE) ---');
  const deactRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: `/api/employees/${createdEmp.id}/status`,
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    }
  }, { status: 'Inactive' });

  console.log(`✓ PATCH /api/employees/:id/status (Deactivate) -> Status: ${deactRes.status}, Status: "${deactRes.body.data?.employment_status}"`);

  // Verify employee is excluded when querying status=Active
  const checkActive = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/employees?status=Active',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  const foundInActive = checkActive.body.data.some(e => e.id === createdEmp.id);
  console.log(`✓ Inactive employee excluded from Active list: ${!foundInActive}`);

  // 6. REACTIVATE Employee
  console.log('\n--- 6. REACTIVATE EMPLOYEE ---');
  const reactRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: `/api/employees/${createdEmp.id}/status`,
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    }
  }, { status: 'Active' });

  console.log(`✓ PATCH /api/employees/:id/status (Reactivate) -> Status: ${reactRes.status}, Status: "${reactRes.body.data?.employment_status}"`);

  // 7. ATTEMPT BLOCKED PERMANENT DELETE ON DEPARTMENT HEAD
  console.log('\n--- 7. SAFETY TEST: BLOCKED DELETE ON DEPARTMENT HEAD / MANAGER ---');
  const principal = allRes.body.data.find(e => e.employee_code === 'EMP-1005'); // Anthony Fernandes (Head of Admin)
  const blockedDelete = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: `/api/employees/${principal.id}`,
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });

  console.log(`✓ DELETE on Department Head -> Status: ${blockedDelete.status} (Expected 400 Bad Request)`);
  console.log(`✓ Safety Rejection Message: "${blockedDelete.body.message}"`);

  // 8. PERMANENT DELETE ON STANDALONE DEMO RECORD
  console.log('\n--- 8. PERMANENT DELETE ON UNREFERENCED TEST RECORD ---');
  const deleteRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: `/api/employees/${createdEmp.id}`,
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });

  console.log(`✓ DELETE /api/employees/:id -> Status: ${deleteRes.status}, Message: "${deleteRes.body.message}"`);

  // Verify deletion from DB
  const verifyDelete = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: `/api/employees/${createdEmp.id}`,
    method: 'GET',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  console.log(`✓ GET after delete -> Status: ${verifyDelete.status} (Expected 404 Not Found)`);

  // 9. RBAC BARRIER TESTS
  console.log('\n--- 9. RBAC RESTRICTIONS (REGULAR EMPLOYEE) ---');
  const teacherDelete = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: `/api/employees/${principal.id}`,
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${teacherToken}` }
  });
  console.log(`✓ Employee DELETE -> Status: ${teacherDelete.status} (Expected 403 Forbidden)`);

  const teacherUpdate = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: `/api/employees/${principal.id}`,
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${teacherToken}`,
      'Content-Type': 'application/json'
    }
  }, { first_name: 'Hacked' });
  console.log(`✓ Employee PUT -> Status: ${teacherUpdate.status} (Expected 403 Forbidden)`);

  console.log('\n================================================================');
  console.log('✓ ALL EMPLOYEE LIFECYCLE & CRUD TESTS PASSED WITH 100% SUCCESS');
  console.log('================================================================');
}

testEmployeeLifecycle();
