const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const pool = require('../db');

async function inspect() {
  const usersRes = await pool.query(`
    SELECT 
      u.id as user_id, 
      u.email, 
      r.name as role_name, 
      u.employee_id, 
      e.employee_code, 
      e.first_name, 
      e.last_name, 
      e.current_shift_id,
      s.name as shift_name,
      s.start_time,
      s.end_time
    FROM users u
    JOIN hr_roles r ON u.role_id = r.id
    LEFT JOIN employees e ON u.employee_id = e.id
    LEFT JOIN shifts s ON e.current_shift_id = s.id;
  `);
  console.log('=== USERS IN DATABASE ===');
  console.table(usersRes.rows);

  const empRes = await pool.query(`
    SELECT id, employee_code, first_name, last_name, work_email, current_shift_id 
    FROM employees 
    LIMIT 10;
  `);
  console.log('=== SAMPLE EMPLOYEES ===');
  console.table(empRes.rows);

  process.exit(0);
}

inspect().catch(err => {
  console.error(err);
  process.exit(1);
});
