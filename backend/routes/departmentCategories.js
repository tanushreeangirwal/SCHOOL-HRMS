const express = require('express');
const pool = require('../db');
const { authenticateToken, requirePermission } = require('../middleware/auth');

const router = express.Router();

/**
 * 1. GET /api/department-categories
 * Returns department categories with real-time department count subquery.
 * Supports search and status filtering.
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { search, status } = req.query;

    let query = `
      SELECT 
        c.id,
        c.name,
        c.code,
        c.description,
        c.is_active,
        c.created_at,
        c.updated_at,
        (SELECT COUNT(*)::int FROM departments d WHERE d.category_id = c.id) AS department_count
      FROM department_categories c
      WHERE 1=1
    `;

    const params = [];

    // Filter by status (active/inactive)
    if (status && status.toLowerCase() === 'active') {
      params.push(true);
      query += ` AND c.is_active = $${params.length}`;
    } else if (status && status.toLowerCase() === 'inactive') {
      params.push(false);
      query += ` AND c.is_active = $${params.length}`;
    }

    // Search by name, code, or description
    if (search && search.trim() !== '') {
      params.push(`%${search.trim().toLowerCase()}%`);
      const pIdx = params.length;
      query += ` AND (
        LOWER(c.name) LIKE $${pIdx} OR 
        LOWER(COALESCE(c.code, '')) LIKE $${pIdx} OR 
        LOWER(COALESCE(c.description, '')) LIKE $${pIdx}
      )`;
    }

    query += ` ORDER BY c.is_active DESC, c.name ASC`;

    const result = await pool.query(query, params);

    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching department categories:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve department categories.'
    });
  }
});

/**
 * 2. POST /api/department-categories
 * Creates a new department category.
 * RBAC: Requires 'department_categories:create' or Admin/HR role.
 */
router.post('/', authenticateToken, requirePermission('department_categories:create'), async (req, res) => {
  try {
    const { name, code, description, is_active } = req.body;

    if (!name || name.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Category name is required and must be at least 2 characters.'
      });
    }

    const cleanName = name.trim();
    const cleanCode = (code || '').trim() || null;
    const cleanDesc = (description || '').trim() || null;
    const activeFlag = is_active !== undefined ? Boolean(is_active) : true;

    // Check duplicate name
    const nameCheck = await pool.query(
      'SELECT id FROM department_categories WHERE LOWER(name) = LOWER($1) LIMIT 1;',
      [cleanName]
    );
    if (nameCheck.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: `A category named "${cleanName}" already exists.`
      });
    }

    // Check duplicate code
    if (cleanCode) {
      const codeCheck = await pool.query(
        'SELECT id FROM department_categories WHERE LOWER(code) = LOWER($1) LIMIT 1;',
        [cleanCode]
      );
      if (codeCheck.rows.length > 0) {
        return res.status(400).json({
          success: false,
          message: `A category with the code "${cleanCode}" already exists.`
        });
      }
    }

    const insertResult = await pool.query(`
      INSERT INTO department_categories (
        id, name, code, description, is_active, created_at, updated_at
      )
      VALUES (
        gen_random_uuid(), $1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
      RETURNING *;
    `, [cleanName, cleanCode, cleanDesc, activeFlag]);

    res.status(201).json({
      success: true,
      message: 'Department category created successfully.',
      data: insertResult.rows[0]
    });
  } catch (error) {
    console.error('Error creating department category:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to create department category.',
      error: error.message
    });
  }
});

/**
 * 3. PUT /api/department-categories/:id
 * Updates an existing department category.
 * RBAC: Requires 'department_categories:update' or Admin/HR role.
 */
router.put('/:id', authenticateToken, requirePermission('department_categories:update'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, code, description, is_active } = req.body;

    const existing = await pool.query('SELECT id FROM department_categories WHERE id = $1;', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Department category not found.'
      });
    }

    if (!name || name.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Category name is required and must be at least 2 characters.'
      });
    }

    const cleanName = name.trim();
    const cleanCode = (code || '').trim() || null;
    const cleanDesc = (description || '').trim() || null;
    const activeFlag = is_active !== undefined ? Boolean(is_active) : true;

    // Check duplicate name excluding current ID
    const nameCheck = await pool.query(
      'SELECT id FROM department_categories WHERE LOWER(name) = LOWER($1) AND id != $2 LIMIT 1;',
      [cleanName, id]
    );
    if (nameCheck.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Another category named "${cleanName}" already exists.`
      });
    }

    // Check duplicate code excluding current ID
    if (cleanCode) {
      const codeCheck = await pool.query(
        'SELECT id FROM department_categories WHERE LOWER(code) = LOWER($1) AND id != $2 LIMIT 1;',
        [cleanCode, id]
      );
      if (codeCheck.rows.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Another category with code "${cleanCode}" already exists.`
        });
      }
    }

    const updateResult = await pool.query(`
      UPDATE department_categories
      SET 
        name = $1,
        code = $2,
        description = $3,
        is_active = $4,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $5
      RETURNING *;
    `, [cleanName, cleanCode, cleanDesc, activeFlag, id]);

    res.json({
      success: true,
      message: 'Department category updated successfully.',
      data: updateResult.rows[0]
    });
  } catch (error) {
    console.error('Error updating department category:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to update department category.',
      error: error.message
    });
  }
});

/**
 * 4. PATCH /api/department-categories/:id/status
 * Soft activate/deactivate category.
 * RBAC: Requires 'department_categories:delete' or Admin/HR role.
 */
router.patch('/:id/status', authenticateToken, requirePermission('department_categories:delete'), async (req, res) => {
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
      UPDATE department_categories
      SET is_active = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING id, name, code, is_active;
    `, [Boolean(is_active), id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Department category not found.'
      });
    }

    res.json({
      success: true,
      message: `Category "${result.rows[0].name}" has been ${is_active ? 'activated' : 'deactivated'}.`,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error toggling category status:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to update category status.'
    });
  }
});

module.exports = router;
