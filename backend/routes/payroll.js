const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken, requireRole, requirePermission } = require('../middleware/auth');

/**
 * Helper: Formats currency amounts safely
 */
function toCurrency(num) {
  return Math.round((Number(num) || 0) * 100) / 100;
}

/**
 * Helper: Computes attendance metrics & payable days for an employee for a given month & year
 */
async function computeAttendanceMetrics(client, employeeId, month, year) {
  const startDateStr = `${year}-${String(month).padStart(2, '0')}-01`;
  const totalDaysInMonth = new Date(year, month, 0).getDate();
  const endDateStr = `${year}-${String(month).padStart(2, '0')}-${String(totalDaysInMonth).padStart(2, '0')}`;

  // 1. Fetch attendance records in this month
  const attRes = await client.query(`
    SELECT status, count(*) as count
    FROM attendance_records
    WHERE employee_id = $1 
      AND attendance_date >= $2 
      AND attendance_date <= $3
    GROUP BY status;
  `, [employeeId, startDateStr, endDateStr]);

  let presentDays = 0;
  let halfDays = 0;
  let absentDays = 0;

  attRes.rows.forEach(r => {
    const c = parseInt(r.count, 10);
    if (r.status === 'Present' || r.status === 'Late') {
      presentDays += c;
    } else if (r.status === 'Half Day') {
      halfDays += c;
    } else if (r.status === 'Absent') {
      absentDays += c;
    }
  });

  // Effective present days = full present + 0.5 * half days
  const effectivePresentDays = presentDays + (halfDays * 0.5);

  // 2. Fetch approved leaves overlapping this month
  const leaveRes = await client.query(`
    SELECT lr.start_date, lr.end_date, lr.total_days, lt.is_paid, lt.name as leave_type_name
    FROM leave_requests lr
    JOIN leave_types lt ON lr.leave_type_id = lt.id
    WHERE lr.employee_id = $1
      AND lr.status = 'Approved'
      AND lr.start_date <= $3
      AND lr.end_date >= $2;
  `, [employeeId, startDateStr, endDateStr]);

  let paidLeaveDays = 0;
  let unpaidLeaveDays = 0;

  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month - 1, totalDaysInMonth);

  leaveRes.rows.forEach(lr => {
    const lStart = new Date(lr.start_date);
    const lEnd = new Date(lr.end_date);
    const overlapStart = lStart < monthStart ? monthStart : lStart;
    const overlapEnd = lEnd > monthEnd ? monthEnd : lEnd;
    const daysInMonth = Math.max(0, Math.floor((overlapEnd - overlapStart) / (1000 * 60 * 60 * 24)) + 1);

    if (lr.is_paid) {
      paidLeaveDays += daysInMonth;
    } else {
      unpaidLeaveDays += daysInMonth;
    }
  });

  // 3. Count official school holidays and weekend off-days in this month
  let sundaysCount = 0;
  for (let d = 1; d <= totalDaysInMonth; d++) {
    const dateObj = new Date(year, month - 1, d);
    if (dateObj.getDay() === 0) {
      sundaysCount++;
    }
  }

  const holidayRes = await client.query(`
    SELECT count(*) as count
    FROM calendar_events
    WHERE event_type IN ('Holiday', 'School Closure')
      AND start_date <= $2 
      AND end_date >= $1;
  `, [startDateStr, endDateStr]);

  const holidayCount = parseInt(holidayRes.rows[0].count, 10) || 0;

  // Standard educational institutional working days = total month days - Sundays - official holidays
  const standardWorkingDays = Math.max(1, totalDaysInMonth - sundaysCount - holidayCount);

  // Unexcused absences reduce payable days
  // Payable days: month calendar days minus unpaid leaves and unexcused absences
  const lossOfPayDays = unpaidLeaveDays + absentDays;
  const payableDays = Math.max(0, totalDaysInMonth - lossOfPayDays);

  return {
    total_days_in_month: totalDaysInMonth,
    standard_working_days: standardWorkingDays,
    present_days: effectivePresentDays,
    half_days: halfDays,
    absent_days: absentDays,
    paid_leave_days: paidLeaveDays,
    unpaid_leave_days: unpaidLeaveDays,
    payable_days: payableDays,
    loss_of_pay_days: lossOfPayDays,
    holidays_count: holidayCount,
    sundays_count: sundaysCount
  };
}

