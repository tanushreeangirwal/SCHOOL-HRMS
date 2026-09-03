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

async function testShifts() {
  try {
    // 1. Health
    const health = await makeRequest({ hostname: 'localhost', port: 5000, path: '/api/health', method: 'GET' });
    console.log('Health Check:', health.body);

    // 2. Login
    const login = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { email: 'admin@school.edu', password: 'SchoolDemo@2026' });

    const token = login.body.token;
    console.log('Login successful. Role:', login.body.user.role);

    // 3. GET /api/shifts
    const shiftsRes = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/shifts',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log('\nGET /api/shifts Count:', shiftsRes.body.count);
    console.log('First shift:', shiftsRes.body.data[0]);

    // 4. GET /api/shifts/stats
    const statsRes = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/shifts/stats',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log('\nGET /api/shifts/stats:', statsRes.body.data);

    // 5. GET /api/shifts/assignments/history
    const historyRes = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/shifts/assignments/history',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log('\nGET /api/shifts/assignments/history Count:', historyRes.body.count);
    console.log('First history log:', historyRes.body.data[0]);

  } catch (err) {
    console.error('Test error:', err);
  }
}

testShifts();
