const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const pool = require('../db');

async function updateDemoNames() {
  console.log('--- UPDATING DEMO EMPLOYEE NAMES ---');

  const updates = [
    { empId: '09d7e1ff-d0e9-4183-939b-eaa7c518ae09', firstName: 'Alistair', lastName: 'Sterling' }, // Super Admin
    { empId: '55069ea6-2ebd-4e2c-bf72-ac545a06ea07', firstName: 'Malcolm', lastName: 'Hayes' },     // Administrator
    { empId: '60603140-dfb1-4713-bd10-7a1627e92c0a', firstName: 'Clara', lastName: 'Higgins' },     // HR
    { empId: '610d9970-59cd-4570-a127-b62e42843b1a', firstName: 'Julian', lastName: 'Mercer' },     // Manager
    { empId: '94f4ee2f-f5fe-41ff-bc32-1a498530ff64', firstName: 'Evelyn', lastName: 'Reed' }       // Employee
  ];

  for (const item of updates) {
    await pool.query(
      'UPDATE employees SET first_name = $1, last_name = $2 WHERE id = $3;',
      [item.firstName, item.lastName, item.empId]
    );
    console.log(`Updated employee ${item.empId} to ${item.firstName} ${item.lastName}`);
  }

  // Also verify
  const res = await pool.query(`
    SELECT u.email, r.name as role_name, e.first_name, e.last_name, e.employee_code 
    FROM users u 
    JOIN hr_roles r ON u.role_id = r.id 
    LEFT JOIN employees e ON u.employee_id = e.id 
    ORDER BY r.name;
  `);
  console.table(res.rows);

  await pool.end();
  console.log('--- DEMO NAMES UPDATED SUCCESSFULLY ---');
}

updateDemoNames().catch(err => {
  console.error(err);
  process.exit(1);
});
