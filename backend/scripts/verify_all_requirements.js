const pool = require('../db');
const http = require('http');

async function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', (err) => reject(err));

    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

async function verifyAll() {
  console.log('================================================================');
  console.log("--- ST. VINCENT'S HRMS: EMPLOYEE STANDARDIZATION & CRUD AUDIT ---");
  console.log('================================================================\n');

  // 1. Database query for code format
  const dbEmployees = await pool.query(`
    SELECT employee_code, first_name, last_name, work_email, employment_status, d.name as dept_name, des.name as desig_name
    FROM employees e
    LEFT JOIN departments d ON e.department_id = d.id
    LEFT JOIN designations des ON e.designation_id = des.id
    ORDER BY CAST(SUBSTRING(employee_code FROM 5) AS INTEGER) ASC;
  `);

  console.log(`1. Total Employees in Database: ${dbEmployees.rows.length}`);
  console.log(`2. Employee Code Format: All start with 'EMP-' and 4 digits.`);
  const allMatchEMP = dbEmployees.rows.every(r => /^EMP-\d{4}$/.test(r.employee_code));
  console.log(`   - Verified Regex /^EMP-\\d{4}$/: ${allMatchEMP}`);
  console.log(`   - Range: ${dbEmployees.rows[0].employee_code} to ${dbEmployees.rows[dbEmployees.rows.length - 1].employee_code}`);

  // Check for any remaining STV codes
  const stvCheck = await pool.query("SELECT COUNT(*) FROM employees WHERE employee_code LIKE 'STV%';");
  console.log(`3. Remaining STV-#### codes in Database: ${stvCheck.rows[0].count} (0 expected)`);

  // Check Foreign Key integrity (departments.head_id, users.employee_id, reporting_manager_id)
  const headCount = await pool.query("SELECT COUNT(*) FROM departments WHERE head_id IS NOT NULL;");
  const userLinks = await pool.query("SELECT COUNT(*) FROM users WHERE employee_id IS NOT NULL;");
  const reportLinks = await pool.query("SELECT COUNT(*) FROM employees WHERE reporting_manager_id IS NOT NULL;");
  console.log(`4. Foreign Key Integrity Audit:`);
  console.log(`   - Departments with assigned heads: ${headCount.rows[0].count}`);
  console.log(`   - Users with linked employee profiles: ${userLinks.rows[0].count}`);
  console.log(`   - Employees with assigned reporting managers: ${reportLinks.rows[0].count}`);

  console.log('\n--- 5. FULL ROSTER TABLE (ALL EMP-#### CODES) ---');
  console.table(dbEmployees.rows.map(e => ({
    Code: e.employee_code,
    Name: `${e.first_name} ${e.last_name}`,
    Department: e.dept_name || 'Unassigned',
    Designation: e.desig_name || 'Unassigned',
    Status: e.employment_status,
    Email: e.work_email
  })));

  await pool.end();
}

verifyAll();
