const pool = require('../db');

async function setupPayroll() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log('1. Checking and safely extending payroll_records table columns...');

    // Non-destructively add optional breakdown and audit fields if they do not exist
    await client.query(`
      ALTER TABLE payroll_records
      ADD COLUMN IF NOT EXISTS total_working_days NUMERIC DEFAULT 0,
      ADD COLUMN IF NOT EXISTS present_days NUMERIC DEFAULT 0,
      ADD COLUMN IF NOT EXISTS paid_leave_days NUMERIC DEFAULT 0,
      ADD COLUMN IF NOT EXISTS unpaid_leave_days NUMERIC DEFAULT 0,
      ADD COLUMN IF NOT EXISTS payable_days NUMERIC DEFAULT 0,
      ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50) DEFAULT 'Bank Transfer',
      ADD COLUMN IF NOT EXISTS breakdown_json JSONB DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS remarks TEXT;
    `);

    // Add unique constraint per employee per month/year to prevent duplicate double-processing
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'uq_payroll_employee_month_year'
        ) THEN
          ALTER TABLE payroll_records 
          ADD CONSTRAINT uq_payroll_employee_month_year UNIQUE (employee_id, payroll_month, payroll_year);
        END IF;
      END $$;
    `);

    console.log('2. Ensuring baseline school salary components exist...');
    const defaultComponents = [
      // Earnings
      { name: 'Basic Salary', code: 'BASIC', component_type: 'Earning', description: 'Core basic pay component for educational staff', is_taxable: true },
      { name: 'House Rent Allowance', code: 'HRA', component_type: 'Earning', description: 'Housing assistance allowance for faculty and staff', is_taxable: true },
      { name: 'Conveyance Allowance', code: 'CONVEYANCE', component_type: 'Earning', description: 'Local travel and commute allowance', is_taxable: false },
      { name: 'Special Academic Allowance', code: 'SPECIAL_ALLOWANCE', component_type: 'Earning', description: 'Academic performance and curriculum guidance allowance', is_taxable: true },
      { name: 'Dearness Allowance', code: 'DA', component_type: 'Earning', description: 'Cost of living adjustment allowance', is_taxable: true },
      // Deductions
      { name: 'Provident Fund (PF)', code: 'PF', component_type: 'Deduction', description: 'Employee provident fund statutory retirement contribution', is_taxable: false },
      { name: 'Professional Tax (PT)', code: 'PT', component_type: 'Deduction', description: 'State municipal employment tax deduction', is_taxable: false },
      { name: 'Tax Deducted at Source (TDS)', code: 'TDS', component_type: 'Deduction', description: 'Income tax deducted at source based on annual tax liability', is_taxable: false }
    ];

    for (const comp of defaultComponents) {
      const check = await client.query(`SELECT id FROM salary_components WHERE code = $1`, [comp.code]);
      if (check.rows.length === 0) {
        await client.query(`
          INSERT INTO salary_components (name, code, component_type, description, is_taxable, is_active)
          VALUES ($1, $2, $3, $4, $5, true);
        `, [comp.name, comp.code, comp.component_type, comp.description, comp.is_taxable]);
      } else {
        await client.query(`
          UPDATE salary_components 
          SET name = $1, description = $2, is_taxable = $3 
          WHERE code = $4
        `, [comp.name, comp.description, comp.is_taxable, comp.code]);
      }
    }

    console.log('3. Ensuring default school salary structures exist...');
    // Create 'Teaching Faculty Structure' and 'Administrative Staff Structure'
    let facultyStructRes = await client.query(`SELECT id FROM salary_structures WHERE code = 'FACULTY_STANDARD'`);
    let facultyStructId;
    if (facultyStructRes.rows.length === 0) {
      const ins = await client.query(`
        INSERT INTO salary_structures (name, code, description, effective_from, is_active)
        VALUES ('Teaching Faculty Standard Structure', 'FACULTY_STANDARD', 'Standard salary structure for primary, secondary, and senior teaching faculty', '2026-01-01', true)
        RETURNING id;
      `);
      facultyStructId = ins.rows[0].id;
    } else {
      facultyStructId = facultyStructRes.rows[0].id;
    }

    let adminStructRes = await client.query(`SELECT id FROM salary_structures WHERE code = 'ADMIN_STANDARD'`);
    let adminStructId;
    if (adminStructRes.rows.length === 0) {
      const ins = await client.query(`
        INSERT INTO salary_structures (name, code, description, effective_from, is_active)
        VALUES ('Administrative & Support Staff Structure', 'ADMIN_STANDARD', 'Standard salary structure for administration, accounts, admissions, and lab support', '2026-01-01', true)
        RETURNING id;
      `);
      adminStructId = ins.rows[0].id;
    } else {
      adminStructId = adminStructRes.rows[0].id;
    }

    // Configure items for faculty structure
    const compMap = {};
    const allComps = await client.query(`SELECT id, code FROM salary_components`);
    allComps.rows.forEach(c => { compMap[c.code] = c.id; });

    // Seed structure items if not present
    const itemsCheck = await client.query(`SELECT count(*) FROM salary_structure_items WHERE salary_structure_id = $1`, [facultyStructId]);
    if (parseInt(itemsCheck.rows[0].count, 10) === 0) {
      const facultyItems = [
        { comp: compMap['BASIC'], type: 'percentage', pct: 50, fixed: null, order: 1 },
        { comp: compMap['HRA'], type: 'percentage', pct: 20, fixed: null, order: 2 },
        { comp: compMap['CONVEYANCE'], type: 'percentage', pct: 10, fixed: null, order: 3 },
        { comp: compMap['SPECIAL_ALLOWANCE'], type: 'percentage', pct: 20, fixed: null, order: 4 },
        { comp: compMap['PF'], type: 'percentage', pct: 12, pct_of: compMap['BASIC'], fixed: null, order: 5 },
        { comp: compMap['PT'], type: 'fixed', pct: null, fixed: 200, order: 6 },
        { comp: compMap['TDS'], type: 'percentage', pct: 5, fixed: null, order: 7 }
      ];

      for (const item of facultyItems) {
        if (item.comp) {
          await client.query(`
            INSERT INTO salary_structure_items 
              (salary_structure_id, salary_component_id, calculation_type, fixed_amount, percentage, percentage_of_component_id, display_order)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
          `, [facultyStructId, item.comp, item.type, item.fixed, item.pct, item.pct_of || null, item.order]);
        }
      }
    }

    // Seed structure items for admin structure if not present
    const adminItemsCheck = await client.query(`SELECT count(*) FROM salary_structure_items WHERE salary_structure_id = $1`, [adminStructId]);
    if (parseInt(adminItemsCheck.rows[0].count, 10) === 0) {
      const adminItems = [
        { comp: compMap['BASIC'], type: 'percentage', pct: 55, fixed: null, order: 1 },
        { comp: compMap['HRA'], type: 'percentage', pct: 20, fixed: null, order: 2 },
        { comp: compMap['CONVEYANCE'], type: 'percentage', pct: 10, fixed: null, order: 3 },
        { comp: compMap['SPECIAL_ALLOWANCE'], type: 'percentage', pct: 15, fixed: null, order: 4 },
        { comp: compMap['PF'], type: 'percentage', pct: 12, pct_of: compMap['BASIC'], fixed: null, order: 5 },
        { comp: compMap['PT'], type: 'fixed', pct: null, fixed: 200, order: 6 },
        { comp: compMap['TDS'], type: 'percentage', pct: 3, fixed: null, order: 7 }
      ];

      for (const item of adminItems) {
        if (item.comp) {
          await client.query(`
            INSERT INTO salary_structure_items 
              (salary_structure_id, salary_component_id, calculation_type, fixed_amount, percentage, percentage_of_component_id, display_order)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
          `, [adminStructId, item.comp, item.type, item.fixed, item.pct, item.pct_of || null, item.order]);
        }
      }
    }

    console.log('4. Assigning initial salary structures to existing employees who lack assignments...');
    const employees = await client.query(`
      SELECT e.id, e.employee_code, e.first_name, e.last_name, d.name as dept_name, des.name as desig_name
      FROM employees e
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN designations des ON e.designation_id = des.id
      WHERE e.employment_status IN ('Active', 'Probation')
    `);

    for (const emp of employees.rows) {
      const existingAssign = await client.query(
        `SELECT id FROM employee_salary_assignments WHERE employee_id = $1 AND is_active = true`,
        [emp.id]
      );

      if (existingAssign.rows.length === 0) {
        const isTeaching = (emp.dept_name || '').toLowerCase().includes('science') ||
                           (emp.dept_name || '').toLowerCase().includes('humanities') ||
                           (emp.dept_name || '').toLowerCase().includes('languages') ||
                           (emp.desig_name || '').toLowerCase().includes('teacher') ||
                           (emp.desig_name || '').toLowerCase().includes('hod') ||
                           (emp.desig_name || '').toLowerCase().includes('principal');

        const structId = isTeaching ? facultyStructId : adminStructId;

        // Realistic school salary bands based on role
        let monthlyGross = 45000;
        const titleLower = (emp.desig_name || '').toLowerCase();
        if (titleLower.includes('principal')) {
          monthlyGross = 95000;
        } else if (titleLower.includes('hod') || titleLower.includes('head')) {
          monthlyGross = 68000;
        } else if (titleLower.includes('senior')) {
          monthlyGross = 54000;
        } else if (titleLower.includes('officer') || titleLower.includes('administrator')) {
          monthlyGross = 50000;
        } else if (titleLower.includes('assistant') || titleLower.includes('executive')) {
          monthlyGross = 32000;
        }

        const annualCtc = monthlyGross * 12;

        await client.query(`
          INSERT INTO employee_salary_assignments
            (employee_id, salary_structure_id, effective_from, annual_ctc, monthly_gross, is_active)
          VALUES ($1, $2, '2026-01-01', $3, $4, true)
        `, [emp.id, structId, annualCtc, monthlyGross]);
      }
    }

    console.log('5. Ensuring payroll permissions exist in RBAC system...');
    const payrollPerms = [
      { name: 'payroll:read', description: 'View payroll dashboard, monthly records, and employee payouts' },
      { name: 'payroll:manage', description: 'Configure salary structures, assign salaries, and process payroll' },
      { name: 'payroll:approve', description: 'Approve finalized payroll and authorize salary disbursements' },
      { name: 'payroll:read_self', description: 'View and download own employee payslips' }
    ];

    for (const p of payrollPerms) {
      const c = await client.query(`SELECT id FROM permissions WHERE name = $1`, [p.name]);
      if (c.rows.length === 0) {
        await client.query(`INSERT INTO permissions (name, description) VALUES ($1, $2)`, [p.name, p.description]);
      }
    }

    // Map permissions to roles
    const rolesRes = await client.query(`SELECT id, name FROM hr_roles`);
    const roleMap = {};
    rolesRes.rows.forEach(r => { roleMap[r.name] = r.id; });

    const permsRes = await client.query(`SELECT id, name FROM permissions WHERE name LIKE 'payroll:%'`);
    const pMap = {};
    permsRes.rows.forEach(p => { pMap[p.name] = p.id; });

    const assignRolePerm = async (roleName, permName) => {
      const rId = roleMap[roleName];
      const pId = pMap[permName];
      if (rId && pId) {
        const check = await client.query(
          `SELECT 1 FROM role_permissions WHERE role_id = $1 AND permission_id = $2`,
          [rId, pId]
        );
        if (check.rows.length === 0) {
          await client.query(
            `INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2)`,
            [rId, pId]
          );
        }
      }
    };

    // Super Admin: all
    await assignRolePerm('Super Admin', 'payroll:read');
    await assignRolePerm('Super Admin', 'payroll:manage');
    await assignRolePerm('Super Admin', 'payroll:approve');
    await assignRolePerm('Super Admin', 'payroll:read_self');

    // Administrator: manage, read, approve
    await assignRolePerm('Administrator', 'payroll:read');
    await assignRolePerm('Administrator', 'payroll:manage');
    await assignRolePerm('Administrator', 'payroll:approve');
    await assignRolePerm('Administrator', 'payroll:read_self');

    // HR: manage, read
    await assignRolePerm('HR', 'payroll:read');
    await assignRolePerm('HR', 'payroll:manage');
    await assignRolePerm('HR', 'payroll:read_self');

    // Manager: read
    await assignRolePerm('Manager', 'payroll:read');
    await assignRolePerm('Manager', 'payroll:read_self');

    // Employee (Teacher): read_self
    await assignRolePerm('Employee', 'payroll:read_self');

    await client.query('COMMIT');
    console.log('Payroll schema extension and baseline school seed completed successfully!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Payroll setup error:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

setupPayroll();
