const pool = require('../db');

async function inspectAllDatabase() {
  console.log('=== 1. DESIGNATIONS SCHEMA & ROWS ===');
  const desigCols = await pool.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'designations'
    ORDER BY ordinal_position;
  `);
  console.table(desigCols.rows);

  const desigs = await pool.query('SELECT * FROM designations ORDER BY name;');
  console.table(desigs.rows);

  console.log('\n=== 2. EMPLOYMENT TYPES ROWS ===');
  const empTypes = await pool.query('SELECT * FROM employment_types ORDER BY name;');
  console.table(empTypes.rows);

  console.log('\n=== 3. EMPLOYEES SCHEMA & ROWS ===');
  const empCols = await pool.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'employees'
    ORDER BY ordinal_position;
  `);
  console.table(empCols.rows);

  const emps = await pool.query(`
    SELECT e.id, e.employee_code, e.first_name, e.last_name, e.gender, e.work_email, e.employment_status, 
           d.name as dept_name, des.name as designation_name, et.name as employment_type_name,
           e.joining_date, e.reporting_manager_id
    FROM employees e
    LEFT JOIN departments d ON e.department_id = d.id
    LEFT JOIN designations des ON e.designation_id = des.id
    LEFT JOIN employment_types et ON e.employment_type_id = et.id
    ORDER BY e.employee_code;
  `);
  console.table(emps.rows);

  console.log('\n=== 4. BRANCHES ===');
  const branches = await pool.query('SELECT * FROM branches LIMIT 5;');
  console.table(branches.rows);

  await pool.end();
}

inspectAllDatabase();