/**
 * Helper: Computes earnings, deductions, and net salary using active salary structure items
 */
function calculateSalaryComponents(monthlyGross, items, payableDays, totalDaysInMonth) {
  const prorationFactor = totalDaysInMonth > 0 ? (payableDays / totalDaysInMonth) : 1;
  const earnings = [];
  const deductions = [];

  let basicAmount = 0;

  // First pass: Calculate Basic Salary
  const basicItem = items.find(i => (i.component_code || '').toUpperCase() === 'BASIC');
  if (basicItem) {
    if (basicItem.calculation_type === 'percentage') {
      basicAmount = (Number(monthlyGross) * Number(basicItem.percentage)) / 100;
    } else {
      basicAmount = Number(basicItem.fixed_amount) || 0;
    }
  } else {
    basicAmount = Number(monthlyGross) * 0.5; // Fallback 50%
  }

  // Second pass: Calculate All Earnings
  let totalEarnings = 0;
  for (const item of items) {
    if (item.component_type === 'Earning') {
      let fullAmount = 0;
      if (item.calculation_type === 'percentage') {
        fullAmount = (Number(monthlyGross) * Number(item.percentage)) / 100;
      } else {
        fullAmount = Number(item.fixed_amount) || 0;
      }

      // Prorated based on payable days
      const proratedAmount = toCurrency(fullAmount * prorationFactor);
      totalEarnings += proratedAmount;

      earnings.push({
        id: item.salary_component_id,
        name: item.component_name,
        code: item.component_code,
        calculation_type: item.calculation_type,
        rate: item.calculation_type === 'percentage' ? `${item.percentage}%` : 'Fixed',
        full_amount: toCurrency(fullAmount),
        amount: proratedAmount
      });
    }
  }

  // Third pass: Calculate Deductions
  let totalDeductions = 0;
  for (const item of items) {
    if (item.component_type === 'Deduction') {
      let amount = 0;
      if (item.calculation_type === 'percentage') {
        const baseForPct = item.percentage_of_component_code === 'BASIC' ? basicAmount : monthlyGross;
        amount = (Number(baseForPct) * Number(item.percentage)) / 100;
      } else {
        amount = Number(item.fixed_amount) || 0;
      }

      // Round deduction
      amount = toCurrency(amount);
      totalDeductions += amount;

      deductions.push({
        id: item.salary_component_id,
        name: item.component_name,
        code: item.component_code,
        calculation_type: item.calculation_type,
        rate: item.calculation_type === 'percentage' ? `${item.percentage}%` : 'Fixed',
        amount: amount
      });
    }
  }

  const lossOfPay = toCurrency(Number(monthlyGross) - totalEarnings);
  const netSalary = Math.max(0, toCurrency(totalEarnings - totalDeductions));

  return {
    gross_earnings: toCurrency(totalEarnings),
    total_deductions: toCurrency(totalDeductions),
    loss_of_pay: lossOfPay,
    net_salary: netSalary,
    earnings,
    deductions
  };
}

