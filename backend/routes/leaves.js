const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');

// Helper: calculate working days between two dates inclusive
function calculateLeaveDays(startDateStr, endDateStr) {
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return 0;
  }
  
  // Calculate difference in days inclusive
  const diffTime = end.getTime() - start.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(diffDays, 0);
}

// ============================================================================
// 1. GET /api/leaves/dashboard — Institutional Leave KPIs & Overview
// ============================================================================
router.get('/dashboard', authenticateToken, async (req, res) => {
  try {
    const currentYear = new Date().getFullYear();
    const todayStr = new Date().toISOString().split('T')[0];

    // Total Requests, Pending, Approved, Rejected for current year
    const countsRes = await pool.query(`
      SELECT 
        COUNT(*) AS total_requests,
        COUNT(*) FILTER (WHERE status = 'Pending') AS pending_requests,
        COUNT(*) FILTER (WHERE status = 'Approved') AS approved_requests,
        COUNT(*) FILTER (WHERE status = 'Rejected') AS rejected_requests,
        COUNT(*) FILTER (WHERE status = 'Cancelled') AS cancelled_requests
      FROM leave_requests
      WHERE EXTRACT(YEAR FROM start_date) = $1 OR EXTRACT(YEAR FROM applied_at) = $1;
    `, [currentYear]);

    const counts = countsRes.rows[0];

    // Employees currently on approved leave today
    const onLeaveTodayRes = await pool.query(`
      SELECT 
        lr.id,
        lr.employee_id,
        e.employee_code,
        e.first_name,
        e.last_name,
        d.name AS department_name,
        des.name AS designation_name,
        lt.name AS leave_type_name,
        lt.code AS leave_type_code,
        lr.start_date,
        lr.end_date,
        lr.total_days,
        lr.reason
      FROM leave_requests lr
      JOIN employees e ON lr.employee_id = e.id
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN designations des ON e.designation_id = des.id
      JOIN leave_types lt ON lr.leave_type_id = lt.id
      WHERE lr.status = 'Approved' 
        AND $1 BETWEEN lr.start_date AND lr.end_date
      ORDER BY e.first_name ASC;
    `, [todayStr]);

    // Pending Leave Requests (recent 10 for HR dashboard table)
    const pendingRes = await pool.query(`
      SELECT 
        lr.id,
        lr.employee_id,
        e.employee_code,
        e.first_name,
        e.last_name,
        d.name AS department_name,
        des.name AS designation_name,
        lt.id AS leave_type_id,
        lt.name AS leave_type_name,
        lt.code AS leave_type_code,
        lt.is_paid,
        lr.start_date,
        lr.end_date,
        lr.total_days,
        lr.reason,
        lr.remarks,
        lr.status,
        lr.applied_at
      FROM leave_requests lr
      JOIN employees e ON lr.employee_id = e.id
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN designations des ON e.designation_id = des.id
      JOIN leave_types lt ON lr.leave_type_id = lt.id
      WHERE lr.status = 'Pending'
      ORDER BY lr.applied_at DESC
      LIMIT 10;
    `);

    // Leave Type distribution (Approved days per type)
    const typeDistRes = await pool.query(`
      SELECT 
        lt.id,
        lt.name,
        lt.code,
        lt.is_paid,
        COALESCE(SUM(lr.total_days) FILTER (WHERE lr.status = 'Approved'), 0) AS approved_days,
        COUNT(lr.id) FILTER (WHERE lr.status = 'Approved') AS approved_count
      FROM leave_types lt
      LEFT JOIN leave_requests lr ON lt.id = lr.leave_type_id AND EXTRACT(YEAR FROM lr.start_date) = $1
      WHERE lt.is_active = true
      GROUP BY lt.id, lt.name, lt.code, lt.is_paid
      ORDER BY approved_days DESC, lt.name ASC;
    `, [currentYear]);

    return res.json({
      success: true,
      data: {
        kpis: {
          total_requests: parseInt(counts.total_requests || '0', 10),
          pending_requests: parseInt(counts.pending_requests || '0', 10),
          approved_requests: parseInt(counts.approved_requests || '0', 10),
          rejected_requests: parseInt(counts.rejected_requests || '0', 10),
          cancelled_requests: parseInt(counts.cancelled_requests || '0', 10),
          currently_on_leave: onLeaveTodayRes.rows.length
        },
        on_leave_today: onLeaveTodayRes.rows,
        pending_requests: pendingRes.rows,
        type_distribution: typeDistRes.rows
      }
    });
  } catch (err) {
    console.error('Leave dashboard error:', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve leave dashboard metrics.' });
  }
});

// ============================================================================
// 2. GET /api/leaves/types — Master Leave Types
// ============================================================================
router.get('/types', authenticateToken, async (req, res) => {
  try {
    const { include_inactive } = req.query;
    let query = `
      SELECT 
        lt.*,
        (SELECT COUNT(*) FROM leave_requests WHERE leave_type_id = lt.id) AS total_requests_count
      FROM leave_types lt
    `;
    if (include_inactive !== 'true') {
      query += ` WHERE lt.is_active = true`;
    }
    query += ` ORDER BY lt.is_active DESC, lt.name ASC;`;

    const result = await pool.query(query);
    return res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Get leave types error:', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve leave types.' });
  }
});

