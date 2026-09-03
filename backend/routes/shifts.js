const express = require('express');
const router = express.Router();
const pool = require('../db');
const { 
  authenticateToken, 
  requirePermission, 
  requireRole, 
  requireSuperAdmin 
} = require('../middleware/auth');

// ============================================================================
// HELPER: Format time to HH:MM AM/PM
// ============================================================================
function formatTime(timeStr) {
  if (!timeStr) return null;
  const parts = timeStr.split(':');
  if (parts.length < 2) return timeStr;
  let hours = parseInt(parts[0], 10);
  const minutes = parts[1];
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // 0 becomes 12
  return `${hours}:${minutes} ${ampm}`;
}

// ============================================================================
// 1. GET /api/shifts - List all shifts with employee count and filters
// ============================================================================
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { status, search, working_day } = req.query;

    let query = `
      SELECT 
        s.id,
        s.name,
        s.code,
        s.description,
        s.start_time,
        s.end_time,
        s.break_start_time,
        s.break_end_time,
        s.break_duration_minutes,
        s.late_grace_minutes,
        s.grace_period_minutes,
        s.early_departure_grace_minutes,
        s.working_days,
        s.is_overnight,
        s.is_active,
        s.created_at,
        s.updated_at,
        COUNT(DISTINCT e.id) as employee_count
      FROM shifts s
      LEFT JOIN employees e ON e.current_shift_id = s.id AND e.employment_status != 'Terminated'
      WHERE 1=1
    `;
    const params = [];

    // Filter by status
    if (status === 'active') {
      params.push(true);
      query += ` AND s.is_active = $${params.length}`;
    } else if (status === 'inactive') {
      params.push(false);
      query += ` AND s.is_active = $${params.length}`;
    }

    // Filter by search term
    if (search && search.trim() !== '') {
      params.push(`%${search.trim().toLowerCase()}%`);
      query += ` AND (LOWER(s.name) LIKE $${params.length} OR LOWER(s.code) LIKE $${params.length} OR LOWER(COALESCE(s.description, '')) LIKE $${params.length})`;
    }

    // Filter by working day
    if (working_day && working_day !== 'ALL') {
      params.push(working_day);
      query += ` AND $${params.length} = ANY(s.working_days)`;
    }

    query += `
      GROUP BY s.id
      ORDER BY s.is_active DESC, s.name ASC;
    `;

    const result = await pool.query(query, params);

    // Format start/end time display
    const formattedData = result.rows.map(shift => ({
      ...shift,
      employee_count: parseInt(shift.employee_count, 10) || 0,
      start_time_formatted: formatTime(shift.start_time),
      end_time_formatted: formatTime(shift.end_time),
      break_start_formatted: formatTime(shift.break_start_time),
      break_end_formatted: formatTime(shift.break_end_time),
      working_days: shift.working_days || []
    }));

    return res.json({
      success: true,
      count: formattedData.length,
      data: formattedData
    });
  } catch (err) {
    console.error('Error fetching shifts:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve shifts.',
      error: err.message
    });
  }
});

// ============================================================================
// 2. GET /api/shifts/stats - Summary statistics for shifts & workforce allocation
// ============================================================================
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const shiftStatsQuery = `
      SELECT 
        COUNT(*) as total_shifts,
        COUNT(*) FILTER (WHERE is_active = true) as active_shifts,
        COUNT(*) FILTER (WHERE is_active = false) as inactive_shifts
      FROM shifts;
    `;

    const empStatsQuery = `
      SELECT 
        COUNT(*) as total_employees,
        COUNT(*) FILTER (WHERE current_shift_id IS NOT NULL) as assigned_employees,
        COUNT(*) FILTER (WHERE current_shift_id IS NULL) as unassigned_employees
      FROM employees
      WHERE employment_status != 'Terminated';
    `;

    const historyStatsQuery = `
      SELECT COUNT(*) as total_assignments FROM shift_assignments;
    `;

    const [shiftStatsRes, empStatsRes, historyStatsRes] = await Promise.all([
      pool.query(shiftStatsQuery),
      pool.query(empStatsQuery),
      pool.query(historyStatsQuery)
    ]);

    const shiftRow = shiftStatsRes.rows[0];
    const empRow = empStatsRes.rows[0];
    const historyRow = historyStatsRes.rows[0];

    return res.json({
      success: true,
      data: {
        total_shifts: parseInt(shiftRow.total_shifts, 10) || 0,
        active_shifts: parseInt(shiftRow.active_shifts, 10) || 0,
        inactive_shifts: parseInt(shiftRow.inactive_shifts, 10) || 0,
        total_employees: parseInt(empRow.total_employees, 10) || 0,
        assigned_employees: parseInt(empRow.assigned_employees, 10) || 0,
        unassigned_employees: parseInt(empRow.unassigned_employees, 10) || 0,
        total_assignments: parseInt(historyRow.total_assignments, 10) || 0
      }
    });
  } catch (err) {
    console.error('Error fetching shift stats:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve shift statistics.',
      error: err.message
    });
  }
});

