const pool = require('../db');

async function run() {
  const permRes = await pool.query("SELECT id, name FROM permissions WHERE name = 'employees:delete';");
  const hrRoleRes = await pool.query("SELECT id, name FROM hr_roles WHERE name = 'HR';");
  console.log('Perm:', permRes.rows[0]);
  console.log('HR Role:', hrRoleRes.rows[0]);

  if (permRes.rows[0] && hrRoleRes.rows[0]) {
    await pool.query(`
      INSERT INTO role_permissions (role_id, permission_id) 
      VALUES ($1, $2) 
      ON CONFLICT DO NOTHING;
    `, [hrRoleRes.rows[0].id, permRes.rows[0].id]);
    console.log('Successfully granted employees:delete to HR role!');
  }

  // Also verify permissions
  const perms = await pool.query(`
    SELECT r.name as role_name, p.name as perm
    FROM hr_roles r
    JOIN role_permissions rp ON r.id = rp.role_id
    JOIN permissions p ON rp.permission_id = p.id
    WHERE r.name = 'HR' AND p.name LIKE 'employees:%'
    ORDER BY p.name;
  `);
  console.log('HR employee permissions:');
  console.table(perms.rows);

  await pool.end();
}

run().catch(console.error);
