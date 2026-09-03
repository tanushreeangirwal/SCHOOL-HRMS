const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const pool = require('../db');

async function checkAdminUser() {
  const userResult = await pool.query(`
    SELECT 
      u.id,
      u.email,
      r.name AS role_name,
      COALESCE(
        json_agg(p.name) FILTER (WHERE p.name IS NOT NULL),
        '[]'
      ) AS permissions
    FROM users u
    JOIN hr_roles r ON u.role_id = r.id
    LEFT JOIN role_permissions rp ON r.id = rp.role_id
    LEFT JOIN permissions p ON rp.permission_id = p.id
    WHERE u.email = 'admin@school.edu'
    GROUP BY u.id, r.name;
  `);
  console.log('admin@school.edu user record:', userResult.rows[0]);
  process.exit(0);
}

checkAdminUser().catch(e => { console.error(e); process.exit(1); });
