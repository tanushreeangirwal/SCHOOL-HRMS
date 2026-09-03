const pool = require('../db');

async function inspectPermissions() {
  console.log('=== EMPLOYEE PERMISSIONS ===');
  const perms = await pool.query(`
    SELECT p.name, p.description, string_agg(r.name, ', ') as roles
    FROM permissions p
    LEFT JOIN role_permissions rp ON p.id = rp.permission_id
    LEFT JOIN hr_roles r ON rp.role_id = r.id
    WHERE p.name LIKE 'employees:%'
    GROUP BY p.name, p.description
    ORDER BY p.name;
  `);
  console.table(perms.rows);
  await pool.end();
}

inspectPermissions();
