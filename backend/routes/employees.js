const express = require("express");
const pool = require("../db");
const { authenticateToken, requirePermission } = require("../middleware/auth");

const router = express.Router();

/**
 * Helper to generate next available sequential employee code: EMP-####
 */
async function getNextEmployeeCode() {
  const result = await pool.query(`
    SELECT employee_code 
    FROM employees 
    WHERE employee_code ~ '^EMP-[0-9]+$' 
    ORDER BY CAST(SUBSTRING(employee_code FROM 5) AS INTEGER) DESC 
    LIMIT 1;
  `);

  if (result.rows.length === 0) {
    return 'EMP-1001';
  }

  const highestNum = parseInt(result.rows[0].employee_code.replace('EMP-', ''), 10);
  const nextNum = isNaN(highestNum) ? 1001 : highestNum + 1;
  return `EMP-${nextNum}`;
}

// ---------------------------------------------------------------------------
// 1. GET ALL EMPLOYEES (Role-Aware with Search & Filters)
// ---------------------------------------------------------------------------
router.get("/", authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const userRole = (user.role || '').toLowerCase().trim();
    const hasFullRead = user.permissions.includes('employees:read') || 
      ['super admin', 'administrator', 'admin', 'hr', 'manager'].includes(userRole);

    const { status, department_id, search } = req.query;

    let baseQuery = `
      SELECT
        e.id,
        e.employee_code,
        e.first_name,
        e.middle_name,
        e.last_name,
        e.date_of_birth,
        e.gender,
        e.personal_email,
        e.work_email,
        e.phone,
        e.address,
        e.city,
        e.state,
        e.postal_code,
        e.branch_id,
        e.department_id,
        d.name AS department_name,
        d.code AS department_code,
        e.designation_id,
        des.name AS designation_name,
        des.code AS designation_code,
        e.employment_type_id,
        et.name AS employment_type_name,
        e.joining_date,
        e.employment_status,
        e.reporting_manager_id,
        TRIM(CONCAT(m.first_name, ' ', COALESCE(m.last_name, ''))) AS reporting_manager_name,
        e.current_shift_id,
        s.name AS shift_name,
        s.code AS shift_code,
        s.start_time AS shift_start_time,
        s.end_time AS shift_end_time,
        s.working_days AS shift_working_days,
        e.profile_photo_url,
        e.created_at,
        e.updated_at
      FROM employees e
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN designations des ON e.designation_id = des.id
      LEFT JOIN employment_types et ON e.employment_type_id = et.id
      LEFT JOIN employees m ON e.reporting_manager_id = m.id
      LEFT JOIN shifts s ON e.current_shift_id = s.id
    `;

    const whereClauses = [];
    const params = [];

    // If regular Employee without full read permission, only return their own record
    if (!hasFullRead) {
      if (user.employee_id) {
        params.push(user.employee_id);
        whereClauses.push(`e.id = $${params.length}`);
      } else {
        return res.json({
          success: true,
          count: 0,
          data: [],
          message: 'No associated employee record found for this account.'
        });
      }
    } else {
      // Status filter
      if (status && status.toLowerCase() !== 'all') {
        params.push(status);
        whereClauses.push(`LOWER(e.employment_status) = LOWER($${params.length})`);
      }

      // Department filter
      if (department_id && department_id !== 'all') {
        params.push(department_id);
        whereClauses.push(`e.department_id = $${params.length}`);
      }

      // Search filter
      if (search && search.trim()) {
        params.push(`%${search.trim().toLowerCase()}%`);
        const searchIdx = params.length;
        whereClauses.push(`(
          LOWER(e.first_name) LIKE $${searchIdx} OR
          LOWER(e.last_name) LIKE $${searchIdx} OR
          LOWER(CONCAT(e.first_name, ' ', e.last_name)) LIKE $${searchIdx} OR
          LOWER(e.employee_code) LIKE $${searchIdx} OR
          LOWER(COALESCE(e.work_email, '')) LIKE $${searchIdx}
        )`);
      }
    }

    if (whereClauses.length > 0) {
      baseQuery += ` WHERE ` + whereClauses.join(' AND ');
    }

    baseQuery += ` ORDER BY e.employee_code ASC`;

    const result = await pool.query(baseQuery, params);

    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    console.error("Error fetching employees:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch employees",
      error: error.message
    });
  }
});