// ============================================================================
// 3. POST /api/leaves/types — Create Leave Type (Admin / Super Admin / HR)
// ============================================================================
router.post('/types', authenticateToken, async (req, res) => {
  try {
    const { name, code, description, annual_allocation, is_paid, requires_approval } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Leave type name is required.' });
    }
    if (!code || !code.trim()) {
      return res.status(400).json({ success: false, message: 'Leave type code is required.' });
    }

    const cleanCode = code.trim().toUpperCase();
    const cleanName = name.trim();
    const alloc = parseFloat(annual_allocation) || 0;

    // Check duplicate code
    const dupCheck = await pool.query('SELECT id FROM leave_types WHERE UPPER(code) = $1;', [cleanCode]);
    if (dupCheck.rows.length > 0) {
      return res.status(400).json({ success: false, message: `Leave type code '${cleanCode}' already exists.` });
    }

    const insertRes = await pool.query(`
      INSERT INTO leave_types (name, code, description, annual_allocation, is_paid, requires_approval, is_active, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, true, $7)
      RETURNING *;
    `, [cleanName, cleanCode, description || null, alloc, is_paid !== false, requires_approval !== false, req.user.id]);

    const newType = insertRes.rows[0];

    // Initialize balance for all active employees for current year
    const currentYear = new Date().getFullYear();
    const empRes = await pool.query('SELECT id FROM employees WHERE employment_status = $1;', ['Active']);
    for (const emp of empRes.rows) {
      await pool.query(`
        INSERT INTO leave_balances (employee_id, leave_type_id, leave_year, opening_balance, allocated_days, used_days, pending_days, carried_forward_days, available_days)
        VALUES ($1, $2, $3, $4, $4, 0, 0, 0, $4)
        ON CONFLICT (employee_id, leave_type_id, leave_year) DO NOTHING;
      `, [emp.id, newType.id, currentYear, alloc]);
    }

    return res.status(201).json({
      success: true,
      message: `Leave type '${cleanName}' created successfully.`,
      data: newType
    });
  } catch (err) {
    console.error('Create leave type error:', err);
    return res.status(500).json({ success: false, message: 'Failed to create leave type.' });
  }
});

// ============================================================================
// 4. PUT /api/leaves/types/:id — Update Leave Type
// ============================================================================
router.put('/types/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, code, description, annual_allocation, is_paid, requires_approval, is_active } = req.body;

    const existing = await pool.query('SELECT * FROM leave_types WHERE id = $1;', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Leave type not found.' });
    }

    const cleanName = name ? name.trim() : existing.rows[0].name;
    const cleanCode = code ? code.trim().toUpperCase() : existing.rows[0].code;
    const alloc = annual_allocation !== undefined ? parseFloat(annual_allocation) : existing.rows[0].annual_allocation;
    const paid = is_paid !== undefined ? Boolean(is_paid) : existing.rows[0].is_paid;
    const reqAppr = requires_approval !== undefined ? Boolean(requires_approval) : existing.rows[0].requires_approval;
    const active = is_active !== undefined ? Boolean(is_active) : existing.rows[0].is_active;

    // Check code collision if code changed
    if (cleanCode !== existing.rows[0].code) {
      const dup = await pool.query('SELECT id FROM leave_types WHERE UPPER(code) = $1 AND id != $2;', [cleanCode, id]);
      if (dup.rows.length > 0) {
        return res.status(400).json({ success: false, message: `Leave type code '${cleanCode}' is already in use.` });
      }
    }

    const updateRes = await pool.query(`
      UPDATE leave_types
      SET name = $1,
          code = $2,
          description = $3,
          annual_allocation = $4,
          is_paid = $5,
          requires_approval = $6,
          is_active = $7,
          updated_at = NOW(),
          updated_by = $8
      WHERE id = $9
      RETURNING *;
    `, [cleanName, cleanCode, description !== undefined ? description : existing.rows[0].description, alloc, paid, reqAppr, active, req.user.id, id]);

    return res.json({
      success: true,
      message: `Leave type '${cleanName}' updated successfully.`,
      data: updateRes.rows[0]
    });
  } catch (err) {
    console.error('Update leave type error:', err);
    return res.status(500).json({ success: false, message: 'Failed to update leave type.' });
  }
});

