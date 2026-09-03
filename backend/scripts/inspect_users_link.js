const pool = require('../db');

async function inspectUsers() {
  const users = await pool.query(`
    SELECT u.id, u.email, u.role_id, r.name as role_name, u.employee_id,
           e.employee_code, e.first_name, e.last_name, e.work_email
    FROM users u
    LEFT JOIN hr_roles r ON u.role_id = r.id
    LEFT JOIN employees e ON u.employee_id = e.id
    ORDER BY r.name;
  `);
  console.log('=== USERS AND ASSOCIATED EMPLOYEES ===');
  console.table(users.rows);
  await pool.end();
}

inspectUsers();