// ============================================================================
// 3. GET /api/shifts/unassigned/employees - Employees without an active shift
// ============================================================================
router.get('/unassigned/employees', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        e.id,
        e.employee_code,
        e.first_name,
        e.middle_name,
        e.last_name,
        e.work_email,
        e.personal_email,
        e.employment_status,
        e.profile_photo_url,
        d.name as department_name,
        d.code as department_code,
        des.name as designation_name
      FROM employees e
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN designations des ON e.designation_id = des.id
      WHERE e.current_shift_id IS NULL AND e.employment_status != 'Terminated'
      ORDER BY e.first_name ASC, e.last_name ASC;
    `);

    return res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (err) {
    console.error('Error fetching unassigned employees:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve unassigned employees.',
      error: err.message
    });
  }
});

// ============================================================================
// 4. GET /api/shifts/assignments/history - Shift assignment & transfer audit log
// ============================================================================
router.get('/assignments/history', authenticateToken, async (req, res) => {
  try {
    const { employee_id, shift_id, search } = req.query;

    let query = `
      SELECT 
        sa.id,
        sa.employee_id,
        sa.shift_id,
        sa.start_date,
        sa.end_date,
        sa.is_active,
        sa.reason,
        sa.created_at,
        e.employee_code,
        TRIM(CONCAT(e.first_name, ' ', COALESCE(e.middle_name, ''), ' ', COALESCE(e.last_name, ''))) as employee_name,
        e.profile_photo_url,
        s.name as shift_name,
        s.code as shift_code,
        s.start_time,
        s.end_time,
        d.name as department_name,
        des.name as designation_name,
        u.email as assigned_by_email
      FROM shift_assignments sa
      JOIN employees e ON sa.employee_id = e.id
      JOIN shifts s ON sa.shift_id = s.id
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN designations des ON e.designation_id = des.id
      LEFT JOIN users u ON sa.assigned_by = u.id
      WHERE 1=1
    `;
    const params = [];

    if (employee_id) {
      params.push(employee_id);
      query += ` AND sa.employee_id = $${params.length}`;
    }

    if (shift_id) {
      params.push(shift_id);
      query += ` AND sa.shift_id = $${params.length}`;
    }

    if (search && search.trim() !== '') {
      params.push(`%${search.trim().toLowerCase()}%`);
      query += ` AND (
        LOWER(e.employee_code) LIKE $${params.length} OR 
        LOWER(e.first_name) LIKE $${params.length} OR 
        LOWER(e.last_name) LIKE $${params.length} OR 
        LOWER(s.name) LIKE $${params.length} OR 
        LOWER(s.code) LIKE $${params.length} OR 
        LOWER(COALESCE(sa.reason, '')) LIKE $${params.length}
      )`;
    }

    query += ` ORDER BY sa.created_at DESC;`;

    const result = await pool.query(query, params);

    const formatted = result.rows.map(r => ({
      ...r,
      start_time_formatted: formatTime(r.start_time),
      end_time_formatted: formatTime(r.end_time)
    }));

    return res.json({
      success: true,
      count: formatted.length,
      data: formatted
    });
  } catch (err) {
    console.error('Error fetching shift history:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve shift assignment history.',
      error: err.message
    });
  }
});

// ============================================================================
// 5. GET /api/shifts/:id - Get single shift details with assigned staff roster
// ============================================================================
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const shiftRes = await pool.query(`
      SELECT 
        s.*,
        u_create.email as created_by_email,
        u_update.email as updated_by_email
      FROM shifts s
      LEFT JOIN users u_create ON s.created_by = u_create.id
      LEFT JOIN users u_update ON s.updated_by = u_update.id
      WHERE s.id = $1;
    `, [id]);

    if (shiftRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Shift not found.'
      });
    }

    const shift = shiftRes.rows[0];

    // Fetch working days
    const daysRes = await pool.query(`
      SELECT day_of_week, day_number, is_working_day 
      FROM shift_working_days 
      WHERE shift_id = $1 
      ORDER BY day_number;
    `, [id]);

    // Fetch assigned employees roster
    const employeesRes = await pool.query(`
      SELECT 
        e.id,
        e.employee_code,
        e.first_name,
        e.middle_name,
        e.last_name,
        e.work_email,
        e.personal_email,
        e.employment_status,
        e.profile_photo_url,
        d.name as department_name,
        des.name as designation_name,
        sa.start_date as assignment_start,
        sa.end_date as assignment_end,
        sa.reason as assignment_reason
      FROM employees e
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN designations des ON e.designation_id = des.id
      LEFT JOIN LATERAL (
        SELECT start_date, end_date, reason
        FROM shift_assignments
        WHERE employee_id = e.id AND shift_id = $1 AND is_active = true
        ORDER BY start_date DESC LIMIT 1
      ) sa ON true
      WHERE e.current_shift_id = $1 AND e.employment_status != 'Terminated'
      ORDER BY e.first_name ASC, e.last_name ASC;
    `, [id]);

    return res.json({
      success: true,
      data: {
        ...shift,
        employee_count: employeesRes.rows.length,
        start_time_formatted: formatTime(shift.start_time),
        end_time_formatted: formatTime(shift.end_time),
        break_start_formatted: formatTime(shift.break_start_time),
        break_end_formatted: formatTime(shift.break_end_time),
        working_days_details: daysRes.rows,
        employees: employeesRes.rows
      }
    });
  } catch (err) {
    console.error('Error fetching shift by ID:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve shift details.',
      error: err.message
    });
  }
});

// ============================================================================
// 6. POST /api/shifts - Create a new work shift
// ============================================================================
router.post('/', authenticateToken, requirePermission('shifts:create'), async (req, res) => {
  const client = await pool.connect();
  try {
    const {
      name,
      code,
      description,
      start_time,
      end_time,
      break_start_time,
      break_end_time,
      break_duration_minutes = 0,
      late_grace_minutes = 0,
      grace_period_minutes,
      early_departure_grace_minutes = 0,
      working_days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      is_overnight = false,
      is_active = true
    } = req.body;

    // 1. Validation
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Shift name is required.' });
    }

    if (!code || !code.trim()) {
      return res.status(400).json({ success: false, message: 'Shift code is required.' });
    }

    if (!start_time || !end_time) {
      return res.status(400).json({ success: false, message: 'Start time and End time are required.' });
    }

    if (!Array.isArray(working_days) || working_days.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one working day must be selected.' });
    }

    const cleanCode = code.trim().toUpperCase();
    const cleanName = name.trim();

    // Check code uniqueness
    const codeCheck = await client.query(`SELECT id FROM shifts WHERE UPPER(code) = $1;`, [cleanCode]);
    if (codeCheck.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: `Shift code '${cleanCode}' is already in use. Please choose a unique code.`
      });
    }

    // Grace period validation
    const lateGrace = Math.max(0, parseInt(late_grace_minutes || grace_period_minutes || 0, 10));
    const earlyGrace = Math.max(0, parseInt(early_departure_grace_minutes || 0, 10));
    const breakDuration = Math.max(0, parseInt(break_duration_minutes || 0, 10));

    await client.query('BEGIN');

    const insertRes = await client.query(`
      INSERT INTO shifts (
        name, code, description, start_time, end_time,
        break_start_time, break_end_time, break_duration_minutes,
        late_grace_minutes, grace_period_minutes, early_departure_grace_minutes,
        working_days, is_overnight, is_active, created_by, updated_by
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8,
        $9, $10, $11,
        $12, $13, $14, $15, $15
      ) RETURNING *;
    `, [
      cleanName, cleanCode, description ? description.trim() : null,
      start_time, end_time,
      break_start_time || null, break_end_time || null, breakDuration,
      lateGrace, lateGrace, earlyGrace,
      working_days, Boolean(is_overnight), is_active !== false, req.user?.id || null
    ]);

    const newShift = insertRes.rows[0];

    // Seed shift_working_days
    const daysMap = {
      Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6, Sunday: 7
    };
    for (const day of working_days) {
      if (daysMap[day]) {
        await client.query(`
          INSERT INTO shift_working_days (shift_id, day_of_week, day_number, is_working_day)
          VALUES ($1, $2, $3, true);
        `, [newShift.id, day, daysMap[day]]);
      }
    }

    await client.query('COMMIT');

    return res.status(201).json({
      success: true,
      message: `Shift '${cleanName}' (${cleanCode}) created successfully.`,
      data: {
        ...newShift,
        employee_count: 0,
        start_time_formatted: formatTime(newShift.start_time),
        end_time_formatted: formatTime(newShift.end_time)
      }
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating shift:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to create shift.',
      error: err.message
    });
  } finally {
    client.release();
  }
});

// ============================================================================
// 7. PUT /api/shifts/:id - Update an existing work shift
// ============================================================================
router.put('/:id', authenticateToken, requirePermission('shifts:update'), async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const {
      name,
      code,
      description,
      start_time,
      end_time,
      break_start_time,
      break_end_time,
      break_duration_minutes = 0,
      late_grace_minutes = 0,
      grace_period_minutes,
      early_departure_grace_minutes = 0,
      working_days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      is_overnight = false,
      is_active
    } = req.body;

    // Check shift exists
    const existingRes = await client.query(`SELECT * FROM shifts WHERE id = $1;`, [id]);
    if (existingRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Shift not found.' });
    }

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Shift name is required.' });
    }

    if (!code || !code.trim()) {
      return res.status(400).json({ success: false, message: 'Shift code is required.' });
    }

    if (!start_time || !end_time) {
      return res.status(400).json({ success: false, message: 'Start time and End time are required.' });
    }

    if (!Array.isArray(working_days) || working_days.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one working day must be selected.' });
    }

    const cleanCode = code.trim().toUpperCase();
    const cleanName = name.trim();

    // Check uniqueness excluding current ID
    const duplicateCheck = await client.query(`
      SELECT id FROM shifts WHERE UPPER(code) = $1 AND id != $2;
    `, [cleanCode, id]);
    if (duplicateCheck.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: `Shift code '${cleanCode}' is already in use by another shift.`
      });
    }

    const lateGrace = Math.max(0, parseInt(late_grace_minutes || grace_period_minutes || 0, 10));
    const earlyGrace = Math.max(0, parseInt(early_departure_grace_minutes || 0, 10));
    const breakDuration = Math.max(0, parseInt(break_duration_minutes || 0, 10));

    await client.query('BEGIN');

    const updateRes = await client.query(`
      UPDATE shifts SET
        name = $1,
        code = $2,
        description = $3,
        start_time = $4,
        end_time = $5,
        break_start_time = $6,
        break_end_time = $7,
        break_duration_minutes = $8,
        late_grace_minutes = $9,
        grace_period_minutes = $9,
        early_departure_grace_minutes = $10,
        working_days = $11,
        is_overnight = $12,
        is_active = COALESCE($13, is_active),
        updated_by = $14,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $15
      RETURNING *;
    `, [
      cleanName, cleanCode, description ? description.trim() : null,
      start_time, end_time,
      break_start_time || null, break_end_time || null, breakDuration,
      lateGrace, earlyGrace,
      working_days, Boolean(is_overnight), is_active !== undefined ? Boolean(is_active) : null,
      req.user?.id || null, id
    ]);

    const updatedShift = updateRes.rows[0];

    // Sync working days
    await client.query(`DELETE FROM shift_working_days WHERE shift_id = $1;`, [id]);
    const daysMap = {
      Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6, Sunday: 7
    };
    for (const day of working_days) {
      if (daysMap[day]) {
        await client.query(`
          INSERT INTO shift_working_days (shift_id, day_of_week, day_number, is_working_day)
          VALUES ($1, $2, $3, true);
        `, [id, day, daysMap[day]]);
      }
    }

    await client.query('COMMIT');

    return res.json({
      success: true,
      message: `Shift '${cleanName}' updated successfully.`,
      data: {
        ...updatedShift,
        start_time_formatted: formatTime(updatedShift.start_time),
        end_time_formatted: formatTime(updatedShift.end_time)
      }
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error updating shift:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to update shift.',
      error: err.message
    });
  } finally {
    client.release();
  }
});

// ============================================================================
// 8. PATCH /api/shifts/:id/status - Toggle shift active / inactive status
// ============================================================================
router.patch('/:id/status', authenticateToken, requirePermission('shifts:delete'), async (req, res) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;

    if (typeof is_active !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'Missing or invalid is_active boolean value.'
      });
    }

    const shiftRes = await pool.query(`SELECT id, name, is_active FROM shifts WHERE id = $1;`, [id]);
    if (shiftRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Shift not found.' });
    }

    const updatedRes = await pool.query(`
      UPDATE shifts 
      SET is_active = $1, updated_by = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING *;
    `, [is_active, req.user?.id || null, id]);

    const updated = updatedRes.rows[0];

    return res.json({
      success: true,
      message: `Shift '${updated.name}' has been ${is_active ? 'activated' : 'deactivated'} successfully.`,
      data: updated
    });
  } catch (err) {
    console.error('Error toggling shift status:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to toggle shift status.',
      error: err.message
    });
  }
});

// ============================================================================
// 9. DELETE /api/shifts/:id - Safe permanent delete of unused shift
// ============================================================================
router.delete('/:id', authenticateToken, requirePermission('shifts:delete'), async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;

    const shiftRes = await client.query(`SELECT id, name, code FROM shifts WHERE id = $1;`, [id]);
    if (shiftRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Shift not found.' });
    }
    const shift = shiftRes.rows[0];

    // Check active employee assignments
    const activeEmpCheck = await client.query(`
      SELECT COUNT(*) as count FROM employees WHERE current_shift_id = $1;
    `, [id]);
    if (parseInt(activeEmpCheck.rows[0].count, 10) > 0) {
      return res.status(409).json({
        success: false,
        message: `Cannot delete shift '${shift.name}' because ${activeEmpCheck.rows[0].count} employee(s) are currently assigned to it. Please reassign them or deactivate the shift instead.`
      });
    }

    // Check historical assignments
    const historyCheck = await client.query(`
      SELECT COUNT(*) as count FROM shift_assignments WHERE shift_id = $1;
    `, [id]);
    if (parseInt(historyCheck.rows[0].count, 10) > 0) {
      return res.status(409).json({
        success: false,
        message: `Cannot delete shift '${shift.name}' because it contains ${historyCheck.rows[0].count} historical assignment record(s). Deactivate the shift to preserve audit integrity.`
      });
    }

    // Check attendance records if table has shift_id
    const attCheck = await client.query(`
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'attendance_records' AND column_name = 'shift_id';
    `);
    if (attCheck.rows.length > 0) {
      const attRecordCheck = await client.query(`
        SELECT COUNT(*) as count FROM attendance_records WHERE shift_id = $1;
      `, [id]);
      if (parseInt(attRecordCheck.rows[0].count, 10) > 0) {
        return res.status(409).json({
          success: false,
          message: `Cannot delete shift '${shift.name}' because historical attendance logs are linked to it.`
        });
      }
    }

    await client.query('BEGIN');
    await client.query(`DELETE FROM shift_working_days WHERE shift_id = $1;`, [id]);
    await client.query(`DELETE FROM shifts WHERE id = $1;`, [id]);
    await client.query('COMMIT');

    return res.json({
      success: true,
      message: `Shift '${shift.name}' (${shift.code}) was deleted permanently.`
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error deleting shift:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete shift.',
      error: err.message
    });
  } finally {
    client.release();
  }
});

// ============================================================================
// 10. POST /api/shifts/assign - Assign or reassign an employee to a work shift
// ============================================================================
router.post('/assign', authenticateToken, requirePermission('shifts:assign'), async (req, res) => {
  const client = await pool.connect();
  try {
    const { employee_id, shift_id, start_date, end_date, reason } = req.body;

    if (!employee_id) {
      return res.status(400).json({ success: false, message: 'Employee selection is required.' });
    }

    if (!shift_id) {
      return res.status(400).json({ success: false, message: 'Target shift selection is required.' });
    }

    const effectiveFrom = start_date || new Date().toISOString().split('T')[0];

    // Check employee
    const empRes = await client.query(`
      SELECT id, employee_code, first_name, last_name, current_shift_id 
      FROM employees WHERE id = $1;
    `, [employee_id]);
    if (empRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Employee not found.' });
    }
    const emp = empRes.rows[0];
    const empFullName = `${emp.first_name} ${emp.last_name || ''}`.trim();

    // Check target shift
    const shiftRes = await client.query(`
      SELECT id, name, code, is_active FROM shifts WHERE id = $1;
    `, [shift_id]);
    if (shiftRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Target shift not found.' });
    }
    const targetShift = shiftRes.rows[0];

    // Prevent assigning inactive shift
    if (!targetShift.is_active) {
      return res.status(400).json({
        success: false,
        message: `Shift '${targetShift.name}' is currently inactive and cannot be assigned to employees.`
      });
    }

    // Prevent duplicate assignment to same active shift
    if (emp.current_shift_id === shift_id) {
      return res.status(400).json({
        success: false,
        message: 'This employee is already assigned to this shift.'
      });
    }

    await client.query('BEGIN');

    // 1. Deactivate previous active shift assignment in history
    await client.query(`
      UPDATE shift_assignments
      SET is_active = false, end_date = $1, updated_at = CURRENT_TIMESTAMP
      WHERE employee_id = $2 AND is_active = true;
    `, [effectiveFrom, employee_id]);

    // 2. Insert new assignment history record
    await client.query(`
      INSERT INTO shift_assignments (
        employee_id, shift_id, start_date, end_date, is_active, assigned_by, reason, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, true, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      );
    `, [
      employee_id,
      shift_id,
      effectiveFrom,
      end_date || null,
      req.user?.id || null,
      reason ? reason.trim() : 'Work schedule assignment'
    ]);

    // 3. Update employee's current_shift_id
    await client.query(`
      UPDATE employees
      SET current_shift_id = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2;
    `, [shift_id, employee_id]);

    await client.query('COMMIT');

    return res.json({
      success: true,
      message: `${empFullName} (${emp.employee_code}) has been assigned to '${targetShift.name}' successfully.`
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error assigning shift to employee:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to assign shift.',
      error: err.message
    });
  } finally {
    client.release();
  }
});

// ============================================================================
// 11. GET /api/shifts/employee/:employeeId/history - Employee's individual history
// ============================================================================
router.get('/employee/:employeeId/history', authenticateToken, async (req, res) => {
  try {
    const { employeeId } = req.params;

    const result = await pool.query(`
      SELECT 
        sa.id,
        sa.shift_id,
        sa.start_date,
        sa.end_date,
        sa.is_active,
        sa.reason,
        sa.created_at,
        s.name as shift_name,
        s.code as shift_code,
        s.start_time,
        s.end_time,
        s.working_days,
        u.email as assigned_by_email
      FROM shift_assignments sa
      JOIN shifts s ON sa.shift_id = s.id
      LEFT JOIN users u ON sa.assigned_by = u.id
      WHERE sa.employee_id = $1
      ORDER BY sa.start_date DESC, sa.created_at DESC;
    `, [employeeId]);

    const formatted = result.rows.map(r => ({
      ...r,
      start_time_formatted: formatTime(r.start_time),
      end_time_formatted: formatTime(r.end_time)
    }));

    return res.json({
      success: true,
      count: formatted.length,
      data: formatted
    });
  } catch (err) {
    console.error('Error fetching employee shift history:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve employee shift history.',
      error: err.message
    });
  }
});

module.exports = router;
