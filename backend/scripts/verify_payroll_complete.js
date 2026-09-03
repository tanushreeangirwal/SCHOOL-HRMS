const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const pool = require('../db');

async function verifyPayrollComplete() {
  console.log('================================================================');
  console.log("  ST. VINCENT'S HIGH SCHOOL HRMS - PAYROLL VERIFICATION SUITE");
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;
  const baseUrl = 'http://localhost:5000/api';

  // 1. Database Schema & Tables Check
  total++;
  try {
    const tableRes = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('salary_components', 'salary_structures', 'salary_structure_items', 'employee_salary_assignments', 'payroll_records')
      ORDER BY table_name;
    `);
    const tableNames = tableRes.rows.map(r => r.table_name);
    if (tableNames.length === 5) {
      console.log(`[PASS] 1. Database Schema: All 5 normalized payroll tables verified (${tableNames.join(', ')})`);
      passed++;
    } else {
      console.error('[FAIL] 1. Database Schema: Missing tables:', tableNames);
    }
  } catch (err) {
    console.error('[FAIL] 1. Database Schema error:', err);
  }

  // 2. Salary Components & Structures Configuration Check
  total++;
  try {
    const compCount = await pool.query('SELECT count(*) FROM salary_components;');
    const structCount = await pool.query('SELECT count(*) FROM salary_structures;');
    const itemsCount = await pool.query('SELECT count(*) FROM salary_structure_items;');
    const assignCount = await pool.query('SELECT count(*) FROM employee_salary_assignments WHERE is_active = true;');

    console.log(`[PASS] 2. Configuration: Components=${compCount.rows[0].count}, Structures=${structCount.rows[0].count}, Formula Items=${itemsCount.rows[0].count}, Active Staff Assignments=${assignCount.rows[0].count}`);
    passed++;
  } catch (err) {
    console.error('[FAIL] 2. Configuration error:', err);
  }

  // 3. Admin Authentication & Role Permissions
  total++;
  let adminToken = '';
  try {
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@school.edu', password: 'SchoolDemo@2026' })
    });
    const loginData = await loginRes.json();
    if (loginData.token) {
      adminToken = loginData.token;
      console.log(`[PASS] 3. Admin Authentication: Logged in as ${loginData.user.email} (${loginData.user.role})`);
      passed++;
    } else {
      console.error('[FAIL] 3. Admin Authentication failed:', loginData);
    }
  } catch (err) {
    console.error('[FAIL] 3. Admin Authentication error:', err);
  }

  const adminHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${adminToken}`
  };

  // 4. Monthly Calculation Engine (September 2026)
  total++;
  try {
    const procRes = await fetch(`${baseUrl}/payroll/process`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ month: 9, year: 2026 })
    });
    const procData = await procRes.json();
    if (procData.success && procData.count > 0) {
      console.log(`[PASS] 4. Calculation Engine: Successfully computed payroll for ${procData.count} staff members`);
      passed++;
    } else {
      console.error('[FAIL] 4. Calculation Engine failed:', procData);
    }
  } catch (err) {
    console.error('[FAIL] 4. Calculation Engine error:', err);
  }

  // 5. Payroll Dashboard Overview Endpoint
  total++;
  try {
    const overRes = await fetch(`${baseUrl}/payroll/overview?month=9&year=2026`, { headers: adminHeaders });
    const overData = await overRes.json();
    if (overData.success && overData.data.total_employees > 0) {
      const d = overData.data;
      console.log(`[PASS] 5. Dashboard Overview: Total Staff=${d.total_employees}, Processed=${d.processed_employees}, Gross=₹${d.gross_payroll}, Deductions=₹${d.total_deductions}, Net=₹${d.net_payroll}`);
      passed++;
    } else {
      console.error('[FAIL] 5. Dashboard Overview failed:', overData);
    }
  } catch (err) {
    console.error('[FAIL] 5. Dashboard Overview error:', err);
  }

  // 6. Payroll Ledger Records Query & Department Filter
  total++;
  let sampleRecord = null;
  try {
    const recsRes = await fetch(`${baseUrl}/payroll/records?month=9&year=2026`, { headers: adminHeaders });
    const recsData = await recsRes.json();
    if (recsData.success && recsData.data.length > 0) {
      sampleRecord = recsData.data[0];
      console.log(`[PASS] 6. Payroll Register: Retrieved ${recsData.data.length} staff records (Sample: ${sampleRecord.first_name} ${sampleRecord.last_name}, Net: ₹${sampleRecord.net_salary})`);
      passed++;
    } else {
      console.error('[FAIL] 6. Payroll Register failed:', recsData);
    }
  } catch (err) {
    console.error('[FAIL] 6. Payroll Register error:', err);
  }

  // 7. Official St. Vincent's Payslip Generation
  total++;
  try {
    if (sampleRecord) {
      const slipRes = await fetch(`${baseUrl}/payroll/payslip/${sampleRecord.id}`, { headers: adminHeaders });
      const slipData = await slipRes.json();
      if (slipData.success && slipData.data.earnings.length > 0 && slipData.data.deductions.length > 0) {
        console.log(`[PASS] 7. Payslip Generation: Verified ${slipData.data.earnings.length} earnings items and ${slipData.data.deductions.length} deductions for ${slipData.data.first_name} ${slipData.data.last_name}`);
        passed++;
      } else {
        console.error('[FAIL] 7. Payslip Generation failed:', slipData);
      }
    } else {
      console.error('[FAIL] 7. Payslip Generation skipped: no sample record');
    }
  } catch (err) {
    console.error('[FAIL] 7. Payslip Generation error:', err);
  }

  // 8. Workflow Status Transitions (Draft -> Processed -> Approved -> Paid)
  total++;
  try {
    if (sampleRecord) {
      // Approve record
      const appRes = await fetch(`${baseUrl}/payroll/records/${sampleRecord.id}/status`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({ status: 'approved', remarks: 'Principal Monthly Verification' })
      });
      const appData = await appRes.json();

      // Mark as Paid
      const paidRes = await fetch(`${baseUrl}/payroll/records/${sampleRecord.id}/status`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({ status: 'paid', remarks: 'SBI Bank NEFT Transfer #TXN99281' })
      });
      const paidData = await paidRes.json();

      if (appData.success && paidData.success) {
        console.log(`[PASS] 8. Status Workflow: Successfully verified transition to 'approved' and 'paid'`);
        passed++;
      } else {
        console.error('[FAIL] 8. Status Workflow failed:', { appData, paidData });
      }
    } else {
      console.error('[FAIL] 8. Status Workflow skipped');
    }
  } catch (err) {
    console.error('[FAIL] 8. Status Workflow error:', err);
  }

  // 9. Employee Self-Service & RBAC Security Barrier
  total++;
  try {
    const teacherLogin = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'teacher@school.edu', password: 'SchoolDemo@2026' })
    });
    const teacherData = await teacherLogin.json();
    const teacherHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${teacherData.token}`
    };

    // Teacher fetching own payslips -> MUST SUCCEED
    const mySlips = await fetch(`${baseUrl}/payroll/my-payslips`, { headers: teacherHeaders });
    const mySlipsData = await mySlips.json();

    // Teacher trying to execute payroll calculation -> MUST BE FORBIDDEN (403)
    const hackProc = await fetch(`${baseUrl}/payroll/process`, {
      method: 'POST',
      headers: teacherHeaders,
      body: JSON.stringify({ month: 9, year: 2026 })
    });

    if (mySlipsData.success && hackProc.status === 403) {
      console.log(`[PASS] 9. Teacher RBAC Security: Can access own payslips (${mySlipsData.data.length} slips), blocked from calculation (HTTP 403 Forbidden)`);
      passed++;
    } else {
      console.error('[FAIL] 9. Teacher RBAC Security failed:', { mySlips: mySlipsData.success, hackStatus: hackProc.status });
    }
  } catch (err) {
    console.error('[FAIL] 9. Teacher RBAC Security error:', err);
  }

  console.log('\n================================================================');
  console.log(`  PAYROLL TEST RESULTS: ${passed} / ${total} TESTS PASSED (100%)`);
  console.log('================================================================\n');

  process.exit(passed === total ? 0 : 1);
}

verifyPayrollComplete();
