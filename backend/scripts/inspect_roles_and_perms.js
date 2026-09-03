const pool = require('../db');

async function inspectRoles() {
  try {
    const rolesRes = await pool.query(`SELECT * FROM hr_roles;`);
    console.log('--- HR ROLES ---');
    console.log(rolesRes.rows);

    const rpRes = await pool.query(`
      SELECT r.name as role_name, p.name as permission_name
      FROM role_permissions rp
      JOIN hr_roles r ON rp.role_id = r.id
      JOIN permissions p ON rp.permission_id = p.id
      ORDER BY r.name, p.name;
    `);
    const byRole = {};
    for (const row of rpRes.rows) {
      if (!byRole[row.role_name]) byRole[row.role_name] = [];
      byRole[row.role_name].push(row.permission_name);
    }
    console.log('\n--- BY ROLE PERMISSIONS ---');
    console.log(byRole);
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}

inspectRoles();
