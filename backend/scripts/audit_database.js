const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const pool = require('../db');

async function inspectDatabase() {
  console.log('=== DATABASE AUDIT ===\n');

  // 1. List all public tables and row counts
  const tablesRes = await pool.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
  `);

  console.log(`Found ${tablesRes.rows.length} tables in public schema:`);
  for (const row of tablesRes.rows) {
    const countRes = await pool.query(`SELECT count(*) FROM "${row.table_name}";`);
    console.log(`- ${row.table_name.padEnd(30)}: ${countRes.rows[0].count} rows`);
  }

  // 2. Inspect all foreign keys
  const fks = await pool.query(`
    SELECT
      tc.table_name, 
      kcu.column_name, 
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name 
    FROM information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
    ORDER BY tc.table_name, kcu.column_name;
  `);

  console.log('\n=== FOREIGN KEY RELATIONSHIPS ===');
  for (const fk of fks.rows) {
    console.log(`${fk.table_name}.${fk.column_name} -> ${fk.foreign_table_name}.${fk.foreign_column_name}`);
  }

  // 3. Inspect Users and Roles
  console.log('\n=== USERS AND ROLES ===');
  const usersRes = await pool.query(`
    SELECT u.id, u.email, u.is_active, u.two_factor_enabled, r.name AS role_name, e.employee_code, e.first_name, e.last_name
    FROM users u
    JOIN hr_roles r ON u.role_id = r.id
    LEFT JOIN employees e ON u.employee_id = e.id;
  `);
  console.table(usersRes.rows);

  // 4. Inspect Roles and Permissions count
  console.log('\n=== ROLES & PERMISSIONS COUNT ===');
  const rolePerms = await pool.query(`
    SELECT r.name AS role_name, COUNT(rp.permission_id) AS perm_count
    FROM hr_roles r
    LEFT JOIN role_permissions rp ON r.id = rp.role_id
    GROUP BY r.name
    ORDER BY perm_count DESC;
  `);
  console.table(rolePerms.rows);

  // 5. Inspect Employee Codes and status
  console.log('\n=== EMPLOYEE STATUS BREAKDOWN ===');
  const empStatus = await pool.query(`
    SELECT employment_status, COUNT(*) 
    FROM employees 
    GROUP BY employment_status;
  `);
  console.table(empStatus.rows);

  // 6. Check for Orphan Records / Missing Links
  console.log('\n=== INTEGRITY CHECKS ===');
  const orphans = {};
  
  // Users without employee_id
  const usersNoEmp = await pool.query("SELECT COUNT(*) FROM users WHERE employee_id IS NULL;");
  orphans.users_without_employee = usersNoEmp.rows[0].count;

  // Employees without department
  const empNoDept = await pool.query("SELECT COUNT(*) FROM employees WHERE department_id IS NULL;");
  orphans.employees_without_department = empNoDept.rows[0].count;

  // Employees without designation
  const empNoDesig = await pool.query("SELECT COUNT(*) FROM employees WHERE designation_id IS NULL;");
  orphans.employees_without_designation = empNoDesig.rows[0].count;

  // Employees without shift assignment
  const empNoShift = await pool.query("SELECT COUNT(*) FROM employees WHERE current_shift_id IS NULL;");
  orphans.employees_without_shift = empNoShift.rows[0].count;

  // Attendance without employee
  const attNoEmp = await pool.query("SELECT COUNT(*) FROM attendance_records a LEFT JOIN employees e ON a.employee_id = e.id WHERE e.id IS NULL;");
  orphans.attendance_orphans = attNoEmp.rows[0].count;

  // Leave requests without employee
  const leaveNoEmp = await pool.query("SELECT COUNT(*) FROM leave_requests l LEFT JOIN employees e ON l.employee_id = e.id WHERE e.id IS NULL;");
  orphans.leave_request_orphans = leaveNoEmp.rows[0].count;

  // Leave balances without employee
  const balNoEmp = await pool.query("SELECT COUNT(*) FROM leave_balances b LEFT JOIN employees e ON b.employee_id = e.id WHERE e.id IS NULL;");
  orphans.leave_balance_orphans = balNoEmp.rows[0].count;

  console.table(orphans);

  process.exit(0);
}

inspectDatabase().catch(e => { console.error(e); process.exit(1); });
