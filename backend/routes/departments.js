const express = require('express');
const pool = require('../db');
const { authenticateToken, requirePermission } = require('../middleware/auth');

const router = express.Router();

/**
 * 1. GET /api/departments
 * Retrieves list of departments with real-time employee counts, category details, and head details.
 * Supports search, category filter, and status filtering.
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { search, status, category_id } = req.query;

    let query = `
      SELECT 
        d.id,
        d.name,
        d.code,
        d.description,
        d.is_active,
        d.head_id,
        d.branch_id,
        d.category_id,
        d.effective_date,
        d.created_at,
        d.updated_at,
        c.name AS category_name,
        c.code AS category_code,
        h.employee_code AS head_code,
        h.first_name AS head_first_name,
        h.last_name AS head_last_name,
        TRIM(CONCAT(h.first_name, ' ', h.last_name)) AS head_name,
        h.work_email AS head_email,
        (SELECT COUNT(*)::int FROM employees e WHERE e.department_id = d.id) AS employee_count
      FROM departments d
      LEFT JOIN department_categories c ON d.category_id = c.id
      LEFT JOIN employees h ON d.head_id = h.id
      WHERE 1=1
    `;

    const params = [];

    // Filter by status (active/inactive)
    if (status && status.toLowerCase() === 'active') {
      params.push(true);
      query += ` AND d.is_active = $${params.length}`;
    } else if (status && status.toLowerCase() === 'inactive') {
      params.push(false);
      query += ` AND d.is_active = $${params.length}`;
    }

    // Filter by category
    if (category_id && category_id !== 'ALL') {
      params.push(category_id);
      query += ` AND d.category_id = $${params.length}`;
    }

    // Search by code, name, description, category, or head name
    if (search && search.trim() !== '') {
      params.push(`%${search.trim().toLowerCase()}%`);
      const pIdx = params.length;
      query += ` AND (
        LOWER(d.name) LIKE $${pIdx} OR 
        LOWER(COALESCE(d.code, '')) LIKE $${pIdx} OR 
        LOWER(COALESCE(d.description, '')) LIKE $${pIdx} OR
        LOWER(COALESCE(c.name, '')) LIKE $${pIdx} OR
        LOWER(CONCAT(COALESCE(h.first_name, ''), ' ', COALESCE(h.last_name, ''))) LIKE $${pIdx}
      )`;
    }

    query += ` ORDER BY d.is_active DESC, d.name ASC`;

    const result = await pool.query(query, params);

    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching departments:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve departments list.'
    });
  }
});

/**
 * 2. GET /api/departments/assignments/history
 * Returns department assignment and transfer audit history.
 */