// ============================================================================
// 5. DELETE /api/leaves/types/:id — Soft-Delete / Deactivate Leave Type
// ============================================================================
router.delete('/types/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await pool.query('SELECT id, name FROM leave_types WHERE id = $1;', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Leave type not found.' });
    }

    // Toggle active status or soft delete
    const result = await pool.query(`
      UPDATE leave_types 
      SET is_active = false, updated_at = NOW(), updated_by = $1
      WHERE id = $2
      RETURNING *;
    `, [req.user.id, id]);

    return res.json({
      success: true,
      message: `Leave type '${existing.rows[0].name}' has been deactivated.`,
      data: result.rows[0]
    });
  } catch (err) {
    console.error('Delete leave type error:', err);
    return res.status(500).json({ success: false, message: 'Failed to deactivate leave type.' });
  }
});

// ============================================================================
// 6. GET /api/leaves/requests — Filterable Leave Requests Roster
// ============================================================================
router.get('/requests', authenticateToken, async (req, res) => {
  try {
    const { status, leave_type_id, department_id, employee_id, search, start_date, end_date, page = 1, limit = 50 } = req.query;

    let query = `
      SELECT 
        lr.id,
        lr.employee_id,
        e.employee_code,
        e.first_name,
        e.last_name,
        d.id AS department_id,
        d.name AS department_name,
        des.name AS designation_name,
        lt.id AS leave_type_id,
        lt.name AS leave_type_name,
        lt.code AS leave_type_code,
        lt.is_paid,
        lr.start_date,
        lr.end_date,
        lr.total_days,
        lr.reason,
        lr.remarks,
        lr.status,
        lr.applied_at,
        lr.approved_at,
        lr.rejection_reason,
        u_rev.email AS reviewer_email,
        e_rev.first_name AS reviewer_first_name,
        e_rev.last_name AS reviewer_last_name
      FROM leave_requests lr
      JOIN employees e ON lr.employee_id = e.id
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN designations des ON e.designation_id = des.id
      JOIN leave_types lt ON lr.leave_type_id = lt.id
      LEFT JOIN employees e_rev ON lr.approved_by = e_rev.id
      LEFT JOIN users u_rev ON e_rev.id = u_rev.employee_id
      WHERE 1=1
    `;

    const params = [];
    let pIdx = 1;

    // Role-based scope: If employee role without management permissions, restrict to own
    const userRole = req.user.role || req.user.role_name;
    const hasReadPerm = req.user.permissions && req.user.permissions.includes('leaves:read');
    if (userRole === 'Employee' && !hasReadPerm) {
      query += ` AND lr.employee_id = $${pIdx}`;
      params.push(req.user.employee_id);
      pIdx++;
    } else if (employee_id && employee_id !== 'ALL') {
      query += ` AND lr.employee_id = $${pIdx}`;
      params.push(employee_id);
      pIdx++;
    }

    if (status && status !== 'ALL') {
      query += ` AND lr.status = $${pIdx}`;
      params.push(status);
      pIdx++;
    }

    if (leave_type_id && leave_type_id !== 'ALL') {
      query += ` AND lr.leave_type_id = $${pIdx}`;
      params.push(leave_type_id);
      pIdx++;
    }

    if (department_id && department_id !== 'ALL') {
      query += ` AND e.department_id = $${pIdx}`;
      params.push(department_id);
      pIdx++;
    }

    if (start_date) {
      query += ` AND lr.end_date >= $${pIdx}`;
      params.push(start_date);
      pIdx++;
    }

    if (end_date) {
      query += ` AND lr.start_date <= $${pIdx}`;
      params.push(end_date);
      pIdx++;
    }

    if (search && search.trim() !== '') {
      const term = `%${search.trim().toLowerCase()}%`;
      query += ` AND (
        LOWER(e.first_name) LIKE $${pIdx} OR 
        LOWER(e.last_name) LIKE $${pIdx} OR 
        LOWER(e.employee_code) LIKE $${pIdx} OR
        LOWER(d.name) LIKE $${pIdx} OR
        LOWER(lt.name) LIKE $${pIdx} OR
        LOWER(lr.reason) LIKE $${pIdx}
      )`;
      params.push(term);
      pIdx++;
    }

    query += ` ORDER BY lr.applied_at DESC;`;

    const result = await pool.query(query, params);

    const formatted = result.rows.map(r => ({
      ...r,
      employee_name: `${r.first_name} ${r.last_name || ''}`.trim(),
      reviewer_name: r.reviewer_first_name ? `${r.reviewer_first_name} ${r.reviewer_last_name || ''}`.trim() : r.reviewer_email || '—'
    }));

    return res.json({
      success: true,
      data: {
        total: formatted.length,
        requests: formatted
      }
    });
  } catch (err) {
    console.error('Get leave requests error:', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve leave requests.' });
  }
});

// ============================================================================
// 7. GET /api/leaves/requests/:id — Single Leave Request Detail with Audit Trail
// ============================================================================
router.get('/requests/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      SELECT 
        lr.*,
        e.employee_code,
        e.first_name,
        e.last_name,
        e.work_email,
        d.name AS department_name,
        des.name AS designation_name,
        lt.name AS leave_type_name,
        lt.code AS leave_type_code,
        lt.is_paid,
        u_rev.email AS reviewer_email,
        e_rev.first_name AS reviewer_first_name,
        e_rev.last_name AS reviewer_last_name
      FROM leave_requests lr
      JOIN employees e ON lr.employee_id = e.id
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN designations des ON e.designation_id = des.id
      JOIN leave_types lt ON lr.leave_type_id = lt.id
      LEFT JOIN employees e_rev ON lr.approved_by = e_rev.id
      LEFT JOIN users u_rev ON e_rev.id = u_rev.employee_id
      WHERE lr.id = $1;
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Leave request not found.' });
    }

    const requestData = result.rows[0];

    // Fetch audit logs for this request
    const auditLogs = await pool.query(`
      SELECT 
        al.*,
        u.email AS actor_email,
        e.first_name AS actor_first_name,
        e.last_name AS actor_last_name
      FROM leave_audit_logs al
      JOIN users u ON al.actor_user_id = u.id
      LEFT JOIN employees e ON u.employee_id = e.id
      WHERE al.leave_request_id = $1
      ORDER BY al.created_at ASC;
    `, [id]);

    return res.json({
      success: true,
      data: {
        ...requestData,
        employee_name: `${requestData.first_name} ${requestData.last_name || ''}`.trim(),
        reviewer_name: requestData.reviewer_first_name ? `${requestData.reviewer_first_name} ${requestData.reviewer_last_name || ''}`.trim() : requestData.reviewer_email || '—',
        audit_logs: auditLogs.rows
      }
    });
  } catch (err) {
    console.error('Get leave request detail error:', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve leave request details.' });
  }
});

