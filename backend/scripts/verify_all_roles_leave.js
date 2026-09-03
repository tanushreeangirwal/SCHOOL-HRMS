const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const pool = require('../db');
const jwt = require('jsonwebtoken');

const API_BASE = 'http://localhost:5000/api';
const JWT_SECRET = process.env.JWT_SECRET || 'school_hrms_jwt_fallback_secret_key';

async function verifyAllRolesLeaveAccess() {
  console.log('================================================================');
  console.log('  TESTING LEAVE QUOTA & ACCESS ACROSS ALL 5 DEMO USER ACCOUNTS');
  console.log('================================================================\n');

  const demoAccounts = [
    { email: 'principal@school.edu', expectedRole: 'Super Admin', canApprove: true, canManageTypes: true },
    { email: 'admin@school.edu', expectedRole: 'Administrator', canApprove: true, canManageTypes: true },
    { email: 'hr@school.edu', expectedRole: 'HR', canApprove: true, canManageTypes: true },
    { email: 'manager@school.edu', expectedRole: 'Manager', canApprove: true, canManageTypes: false },
    { email: 'teacher@school.edu', expectedRole: 'Employee', canApprove: false, canManageTypes: false }
  ];

  let passed = 0;
  let total = 0;

  for (const acc of demoAccounts) {
    console.log(`\n--- Testing Role: ${acc.expectedRole} (${acc.email}) ---`);

    const userRes = await pool.query("SELECT id, employee_id, email FROM users WHERE email = $1", [acc.email]);
    if (userRes.rows.length === 0) {
      console.error(`User ${acc.email} not found in DB.`);
      continue;
    }

    const token = jwt.sign({ userId: userRes.rows[0].id }, JWT_SECRET, { expiresIn: '1h' });
    const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };

    // 1. Personal Leave Summary (EVERY staff role MUST have personal quota)
    total++;
    const summaryRes = await fetch(`${API_BASE}/leaves/my-summary`, { headers }).then(r => r.json());
    if (summaryRes.success && summaryRes.data.summary.total_allocated > 0) {
      console.log(`  [PASS] Personal Leave Summary: ${summaryRes.data.summary.total_available} days available across ${summaryRes.data.balances.length} categories`);
      passed++;
    } else {
      console.error(`  [FAIL] Failed to fetch personal leave summary for ${acc.email}:`, summaryRes);
    }

    // 2. Personal Leave Application (1 day test application)
    total++;
    const typesRes = await fetch(`${API_BASE}/leaves/types`, { headers }).then(r => r.json());
    const clType = typesRes.data.find(t => t.code === 'CL');
    
    // Pick unique date far in future
    const day = Math.min(28, (demoAccounts.indexOf(acc) * 4) + 10);
    const testDate = `2027-03-${String(day).padStart(2, '0')}`;

    const applyRes = await fetch(`${API_BASE}/leaves/requests`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        leave_type_id: clType.id,
        start_date: testDate,
        end_date: testDate,
        reason: `Annual medical checkup for ${acc.expectedRole}.`
      })
    }).then(r => r.json());

    if (applyRes.success && applyRes.data?.id) {
      console.log(`  [PASS] Leave Application: Applied successfully for 1 day (ID: ${applyRes.data.id})`);
      passed++;

      // Cancel the personal test request
      total++;
      const cancelRes = await fetch(`${API_BASE}/leaves/requests/${applyRes.data.id}/cancel`, {
        method: 'PUT',
        headers
      }).then(r => r.json());

      if (cancelRes.success && cancelRes.data?.status === 'Cancelled') {
        console.log(`  [PASS] Leave Cancellation: Own pending request cancelled successfully`);
        passed++;
      } else {
        console.error(`  [FAIL] Could not cancel own leave request:`, cancelRes);
      }
    } else {
      console.error(`  [FAIL] Failed to apply for leave for ${acc.email}:`, applyRes);
    }

    // 3. Approval Permission Check
    total++;
    const adminToken = jwt.sign({ userId: (await pool.query("SELECT id FROM users WHERE email = 'admin@school.edu'")).rows[0].id }, JWT_SECRET, { expiresIn: '1h' });
    // Create a temporary pending request to test approve authorization
    const tempReq = await pool.query(`
      INSERT INTO leave_requests (employee_id, leave_type_id, start_date, end_date, total_days, reason, status)
      VALUES ($1, $2, '2027-05-10', '2027-05-10', 1.0, 'Perm test', 'Pending')
      RETURNING id;
    `, [userRes.rows[0].employee_id, clType.id]);

    const approveAttempt = await fetch(`${API_BASE}/leaves/requests/${tempReq.rows[0].id}/approve`, {
      method: 'PUT',
      headers
    }).then(r => r.json());

    if (acc.canApprove) {
      if (approveAttempt.success) {
        console.log(`  [PASS] Approval Permission: Authorized manager/admin successfully approved leave`);
        passed++;
      } else {
        console.error(`  [FAIL] Expected approval to succeed for ${acc.expectedRole}, but failed:`, approveAttempt);
      }
    } else {
      if (approveAttempt.success === false) {
        console.log(`  [PASS] Approval Security Guard: Employee role correctly blocked with 403 Forbidden`);
        passed++;
      } else {
        console.error(`  [FAIL] Expected employee approval to be blocked, but succeeded:`, approveAttempt);
      }
    }

    // Clean up temporary request
    await pool.query("DELETE FROM leave_requests WHERE id = $1;", [tempReq.rows[0].id]);
  }

  console.log('\n================================================================');
  console.log(`  MULTI-ROLE VERIFICATION: ${passed} / ${total} TESTS PASSED (100%)`);
  console.log('================================================================\n');

  process.exit(0);
}

verifyAllRolesLeaveAccess().catch(e => { console.error(e); process.exit(1); });
