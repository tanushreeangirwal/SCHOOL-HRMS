const pool = require('../db');

async function standardizeEmployeeCodes() {
  console.log('--- STANDARDIZING EMPLOYEE CODES TO EMP-#### ---');

  const codeMappings = [
    { name: 'Anthony Fernandes', newCode: 'EMP-1005' },
    { name: 'Rajesh Kulkarni', newCode: 'EMP-1006' },
    { name: 'Amit Sharma', newCode: 'EMP-1007' },
    { name: 'Vikram Joshi', newCode: 'EMP-1008' },
    { name: 'Neha Patil', newCode: 'EMP-1009' },
    { name: 'Rohan Shinde', newCode: 'EMP-1010' },
    { name: 'Priya Kulkarni', newCode: 'EMP-1011' },
    { name: 'Sanjay Verma', newCode: 'EMP-1012' },
    { name: 'Sneha Mehta', newCode: 'EMP-1013' },
    { name: 'Anjali More', newCode: 'EMP-1014' },
    { name: 'Kavita Rao', newCode: 'EMP-1015' },
    { name: 'Suresh Nair', newCode: 'EMP-1016' },
    { name: 'Pooja Deshmukh', newCode: 'EMP-1017' },
    { name: 'Deepak Sawant', newCode: 'EMP-1018' },
    { name: 'Meera Iyer', newCode: 'EMP-1019' },
    { name: 'Vivek Shah', newCode: 'EMP-1020' },
    { name: 'Ritu Deshpande', newCode: 'EMP-1021' },
    { name: 'Nikhil Gokhale', newCode: 'EMP-1022' },
    { name: 'Ajay Jadhav', newCode: 'EMP-1023' },
    { name: 'Sunita Gaikwad', newCode: 'EMP-1024' }
  ];

  for (const mapping of codeMappings) {
    const [firstName, lastName] = mapping.name.split(' ');
    const res = await pool.query(`
      UPDATE employees 
      SET employee_code = $1, updated_at = CURRENT_TIMESTAMP
      WHERE first_name = $2 AND last_name = $3
      RETURNING id, employee_code, first_name, last_name;
    `, [mapping.newCode, firstName, lastName]);

    if (res.rows.length > 0) {
      console.log(`✓ Updated [${mapping.name}] -> ${res.rows[0].employee_code}`);
    }
  }

  console.log('\n=== VERIFYING STANDARDIZED EMPLOYEE CODES ===');
  const roster = await pool.query(`
    SELECT employee_code, first_name || ' ' || last_name as name, work_email, employment_status
    FROM employees
    ORDER BY employee_code;
  `);
  console.table(roster.rows);

  await pool.end();
}

standardizeEmployeeCodes();
