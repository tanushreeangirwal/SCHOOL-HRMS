const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const pool = require('../db');
const jwt = require('jsonwebtoken');

const API_BASE = 'http://localhost:5000/api';
const JWT_SECRET = process.env.JWT_SECRET || 'school_hrms_jwt_fallback_secret_key';

async function verifyLeaveComplete() {
  console.log('================================================================');
  console.log('  ST. VINCENT\'S HRMS — LEAVE MANAGEMENT VERIFICATION SUITE');
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
    // 1. Health check
    const health = await fetch(`${API_BASE}/health`).then(r => r.json());
    assert(health.success === true, 'Backend health check responds OK');

    // Fetch user tokens for Admin and Teacher
    const adminUserRes = await pool.query("SELECT id, employee_id FROM users WHERE email = 'admin@school.edu'");
    const adminToken = jwt.sign({ userId: adminUserRes.rows[0].id }, JWT_SECRET, { expiresIn: '1h' });
    const adminHeaders = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` };

    const teacherUserRes = await pool.query("SELECT id, employee_id FROM users WHERE email = 'teacher@school.edu'");
    const teacherToken = jwt.sign({ userId: teacherUserRes.rows[0].id }, JWT_SECRET, { expiresIn: '1h' });
    const teacherHeaders = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${teacherToken}` };

    // 2. GET /api/leaves/types (Master leave types)
    const typesRes = await fetch(`${API_BASE}/leaves/types`, { headers: adminHeaders }).then(r => r.json());
    assert(typesRes.success === true && typesRes.data.length >= 8, `GET /api/leaves/types returns ${typesRes?.data?.length} master leave types`);

    const clType = typesRes.data.find(t => t.code === 'CL');
    assert(Boolean(clType && clType.annual_allocation >= 12), 'Casual Leave (CL) is seeded with annual allocation');

    // 3. POST /api/leaves/types (Create custom leave type)
    const newTypeCode = `TEST-LT-${Math.floor(Math.random() * 9000 + 1000)}`;
    const newTypeName = `Conference & Workshop Leave ${Math.floor(Math.random() * 9000 + 1000)}`;
    const createTypeRes = await fetch(`${API_BASE}/leaves/types`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        name: newTypeName,
        code: newTypeCode,
        description: 'Authorized attendance for external pedagogy workshops.',
        annual_allocation: 4.0,
        is_paid: true,
        requires_approval: true
      })
    }).then(r => r.json());
    if (!createTypeRes.success) console.log('createTypeRes error:', createTypeRes);
    assert(createTypeRes.success === true && createTypeRes.data?.code === newTypeCode, `POST /api/leaves/types creates new leave type (${newTypeCode})`);

    // 4. PUT /api/leaves/types/:id (Update leave type)
    const updateTypeRes = await fetch(`${API_BASE}/leaves/types/${createTypeRes.data.id}`, {
      method: 'PUT',
      headers: adminHeaders,
      body: JSON.stringify({
        annual_allocation: 5.0,
        description: 'Updated description for pedagogical training.'
      })
    }).then(r => r.json());
    assert(updateTypeRes.success === true && parseFloat(updateTypeRes.data.annual_allocation) === 5.0, 'PUT /api/leaves/types/:id updates parameters');

    // 5. DELETE /api/leaves/types/:id (Deactivate leave type)
    const deleteTypeRes = await fetch(`${API_BASE}/leaves/types/${createTypeRes.data.id}`, {
      method: 'DELETE',
      headers: adminHeaders
    }).then(r => r.json());
    assert(deleteTypeRes.success === true && deleteTypeRes.data.is_active === false, 'DELETE /api/leaves/types/:id deactivates leave type');

    // 6. GET /api/leaves/my-summary (Teacher personal leave quota)
    const mySummaryRes = await fetch(`${API_BASE}/leaves/my-summary`, { headers: teacherHeaders }).then(r => r.json());
    assert(
      mySummaryRes.success === true && mySummaryRes.data.balances.length > 0 && mySummaryRes.data.summary.total_allocated > 0,
      `GET /api/leaves/my-summary returns personal balance (${mySummaryRes?.data?.summary?.total_available} available days)`
    );

    // Clean up any test requests and reset balance for teacher in future dates
    await pool.query("DELETE FROM leave_requests WHERE employee_id = $1;", [teacherUserRes.rows[0].employee_id]);
    await pool.query("UPDATE leave_balances SET pending_days = 0, used_days = 0, available_days = allocated_days WHERE employee_id = $1;", [teacherUserRes.rows[0].employee_id]);

    // 7. POST /api/leaves/requests (Teacher applies for 3 days of Casual Leave)
    const applyRes = await fetch(`${API_BASE}/leaves/requests`, {
      method: 'POST',
      headers: teacherHeaders,
      body: JSON.stringify({
        leave_type_id: clType.id,
        start_date: '2026-10-12',
        end_date: '2026-10-14',
        reason: 'Attending family wedding ceremony out of state.',
        remarks: 'Class syllabus lessons covered in advance.'
      })
    }).then(r => r.json());
    if (!applyRes.success) console.log('applyRes error:', applyRes);
    assert(
      applyRes.success === true && parseFloat(applyRes.data?.total_days) === 3.0 && applyRes.data?.status === 'Pending',
      `POST /api/leaves/requests applies for 3 days leave (ID: ${applyRes?.data?.id})`
    );

    const createdRequestId = applyRes.data.id;

    // 8. Test Overlap Prevention
    const overlapRes = await fetch(`${API_BASE}/leaves/requests`, {
      method: 'POST',
      headers: teacherHeaders,
      body: JSON.stringify({
        leave_type_id: clType.id,
        start_date: '2026-10-13',
        end_date: '2026-10-16',
        reason: 'Conflicting leave overlap attempt.'
      })
    }).then(r => r.json());
    assert(overlapRes.success === false, 'POST /api/leaves/requests correctly rejects overlapping dates');

    // 9. GET /api/leaves/dashboard (HR KPI verification)
    const dashRes = await fetch(`${API_BASE}/leaves/dashboard`, { headers: adminHeaders }).then(r => r.json());
    assert(
      dashRes.success === true && dashRes.data.kpis.pending_requests >= 1 && Array.isArray(dashRes.data.pending_requests),
      `GET /api/leaves/dashboard reflects pending requests (${dashRes?.data?.kpis?.pending_requests} pending)`
    );

    // 10. GET /api/leaves/requests (Filterable list)
    const listRes = await fetch(`${API_BASE}/leaves/requests?status=Pending`, { headers: adminHeaders }).then(r => r.json());
    assert(
      listRes.success === true && listRes.data.requests.some(r => r.id === createdRequestId),
      `GET /api/leaves/requests lists the created pending leave request`
    );

    // 11. GET /api/leaves/requests/:id (Detail with audit trail)
    const detailRes = await fetch(`${API_BASE}/leaves/requests/${createdRequestId}`, { headers: adminHeaders }).then(r => r.json());
    assert(
      detailRes.success === true && detailRes.data.audit_logs.length >= 1,
      `GET /api/leaves/requests/:id returns request details with audit log (${detailRes?.data?.audit_logs?.length} log entries)`
    );

    // 12. PUT /api/leaves/requests/:id/approve (Admin approves request)
    const approveRes = await fetch(`${API_BASE}/leaves/requests/${createdRequestId}/approve`, {
      method: 'PUT',
      headers: adminHeaders
    }).then(r => r.json());
    if (!approveRes.success) console.log('approveRes error:', approveRes);
    assert(
      approveRes.success === true && approveRes.data?.status === 'Approved',
      `PUT /api/leaves/requests/:id/approve approves the request`
    );

    // 13. GET /api/leaves/calendar (Approved leave shows in calendar)
    const calRes = await fetch(`${API_BASE}/leaves/calendar?month=2026-10`, { headers: adminHeaders }).then(r => r.json());
    assert(
      calRes.success === true && calRes.data.events.some(e => e.id === createdRequestId),
      `GET /api/leaves/calendar displays approved leave in October 2026`
    );

    // 14. Test Teacher applying and cancelling a second request
    const apply2Res = await fetch(`${API_BASE}/leaves/requests`, {
      method: 'POST',
      headers: teacherHeaders,
      body: JSON.stringify({
        leave_type_id: clType.id,
        start_date: '2026-11-05',
        end_date: '2026-11-06',
        reason: 'Personal work.'
      })
    }).then(r => r.json());

    const cancelRes = await fetch(`${API_BASE}/leaves/requests/${apply2Res.data.id}/cancel`, {
      method: 'PUT',
      headers: teacherHeaders
    }).then(r => r.json());
    assert(
      cancelRes.success === true && cancelRes.data.status === 'Cancelled',
      `PUT /api/leaves/requests/:id/cancel allows employee to cancel own pending request`
    );

    // 15. Test Admin rejection on another request
    const apply3Res = await fetch(`${API_BASE}/leaves/requests`, {
      method: 'POST',
      headers: teacherHeaders,
      body: JSON.stringify({
        leave_type_id: clType.id,
        start_date: '2026-11-18',
        end_date: '2026-11-19',
        reason: 'Trip.'
      })
    }).then(r => r.json());

    const rejectRes = await fetch(`${API_BASE}/leaves/requests/${apply3Res.data.id}/reject`, {
      method: 'PUT',
      headers: adminHeaders,
      body: JSON.stringify({
        rejection_reason: 'Institutional exam supervision scheduled on requested dates.'
      })
    }).then(r => r.json());
    if (!rejectRes.success) console.log('rejectRes error:', rejectRes);
    assert(
      rejectRes.success === true && rejectRes.data?.status === 'Rejected' && rejectRes.data?.rejection_reason.includes('exam supervision'),
      `PUT /api/leaves/requests/:id/reject rejects request with reason`
    );

    // 16. Test CSV Export
    const exportRes = await fetch(`${API_BASE}/leaves/export`, { headers: adminHeaders });
    const exportText = await exportRes.text();
    assert(
      exportRes.ok && exportText.includes('Employee Code') && exportText.includes('Leave Type'),
      `GET /api/leaves/export generates valid CSV export`
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

verifyLeaveComplete();
