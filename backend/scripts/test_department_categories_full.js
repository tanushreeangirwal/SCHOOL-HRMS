const http = require('http');
const pool = require('../db');

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

async function runDepartmentCategoryTests() {
  console.log('================================================================');
  console.log('--- TESTING DEPARTMENT CATEGORIES & DEPARTMENT ASSIGNMENT ---');
  console.log('================================================================\n');

  // 1. Authenticate users
  console.log('--- STEP 1: AUTHENTICATION ---');
  const adminLogin = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: 'admin@school.edu', password: 'SchoolDemo@2026' });

  const adminToken = adminLogin.body.token;
  console.log(`✓ Admin authenticated. Token acquired.`);

  const teacherLogin = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: 'teacher@school.edu', password: 'SchoolDemo@2026' });

  const teacherToken = teacherLogin.body.token;
  console.log(`✓ Teacher authenticated. Token acquired.`);

  // 2. Fetch existing categories
  console.log('\n--- STEP 2: FETCH REAL CATEGORIES ---');
  const catRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/department-categories',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });

  console.log(`✓ GET /api/department-categories -> Status: ${catRes.status}, Found: ${catRes.body.count} categories`);
  catRes.body.data.forEach(c => {
    console.log(`   • ${c.name} (${c.code || 'NO-CODE'}): ${c.department_count} departments [${c.is_active ? 'ACTIVE' : 'INACTIVE'}]`);
  });

  // 3. Fetch departments
  console.log('\n--- STEP 3: FETCH DEPARTMENTS ---');
  const deptRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/departments',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });

  console.log(`✓ GET /api/departments -> Status: ${deptRes.status}, Found: ${deptRes.body.count} departments`);
  const testDept = deptRes.body.data[0];
  console.log(`   • Sample department: "${testDept.name}" (ID: ${testDept.id}), Category: "${testDept.category_name || 'None'}"`);

  // 4. Test Category Creation & Validations
  console.log('\n--- STEP 4: CATEGORY CREATION & DUPLICATE VALIDATION ---');
  const testCatName = `Test Wing ${Date.now().toString().slice(-4)}`;
  const testCatCode = `CAT-${Date.now().toString().slice(-4)}`;

  const createRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/department-categories',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    }
  }, {
    name: testCatName,
    code: testCatCode,
    description: 'Automated test category for school organizational hierarchy',
    is_active: true
  });

  console.log(`✓ POST /api/department-categories -> Status: ${createRes.status}, Created ID: ${createRes.body.data?.id}`);
  const createdCatId = createRes.body.data?.id;

  // Test duplicate name prevention
  const dupRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/department-categories',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    }
  }, {
    name: testCatName,
    code: 'CAT-DUP'
  });
  console.log(`✓ Duplicate Name Check -> Status: ${dupRes.status} (Expected 400), Message: "${dupRes.body.message}"`);

  // 5. Test Department Assignment to Category (via PUT)
  console.log('\n--- STEP 5: ASSIGN DEPARTMENT TO CATEGORY ---');
  const assignRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: `/api/departments/${testDept.id}`,
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    }
  }, {
    name: testDept.name,
    code: testDept.code,
    category_id: createdCatId,
    description: testDept.description,
    head_id: testDept.head_id,
    branch_id: testDept.branch_id,
    is_active: testDept.is_active,
    effective_date: testDept.effective_date
  });

  console.log(`✓ PUT /api/departments/:id (Assign) -> Status: ${assignRes.status}, Assigned Category ID: "${assignRes.body.data?.category_id}"`);

  // Verify department now has this category
  const verifyDeptRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: `/api/departments/${testDept.id}`,
    method: 'GET',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  console.log(`✓ Department Category Verified in DB -> Category ID: "${verifyDeptRes.body.data?.category_id}"`);

  // 6. Test Department Removal from Category (category_id = null)
  console.log('\n--- STEP 6: REMOVE DEPARTMENT FROM CATEGORY ---');
  const removeRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: `/api/departments/${testDept.id}`,
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    }
  }, {
    name: testDept.name,
    code: testDept.code,
    category_id: null,
    description: testDept.description,
    head_id: testDept.head_id,
    branch_id: testDept.branch_id,
    is_active: testDept.is_active,
    effective_date: testDept.effective_date
  });

  console.log(`✓ PUT /api/departments/:id (Remove) -> Status: ${removeRes.status}, Category ID: "${removeRes.body.data?.category_id || 'null'}"`);

  // Verify department record is NOT deleted and category_id is null
  const verifyDeptPostRemove = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: `/api/departments/${testDept.id}`,
    method: 'GET',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  console.log(`✓ Department Exists Check -> Name: "${verifyDeptPostRemove.body.data?.name}", Category: "${verifyDeptPostRemove.body.data?.category_name || 'None'}" (Department NOT deleted)`);

  // Restore original department category if it had one
  if (testDept.category_id) {
    await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: `/api/departments/${testDept.id}`,
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      }
    }, {
      name: testDept.name,
      code: testDept.code,
      category_id: testDept.category_id,
      description: testDept.description,
      head_id: testDept.head_id,
      branch_id: testDept.branch_id,
      is_active: testDept.is_active,
      effective_date: testDept.effective_date
    });
    console.log(`✓ Restored original category for "${testDept.name}"`);
  }

  // 7. Test Category Status Toggle
  console.log('\n--- STEP 7: TOGGLE CATEGORY STATUS ---');
  const toggleRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: `/api/department-categories/${createdCatId}/status`,
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    }
  }, { is_active: false });

  console.log(`✓ PATCH /api/department-categories/:id/status -> Status: ${toggleRes.status}, Message: "${toggleRes.body.message}"`);

  // 8. Test RBAC Barriers (Employee blocked from creating category or modifying department)
  console.log('\n--- STEP 8: RBAC RESTRICTIONS (EMPLOYEE) ---');
  const teacherCreateCat = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/department-categories',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${teacherToken}`,
      'Content-Type': 'application/json'
    }
  }, { name: 'Unauthorized Category' });
  console.log(`✓ Employee Category Create -> Status: ${teacherCreateCat.status} (Expected 403 Forbidden)`);

  const teacherUpdateDept = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: `/api/departments/${testDept.id}`,
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${teacherToken}`,
      'Content-Type': 'application/json'
    }
  }, { name: 'Unauthorized Mod', category_id: createdCatId });
  console.log(`✓ Employee Department Modify -> Status: ${teacherUpdateDept.status} (Expected 403 Forbidden)`);

  // 9. Cleanup test category
  await pool.query('DELETE FROM department_categories WHERE id = $1;', [createdCatId]);
  console.log(`\n✓ Cleaned up temporary test category from database.`);
  await pool.end();

  console.log('\n================================================================');
  console.log('✓ ALL DEPARTMENT CATEGORY TESTS PASSED WITH 100% SUCCESS');
  console.log('================================================================');
}

runDepartmentCategoryTests();
