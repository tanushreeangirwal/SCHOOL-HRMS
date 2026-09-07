const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const bcrypt = require('bcryptjs');
const pool = require('../db');

/**
 * Helper to generate next available sequential employee code: EMP-####
 */
async function getNextEmployeeCode(client) {
  const result = await client.query(`
    SELECT employee_code 
    FROM employees 
    WHERE employee_code ~ '^EMP-[0-9]+$' 
    ORDER BY CAST(SUBSTRING(employee_code FROM 5) AS INTEGER) DESC 
    LIMIT 1;
  `);

  if (result.rows.length === 0) {
    return 'EMP-1001';
  }

  const highestNum = parseInt(result.rows[0].employee_code.replace('EMP-', ''), 10);
  const nextNum = isNaN(highestNum) ? 1001 : highestNum + 1;
  return `EMP-${nextNum}`;
}

async function importStaff() {
  const filePathArg = process.argv[2] || 'Employee_Onboarding_Template.xlsx';
  const targetPath = path.isAbsolute(filePathArg) 
    ? filePathArg 
    : path.resolve(__dirname, '..', '..', filePathArg);

  if (!fs.existsSync(targetPath)) {
    console.error(`[ERROR] File not found at: ${targetPath}`);
    process.exit(1);
  }

  console.log(`=== ST. VINCENT'S HRMS — STAFF BULK IMPORT ===`);
  console.log(`Reading input file: ${targetPath}`);

  let rows = [];
  if (targetPath.endsWith('.csv')) {
    const content = fs.readFileSync(targetPath, 'utf8');
    const workbook = xlsx.read(content, { type: 'string' });
    const sheetName = workbook.SheetNames[0];
    rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });
  } else {
    const workbook = xlsx.readFile(targetPath);
    const sheetName = workbook.SheetNames.includes('Employee_Onboarding') 
      ? 'Employee_Onboarding' 
      : workbook.SheetNames[0];
    rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });
  }

  if (rows.length === 0) {
    console.log('[WARN] No data rows found in the sheet.');
    process.exit(0);
  }

  console.log(`Found ${rows.length} records to process.\n`);

  const client = await pool.connect();
  try {
    // 1. Preload lookup tables for high-performance in-memory resolution
    const [deptsRes, desigsRes, empTypesRes, rolesRes, shiftsRes, branchesRes, salaryStructsRes] = await Promise.all([
      client.query('SELECT id, name, code FROM departments;'),
      client.query('SELECT id, name, code FROM designations;'),
      client.query('SELECT id, name FROM employment_types;'),
      client.query('SELECT id, name FROM hr_roles;'),
      client.query('SELECT id, name, code FROM shifts;'),
      client.query('SELECT id, name FROM branches LIMIT 1;'),
      client.query('SELECT id, name, code FROM salary_structures WHERE is_active = true;')
    ]);

    const deptMap = new Map();
    deptsRes.rows.forEach(d => {
      deptMap.set(d.name.toLowerCase().trim(), d.id);
      if (d.code) deptMap.set(d.code.toLowerCase().trim(), d.id);
    });

    const desigMap = new Map();
    desigsRes.rows.forEach(d => {
      desigMap.set(d.name.toLowerCase().trim(), d.id);
      if (d.code) desigMap.set(d.code.toLowerCase().trim(), d.id);
    });

    const empTypeMap = new Map();
    empTypesRes.rows.forEach(e => {
      empTypeMap.set(e.name.toLowerCase().trim(), e.id);
    });

    const roleMap = new Map();
    rolesRes.rows.forEach(r => {
      roleMap.set(r.name.toLowerCase().trim(), r.id);
    });

    const shiftMap = new Map();
    shiftsRes.rows.forEach(s => {
      shiftMap.set(s.code.toLowerCase().trim(), s.id);
      shiftMap.set(s.name.toLowerCase().trim(), s.id);
    });

    const salaryStructMap = new Map();
    salaryStructsRes.rows.forEach(ss => {
      salaryStructMap.set(ss.code.toLowerCase().trim(), ss.id);
      salaryStructMap.set(ss.name.toLowerCase().trim(), ss.id);
    });

    const defaultBranchId = branchesRes.rows[0]?.id || null;
    const defaultRoleId = roleMap.get('employee') || rolesRes.rows[0]?.id;
    const defaultShiftId = shiftMap.get('sh-gen') || shiftsRes.rows[0]?.id || null;
    const defaultSalaryStructId = salaryStructsRes.rows[0]?.id || null;

    let successCount = 0;
    let skipCount = 0;
    const summary = [];

    // Common default initial password for batch onboarded employees
    const defaultPasswordHash = await bcrypt.hash('SchoolStaff@2026', 10);

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;

      // Extract and clean fields
      const firstName = String(row.first_name || '').trim();
      const middleName = String(row.middle_name || '').trim();
      const lastName = String(row.last_name || '').trim();
      const workEmail = String(row.work_email || '').trim().toLowerCase();
      const personalEmail = String(row.personal_email || '').trim().toLowerCase();
      const phone = String(row.phone || '').trim();
      const gender = String(row.gender || 'Male').trim();
      const dob = row.date_of_birth ? String(row.date_of_birth).slice(0, 10) : null;
      const joiningDate = row.joining_date ? String(row.joining_date).slice(0, 10) : new Date().toISOString().slice(0, 10);
      const employmentStatus = String(row.employment_status || 'Active').trim();
      const deptInput = String(row.department_name || '').trim().toLowerCase();
      const desigInput = String(row.designation_name || '').trim().toLowerCase();
      const empTypeInput = String(row.employment_type || 'full time').trim().toLowerCase();
      const roleInput = String(row.system_role || 'employee').trim().toLowerCase();
      const shiftInput = String(row.shift_code || 'sh-gen').trim().toLowerCase();
      const managerCode = String(row.reporting_manager_code || '').trim().toUpperCase();

      // Basic validations
      if (!firstName || !lastName || !workEmail) {
        console.warn(`[SKIP Row ${rowNum}] Missing essential fields (first_name, last_name, or work_email).`);
        skipCount++;
        continue;
      }

      // Check if employee already exists with work_email
      const existingEmail = await client.query('SELECT id, employee_code FROM employees WHERE LOWER(work_email) = $1;', [workEmail]);
      if (existingEmail.rows.length > 0) {
        console.warn(`[SKIP Row ${rowNum}] Work email "${workEmail}" already exists (${existingEmail.rows[0].employee_code}).`);
        skipCount++;
        continue;
      }

      // Resolve Lookups
      const departmentId = deptMap.get(deptInput) || null;
      const designationId = desigMap.get(desigInput) || null;
      const empTypeId = empTypeMap.get(empTypeInput) || empTypeMap.get('full time') || null;
      const roleId = roleMap.get(roleInput) || defaultRoleId;
      const shiftId = shiftMap.get(shiftInput) || defaultShiftId;

      // Resolve Manager ID
      let managerId = null;
      if (managerCode) {
        const mgrRes = await client.query('SELECT id FROM employees WHERE UPPER(employee_code) = $1;', [managerCode]);
        if (mgrRes.rows.length > 0) {
          managerId = mgrRes.rows[0].id;
        }
      }

      // Determine Employee Code
      let employeeCode = String(row.employee_code || '').trim().toUpperCase();
      if (!employeeCode || !employeeCode.startsWith('EMP-')) {
        employeeCode = await getNextEmployeeCode(client);
      }

      await client.query('BEGIN');

      try {
        // 1. Insert Employee
        const empInsert = await client.query(`
          INSERT INTO employees (
            employee_code, first_name, middle_name, last_name,
            date_of_birth, gender, personal_email, work_email, phone,
            address, city, state, postal_code, branch_id, department_id,
            designation_id, employment_type_id, joining_date, employment_status,
            reporting_manager_id, current_shift_id, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4,
            $5, $6, $7, $8, $9,
            $10, $11, $12, $13, $14, $15,
            $16, $17, $18, $19,
            $20, $21, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          ) RETURNING id;
        `, [
          employeeCode,
          firstName,
          middleName || null,
          lastName,
          dob,
          gender,
          personalEmail || null,
          workEmail,
          phone || null,
          row.address || null,
          row.city || 'Pune',
          row.state || 'Maharashtra',
          row.postal_code || null,
          defaultBranchId,
          departmentId,
          designationId,
          empTypeId,
          joiningDate,
          employmentStatus,
          managerId,
          shiftId
        ]);

        const empId = empInsert.rows[0].id;

        // 2. Insert User Account (Active with default password)
        await client.query(`
          INSERT INTO users (
            employee_id, role_id, email, password_hash, is_active, 
            account_status, two_factor_enabled, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, true,
            'ACTIVE', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          ) ON CONFLICT (email) DO NOTHING;
        `, [empId, roleId, workEmail, defaultPasswordHash]);

        // 3. Optional: Insert Bank Account Details
        if (row.bank_name && row.account_number) {
          await client.query(`
            INSERT INTO employee_bank_accounts (
              employee_id, bank_name, account_number, ifsc_code,
              account_holder_name, is_primary, is_active, created_at, updated_at
            ) VALUES (
              $1, $2, $3, $4,
              $5, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
            );
          `, [
            empId,
            String(row.bank_name).trim(),
            String(row.account_number).trim(),
            String(row.ifsc_code || '').trim().toUpperCase(),
            String(row.account_holder_name || `${firstName} ${lastName}`).trim()
          ]);
        }

        // 4. Optional: Insert Emergency Contact
        if (row.emergency_contact_name) {
          await client.query(`
            INSERT INTO emergency_contacts (
              employee_id, name, relationship, phone, is_primary, created_at, updated_at
            ) VALUES (
              $1, $2, $3, $4, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
            );
          `, [
            empId,
            String(row.emergency_contact_name).trim(),
            String(row.emergency_relationship || 'Contact').trim(),
            String(row.emergency_phone || '').trim()
          ]);
        }

        // 5. Optional: Insert Salary Assignment
        if (row.monthly_gross && !isNaN(Number(row.monthly_gross))) {
          const gross = Number(row.monthly_gross);
          const ctc = row.annual_ctc && !isNaN(Number(row.annual_ctc)) ? Number(row.annual_ctc) : gross * 12;
          
          // Select faculty or admin salary structure based on department
          const isStaffAdmin = deptInput.includes('admin') || deptInput.includes('hr') || deptInput.includes('maintenance') || deptInput.includes('support');
          const matchedStructureId = isStaffAdmin 
            ? (salaryStructMap.get('admin_standard') || defaultSalaryStructId)
            : (salaryStructMap.get('faculty_standard') || defaultSalaryStructId);

          await client.query(`
            INSERT INTO employee_salary_assignments (
              employee_id, salary_structure_id, monthly_gross, annual_ctc, effective_from, is_active, created_at, updated_at
            ) VALUES (
              $1, $2, $3, $4, $5, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
            );
          `, [empId, matchedStructureId, gross, ctc, joiningDate]);
        }

        await client.query('COMMIT');

        successCount++;
        summary.push({
          code: employeeCode,
          name: `${firstName} ${lastName}`,
          email: workEmail,
          dept: row.department_name || 'N/A',
          desig: row.designation_name || 'N/A',
          defaultPassword: 'SchoolStaff@2026'
        });
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`[ERROR Row ${rowNum}] Transaction failed:`, err.message);
        skipCount++;
      }
    }

    console.log(`\n======================================================`);
    console.log(`IMPORT SUMMARY: Successfully Onboarded: ${successCount} | Skipped: ${skipCount}`);
    console.log(`======================================================`);
    if (summary.length > 0) {
      console.table(summary);
      console.log(`\nDefault initial staff login password: SchoolStaff@2026`);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

importStaff().catch(err => {
  console.error('Fatal import error:', err);
  process.exit(1);
});
