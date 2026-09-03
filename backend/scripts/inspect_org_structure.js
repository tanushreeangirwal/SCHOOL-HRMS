const pool = require('../db');

async function inspectData() {
  console.log('=== CURRENT DEPARTMENT CATEGORIES ===');
  const cats = await pool.query('SELECT id, name, code, is_active FROM department_categories ORDER BY name;');
  console.table(cats.rows);

  console.log('\n=== CURRENT DEPARTMENTS ===');
  const depts = await pool.query(`
    SELECT d.id, d.name, d.code, d.category_id, c.name as category_name,
      (SELECT COUNT(*) FROM employees e WHERE e.department_id = d.id) as emp_count
    FROM departments d
    LEFT JOIN department_categories c ON d.category_id = c.id
    ORDER BY d.name;
  `);
  console.table(depts.rows);

  console.log('\n=== CURRENT EMPLOYEES & THEIR DEPARTMENTS ===');
  const emps = await pool.query(`
    SELECT e.id, e.employee_code, e.first_name, e.last_name, e.work_email, d.name as department_name
    FROM employees e
    LEFT JOIN departments d ON e.department_id = d.id
    ORDER BY e.created_at;
  `);
  console.table(emps.rows);

  await pool.end();
}

inspectData();