// ============================================================================
// 8. POST /api/leaves/requests — Apply For Leave
// ============================================================================
router.post('/requests', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { employee_id, leave_type_id, start_date, end_date, reason, remarks } = req.body;

    const callerRole = req.user.role || req.user.role_name;
    const canManage = ['Super Admin', 'Administrator', 'HR', 'Manager'].includes(callerRole) || (req.user.permissions && req.user.permissions.includes('leaves:approve'));

    // Determine target employee: if caller is Admin/HR, allow employee_id override, otherwise lock to req.user.employee_id
    let targetEmpId = req.user.employee_id;
    if (employee_id && canManage) {
      targetEmpId = employee_id;
    }

    if (!targetEmpId) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'No valid employee profile associated with this account.' });
    }

    if (!leave_type_id) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Please select a leave type.' });
    }

    if (!start_date || !end_date) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Start date and End date are required.' });
    }

    if (new Date(end_date) < new Date(start_date)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'End date cannot be prior to start date.' });
    }

    if (!reason || !reason.trim()) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Please provide a reason for the leave application.' });
    }

    // Verify leave type
    const leaveTypeRes = await client.query('SELECT * FROM leave_types WHERE id = $1 AND is_active = true;', [leave_type_id]);
    if (leaveTypeRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Selected leave type is invalid or inactive.' });
    }
    const leaveType = leaveTypeRes.rows[0];

    // Calculate total days
    const totalDays = calculateLeaveDays(start_date, end_date);
    if (totalDays <= 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Invalid leave duration calculated.' });
    }

    // Check for overlapping pending or approved leave requests for this employee
    const overlapRes = await client.query(`
      SELECT id, start_date, end_date, status 
      FROM leave_requests
      WHERE employee_id = $1 
        AND status IN ('Pending', 'Approved')
        AND NOT (end_date < $2 OR start_date > $3);
    `, [targetEmpId, start_date, end_date]);

    if (overlapRes.rows.length > 0) {
      await client.query('ROLLBACK');
      const ov = overlapRes.rows[0];
      return res.status(400).json({
        success: false,
        message: `An overlapping ${ov.status.toLowerCase()} leave request already exists from ${ov.start_date.toISOString().split('T')[0]} to ${ov.end_date.toISOString().split('T')[0]}.`
      });
    }

    const currentYear = new Date(start_date).getFullYear();

    // Fetch or create balance record
    let balanceRes = await client.query(`
      SELECT * FROM leave_balances 
      WHERE employee_id = $1 AND leave_type_id = $2 AND leave_year = $3;
    `, [targetEmpId, leave_type_id, currentYear]);

    let currentBalance;
    if (balanceRes.rows.length === 0) {
      const alloc = parseFloat(leaveType.annual_allocation) || 0;
      const newBal = await client.query(`
        INSERT INTO leave_balances (employee_id, leave_type_id, leave_year, opening_balance, allocated_days, used_days, pending_days, carried_forward_days, available_days)
        VALUES ($1, $2, $3, $4, $4, 0, 0, 0, $4)
        RETURNING *;
      `, [targetEmpId, leave_type_id, currentYear, alloc]);
      currentBalance = newBal.rows[0];
    } else {
      currentBalance = balanceRes.rows[0];
    }

    const availableDays = parseFloat(currentBalance.available_days) || 0;
    // For paid leaves with quota, check balance
    if (leaveType.is_paid && parseFloat(leaveType.annual_allocation) > 0 && availableDays < totalDays) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: `Insufficient leave balance. You requested ${totalDays} day(s) of ${leaveType.name}, but only ${availableDays} day(s) are available.`
      });
    }

    // Insert leave request
    const insertReq = await client.query(`
      INSERT INTO leave_requests (
        employee_id,
        leave_type_id,
        start_date,
        end_date,
        total_days,
        reason,
        remarks,
        status,
        applied_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'Pending', NOW())
      RETURNING *;
    `, [targetEmpId, leave_type_id, start_date, end_date, totalDays, reason.trim(), remarks ? remarks.trim() : null]);

    const newRequest = insertReq.rows[0];

    // Update leave balance: pending_days += totalDays, available_days -= totalDays
    await client.query(`
      UPDATE leave_balances
      SET pending_days = pending_days + $1,
          available_days = available_days - $1,
          updated_at = NOW()
      WHERE id = $2;
    `, [totalDays, currentBalance.id]);

    // Insert audit log
    await client.query(`
      INSERT INTO leave_audit_logs (leave_request_id, actor_user_id, action, previous_status, new_status, notes)
      VALUES ($1, $2, 'APPLIED', NULL, 'Pending', $3);
    `, [newRequest.id, req.user.id, `Applied for ${totalDays} day(s) of ${leaveType.name}. Reason: ${reason.trim()}`]);

    await client.query('COMMIT');

    return res.status(201).json({
      success: true,
      message: `Leave application submitted successfully for ${totalDays} day(s).`,
      data: newRequest
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Apply leave error:', err);
    return res.status(500).json({ success: false, message: 'Failed to submit leave application.' });
  } finally {
    client.release();
  }
});