// ---------------------------------------------------------------------------
// 2. GET SINGLE EMPLOYEE
// ---------------------------------------------------------------------------
router.get("/:id", authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const requestedId = req.params.id;
    const userRole = (user.role || '').toLowerCase().trim();
    const hasFullRead = user.permissions.includes('employees:read') || 
      ['super admin', 'administrator', 'admin', 'hr', 'manager'].includes(userRole);

    if (!hasFullRead && user.employee_id !== requestedId) {
      return res.status(403).json({
        success: false,
        message: "Access denied. You can only view your own employee profile."
      });
    }

    const result = await pool.query(`
      SELECT 
        e.*,
        d.name AS department_name,
        d.code AS department_code,
        des.name AS designation_name,
        des.code AS designation_code,
        et.name AS employment_type_name,
        TRIM(CONCAT(m.first_name, ' ', COALESCE(m.last_name, ''))) AS reporting_manager_name,
        s.name AS shift_name,
        s.code AS shift_code,
        s.start_time AS shift_start_time,
        s.end_time AS shift_end_time,
        s.working_days AS shift_working_days
      FROM employees e
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN designations des ON e.designation_id = des.id
      LEFT JOIN employment_types et ON e.employment_type_id = et.id
      LEFT JOIN employees m ON e.reporting_manager_id = m.id
      LEFT JOIN shifts s ON e.current_shift_id = s.id
      WHERE e.id = $1
    `, [requestedId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Employee not found"
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error("Error fetching employee:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch employee",
      error: error.message
    });
  }
});

// ---------------------------------------------------------------------------
// 3. CREATE EMPLOYEE (Standardized EMP-#### sequence)
// ---------------------------------------------------------------------------
router.post("/", authenticateToken, requirePermission("employees:create"), async (req, res) => {
  try {
    let {
      employee_code,
      first_name,
      middle_name,
      last_name,
      date_of_birth,
      gender,
      personal_email,
      work_email,
      phone,
      address,
      city,
      state,
      postal_code,
      branch_id,
      department_id,
      designation_id,
      employment_type_id,
      joining_date,
      employment_status,
      reporting_manager_id,
      profile_photo_url
    } = req.body;

    if (!first_name || !first_name.trim()) {
      return res.status(400).json({
        success: false,
        message: "First name is required."
      });
    }

    // Auto-generate or validate standardized EMP-#### format
    if (!employee_code || !employee_code.trim() || !employee_code.startsWith('EMP-')) {
      employee_code = await getNextEmployeeCode();
    } else {
      employee_code = employee_code.trim().toUpperCase();
    }

    // Check duplicate employee code
    const existingCode = await pool.query('SELECT id FROM employees WHERE UPPER(employee_code) = $1;', [employee_code]);
    if (existingCode.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Employee code "${employee_code}" already exists.`
      });
    }

    // Check duplicate work email if provided
    if (work_email && work_email.trim()) {
      const existingEmail = await pool.query('SELECT id FROM employees WHERE LOWER(work_email) = LOWER($1);', [work_email.trim()]);
      if (existingEmail.rows.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Work email "${work_email}" is already in use by another employee.`
        });
      }
    }

    const result = await pool.query(
      `
      INSERT INTO employees (
        employee_code, first_name, middle_name, last_name,
        date_of_birth, gender, personal_email, work_email, phone,
        address, city, state, postal_code, branch_id, department_id,
        designation_id, employment_type_id, joining_date, employment_status,
        reporting_manager_id, profile_photo_url, created_at, updated_at
      )
      VALUES (
        $1, $2, $3, $4,
        $5, $6, $7, $8, $9,
        $10, $11, $12, $13, $14, $15,
        $16, $17, $18, $19,
        $20, $21, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
      RETURNING *
      `,
      [
        employee_code,
        first_name.trim(),
        middle_name ? middle_name.trim() : null,
        last_name ? last_name.trim() : '',
        date_of_birth || null,
        gender || null,
        personal_email ? personal_email.trim() : null,
        work_email ? work_email.trim() : null,
        phone ? phone.trim() : null,
        address || null,
        city || 'Pune',
        state || 'Maharashtra',
        postal_code || null,
        branch_id || null,
        department_id || null,
        designation_id || null,
        employment_type_id || null,
        joining_date || new Date().toISOString().slice(0, 10),
        employment_status || 'Active',
        reporting_manager_id || null,
        profile_photo_url || null
      ]
    );

    res.status(201).json({
      success: true,
      message: `Employee "${first_name} ${last_name || ''}" created successfully with code ${employee_code}.`,
      data: result.rows[0]
    });
  } catch (error) {
    console.error("Error creating employee:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to create employee record.",
      error: error.message
    });
  }
});

