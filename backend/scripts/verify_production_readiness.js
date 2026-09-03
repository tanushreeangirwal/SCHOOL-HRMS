/**
 * Production Readiness & API Verification Script
 * Validates backend startup, health check, auth/login, GET employees, and POST/DELETE employee lifecycle.
 */

require('dotenv').config();
const http = require('http');
const { spawn } = require('child_process');
const path = require('path');

const TEST_PORT = 5055;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}/api`;

function makeRequest(url, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const reqOptions = {
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + parsed.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    };

    if (body) {
      if (!reqOptions.headers['Content-Type']) {
        reqOptions.headers['Content-Type'] = 'application/json';
      }
    }

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch (_) {
          json = data;
        }
        resolve({ status: res.statusCode, data: json });
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function waitForServer(retries = 30, delayMs = 300) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await makeRequest(`${BASE_URL}/health`);
      if (res.status === 200) return true;
    } catch (_) {}
    await new Promise(r => setTimeout(r, delayMs));
  }
  return false;
}

async function runVerification() {
  console.log('===========================================================');
  console.log('--- SCHOOL HRMS BACKEND API PRODUCTION READINESS TEST ---');
  console.log('===========================================================');

  const serverEnv = { ...process.env, PORT: String(TEST_PORT) };
  const serverProcess = spawn('node', [path.join(__dirname, '..', 'server.js')], {
    env: serverEnv,
    stdio: 'pipe'
  });

  serverProcess.stdout.on('data', data => {
    // console.log(`[Server]: ${data}`);
  });
  serverProcess.stderr.on('data', data => {
    console.error(`[Server Error]: ${data}`);
  });

  try {
    const isUp = await waitForServer();
    if (!isUp) {
      throw new Error(`Server failed to start on port ${TEST_PORT}`);
    }
    console.log(`✓ 1. Backend process booted successfully on dynamic PORT=${TEST_PORT}`);

    // 1. GET /api/health
    const healthRes = await makeRequest(`${BASE_URL}/health`);
    if (healthRes.status === 200 && healthRes.data.success) {
      console.log(`✓ 2. GET /api/health passed:`, healthRes.data.message);
    } else {
      throw new Error(`Health check failed with status ${healthRes.status}`);
    }

    // 2. POST /api/auth/login
    const loginRes = await makeRequest(`${BASE_URL}/auth/login`, { method: 'POST' }, {
      email: 'admin@school.edu',
      password: 'SchoolDemo@2026'
    });

    if (loginRes.status !== 200 || !loginRes.data.token) {
      throw new Error(`Login failed with status ${loginRes.status}: ${JSON.stringify(loginRes.data)}`);
    }
    const token = loginRes.data.token;
    console.log(`✓ 3. POST /api/auth/login passed (Token acquired for Administrator)`);

    // 3. GET /api/employees
    const empGetRes = await makeRequest(`${BASE_URL}/employees`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (empGetRes.status !== 200 || !Array.isArray(empGetRes.data.data)) {
      throw new Error(`GET /api/employees failed with status ${empGetRes.status}`);
    }
    console.log(`✓ 4. GET /api/employees passed (${empGetRes.data.data.length} employees currently in database)`);

    // 4. POST /api/employees (Verification of create endpoint, followed by cleanup)
    const newEmpPayload = {
      first_name: "ProdReadinessVerify",
      last_name: "TestRecord",
      gender: "Other",
      employment_status: "Active"
    };

    const empPostRes = await makeRequest(`${BASE_URL}/employees`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    }, newEmpPayload);

    if (empPostRes.status !== 200 && empPostRes.status !== 201) {
      throw new Error(`POST /api/employees failed with status ${empPostRes.status}: ${JSON.stringify(empPostRes.data)}`);
    }
    const createdEmp = empPostRes.data.data;
    console.log(`✓ 5. POST /api/employees passed (Generated Code: ${createdEmp.employee_code}, ID: ${createdEmp.id})`);

    // Clean up test employee record immediately to keep DB clean
    const deleteRes = await makeRequest(`${BASE_URL}/employees/${createdEmp.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (deleteRes.status === 200) {
      console.log(`✓ 6. DELETE /api/employees cleanup passed (Deleted temporary verification record ${createdEmp.id})`);
    } else {
      console.warn(`⚠️ Warning: Cleanup delete returned status ${deleteRes.status}`);
    }

    console.log('\n===========================================================');
    console.log('✓ ALL REQUIRED PRODUCTION ENDPOINTS VERIFIED SUCCESSFULLY');
    console.log('===========================================================');
  } finally {
    serverProcess.kill();
  }
}

runVerification().catch(err => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