// ============================================================================
// 9. PUT /api/leaves/requests/:id/approve — Approve Leave Request
// ============================================================================
router.put('/requests/:id/approve', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { id } = req.params;

    // Check permissions: Super Admin, Admin, HR, Manager, or leaves:approve permission
    const callerRole = req.user.role || req.user.role_name;
    const allowedRoles = ['Super Admin', 'Administrator', 'HR', 'Manager'];
    const hasPerm = req.user.permissions && req.user.permissions.includes('leaves:approve');

    if (!allowedRoles.includes(callerRole) && !hasPerm) {
      await client.query('ROLLBACK');
      return res.status(403).json({ success: false, message: 'You do not have permission to approve leave requests.' });
    }

    const reqRes = await client.query(`
      SELECT lr.*, lt.name AS leave_type_name, e.first_name, e.last_name
      FROM leave_requests lr
      JOIN leave_types lt ON lr.leave_type_id = lt.id
      JOIN employees e ON lr.employee_id = e.id
      WHERE lr.id = $1;
    `, [id]);

    if (reqRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Leave request not found.' });
    }

    const request = reqRes.rows[0];

    if (request.status !== 'Pending') {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: `Cannot approve request with current status '${request.status}'.` });
    }

    // Update request status to Approved
    const updated = await client.query(`
      UPDATE leave_requests
      SET status = 'Approved',
          approved_by = $1,
          approved_at = NOW(),
          updated_at = NOW()
      WHERE id = $2
      RETURNING *;
    `, [req.user.employee_id, id]);

    const totalDays = parseFloat(request.total_days);
    const leaveYear = new Date(request.start_date).getFullYear();

    // Update balance: pending_days -= totalDays, used_days += totalDays
    await client.query(`
      UPDATE leave_balances
      SET pending_days = GREATEST(pending_days - $1, 0),
          used_days = used_days + $1,
          updated_at = NOW()
      WHERE employee_id = $2 AND leave_type_id = $3 AND leave_year = $4;
    `, [totalDays, request.employee_id, request.leave_type_id, leaveYear]);

    // Insert audit log
    await client.query(`
      INSERT INTO leave_audit_logs (leave_request_id, actor_user_id, action, previous_status, new_status, notes)
      VALUES ($1, $2, 'APPROVED', 'Pending', 'Approved', $3);
    `, [id, req.user.id, `Leave approved by ${callerRole}`]);

    await client.query('COMMIT');

    return res.json({
      success: true,
      message: `Leave request for ${request.first_name} ${request.last_name} has been approved.`,
      data: updated.rows[0]
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Approve leave error:', err);
    return res.status(500).json({ success: false, message: 'Failed to approve leave request.' });
  } finally {
    client.release();
  }
});

