const pool = require('../db');

async function grantManagerTrainingPerms() {
  const res = await pool.query(`
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT r.id, p.id 
    FROM hr_roles r, permissions p
    WHERE r.name = 'Manager' AND p.name IN ('training:assign', 'training:attendance')
    ON CONFLICT DO NOTHING;
  `);
  console.log('Granted Manager training assign and attendance permissions!');

  const perms = await pool.query(`
    SELECT r.name as role_name, p.name as perm_name
    FROM hr_roles r
    JOIN role_permissions rp ON r.id = rp.role_id
    JOIN permissions p ON rp.permission_id = p.id
    WHERE r.name = 'Manager' AND p.name LIKE 'training:%'
    ORDER BY p.name;
  `);
  console.table(perms.rows);

  await pool.end();
}

grantManagerTrainingPerms().catch(console.error);
