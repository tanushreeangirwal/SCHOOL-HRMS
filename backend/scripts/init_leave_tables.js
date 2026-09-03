const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const pool = require('../db');

async function initLeaveTables() {
  console.log('================================================================');
  console.log('  ST. VINCENT\'S HRMS — LEAVE MANAGEMENT SCHEMA INITIALIZATION');
  console.log('================================================================\n');

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Ensure leave_types columns
    console.log('Configuring table: leave_types...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS leave_types (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL,
        code VARCHAR(30) UNIQUE NOT NULL,
        description TEXT,
        annual_allocation NUMERIC(5, 1) NOT NULL DEFAULT 12,
        is_paid BOOLEAN NOT NULL DEFAULT true,
        requires_approval BOOLEAN NOT NULL DEFAULT true,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
        created_by UUID,
        updated_by UUID
      );
    `);

    await client.query(`
      ALTER TABLE leave_types 
      ADD COLUMN IF NOT EXISTS annual_allocation NUMERIC(5, 1) NOT NULL DEFAULT 12,
      ADD COLUMN IF NOT EXISTS requires_approval BOOLEAN NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS created_by UUID,
      ADD COLUMN IF NOT EXISTS updated_by UUID;
    `);

    // 2. Ensure leave_requests columns
    console.log('Configuring table: leave_requests...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS leave_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
        leave_type_id UUID NOT NULL REFERENCES leave_types(id) ON DELETE RESTRICT,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        total_days NUMERIC(4, 1) NOT NULL,
        reason TEXT NOT NULL,
        remarks TEXT,
        status VARCHAR(20) NOT NULL DEFAULT 'Pending',
        applied_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
        approved_by UUID REFERENCES users(id),
        approved_at TIMESTAMP WITHOUT TIME ZONE,
        rejection_reason TEXT,
        created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
      );
    `);

    await client.query(`
      ALTER TABLE leave_requests
      ADD COLUMN IF NOT EXISTS remarks TEXT,
      ADD COLUMN IF NOT EXISTS applied_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW();
    `);

    // 3. Ensure leave_balances columns
    console.log('Configuring table: leave_balances...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS leave_balances (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        leave_type_id UUID NOT NULL REFERENCES leave_types(id) ON DELETE CASCADE,
        leave_year INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
        opening_balance NUMERIC(5, 1) NOT NULL DEFAULT 0,
        allocated_days NUMERIC(5, 1) NOT NULL DEFAULT 0,
        used_days NUMERIC(5, 1) NOT NULL DEFAULT 0,
        pending_days NUMERIC(5, 1) NOT NULL DEFAULT 0,
        carried_forward_days NUMERIC(5, 1) NOT NULL DEFAULT 0,
        available_days NUMERIC(5, 1) NOT NULL DEFAULT 0,
        created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
      );
    `);

    await client.query(`
      ALTER TABLE leave_balances
      ADD COLUMN IF NOT EXISTS available_days NUMERIC(5, 1) NOT NULL DEFAULT 0;
    `);

    // Ensure unique constraint on leave_balances (employee_id, leave_type_id, leave_year)
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'uq_employee_leave_year'
        ) THEN
          ALTER TABLE leave_balances ADD CONSTRAINT uq_employee_leave_year UNIQUE (employee_id, leave_type_id, leave_year);
        END IF;
      END $$;
    `);

    // 4. Create leave_audit_logs table
    console.log('Configuring table: leave_audit_logs...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS leave_audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        leave_request_id UUID NOT NULL REFERENCES leave_requests(id) ON DELETE CASCADE,
        actor_user_id UUID NOT NULL REFERENCES users(id),
        action VARCHAR(50) NOT NULL,
        previous_status VARCHAR(20),
        new_status VARCHAR(20),
        notes TEXT,
        created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
      );
    `);

    // Create Indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_leave_requests_emp ON leave_requests(employee_id);
      CREATE INDEX IF NOT EXISTS idx_leave_requests_dates ON leave_requests(start_date, end_date);
      CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON leave_requests(status);
      CREATE INDEX IF NOT EXISTS idx_leave_balances_emp_year ON leave_balances(employee_id, leave_year);
    `);

    // 5. Seed Default School Leave Types
    console.log('\nSeeding Default St. Vincent School Leave Types...');
    const defaultLeaveTypes = [
      {
        name: 'Casual Leave',
        code: 'CL',
        description: 'Routine personal leave for short durations, personal affairs, or family commitments.',
        annual_allocation: 12.0,
        is_paid: true,
        requires_approval: true
      },
      {
        name: 'Sick / Medical Leave',
        code: 'SL',
        description: 'Absence due to personal illness, medical treatments, consultations, or convalescence.',
        annual_allocation: 10.0,
        is_paid: true,
        requires_approval: true
      },
      {
        name: 'Earned / Privilege Leave',
        code: 'EL',
        description: 'Annual accumulated vacation and earned recreational leave for school faculty.',
        annual_allocation: 15.0,
        is_paid: true,
        requires_approval: true
      },
      {
        name: 'Half Day Leave',
        code: 'HDL',
        description: 'Half-day absence covering either morning session or afternoon session.',
        annual_allocation: 6.0,
        is_paid: true,
        requires_approval: true
      },
      {
        name: 'Emergency Leave',
        code: 'EML',
        description: 'Unforeseen critical family emergencies or urgent domestic crises.',
        annual_allocation: 5.0,
        is_paid: true,
        requires_approval: true
      },
      {
        name: 'Maternity Leave',
        code: 'ML',
        description: 'Statutory maternity leave entitlement for eligible female staff members.',
        annual_allocation: 90.0,
        is_paid: true,
        requires_approval: true
      },
      {
        name: 'Paternity Leave',
        code: 'PL',
        description: 'Statutory paternity leave entitlement for eligible male staff members.',
        annual_allocation: 15.0,
        is_paid: true,
        requires_approval: true
      },
      {
        name: 'Leave Without Pay (Unpaid)',
        code: 'LWP',
        description: 'Authorized absence beyond available leave quotas or non-paid extended leaves.',
        annual_allocation: 0.0,
        is_paid: false,
        requires_approval: true
      }
    ];

    for (const lt of defaultLeaveTypes) {
      await client.query(`
        INSERT INTO leave_types (name, code, description, annual_allocation, is_paid, requires_approval, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, true)
        ON CONFLICT (code) DO UPDATE 
        SET name = EXCLUDED.name,
            description = EXCLUDED.description,
            annual_allocation = EXCLUDED.annual_allocation,
            is_paid = EXCLUDED.is_paid,
            updated_at = NOW();
      `, [lt.name, lt.code, lt.description, lt.annual_allocation, lt.is_paid, lt.requires_approval]);
    }
    console.log(`✓ Seeded ${defaultLeaveTypes.length} default school leave types.`);

    // 6. Seed RBAC Permissions
    console.log('\nSeeding Leave Management RBAC Permissions...');
    const leavePermissions = [
      { name: 'leaves:read', description: 'View institutional leave dashboard, requests roster, and calendar' },
      { name: 'leaves:read_self', description: 'View own personal leave history and balances' },
      { name: 'leaves:apply', description: 'Apply for personal leave requests' },
      { name: 'leaves:approve', description: 'Approve or reject employee leave requests' },
      { name: 'leaves:manage_types', description: 'Configure master leave types and annual allocations' }
    ];

    for (const p of leavePermissions) {
      await client.query(`
        INSERT INTO permissions (name, description)
        VALUES ($1, $2)
        ON CONFLICT (name) DO UPDATE 
        SET description = EXCLUDED.description;
      `, [p.name, p.description]);
    }

    // Link permissions to roles
    const rolesRes = await client.query('SELECT id, name FROM hr_roles;');
    const rolesMap = {};
    rolesRes.rows.forEach(r => { rolesMap[r.name] = r.id; });

    const permsRes = await client.query("SELECT id, name FROM permissions WHERE name LIKE 'leaves:%';");
    const permsMap = {};
    permsRes.rows.forEach(p => { permsMap[p.name] = p.id; });

    // Super Admin: all
    if (rolesMap['Super Admin']) {
      for (const p of Object.values(permsMap)) {
        await client.query(`
          INSERT INTO role_permissions (role_id, permission_id)
          VALUES ($1, $2)
          ON CONFLICT DO NOTHING;
        `, [rolesMap['Super Admin'], p]);
      }
    }

    // Administrator: all
    if (rolesMap['Administrator']) {
      for (const p of Object.values(permsMap)) {
        await client.query(`
          INSERT INTO role_permissions (role_id, permission_id)
          VALUES ($1, $2)
          ON CONFLICT DO NOTHING;
        `, [rolesMap['Administrator'], p]);
      }
    }

    // HR: read, read_self, apply, approve, manage_types
    if (rolesMap['HR']) {
      for (const p of Object.values(permsMap)) {
        await client.query(`
          INSERT INTO role_permissions (role_id, permission_id)
          VALUES ($1, $2)
          ON CONFLICT DO NOTHING;
        `, [rolesMap['HR'], p]);
      }
    }

    // Manager: read, read_self, apply, approve
    if (rolesMap['Manager']) {
      const mgrPerms = ['leaves:read', 'leaves:read_self', 'leaves:apply', 'leaves:approve'];
      for (const pName of mgrPerms) {
        if (permsMap[pName]) {
          await client.query(`
            INSERT INTO role_permissions (role_id, permission_id)
            VALUES ($1, $2)
            ON CONFLICT DO NOTHING;
          `, [rolesMap['Manager'], permsMap[pName]]);
        }
      }
    }

    // Employee: read_self, apply
    if (rolesMap['Employee']) {
      const empPerms = ['leaves:read_self', 'leaves:apply'];
      for (const pName of empPerms) {
        if (permsMap[pName]) {
          await client.query(`
            INSERT INTO role_permissions (role_id, permission_id)
            VALUES ($1, $2)
            ON CONFLICT DO NOTHING;
          `, [rolesMap['Employee'], permsMap[pName]]);
        }
      }
    }
    console.log('✓ Linked leave permissions to all 5 system roles.');

    // 7. Initialize Leave Balances for all active employees for current year
    console.log('\nInitializing Leave Balances for all active employees...');
    const currentYear = new Date().getFullYear();
    const employeesRes = await client.query('SELECT id, first_name, last_name FROM employees WHERE employment_status = $1;', ['Active']);
    const leaveTypesRes = await client.query('SELECT id, annual_allocation FROM leave_types WHERE is_active = true;');

    for (const emp of employeesRes.rows) {
      for (const lt of leaveTypesRes.rows) {
        const alloc = parseFloat(lt.annual_allocation) || 0;
        await client.query(`
          INSERT INTO leave_balances (employee_id, leave_type_id, leave_year, opening_balance, allocated_days, used_days, pending_days, carried_forward_days, available_days)
          VALUES ($1, $2, $3, $4, $4, 0, 0, 0, $4)
          ON CONFLICT (employee_id, leave_type_id, leave_year) DO UPDATE
          SET allocated_days = EXCLUDED.allocated_days,
              available_days = EXCLUDED.allocated_days - leave_balances.used_days - leave_balances.pending_days,
              updated_at = NOW();
        `, [emp.id, lt.id, currentYear, alloc]);
      }
    }
    console.log(`✓ Initialized leave balances for ${employeesRes.rows.length} active employees across ${leaveTypesRes.rows.length} leave types.`);

    await client.query('COMMIT');
    console.log('\n================================================================');
    console.log('  LEAVE MANAGEMENT SCHEMA INITIALIZATION COMPLETED SUCCESSFULLY!');
    console.log('================================================================\n');
    process.exit(0);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Schema initialization failed:', err);
    process.exit(1);
  } finally {
    client.release();
  }
}

initLeaveTables();