// ============================================================================
// 1. GET /api/payroll/overview: Top Dashboard KPIs & Status
// ============================================================================
router.get('/overview', authenticateToken, requireRole('Super Admin', 'Administrator', 'HR'), async (req, res) => {
  try {
    const month = parseInt(req.query.month, 10) || (new Date().getMonth() + 1);
    const year = parseInt(req.query.year, 10) || new Date().getFullYear();

    // Total active employees
    const empRes = await pool.query(`
      SELECT count(*) as count 
      FROM employees 
      WHERE employment_status IN ('Active', 'Probation');
    `);
    const totalEmployees = parseInt(empRes.rows[0].count, 10) || 0;

    // Payroll records for this month
    const payRes = await pool.query(`
      SELECT 
        count(*) as total_records,
        count(*) FILTER (WHERE status = 'processed') as processed_count,
        count(*) FILTER (WHERE status = 'approved') as approved_count,
        count(*) FILTER (WHERE status = 'paid') as paid_count,
        count(*) FILTER (WHERE status = 'draft') as draft_count,
        COALESCE(SUM(gross_earnings), 0) as total_gross,
        COALESCE(SUM(total_deductions), 0) as total_deductions,
        COALESCE(SUM(net_salary), 0) as total_net,
        COALESCE(SUM(loss_of_pay), 0) as total_lop
      FROM payroll_records
      WHERE payroll_month = $1 AND payroll_year = $2;
    `, [month, year]);

    const stats = payRes.rows[0];
    const totalProcessed = parseInt(stats.processed_count, 10) + parseInt(stats.approved_count, 10) + parseInt(stats.paid_count, 10);
    const pendingEmployees = Math.max(0, totalEmployees - totalProcessed);

    // Determine aggregate month run status
    let runStatus = 'Pending Run';
    if (parseInt(stats.paid_count, 10) > 0 && parseInt(stats.paid_count, 10) === totalEmployees) {
      runStatus = 'Paid';
    } else if (parseInt(stats.approved_count, 10) > 0) {
      runStatus = 'Approved';
    } else if (totalProcessed > 0) {
      runStatus = 'Processed';
    } else if (parseInt(stats.draft_count, 10) > 0) {
      runStatus = 'Draft';
    }

    // Department-wise payroll breakdown
    const deptRes = await pool.query(`
      SELECT 
        d.name as department_name,
        count(pr.id) as employee_count,
        COALESCE(SUM(pr.gross_earnings), 0) as gross_amount,
        COALESCE(SUM(pr.net_salary), 0) as net_amount
      FROM payroll_records pr
      JOIN employees e ON pr.employee_id = e.id
      JOIN departments d ON e.department_id = d.id
      WHERE pr.payroll_month = $1 AND pr.payroll_year = $2
      GROUP BY d.name
      ORDER BY net_amount DESC;
    `, [month, year]);

    res.json({
      success: true,
      data: {
        month,
        year,
        month_name: new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        total_employees: totalEmployees,
        processed_employees: totalProcessed,
        pending_employees: pendingEmployees,
        gross_payroll: toCurrency(stats.total_gross),
        total_deductions: toCurrency(stats.total_deductions),
        net_payroll: toCurrency(stats.total_net),
        loss_of_pay: toCurrency(stats.total_lop),
        run_status: runStatus,
        breakdown_by_department: deptRes.rows
      }
    });
  } catch (error) {
    console.error('Payroll overview error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch payroll overview', error: error.message });
  }
});

// ============================================================================
// 2. GET /api/payroll/records: Searchable & Filterable Monthly Register
// ============================================================================
router.get('/records', authenticateToken, requireRole('Super Admin', 'Administrator', 'HR'), async (req, res) => {
  try {
    const month = parseInt(req.query.month, 10) || (new Date().getMonth() + 1);
    const year = parseInt(req.query.year, 10) || new Date().getFullYear();
    const { department_id, status, search } = req.query;

    let query = `
      SELECT 
        pr.id,
        pr.employee_id,
        pr.salary_assignment_id,
        pr.payroll_month,
        pr.payroll_year,
        pr.gross_earnings,
        pr.total_deductions,
        pr.loss_of_pay,
        pr.net_salary,
        pr.status,
        pr.total_working_days,
        pr.present_days,
        pr.paid_leave_days,
        pr.unpaid_leave_days,
        pr.payable_days,
        pr.processed_at,
        pr.approved_at,
        pr.paid_at,
        pr.payment_method,
        e.employee_code,
        e.first_name,
        e.last_name,
        e.employment_status,
        d.name as department_name,
        des.name as designation_name,
        esa.monthly_gross as base_monthly_gross
      FROM payroll_records pr
      JOIN employees e ON pr.employee_id = e.id
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN designations des ON e.designation_id = des.id
      LEFT JOIN employee_salary_assignments esa ON pr.salary_assignment_id = esa.id
      WHERE pr.payroll_month = $1 AND pr.payroll_year = $2
    `;

    const params = [month, year];

    if (department_id) {
      params.push(department_id);
      query += ` AND e.department_id = $${params.length}`;
    }

    if (status) {
      params.push(status.toLowerCase());
      query += ` AND LOWER(pr.status) = $${params.length}`;
    }

    if (search) {
      params.push(`%${search.trim()}%`);
      query += ` AND (
        e.first_name ILIKE $${params.length} OR 
        e.last_name ILIKE $${params.length} OR 
        e.employee_code ILIKE $${params.length} OR 
        des.name ILIKE $${params.length}
      )`;
    }

    query += ` ORDER BY e.first_name ASC, e.last_name ASC;`;

    const recordsRes = await pool.query(query, params);

    res.json({
      success: true,
      data: recordsRes.rows
    });
  } catch (error) {
    console.error('Payroll records error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch payroll records', error: error.message });
  }
});