router.get('/assignments/history', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        h.id,
        h.employee_id,
        h.department_id,
        h.previous_department_id,
        h.effective_date,
        h.reason,
        h.created_at,
        e.employee_code,
        e.first_name,
        e.last_name,
        TRIM(CONCAT(e.first_name, ' ', e.last_name)) AS employee_name,
        d.name AS department_name,
        d.code AS department_code,
        pd.name AS previous_department_name,
        u.email AS assigned_by_email
      FROM employee_department_history h
      JOIN employees e ON h.employee_id = e.id
      JOIN departments d ON h.department_id = d.id
      LEFT JOIN departments pd ON h.previous_department_id = pd.id
      LEFT JOIN users u ON h.assigned_by = u.id
      ORDER BY h.created_at DESC
      LIMIT 100;
    `);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching department assignment history:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve assignment history.'
    });
  }
});

/**
 * 3. POST /api/departments/assign
 * Assigns an employee to a department and logs an immutable audit history record.
 * RBAC: Requires 'departments:assign' or Admin/HR role.
 */
router.post('/assign', authenticateToken, requirePermission('departments:assign'), async (req, res) => {
  try {
    const { employee_id, department_id, effective_date, reason } = req.body;

    if (!employee_id || !department_id) {
      return res.status(400).json({
        success: false,
        message: 'Employee ID and Department ID are required.'
      });
    }

    // Verify employee
    const empResult = await pool.query('SELECT id, first_name, last_name, employee_code, department_id FROM employees WHERE id = $1;', [employee_id]);
    if (empResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Employee not found.' });
    }
    const emp = empResult.rows[0];

    // Verify target department
    const deptResult = await pool.query('SELECT id, name, is_active FROM departments WHERE id = $1;', [department_id]);
    if (deptResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Department not found.' });
    }
    const dept = deptResult.rows[0];

    const prevDeptId = emp.department_id;
    const cleanEffectiveDate = effective_date || new Date().toISOString().split('T')[0];
    const cleanReason = reason ? reason.trim() : 'Department assignment / transfer';

    // 1. Update employee's active department_id
    await pool.query('UPDATE employees SET department_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2;', [department_id, employee_id]);

    // 2. Insert historical record
    await pool.query(`
      INSERT INTO employee_department_history (
        id, employee_id, department_id, previous_department_id, effective_date, reason, assigned_by, created_at
      )
      VALUES (
        gen_random_uuid(), $1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP
      );
    `, [employee_id, department_id, prevDeptId, cleanEffectiveDate, cleanReason, req.user.id]);

    const empName = [emp.first_name, emp.last_name].filter(Boolean).join(' ') || emp.employee_code;

    res.json({
      success: true,
      message: `${empName} has been assigned to "${dept.name}" successfully.`
    });
  } catch (error) {
    console.error('Error assigning employee to department:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to assign employee to department.'
    });
  }
});

/**
 * 4. GET /api/departments/:id
 * Retrieves department details along with its assigned staff roster and category info.
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const deptResult = await pool.query(`
      SELECT 
        d.id,
        d.name,
        d.code,
        d.description,
        d.is_active,
        d.head_id,
        d.branch_id,
        d.category_id,
        d.effective_date,
        d.created_at,
        d.updated_at,
        c.name AS category_name,
        c.code AS category_code,
        h.employee_code AS head_code,
        h.first_name AS head_first_name,
        h.last_name AS head_last_name,
        TRIM(CONCAT(h.first_name, ' ', h.last_name)) AS head_name,
        h.work_email AS head_email,
        (SELECT COUNT(*)::int FROM employees e WHERE e.department_id = d.id) AS employee_count
      FROM departments d
      LEFT JOIN department_categories c ON d.category_id = c.id
      LEFT JOIN employees h ON d.head_id = h.id
      WHERE d.id = $1
    `, [id]);

    if (deptResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Department not found.'
      });
    }

    const department = deptResult.rows[0];

    // Fetch real employees belonging to this department
    const employeesResult = await pool.query(`
      SELECT 
        e.id,
        e.employee_code,
        e.first_name,
        e.middle_name,
        e.last_name,
        e.work_email,
        e.phone,
        e.employment_status,
        e.joining_date,
        e.profile_photo_url
      FROM employees e
      WHERE e.department_id = $1
      ORDER BY e.first_name ASC, e.last_name ASC
    `, [id]);

    department.employees = employeesResult.rows;

    res.json({
      success: true,
      data: department
    });
  } catch (error) {
    console.error('Error fetching department details:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve department details.'
    });
  }
});

/**
 * 5. POST /api/departments
 * Creates a new department record.
 * RBAC: Requires 'departments:create' or Admin/HR role.
 */
router.post('/', authenticateToken, requirePermission('departments:create'), async (req, res) => {
  try {
    const { name, code, category_id, description, head_id, is_active, branch_id, effective_date } = req.body;

    if (!name || name.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Department name is required and must be at least 2 characters.'
      });
    }

    if (name.length > 150) {
      return res.status(400).json({
        success: false,
        message: 'Department name cannot exceed 150 characters.'
      });
    }

    const cleanName = name.trim();
    const cleanCode = (code || '').trim() || null;
    const cleanCategoryId = category_id || null;
    const cleanDesc = (description || '').trim() || null;
    const cleanHeadId = head_id || null;
    const cleanBranchId = branch_id || null;
    const cleanEffectiveDate = effective_date || new Date().toISOString().split('T')[0];
    const activeFlag = is_active !== undefined ? Boolean(is_active) : true;

    // Check duplicate name
    const nameCheck = await pool.query(
      'SELECT id FROM departments WHERE LOWER(name) = LOWER($1) LIMIT 1;',
      [cleanName]
    );
    if (nameCheck.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: `A department with the name "${cleanName}" already exists.`
      });
    }

    // Check duplicate code
    if (cleanCode) {
      const codeCheck = await pool.query(
        'SELECT id FROM departments WHERE LOWER(code) = LOWER($1) LIMIT 1;',
        [cleanCode]
      );
      if (codeCheck.rows.length > 0) {
        return res.status(400).json({
          success: false,
          message: `A department with the code "${cleanCode}" already exists.`
        });
      }
    }

    const insertResult = await pool.query(`
      INSERT INTO departments (
        id, name, code, category_id, description, head_id, branch_id, is_active, effective_date, created_at, updated_at
      )
      VALUES (
        gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
      RETURNING *;
    `, [cleanName, cleanCode, cleanCategoryId, cleanDesc, cleanHeadId, cleanBranchId, activeFlag, cleanEffectiveDate]);

    res.status(201).json({
      success: true,
      message: 'Department created successfully.',
      data: insertResult.rows[0]
    });
  } catch (error) {
    console.error('Error creating department:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to create department.',
      error: error.message
    });
  }
});

/**
 * 6. PUT /api/departments/:id
 * Updates an existing department record.
 * RBAC: Requires 'departments:update' or Admin/HR role.
 */
router.put('/:id', authenticateToken, requirePermission('departments:update'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, code, category_id, description, head_id, is_active, branch_id, effective_date } = req.body;

    const existing = await pool.query('SELECT id FROM departments WHERE id = $1;', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Department not found.'
      });
    }

    if (!name || name.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Department name is required and must be at least 2 characters.'
      });
    }

    const cleanName = name.trim();
    const cleanCode = (code || '').trim() || null;
    const cleanCategoryId = category_id || null;
    const cleanDesc = (description || '').trim() || null;
    const cleanHeadId = head_id || null;
    const cleanBranchId = branch_id || null;
    const cleanEffectiveDate = effective_date || new Date().toISOString().split('T')[0];
    const activeFlag = is_active !== undefined ? Boolean(is_active) : true;

    // Check duplicate name excluding self
    const nameCheck = await pool.query(
      'SELECT id FROM departments WHERE LOWER(name) = LOWER($1) AND id != $2 LIMIT 1;',
      [cleanName, id]
    );
    if (nameCheck.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Another department with the name "${cleanName}" already exists.`
      });
    }

    // Check duplicate code excluding self
    if (cleanCode) {
      const codeCheck = await pool.query(
        'SELECT id FROM departments WHERE LOWER(code) = LOWER($1) AND id != $2 LIMIT 1;',
        [cleanCode, id]
      );
      if (codeCheck.rows.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Another department with the code "${cleanCode}" already exists.`
        });
      }
    }

    const updateResult = await pool.query(`
      UPDATE departments
      SET 
        name = $1,
        code = $2,
        category_id = $3,
        description = $4,
        head_id = $5,
        branch_id = $6,
        is_active = $7,
        effective_date = $8,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $9
      RETURNING *;
    `, [cleanName, cleanCode, cleanCategoryId, cleanDesc, cleanHeadId, cleanBranchId, activeFlag, cleanEffectiveDate, id]);

    res.json({
      success: true,
      message: 'Department updated successfully.',
      data: updateResult.rows[0]
    });
  } catch (error) {
    console.error('Error updating department:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to update department.',
      error: error.message
    });
  }
});

/**
 * 7. PATCH /api/departments/:id/status
 * Soft toggle for activating/deactivating a department.
 * RBAC: Requires 'departments:delete' or Admin/HR role.
 */
router.patch('/:id/status', authenticateToken, requirePermission('departments:delete'), async (req, res) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;

    if (is_active === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Status boolean (is_active) is required.'
      });
    }

    const result = await pool.query(`
      UPDATE departments
      SET is_active = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING id, name, code, is_active;
    `, [Boolean(is_active), id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Department not found.'
      });
    }

    res.json({
      success: true,
      message: `Department "${result.rows[0].name}" has been ${is_active ? 'activated' : 'deactivated'}.`,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error toggling department status:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to update department status.'
    });
  }
});

/**
 * 8. PATCH /api/departments/:id/category
 * Assigns or removes (null) a department's category association.
 * RBAC: Requires 'departments:update' or Admin/HR role.
 */
router.patch('/:id/category', authenticateToken, requirePermission('departments:update'), async (req, res) => {
  try {
    const { id } = req.params;
    const { category_id } = req.body;
    const cleanCategoryId = category_id || null;

    // If a category ID is specified, verify it exists
    if (cleanCategoryId) {
      const catCheck = await pool.query('SELECT id, name FROM department_categories WHERE id = $1;', [cleanCategoryId]);
      if (catCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Selected department category does not exist.'
        });
      }
    }

    const updateResult = await pool.query(`
      UPDATE departments
      SET category_id = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING id, name, code, category_id;
    `, [cleanCategoryId, id]);

    if (updateResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Department not found.'
      });
    }

    res.json({
      success: true,
      message: cleanCategoryId 
        ? 'Department assigned to category successfully.' 
        : 'Department removed from category successfully.',
      data: updateResult.rows[0]
    });
  } catch (error) {
    console.error('Error updating department category:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to update department category assignment.',
      error: error.message
    });
  }
});

module.exports = router;
