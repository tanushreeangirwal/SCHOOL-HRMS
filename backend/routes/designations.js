const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken, requirePermission, requireRole } = require('../middleware/auth');

/**
 * GET /api/designations
 * Retrieves all designations with department join and real-time employee counts
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { search, department_id, status } = req.query;

    let queryText = `
      SELECT 
        d.id,
        d.name,
        d.code,
        d.description,
        d.department_id,
        dept.name AS department_name,
        dept.code AS department_code,
        d.is_active,
        d.created_at,
        d.updated_at,
        (SELECT COUNT(*)::int FROM employees e WHERE e.designation_id = d.id) AS employee_count
      FROM designations d
      LEFT JOIN departments dept ON d.department_id = dept.id
      WHERE 1=1
    `;
    const params = [];

    // Filter: Status (all | active | inactive)
    if (status && status.toLowerCase() === 'active') {
      params.push(true);
      queryText += ` AND d.is_active = $${params.length}`;
    } else if (status && status.toLowerCase() === 'inactive') {
      params.push(false);
      queryText += ` AND d.is_active = $${params.length}`;
    }

    // Filter: Department
    if (department_id && department_id !== 'ALL') {
      params.push(department_id);
      queryText += ` AND d.department_id = $${params.length}`;
    }

    // Filter: Search (Name, Code, Description, Department Name)
    if (search && search.trim() !== '') {
      const term = `%${search.trim()}%`;
      params.push(term);
      queryText += ` AND (
        d.name ILIKE $${params.length} 
        OR d.code ILIKE $${params.length} 
        OR d.description ILIKE $${params.length}
        OR dept.name ILIKE $${params.length}
      )`;
    }

    queryText += ` ORDER BY d.name ASC;`;

    const result = await pool.query(queryText, params);

    res.status(200).json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (err) {
    console.error('Error fetching designations:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve designations. Please try again later.'
    });
  }
});

/**
 * GET /api/designations/:id
 * Retrieves detailed designation information along with roster of employees holding this designation
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const desigQuery = `
      SELECT 
        d.id,
        d.name,
        d.code,
        d.description,
        d.department_id,
        dept.name AS department_name,
        dept.code AS department_code,
        d.is_active,
        d.created_at,
        d.updated_at,
        (SELECT COUNT(*)::int FROM employees e WHERE e.designation_id = d.id) AS employee_count
      FROM designations d
      LEFT JOIN departments dept ON d.department_id = dept.id
      WHERE d.id = $1;
    `;
    const desigResult = await pool.query(desigQuery, [id]);

    if (desigResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Designation record not found.'
      });
    }

    const designation = desigResult.rows[0];

    // Retrieve staff holding this designation
    const staffQuery = `
      SELECT 
        e.id, 
        e.employee_code, 
        e.first_name, 
        e.last_name, 
        e.work_email,
        e.phone,
        e.employment_status, 
        e.joining_date,
        dept.name AS department_name
      FROM employees e
      LEFT JOIN departments dept ON e.department_id = dept.id
      WHERE e.designation_id = $1
      ORDER BY e.first_name ASC, e.last_name ASC;
    `;
    const staffResult = await pool.query(staffQuery, [id]);
    designation.employees = staffResult.rows;

    res.status(200).json({
      success: true,
      data: designation
    });
  } catch (err) {
    console.error('Error fetching designation details:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve designation profile.'
    });
  }
});

/**
 * POST /api/designations
 * Creates a new designation (Role: Administrator, HR)
 */
