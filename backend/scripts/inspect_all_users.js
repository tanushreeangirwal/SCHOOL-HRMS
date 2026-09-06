const pool = require('../db');

async function checkUsers() {
  try {
    const res = await pool.query(`
      SELECT 
        u.id, 
        u.email, 
        r.name as role_name, 
        u.is_active, 
        e.first_name,
        e.last_name, 
        e.employee_code, 
        d.name as dept_name, 
        des.title as desig_title 
      FROM users u 
      LEFT JOIN roles r ON u.role_id = r.id
      LEFT JOIN employees e ON u.employee_id = e.id 
      LEFT JOIN departments d ON e.department_id = d.id 
      LEFT JOIN designations des ON e.designation_id = des.id 
      ORDER BY r.name, u.email
    `);
    console.table(res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}

checkUsers();