// ============================================================================
// 3. GET /api/payroll/records/:id: Single Record Detail with Calculations
// ============================================================================
router.get('/records/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const recordRes = await pool.query(`
      SELECT 
        pr.*,
        e.employee_code,
        e.first_name,
        e.last_name,
        e.personal_email,
        e.work_email,
        e.joining_date,
        e.employment_status,
        d.name as department_name,
        des.name as designation_name,
        esa.annual_ctc,
        esa.monthly_gross as assigned_monthly_gross,
        ss.name as structure_name,
        u_app.email as approved_by_email
      FROM payroll_records pr
      JOIN employees e ON pr.employee_id = e.id
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN designations des ON e.designation_id = des.id
      LEFT JOIN employee_salary_assignments esa ON pr.salary_assignment_id = esa.id
      LEFT JOIN salary_structures ss ON esa.salary_structure_id = ss.id
      LEFT JOIN users u_app ON pr.approved_by = u_app.id
      WHERE pr.id = $1;
    `, [id]);

    if (recordRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Payroll record not found.' });
    }

    const record = recordRes.rows[0];

    // Strict ownership & RBAC protection: Only HR/Admin or the record owner can view
    const userRole = (req.user.role || '').toLowerCase();
    const isHrOrAdmin = ['super admin', 'administrator', 'admin', 'hr'].includes(userRole);
    const isOwner = req.user.employee_id && record.employee_id === req.user.employee_id;

    if (!isHrOrAdmin && !isOwner) {
      return res.status(403).json({ success: false, message: 'Access denied. You do not have permission to view this payroll record.' });
    }

    res.json({
      success: true,
      data: record
    });
  } catch (error) {
    console.error('Record detail error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch payroll record detail', error: error.message });
  }
});

// ============================================================================
// 4. POST /api/payroll/process: Run Transparent Monthly Payroll Calculation
// ============================================================================
router.post('/process', authenticateToken, requireRole('Super Admin', 'Administrator', 'HR'), async (req, res) => {

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const month = parseInt(req.body.month, 10) || (new Date().getMonth() + 1);
    const year = parseInt(req.body.year, 10) || new Date().getFullYear();

    // 1. Fetch all active employees with their active salary assignments
    const empsRes = await client.query(`
      SELECT 
        e.id as employee_id,
        e.employee_code,
        e.first_name,
        e.last_name,
        esa.id as salary_assignment_id,
        esa.salary_structure_id,
        esa.monthly_gross,
        esa.annual_ctc
      FROM employees e
      JOIN employee_salary_assignments esa ON e.id = esa.employee_id AND esa.is_active = true
      WHERE e.employment_status IN ('Active', 'Probation')
      ORDER BY e.first_name ASC;
    `);

    if (empsRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'No active employees with assigned salary structures were found to process.'
      });
    }

    // 2. Pre-fetch salary structure items
    const structItemsRes = await client.query(`
      SELECT 
        ssi.*,
        sc.name as component_name,
        sc.code as component_code,
        sc.component_type,
        sc_pct.code as percentage_of_component_code
      FROM salary_structure_items ssi
      JOIN salary_components sc ON ssi.salary_component_id = sc.id
      LEFT JOIN salary_components sc_pct ON ssi.percentage_of_component_id = sc_pct.id
      ORDER BY ssi.display_order ASC;
    `);

    const itemsByStructure = {};
    structItemsRes.rows.forEach(item => {
      if (!itemsByStructure[item.salary_structure_id]) {
        itemsByStructure[item.salary_structure_id] = [];
      }
      itemsByStructure[item.salary_structure_id].push(item);
    });

    const processedResults = [];

    // 3. Compute each employee's attendance, leaves, payable days, and compensation
    for (const emp of empsRes.rows) {
      const metrics = await computeAttendanceMetrics(client, emp.employee_id, month, year);
      const structItems = itemsByStructure[emp.salary_structure_id] || [];

      const calc = calculateSalaryComponents(
        emp.monthly_gross,
        structItems,
        metrics.payable_days,
        metrics.total_days_in_month
      );

      const breakdownJson = {
        metrics,
        earnings: calc.earnings,
        deductions: calc.deductions,
        monthly_base_gross: emp.monthly_gross,
        annual_ctc: emp.annual_ctc
      };

      // Upsert record into payroll_records
      const upsertRes = await client.query(`
        INSERT INTO payroll_records (
          employee_id,
          salary_assignment_id,
          payroll_month,
          payroll_year,
          gross_earnings,
          total_deductions,
          loss_of_pay,
          overtime_amount,
          net_salary,
          status,
          total_working_days,
          present_days,
          paid_leave_days,
          unpaid_leave_days,
          payable_days,
          breakdown_json,
          processed_at,
          updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, 0, $8, 'processed', $9, $10, $11, $12, $13, $14, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
        ON CONFLICT (employee_id, payroll_month, payroll_year) DO UPDATE SET
          salary_assignment_id = EXCLUDED.salary_assignment_id,
          gross_earnings = EXCLUDED.gross_earnings,
          total_deductions = EXCLUDED.total_deductions,
          loss_of_pay = EXCLUDED.loss_of_pay,
          net_salary = EXCLUDED.net_salary,
          status = CASE WHEN payroll_records.status = 'paid' THEN 'paid' ELSE 'processed' END,
          total_working_days = EXCLUDED.total_working_days,
          present_days = EXCLUDED.present_days,
          paid_leave_days = EXCLUDED.paid_leave_days,
          unpaid_leave_days = EXCLUDED.unpaid_leave_days,
          payable_days = EXCLUDED.payable_days,
          breakdown_json = EXCLUDED.breakdown_json,
          processed_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        RETURNING id, employee_id, net_salary, status;
      `, [
        emp.employee_id,
        emp.salary_assignment_id,
        month,
        year,
        calc.gross_earnings,
        calc.total_deductions,
        calc.loss_of_pay,
        calc.net_salary,
        metrics.total_days_in_month,
        metrics.present_days,
        metrics.paid_leave_days,
        metrics.unpaid_leave_days,
        metrics.payable_days,
        JSON.stringify(breakdownJson)
      ]);

      processedResults.push({
        record_id: upsertRes.rows[0].id,
        employee_code: emp.employee_code,
        employee_name: `${emp.first_name} ${emp.last_name}`,
        payable_days: metrics.payable_days,
        net_salary: calc.net_salary
      });
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      message: `Successfully processed payroll for ${processedResults.length} staff members for ${new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}.`,
      count: processedResults.length,
      data: processedResults
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Payroll processing error:', error);
    res.status(500).json({ success: false, message: 'Failed to process monthly payroll', error: error.message });
  } finally {
    client.release();
  }
});

// ============================================================================
// 5. POST /api/payroll/records/:id/status: Transition Record Status
// ============================================================================
router.post('/records/:id/status', authenticateToken, requireRole('Super Admin', 'Administrator', 'HR'), async (req, res) => {
  try {
    const { id } = req.params;
    const { status, remarks } = req.body;

    const validStatuses = ['draft', 'processed', 'approved', 'paid'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

    const userRole = (req.user.role || '').toLowerCase();
    // Approval and Paid status require Principal / Super Admin or Administrator privileges
    if ((status === 'approved' || status === 'paid') && !(userRole === 'super admin' || userRole === 'administrator' || userRole === 'admin')) {
      return res.status(403).json({
        success: false,
        message: 'Approving or marking payroll as Paid requires Principal / Super Admin or Administrator executive authorization.'
      });
    }

    const updates = [];
    const params = [id, status];

    let query = `
      UPDATE payroll_records
      SET status = $2, updated_at = CURRENT_TIMESTAMP
    `;

    if (status === 'approved') {
      params.push(req.user.id);
      query += `, approved_by = $${params.length}, approved_at = CURRENT_TIMESTAMP`;
    } else if (status === 'paid') {
      query += `, paid_at = CURRENT_TIMESTAMP`;
    }

    if (remarks) {
      params.push(remarks);
      query += `, remarks = $${params.length}`;
    }

    query += ` WHERE id = $1 RETURNING *;`;

    const updateRes = await pool.query(query, params);

    if (updateRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Payroll record not found.' });
    }

    res.json({
      success: true,
      message: `Payroll status updated to "${status}".`,
      data: updateRes.rows[0]
    });
  } catch (error) {
    console.error('Update record status error:', error);
    res.status(500).json({ success: false, message: 'Failed to update payroll status', error: error.message });
  }
});

// ============================================================================
// 6. POST /api/payroll/batch-status: Approve All or Mark All as Paid for Month
// ============================================================================
router.post('/batch-status', authenticateToken, async (req, res) => {
  try {
    const { month, year, status } = req.body;
    const userRole = (req.user.role || '').toLowerCase();

    if (!(userRole === 'super admin' || userRole === 'administrator' || userRole === 'admin')) {
      return res.status(403).json({
        success: false,
        message: 'Batch approval or payment marking requires Principal / Administrator executive privileges.'
      });
    }

    if (status !== 'approved' && status !== 'paid') {
      return res.status(400).json({ success: false, message: 'Batch transition only supports "approved" or "paid".' });
    }

    let query = `
      UPDATE payroll_records
      SET status = $3, updated_at = CURRENT_TIMESTAMP
    `;
    const params = [month, year, status];

    if (status === 'approved') {
      params.push(req.user.id);
      query += `, approved_by = $4, approved_at = CURRENT_TIMESTAMP WHERE payroll_month = $1 AND payroll_year = $2 AND status = 'processed' RETURNING id;`;
    } else if (status === 'paid') {
      query += `, paid_at = CURRENT_TIMESTAMP WHERE payroll_month = $1 AND payroll_year = $2 AND status = 'approved' RETURNING id;`;
    }

    const resBatch = await pool.query(query, params);

    res.json({
      success: true,
      message: `Successfully marked ${resBatch.rows.length} payroll records as "${status}".`,
      count: resBatch.rows.length
    });
  } catch (error) {
    console.error('Batch status error:', error);
    res.status(500).json({ success: false, message: 'Failed to perform batch payroll update', error: error.message });
  }
});

// ============================================================================
// 7. GET /api/payroll/components: List Salary Components (Earnings & Deductions)
// ============================================================================
router.get('/components', authenticateToken, requireRole('Super Admin', 'Administrator', 'HR'), async (req, res) => {
  try {
    const comps = await pool.query(`
      SELECT * FROM salary_components 
      ORDER BY component_type DESC, name ASC;
    `);

    res.json({
      success: true,
      data: comps.rows
    });
  } catch (error) {
    console.error('Components fetch error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch salary components', error: error.message });
  }
});

// ============================================================================
// 8. POST /api/payroll/components: Create or Update Salary Component
// ============================================================================
router.post('/components', authenticateToken, requireRole('Super Admin', 'Administrator', 'HR'), async (req, res) => {
  try {

    const { id, name, code, component_type, description, is_taxable } = req.body;

    if (!name || !code || !component_type) {
      return res.status(400).json({ success: false, message: 'Name, code, and component type (Earning/Deduction) are required.' });
    }

    if (id) {
      const updateRes = await pool.query(`
        UPDATE salary_components
        SET name = $1, description = $2, is_taxable = $3, updated_at = CURRENT_TIMESTAMP
        WHERE id = $4
        RETURNING *;
      `, [name, description, is_taxable !== false, id]);

      return res.json({
        success: true,
        message: 'Salary component updated successfully.',
        data: updateRes.rows[0]
      });
    }

    const insRes = await pool.query(`
      INSERT INTO salary_components (name, code, component_type, description, is_taxable, is_active)
      VALUES ($1, $2, $3, $4, $5, true)
      RETURNING *;
    `, [name, code.toUpperCase().trim(), component_type, description, is_taxable !== false]);

    res.status(201).json({
      success: true,
      message: 'Salary component created successfully.',
      data: insRes.rows[0]
    });
  } catch (error) {
    console.error('Component save error:', error);
    res.status(500).json({ success: false, message: 'Failed to save salary component', error: error.message });
  }
});

// ============================================================================
// 9. GET /api/payroll/structures: Salary Structures with Formula Items
// ============================================================================
router.get('/structures', authenticateToken, requireRole('Super Admin', 'Administrator', 'HR'), async (req, res) => {
  try {
    const structsRes = await pool.query(`
      SELECT * FROM salary_structures WHERE is_active = true ORDER BY name ASC;
    `);

    const itemsRes = await pool.query(`
      SELECT 
        ssi.*,
        sc.name as component_name,
        sc.code as component_code,
        sc.component_type,
        sc_pct.code as percentage_of_component_code
      FROM salary_structure_items ssi
      JOIN salary_components sc ON ssi.salary_component_id = sc.id
      LEFT JOIN salary_components sc_pct ON ssi.percentage_of_component_id = sc_pct.id
      ORDER BY ssi.display_order ASC;
    `);

    const itemsMap = {};
    itemsRes.rows.forEach(item => {
      if (!itemsMap[item.salary_structure_id]) {
        itemsMap[item.salary_structure_id] = [];
      }
      itemsMap[item.salary_structure_id].push(item);
    });

    const structuresWithItems = structsRes.rows.map(s => ({
      ...s,
      items: itemsMap[s.id] || []
    }));

    res.json({
      success: true,
      data: structuresWithItems
    });
  } catch (error) {
    console.error('Structures fetch error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch salary structures', error: error.message });
  }
});

// ============================================================================
// 10. GET /api/payroll/assignments: Employee Salary Assignment Directory
// ============================================================================
router.get('/assignments', authenticateToken, requireRole('Super Admin', 'Administrator', 'HR'), async (req, res) => {
  try {
    const assignRes = await pool.query(`
      SELECT 
        esa.*,
        e.employee_code,
        e.first_name,
        e.last_name,
        e.employment_status,
        d.name as department_name,
        des.name as designation_name,
        ss.name as structure_name,
        ss.code as structure_code
      FROM employee_salary_assignments esa
      JOIN employees e ON esa.employee_id = e.id
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN designations des ON e.designation_id = des.id
      LEFT JOIN salary_structures ss ON esa.salary_structure_id = ss.id
      WHERE esa.is_active = true
      ORDER BY e.first_name ASC, e.last_name ASC;
    `);

    res.json({
      success: true,
      data: assignRes.rows
    });
  } catch (error) {
    console.error('Assignments fetch error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch salary assignments', error: error.message });
  }
});

// ============================================================================
// 11. POST /api/payroll/assignments: Assign or Update Employee Salary
// ============================================================================
router.post('/assignments', authenticateToken, requireRole('Super Admin', 'Administrator', 'HR'), async (req, res) => {
  try {

    const { employee_id, salary_structure_id, monthly_gross, annual_ctc, effective_from } = req.body;

    if (!employee_id || !salary_structure_id || !monthly_gross) {
      return res.status(400).json({ success: false, message: 'Employee, salary structure, and monthly gross salary are required.' });
    }

    const ctc = annual_ctc || (Number(monthly_gross) * 12);
    const effDate = effective_from || new Date().toISOString().split('T')[0];

    // Deactivate existing assignment
    await pool.query(`
      UPDATE employee_salary_assignments
      SET is_active = false, effective_to = CURRENT_DATE, updated_at = CURRENT_TIMESTAMP
      WHERE employee_id = $1 AND is_active = true;
    `, [employee_id]);

    // Insert new assignment
    const newAssign = await pool.query(`
      INSERT INTO employee_salary_assignments
        (employee_id, salary_structure_id, effective_from, annual_ctc, monthly_gross, is_active)
      VALUES ($1, $2, $3, $4, $5, true)
      RETURNING *;
    `, [employee_id, salary_structure_id, effDate, ctc, monthly_gross]);

    res.status(201).json({
      success: true,
      message: 'Employee salary structure assigned successfully.',
      data: newAssign.rows[0]
    });
  } catch (error) {
    console.error('Assignment save error:', error);
    res.status(500).json({ success: false, message: 'Failed to assign salary structure', error: error.message });
  }
});

// ============================================================================
// 12. GET /api/payroll/payslip/:id: Full Printable Payslip Payload
// ============================================================================
router.get('/payslip/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const slipRes = await pool.query(`
      SELECT 
        pr.*,
        e.employee_code,
        e.first_name,
        e.middle_name,
        e.last_name,
        e.personal_email,
        e.work_email,
        e.phone,
        e.joining_date,
        e.employment_status,
        d.name as department_name,
        des.name as designation_name,
        eba.bank_name,
        eba.account_number,
        eba.ifsc_code,
        ss.name as structure_name,
        u_app.email as approved_by_email
      FROM payroll_records pr
      JOIN employees e ON pr.employee_id = e.id
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN designations des ON e.designation_id = des.id
      LEFT JOIN employee_bank_accounts eba ON e.id = eba.employee_id AND eba.is_primary = true
      LEFT JOIN employee_salary_assignments esa ON pr.salary_assignment_id = esa.id
      LEFT JOIN salary_structures ss ON esa.salary_structure_id = ss.id
      LEFT JOIN users u_app ON pr.approved_by = u_app.id
      WHERE pr.id = $1;
    `, [id]);

    if (slipRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Payslip record not found.' });
    }

    const slip = slipRes.rows[0];

    // Strict ownership & RBAC protection: Only HR/Admin or the payslip owner can access
    const userRole = (req.user.role || '').toLowerCase();
    const isHrOrAdmin = ['super admin', 'administrator', 'admin', 'hr'].includes(userRole);
    const isOwner = req.user.employee_id && slip.employee_id === req.user.employee_id;

    if (!isHrOrAdmin && !isOwner) {
      return res.status(403).json({ success: false, message: 'Access denied. You can only view your own payslips.' });
    }

    // Breakdown parse
    const breakdown = slip.breakdown_json || {};
    const monthName = new Date(slip.payroll_year, slip.payroll_month - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    res.json({
      success: true,
      data: {
        ...slip,
        month_name: monthName,
        school_name: "St. Vincent's High School",
        school_address: "Camp, Pune - 411001, Maharashtra, India",
        affiliation: "Affiliated to CISCE / State Board of Education",
        earnings: breakdown.earnings || [],
        deductions: breakdown.deductions || [],
        metrics: breakdown.metrics || {
          total_days_in_month: slip.total_working_days,
          present_days: slip.present_days,
          paid_leave_days: slip.paid_leave_days,
          unpaid_leave_days: slip.unpaid_leave_days,
          payable_days: slip.payable_days
        }
      }
    });
  } catch (error) {
    console.error('Payslip generation error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate payslip', error: error.message });
  }
});

// ============================================================================
// 13. GET /api/payroll/my-payslips: Teacher / Employee Self-Service
// ============================================================================
router.get('/my-payslips', authenticateToken, async (req, res) => {
  try {
    const employeeId = req.user.employee_id;
    if (!employeeId) {
      return res.status(400).json({
        success: false,
        message: 'No employee record is linked to your user account.'
      });
    }

    const slipsRes = await pool.query(`
      SELECT 
        pr.id,
        pr.payroll_month,
        pr.payroll_year,
        pr.gross_earnings,
        pr.total_deductions,
        pr.loss_of_pay,
        pr.net_salary,
        pr.status,
        pr.payable_days,
        pr.total_working_days,
        pr.processed_at,
        pr.paid_at,
        e.employee_code,
        d.name as department_name,
        des.name as designation_name
      FROM payroll_records pr
      JOIN employees e ON pr.employee_id = e.id
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN designations des ON e.designation_id = des.id
      WHERE pr.employee_id = $1
      ORDER BY pr.payroll_year DESC, pr.payroll_month DESC;
    `, [employeeId]);

    const formatted = slipsRes.rows.map(r => ({
      ...r,
      month_name: new Date(r.payroll_year, r.payroll_month - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    }));

    res.json({
      success: true,
      data: formatted
    });
  } catch (error) {
    console.error('My payslips error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch personal payslips', error: error.message });
  }
});

module.exports = router;