router.post('/', authenticateToken, requirePermission('designations:create'), async (req, res) => {
  try {
    const { name, code, department_id, description, is_active } = req.body;

    // Validate Name
    if (!name || name.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Designation name is required.'
      });
    }

    const trimmedName = name.trim();
    let finalCode = code && code.trim() !== '' 
      ? code.trim().toUpperCase() 
      : 'DESIG-' + trimmedName.replace(/[^A-Za-z0-9]/g, '').slice(0, 8).toUpperCase();

    // Check duplicate Name
    const dupNameCheck = await pool.query(
      'SELECT id FROM designations WHERE LOWER(name) = LOWER($1);',
      [trimmedName]
    );
    if (dupNameCheck.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: `A designation named "${trimmedName}" already exists.`
      });
    }

    // Check duplicate Code
    const dupCodeCheck = await pool.query(
      'SELECT id FROM designations WHERE LOWER(code) = LOWER($1);',
      [finalCode]
    );
    if (dupCodeCheck.rows.length > 0) {
      finalCode = `${finalCode}-${Math.floor(100 + Math.random() * 900)}`;
    }

    // Validate Department FK if provided
    let validDeptId = null;
    if (department_id && department_id !== 'ALL' && department_id !== '') {
      const deptCheck = await pool.query('SELECT id FROM departments WHERE id = $1;', [department_id]);
      if (deptCheck.rows.length > 0) {
        validDeptId = department_id;
      }
    }

    const insertQuery = `
      INSERT INTO designations (
        name, 
        code, 
        department_id, 
        description, 
        is_active, 
        created_at, 
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *;
    `;
    const result = await pool.query(insertQuery, [
      trimmedName,
      finalCode,
      validDeptId,
      description ? description.trim() : null,
      is_active !== undefined ? Boolean(is_active) : true
    ]);

    res.status(201).json({
      success: true,
      message: `Designation "${trimmedName}" has been successfully created.`,
      data: result.rows[0]
    });
  } catch (err) {
    console.error('Error creating designation:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'Failed to create designation record.'
    });
  }
});

/**
 * PUT /api/designations/:id
 * Updates an existing designation
 */
router.put('/:id', authenticateToken, requirePermission('designations:update'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, code, department_id, description, is_active } = req.body;

    const existingCheck = await pool.query('SELECT id, name FROM designations WHERE id = $1;', [id]);
    if (existingCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Designation record not found.'
      });
    }

    if (!name || name.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Designation name is required.'
      });
    }

    const trimmedName = name.trim();
    const trimmedCode = code ? code.trim().toUpperCase() : null;

    // Check duplicate Name on other records
    const dupNameCheck = await pool.query(
      'SELECT id FROM designations WHERE LOWER(name) = LOWER($1) AND id != $2;',
      [trimmedName, id]
    );
    if (dupNameCheck.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: `Another designation with the name "${trimmedName}" already exists.`
      });
    }

    // Check duplicate Code on other records
    if (trimmedCode) {
      const dupCodeCheck = await pool.query(
        'SELECT id FROM designations WHERE LOWER(code) = LOWER($1) AND id != $2;',
        [trimmedCode, id]
      );
      if (dupCodeCheck.rows.length > 0) {
        return res.status(409).json({
          success: false,
          message: `Another designation with code "${trimmedCode}" already exists.`
        });
      }
    }

    // Validate Department FK
    let validDeptId = null;
    if (department_id && department_id !== 'ALL' && department_id !== '') {
      const deptCheck = await pool.query('SELECT id FROM departments WHERE id = $1;', [department_id]);
      if (deptCheck.rows.length > 0) {
        validDeptId = department_id;
      }
    }

    const updateQuery = `
      UPDATE designations
      SET 
        name = $1,
        code = COALESCE($2, code),
        department_id = $3,
        description = $4,
        is_active = COALESCE($5, is_active),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $6
      RETURNING *;
    `;
    const result = await pool.query(updateQuery, [
      trimmedName,
      trimmedCode,
      validDeptId,
      description !== undefined ? (description ? description.trim() : null) : null,
      is_active !== undefined ? Boolean(is_active) : null,
      id
    ]);

    res.status(200).json({
      success: true,
      message: `Designation "${trimmedName}" has been updated successfully.`,
      data: result.rows[0]
    });
  } catch (err) {
    console.error('Error updating designation:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'Failed to update designation.'
    });
  }
});

/**
 * PATCH /api/designations/:id/status
 * Soft toggles designation active/inactive status
 */
router.patch('/:id/status', authenticateToken, requirePermission('designations:delete'), async (req, res) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;

    const existingCheck = await pool.query('SELECT id, name, is_active FROM designations WHERE id = $1;', [id]);
    if (existingCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Designation record not found.'
      });
    }

    const desig = existingCheck.rows[0];
    const targetStatus = is_active !== undefined ? Boolean(is_active) : !desig.is_active;

    const updateRes = await pool.query(`
      UPDATE designations
      SET is_active = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *;
    `, [targetStatus, id]);

    res.status(200).json({
      success: true,
      message: `Designation "${desig.name}" is now ${targetStatus ? 'Active' : 'Inactive'}.`,
      data: updateRes.rows[0]
    });
  } catch (err) {
    console.error('Error toggling designation status:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to update designation status.'
    });
  }
});

module.exports = router;
