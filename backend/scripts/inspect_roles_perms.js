const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const pool = require('../db');

async function inspectRolesAndPerms() {
  const roles = await pool.query('SELECT id, name FROM hr_roles ORDER BY id;');
  console.log('Roles in hr_roles:', roles.rows);

  const perms = await pool.query('SELECT id, name, description FROM permissions ORDER BY name;');
  console.log('Permissions count:', perms.rows.length);
  console.log('Permission names:', perms.rows.map(p => p.name));

  // Check role_permissions for each role
  for (const r of roles.rows) {
    const rp = await pool.query(`
      SELECT p.name 
      FROM role_permissions rp 
      JOIN permissions p ON rp.permission_id = p.id 
      WHERE rp.role_id = $1 
      ORDER BY p.name;
    `, [r.id]);
    console.log(`Role [${r.name}] has ${rp.rows.length} perms:`, rp.rows.map(x => x.name));
  }

  process.exit(0);
}

inspectRolesAndPerms();
