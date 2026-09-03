const pool = require('../db');

async function inspectEmployeesAndFks() {
  console.log('=== 1. CURRENT EMPLOYEES ===');
  const emps = await pool.query(`
    SELECT e.id, e.employee_code, e.first_name, e.last_name, e.work_email, e.employment_status,
           d.name as dept_name, des.name as desig_name
    FROM employees e
    LEFT JOIN departments d ON e.department_id = d.id
    LEFT JOIN designations des ON e.designation_id = des.id
    ORDER BY e.employee_code;
  `);
  console.table(emps.rows);

  console.log('\n=== 2. FOREIGN KEYS REFERENCING EMPLOYEES ===');
  const fks = await pool.query(`
    SELECT
      tc.table_name, 
      kcu.column_name, 
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name,
      rc.delete_rule
    FROM information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    JOIN information_schema.referential_constraints AS rc
      ON rc.constraint_name = tc.constraint_name
    WHERE ccu.table_name = 'employees'
    ORDER BY tc.table_name;
  `);
  console.table(fks.rows);

  console.log('\n=== 3. USERS LINKED TO EMPLOYEES ===');
  const users = await pool.query(`
    SELECT u.id, u.email, r.name as role, e.employee_code, e.first_name, e.last_name
    FROM users u
    LEFT JOIN hr_roles r ON u.role_id = r.id
    LEFT JOIN employees e ON u.employee_id = e.id;
  `);
  console.table(users.rows);

  await pool.end();
}

inspectEmployeesAndFks();