// ---------------------------------------------------------------------------
// 4. UPDATE EMPLOYEE (Requires employees:update permission)
// ---------------------------------------------------------------------------
router.put("/:id", authenticateToken, requirePermission("employees:update"), async (req, res) => {
  try {
    const employeeId = req.params.id;
    const {
      employee_code,
      first_name,
      middle_name,
      last_name,
      date_of_birth,
      gender,
      personal_email,
      work_email,
      phone,
      address,
      city,
      state,
      postal_code,
      branch_id,
      department_id,
      designation_id,
      employment_type_id,
      joining_date,
      employment_status,
      reporting_manager_id,
      profile_photo_url
    } = req.body;

    if (!first_name || !first_name.trim()) {
      return res.status(400).json({
        success: false,
        message: "First name is required."
      });
    }

    // Check that employee exists
    const existing = await pool.query('SELECT id FROM employees WHERE id = $1;', [employeeId]);
    if (existing.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Employee record not found."
      });
    }

    // Check duplicate employee_code on other records
    if (employee_code) {
      const codeCheck = await pool.query(
        'SELECT id FROM employees WHERE UPPER(employee_code) = UPPER($1) AND id != $2;',
        [employee_code.trim(), employeeId]
      );
      if (codeCheck.rows.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Employee code "${employee_code}" is already in use by another employee.`
        });
      }
    }

    // Check duplicate work_email on other records
    if (work_email && work_email.trim()) {
      const emailCheck = await pool.query(
        'SELECT id FROM employees WHERE LOWER(work_email) = LOWER($1) AND id != $2;',
        [work_email.trim(), employeeId]
      );
      if (emailCheck.rows.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Work email "${work_email}" is already assigned to another employee.`
        });
      }
    }

    // Prevent circular reporting manager
    if (reporting_manager_id && reporting_manager_id === employeeId) {
      return res.status(400).json({
        success: false,
        message: "An employee cannot be their own reporting manager."
      });
    }

    const result = await pool.query(
      `
      UPDATE employees
      SET
        employee_code = COALESCE($1, employee_code),
        first_name = $2,
        middle_name = $3,
        last_name = $4,
        date_of_birth = $5,
        gender = $6,
        personal_email = $7,
        work_email = $8,
        phone = $9,
        address = $10,
        city = $11,
        state = $12,
        postal_code = $13,
        branch_id = $14,
        department_id = $15,
        designation_id = $16,
        employment_type_id = $17,
        joining_date = $18,
        employment_status = COALESCE($19, employment_status),
        reporting_manager_id = $20,
        profile_photo_url = $21,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $22
      RETURNING *
      `,
      [
        employee_code ? employee_code.trim().toUpperCase() : null,
        first_name.trim(),
        middle_name ? middle_name.trim() : null,
        last_name ? last_name.trim() : '',
        date_of_birth || null,
        gender || null,
        personal_email ? personal_email.trim() : null,
        work_email ? work_email.trim() : null,
        phone ? phone.trim() : null,
        address || null,
        city || 'Pune',
        state || 'Maharashtra',
        postal_code || null,
        branch_id || null,
        department_id || null,
        designation_id || null,
        employment_type_id || null,
        joining_date || null,
        employment_status || null,
        reporting_manager_id || null,
        profile_photo_url || null,
        employeeId
      ]
    );

    res.json({
      success: true,
      message: `Employee "${first_name} ${last_name || ''}" updated successfully.`,
      data: result.rows[0]
    });
  } catch (error) {
    console.error("Error updating employee:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to update employee profile.",
      error: error.message
    });
  }
});

