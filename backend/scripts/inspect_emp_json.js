const pool = require('../db');

async function inspectEmployeesJson() {
  const result = await pool.query(`
    SELECT
      e.id,
      e.employee_code,
      e.first_name,
      e.last_name,
      e.department_id,
      d.name AS department_name,
      e.designation_id,
      des.name AS designation_name,
      e.employment_type_id,
      et.name AS employment_type_name,
      e.joining_date,
      e.employment_status,
      e.reporting_manager_id,
      TRIM(CONCAT(m.first_name, ' ', COALESCE(m.last_name, ''))) AS reporting_manager_name
    FROM employees e
    LEFT JOIN departments d ON e.department_id = d.id
    LEFT JOIN designations des ON e.designation_id = des.id
    LEFT JOIN employment_types et ON e.employment_type_id = et.id
    LEFT JOIN employees m ON e.reporting_manager_id = m.id
    ORDER BY e.employee_code;
  `);

  console.table(result.rows);
  await pool.end();
}

inspectEmployeesJson();
