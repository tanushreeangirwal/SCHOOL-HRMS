const pool = require('../db');

async function listAllEmployees() {
  const res = await pool.query(`
    SELECT e.id, e.employee_code, e.first_name, e.last_name, e.work_email, d.name as department_name, des.name as designation_name
    FROM employees e
    LEFT JOIN departments d ON e.department_id = d.id
    LEFT JOIN designations des ON e.designation_id = des.id
    ORDER BY e.employee_code;
  `);
  console.log('ALL EMPLOYEES:', res.rows);
  await pool.end();
}

listAllEmployees();