// ---------------------------------------------------------------------------
// 5. DEACTIVATE / REACTIVATE EMPLOYEE (Status Lifecycle)
// ---------------------------------------------------------------------------
router.patch("/:id/status", authenticateToken, requirePermission("employees:update"), async (req, res) => {
  try {
    const employeeId = req.params.id;
    const { status } = req.body;

    if (!status || !['Active', 'Inactive', 'Probation', 'On Leave'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Valid status required: 'Active', 'Inactive', 'Probation', or 'On Leave'."
      });
    }

    const empRes = await pool.query('SELECT id, first_name, last_name, employee_code FROM employees WHERE id = $1;', [employeeId]);
    if (empRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Employee record not found."
      });
    }
    const emp = empRes.rows[0];

    // Update employee status
    const result = await pool.query(`
      UPDATE employees 
      SET employment_status = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING id, employee_code, first_name, last_name, employment_status;
    `, [status, employeeId]);

    // If deactivated, disable linked user login; if reactivated, re-enable user login
    const isUserActive = status.toLowerCase() !== 'inactive';
    await pool.query(`
      UPDATE users 
      SET is_active = $1, updated_at = CURRENT_TIMESTAMP
      WHERE employee_id = $2;
    `, [isUserActive, employeeId]);

    res.json({
      success: true,
      message: `Employee "${emp.first_name} ${emp.last_name}" (${emp.employee_code}) is now ${status}.`,
      data: result.rows[0]
    });
  } catch (error) {
    console.error("Error updating employee status:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to update employee status.",
      error: error.message
    });
  }
});

// ---------------------------------------------------------------------------
// 6. PERMANENT DELETE EMPLOYEE (Strict Safety Checks against Orphaned Records)
// ---------------------------------------------------------------------------
router.delete("/:id", authenticateToken, requirePermission("employees:delete"), async (req, res) => {
  try {
    const employeeId = req.params.id;

    // 1. Fetch employee
    const empRes = await pool.query('SELECT id, first_name, last_name, employee_code FROM employees WHERE id = $1;', [employeeId]);
    if (empRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Employee not found."
      });
    }
    const emp = empRes.rows[0];

    // 2. Safety Check A: Is this employee a Department Head?
    const deptHeadCheck = await pool.query('SELECT name FROM departments WHERE head_id = $1;', [employeeId]);
    if (deptHeadCheck.rows.length > 0) {
      const deptNames = deptHeadCheck.rows.map(d => d.name).join(', ');
      return res.status(400).json({
        success: false,
        message: `Cannot permanently delete "${emp.first_name} ${emp.last_name}" because they are currently assigned as Head of Department for: ${deptNames}. Please reassign the Department Head or deactivate the employee instead.`
      });
    }

    // 3. Safety Check B: Are other employees reporting to this person?
    const reportsCheck = await pool.query('SELECT COUNT(*)::int as count FROM employees WHERE reporting_manager_id = $1;', [employeeId]);
    if (reportsCheck.rows[0].count > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot permanently delete "${emp.first_name} ${emp.last_name}" because ${reportsCheck.rows[0].count} staff member(s) currently report to them. Please reassign reporting staff or deactivate the employee instead.`
      });
    }

    // 4. Safety Check C: Are there dependent attendance or payroll records?
    const attendanceCheck = await pool.query('SELECT COUNT(*)::int as count FROM attendance_records WHERE employee_id = $1;', [employeeId]);
    const payrollCheck = await pool.query('SELECT COUNT(*)::int as count FROM payroll_records WHERE employee_id = $1;', [employeeId]);
    
    if (attendanceCheck.rows[0].count > 0 || payrollCheck.rows[0].count > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot permanently delete "${emp.first_name} ${emp.last_name}" because historical attendance (${attendanceCheck.rows[0].count}) or payroll (${payrollCheck.rows[0].count}) records exist. To protect audit trails, please deactivate this employee instead.`
      });
    }

    // 5. Unlink user account if linked before deletion
    await pool.query('UPDATE users SET employee_id = NULL WHERE employee_id = $1;', [employeeId]);

    // 6. Delete clean, standalone employee record
    await pool.query('DELETE FROM employees WHERE id = $1;', [employeeId]);

    res.json({
      success: true,
      message: `Employee "${emp.first_name} ${emp.last_name}" (${emp.employee_code}) was permanently deleted from the database.`
    });
  } catch (error) {
    console.error("Error deleting employee:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to delete employee record.",
      error: error.message
    });
  }
});

module.exports = router;