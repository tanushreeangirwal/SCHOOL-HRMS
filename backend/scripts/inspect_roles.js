const pool = require('../db');

async function inspectRoles() {
  const roles = await pool.query(`SELECT * FROM hr_roles ORDER BY id;`);
  console.log('ROLES IN DB:', roles.rows);
  const perms = await pool.query(`SELECT id, name FROM permissions ORDER BY name;`);
  console.log('PERMISSIONS IN DB:', perms.rows);
  await pool.end();
}

inspectRoles();
