const pool = require('../db');

async function inspectSchema() {
  try {
    console.log('=== 1. TABLES IN DATABASE ===');
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    console.log(tables.rows.map(r => r.table_name));

    console.log('\n=== 2. HR_ROLES / ROLES ROWS ===');
    const roles = await pool.query(`SELECT * FROM hr_roles ORDER BY id;`);
    console.log(roles.rows);

    console.log('\n=== 3. PERMISSIONS ROWS ===');
    const perms = await pool.query(`SELECT * FROM permissions ORDER BY name;`);
    console.log(perms.rows);

    console.log('\n=== 4. ROLE_PERMISSIONS MAPPINGS ===');
    const rolePerms = await pool.query(`
      SELECT r.name as role_name, p.name as permission_name
      FROM role_permissions rp
      JOIN hr_roles r ON rp.role_id = r.id
      JOIN permissions p ON rp.permission_id = p.id
      ORDER BY r.name, p.name;
    `);
    console.log(rolePerms.rows);

    console.log('\n=== 5. USERS TABLE COLUMNS & ROWS ===');
    const userCols = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'users'
      ORDER BY ordinal_position;
    `);
    console.log(userCols.rows);

    const users = await pool.query(`
      SELECT u.id, u.email, u.role_id, r.name as role_name, u.employee_id, u.is_active, u.two_factor_enabled
      FROM users u
      LEFT JOIN hr_roles r ON u.role_id = r.id
      ORDER BY u.id;
    `);
    console.log(users.rows);

    console.log('\n=== 6. EMPLOYEES SAMPLE ===');
    const emps = await pool.query(`
      SELECT id, employee_code, first_name, last_name, department_id, designation_id, employment_status, role_category
      FROM employees
      LIMIT 10;
    `).catch(err => {
      return pool.query(`
        SELECT id, employee_code, first_name, last_name, department_id, designation_id, employment_status
        FROM employees
        LIMIT 10;
      `);
    });
    console.log(emps.rows);

  } catch (err) {
    console.error('Inspection error:', err);
  } finally {
    await pool.end();
  }
}

inspectSchema();