// ============================================================================
// 10. PUT /api/leaves/requests/:id/reject — Reject Leave Request
// ============================================================================
router.put('/requests/:id/reject', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { id } = req.params;
    const { rejection_reason } = req.body;

    const callerRole = req.user.role || req.user.role_name;
    const allowedRoles = ['Super Admin', 'Administrator', 'HR', 'Manager'];
    const hasPerm = req.user.permissions && req.user.permissions.includes('leaves:approve');

    if (!allowedRoles.includes(callerRole) && !hasPerm) {
      await client.query('ROLLBACK');
      return res.status(403).json({ success: false, message: 'You do not have permission to reject leave requests.' });
    }

    if (!rejection_reason || !rejection_reason.trim()) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'A rejection reason is required.' });
    }

    const reqRes = await client.query(`
      SELECT lr.*, lt.name AS leave_type_name, e.first_name, e.last_name
      FROM leave_requests lr
      JOIN leave_types lt ON lr.leave_type_id = lt.id
      JOIN employees e ON lr.employee_id = e.id
      WHERE lr.id = $1;
    `, [id]);

    if (reqRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Leave request not found.' });
    }

    const request = reqRes.rows[0];

    if (request.status !== 'Pending') {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: `Cannot reject request with current status '${request.status}'.` });
    }

    const cleanReason = rejection_reason.trim();

    // Update request status to Rejected
    const updated = await client.query(`
      UPDATE leave_requests
      SET status = 'Rejected',
          approved_by = $1,
          approved_at = NOW(),
          rejection_reason = $2,
          updated_at = NOW()
      WHERE id = $3
      RETURNING *;
    `, [req.user.employee_id, cleanReason, id]);

    const totalDays = parseFloat(request.total_days);
    const leaveYear = new Date(request.start_date).getFullYear();

    // Restore balance: pending_days -= totalDays, available_days += totalDays
    await client.query(`
      UPDATE leave_balances
      SET pending_days = GREATEST(pending_days - $1, 0),
          available_days = available_days + $1,
          updated_at = NOW()
      WHERE employee_id = $2 AND leave_type_id = $3 AND leave_year = $4;
    `, [totalDays, request.employee_id, request.leave_type_id, leaveYear]);

    // Insert audit log
    await client.query(`
      INSERT INTO leave_audit_logs (leave_request_id, actor_user_id, action, previous_status, new_status, notes)
      VALUES ($1, $2, 'REJECTED', 'Pending', 'Rejected', $3);
    `, [id, req.user.id, `Reason: ${cleanReason}`]);

    await client.query('COMMIT');

    return res.json({
      success: true,
      message: `Leave request for ${request.first_name} ${request.last_name} has been rejected.`,
      data: updated.rows[0]
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Reject leave error:', err);
    return res.status(500).json({ success: false, message: 'Failed to reject leave request.' });
  } finally {
    client.release();
  }
});

// ============================================================================
// 11. PUT /api/leaves/requests/:id/cancel — Cancel Own Pending Leave Request
// ============================================================================
router.put('/requests/:id/cancel', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { id } = req.params;

    const reqRes = await client.query(`
      SELECT * FROM leave_requests WHERE id = $1;
    `, [id]);

    if (reqRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Leave request not found.' });
    }

    const request = reqRes.rows[0];

    // Check ownership or admin status
    const callerRole = req.user.role || req.user.role_name;
    const isAdminUser = ['Super Admin', 'Administrator', 'HR'].includes(callerRole);
    if (!isAdminUser && request.employee_id !== req.user.employee_id) {
      await client.query('ROLLBACK');
      return res.status(403).json({ success: false, message: 'You can only cancel your own leave requests.' });
    }

    if (request.status !== 'Pending') {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: `Only pending requests can be cancelled (current status: ${request.status}).` });
    }

    // Update request status to Cancelled
    const updated = await client.query(`
      UPDATE leave_requests
      SET status = 'Cancelled',
          updated_at = NOW()
      WHERE id = $1
      RETURNING *;
    `, [id]);

    const totalDays = parseFloat(request.total_days);
    const leaveYear = new Date(request.start_date).getFullYear();

    // Restore balance: pending_days -= totalDays, available_days += totalDays
    await client.query(`
      UPDATE leave_balances
      SET pending_days = GREATEST(pending_days - $1, 0),
          available_days = available_days + $1,
          updated_at = NOW()
      WHERE employee_id = $2 AND leave_type_id = $3 AND leave_year = $4;
    `, [totalDays, request.employee_id, request.leave_type_id, leaveYear]);

    // Insert audit log
    await client.query(`
      INSERT INTO leave_audit_logs (leave_request_id, actor_user_id, action, previous_status, new_status, notes)
      VALUES ($1, $2, 'CANCELLED', 'Pending', 'Cancelled', 'Cancelled by user');
    `, [id, req.user.id]);

    await client.query('COMMIT');

    return res.json({
      success: true,
      message: 'Leave application has been cancelled.',
      data: updated.rows[0]
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Cancel leave error:', err);
    return res.status(500).json({ success: false, message: 'Failed to cancel leave request.' });
  } finally {
    client.release();
  }
});

// ============================================================================
// 12. GET /api/leaves/my-summary — Personal Quota & Balances for Logged-In User
// ============================================================================
router.get('/my-summary', authenticateToken, async (req, res) => {
  try {
    const employeeId = req.user.employee_id;
    if (!employeeId) {
      return res.status(400).json({ success: false, message: 'No linked employee record for this account.' });
    }

    const currentYear = new Date().getFullYear();

    // Fetch balances by leave type
    const balancesRes = await pool.query(`
      SELECT 
        lb.id,
        lb.leave_year,
        lb.allocated_days,
        lb.used_days,
        lb.pending_days,
        lb.available_days,
        lt.id AS leave_type_id,
        lt.name AS leave_type_name,
        lt.code AS leave_type_code,
        lt.description AS leave_type_description,
        lt.is_paid,
        lt.annual_allocation
      FROM leave_balances lb
      JOIN leave_types lt ON lb.leave_type_id = lt.id
      WHERE lb.employee_id = $1 AND lb.leave_year = $2 AND lt.is_active = true
      ORDER BY lt.name ASC;
    `, [employeeId, currentYear]);

    // Aggregate overall KPI totals
    let totalAllocated = 0;
    let totalUsed = 0;
    let totalPending = 0;
    let totalAvailable = 0;

    balancesRes.rows.forEach(b => {
      totalAllocated += parseFloat(b.allocated_days || 0);
      totalUsed += parseFloat(b.used_days || 0);
      totalPending += parseFloat(b.pending_days || 0);
      totalAvailable += parseFloat(b.available_days || 0);
    });

    // Recent personal requests (last 20)
    const requestsRes = await pool.query(`
      SELECT 
        lr.id,
        lr.leave_type_id,
        lt.name AS leave_type_name,
        lt.code AS leave_type_code,
        lt.is_paid,
        lr.start_date,
        lr.end_date,
        lr.total_days,
        lr.reason,
        lr.remarks,
        lr.status,
        lr.applied_at,
        lr.approved_at,
        lr.rejection_reason,
        u_rev.email AS reviewer_email,
        e_rev.first_name AS reviewer_first_name,
        e_rev.last_name AS reviewer_last_name
      FROM leave_requests lr
      JOIN leave_types lt ON lr.leave_type_id = lt.id
      LEFT JOIN users u_rev ON lr.approved_by = u_rev.id
      LEFT JOIN employees e_rev ON u_rev.employee_id = e_rev.id
      WHERE lr.employee_id = $1
      ORDER BY lr.applied_at DESC
      LIMIT 20;
    `, [employeeId]);

    const formattedRequests = requestsRes.rows.map(r => ({
      ...r,
      reviewer_name: r.reviewer_first_name ? `${r.reviewer_first_name} ${r.reviewer_last_name || ''}`.trim() : r.reviewer_email || '—'
    }));

    return res.json({
      success: true,
      data: {
        year: currentYear,
        summary: {
          total_allocated: totalAllocated,
          total_used: totalUsed,
          total_pending: totalPending,
          total_available: totalAvailable
        },
        balances: balancesRes.rows,
        my_requests: formattedRequests
      }
    });
  } catch (err) {
    console.error('Get my leave summary error:', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve personal leave summary.' });
  }
});

// ============================================================================
// 13. GET /api/leaves/calendar — Institutional Absence Events for Calendar
// ============================================================================
router.get('/calendar', authenticateToken, async (req, res) => {
  try {
    const { month, department_id, leave_type_id, employee_id } = req.query;

    const targetMonth = month || new Date().toISOString().slice(0, 7); // YYYY-MM
    const [yearStr, monthStr] = targetMonth.split('-');
    const year = parseInt(yearStr, 10);
    const monthNum = parseInt(monthStr, 10);

    const monthStart = `${year}-${String(monthNum).padStart(2, '0')}-01`;
    const lastDay = new Date(year, monthNum, 0).getDate();
    const monthEnd = `${year}-${String(monthNum).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    let query = `
      SELECT 
        lr.id,
        lr.employee_id,
        e.employee_code,
        e.first_name,
        e.last_name,
        d.id AS department_id,
        d.name AS department_name,
        des.name AS designation_name,
        lt.id AS leave_type_id,
        lt.name AS leave_type_name,
        lt.code AS leave_type_code,
        lt.is_paid,
        lr.start_date,
        lr.end_date,
        lr.total_days,
        lr.reason,
        lr.status
      FROM leave_requests lr
      JOIN employees e ON lr.employee_id = e.id
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN designations des ON e.designation_id = des.id
      JOIN leave_types lt ON lr.leave_type_id = lt.id
      WHERE lr.status = 'Approved'
        AND NOT (lr.end_date < $1 OR lr.start_date > $2)
    `;

    const params = [monthStart, monthEnd];
    let pIdx = 3;

    if (department_id && department_id !== 'ALL') {
      query += ` AND e.department_id = $${pIdx}`;
      params.push(department_id);
      pIdx++;
    }

    if (leave_type_id && leave_type_id !== 'ALL') {
      query += ` AND lr.leave_type_id = $${pIdx}`;
      params.push(leave_type_id);
      pIdx++;
    }

    if (employee_id && employee_id !== 'ALL') {
      query += ` AND lr.employee_id = $${pIdx}`;
      params.push(employee_id);
      pIdx++;
    }

    query += ` ORDER BY lr.start_date ASC, e.first_name ASC;`;

    const result = await pool.query(query, params);

    const events = result.rows.map(r => ({
      ...r,
      employee_name: `${r.first_name} ${r.last_name || ''}`.trim(),
      start_date_str: r.start_date.toISOString().split('T')[0],
      end_date_str: r.end_date.toISOString().split('T')[0]
    }));

    return res.json({
      success: true,
      data: {
        month: targetMonth,
        month_start: monthStart,
        month_end: monthEnd,
        total_leaves: events.length,
        events: events
      }
    });
  } catch (err) {
    console.error('Get leave calendar error:', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve leave calendar events.' });
  }
});

// ============================================================================
// 14. GET /api/leaves/export — CSV Export of Leave Requests
// ============================================================================
router.get('/export', authenticateToken, async (req, res) => {
  try {
    const { status, leave_type_id, department_id, start_date, end_date } = req.query;

    let query = `
      SELECT 
        e.employee_code,
        e.first_name,
        e.last_name,
        d.name AS department_name,
        des.name AS designation_name,
        lt.name AS leave_type_name,
        lt.code AS leave_type_code,
        lr.start_date,
        lr.end_date,
        lr.total_days,
        lr.reason,
        lr.status,
        lr.applied_at,
        lr.approved_at
      FROM leave_requests lr
      JOIN employees e ON lr.employee_id = e.id
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN designations des ON e.designation_id = des.id
      JOIN leave_types lt ON lr.leave_type_id = lt.id
      WHERE 1=1
    `;

    const params = [];
    let pIdx = 1;

    if (status && status !== 'ALL') {
      query += ` AND lr.status = $${pIdx}`;
      params.push(status);
      pIdx++;
    }

    if (leave_type_id && leave_type_id !== 'ALL') {
      query += ` AND lr.leave_type_id = $${pIdx}`;
      params.push(leave_type_id);
      pIdx++;
    }

    if (department_id && department_id !== 'ALL') {
      query += ` AND e.department_id = $${pIdx}`;
      params.push(department_id);
      pIdx++;
    }

    if (start_date) {
      query += ` AND lr.end_date >= $${pIdx}`;
      params.push(start_date);
      pIdx++;
    }

    if (end_date) {
      query += ` AND lr.start_date <= $${pIdx}`;
      params.push(end_date);
      pIdx++;
    }

    query += ` ORDER BY lr.applied_at DESC;`;

    const result = await pool.query(query, params);

    // CSV Header
    let csv = 'Employee Code,Staff Name,Department,Designation,Leave Type,Start Date,End Date,Days,Status,Applied On,Reason\n';
    result.rows.forEach(r => {
      const name = `"${r.first_name} ${r.last_name || ''}"`;
      const dept = `"${r.department_name || '—'}"`;
      const des = `"${r.designation_name || '—'}"`;
      const lt = `"${r.leave_type_name}"`;
      const sDate = r.start_date ? r.start_date.toISOString().split('T')[0] : '';
      const eDate = r.end_date ? r.end_date.toISOString().split('T')[0] : '';
      const appOn = r.applied_at ? r.applied_at.toISOString().split('T')[0] : '';
      const reason = `"${(r.reason || '').replace(/"/g, '""')}"`;
      csv += `${r.employee_code},${name},${dept},${des},${lt},${sDate},${eDate},${r.total_days},${r.status},${appOn},${reason}\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=st_vincents_leave_records_${Date.now()}.csv`);
    return res.send(csv);
  } catch (err) {
    console.error('Leave export error:', err);
    return res.status(500).json({ success: false, message: 'Failed to export leave records.' });
  }
});

module.exports = router;
