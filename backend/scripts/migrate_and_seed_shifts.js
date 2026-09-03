const pool = require('../db');

async function migrateAndSeedShifts() {
  const client = await pool.connect();
  try {
    console.log('--- STARTING SHIFT & SCHEDULE DATABASE MIGRATION ---');
    await client.query('BEGIN');

    // 1. Update/Enhance `shifts` table
    await client.query(`
      CREATE TABLE IF NOT EXISTS shifts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(150) NOT NULL,
        code VARCHAR(50) UNIQUE NOT NULL,
        description TEXT,
        start_time TIME NOT NULL,
        end_time TIME NOT NULL,
        break_start_time TIME,
        break_end_time TIME,
        break_duration_minutes INTEGER DEFAULT 0 NOT NULL,
        late_grace_minutes INTEGER DEFAULT 0 NOT NULL,
        grace_period_minutes INTEGER DEFAULT 0 NOT NULL,
        early_departure_grace_minutes INTEGER DEFAULT 0 NOT NULL,
        working_days TEXT[] DEFAULT ARRAY['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        is_overnight BOOLEAN DEFAULT false NOT NULL,
        is_active BOOLEAN DEFAULT true NOT NULL,
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
    `);

    // Add any missing columns to `shifts` if table already existed
    const shiftColsToAdd = [
      { name: 'description', type: 'TEXT' },
      { name: 'break_start_time', type: 'TIME' },
      { name: 'break_end_time', type: 'TIME' },
      { name: 'late_grace_minutes', type: 'INTEGER DEFAULT 0' },
      { name: 'early_departure_grace_minutes', type: 'INTEGER DEFAULT 0' },
      { name: 'working_days', type: "TEXT[] DEFAULT ARRAY['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']" },
      { name: 'created_by', type: 'UUID REFERENCES users(id) ON DELETE SET NULL' },
      { name: 'updated_by', type: 'UUID REFERENCES users(id) ON DELETE SET NULL' }
    ];

    for (const col of shiftColsToAdd) {
      await client.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'shifts' AND column_name = '${col.name}'
          ) THEN
            ALTER TABLE shifts ADD COLUMN ${col.name} ${col.type};
          END IF;
        END $$;
      `);
    }

    // Ensure `code` column is unique
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'shifts_code_unique'
        ) THEN
          BEGIN
            ALTER TABLE shifts ADD CONSTRAINT shifts_code_unique UNIQUE (code);
          EXCEPTION
            WHEN duplicate_table THEN NULL;
            WHEN duplicate_object THEN NULL;
          END;
        END IF;
      END $$;
    `);

    // 2. Create `shift_working_days` table
    await client.query(`
      CREATE TABLE IF NOT EXISTS shift_working_days (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        shift_id UUID NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
        day_of_week VARCHAR(20) NOT NULL,
        day_number INTEGER NOT NULL,
        is_working_day BOOLEAN DEFAULT true NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        UNIQUE (shift_id, day_of_week)
      );
    `);

    // 3. Update/Enhance `shift_assignments` table
    await client.query(`
      CREATE TABLE IF NOT EXISTS shift_assignments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
        shift_id UUID NOT NULL REFERENCES shifts(id) ON DELETE RESTRICT,
        start_date DATE NOT NULL,
        end_date DATE,
        is_active BOOLEAN DEFAULT true NOT NULL,
        assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
        reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
    `);

    const assignColsToAdd = [
      { name: 'assigned_by', type: 'UUID REFERENCES users(id) ON DELETE SET NULL' },
      { name: 'reason', type: 'TEXT' }
    ];
    for (const col of assignColsToAdd) {
      await client.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'shift_assignments' AND column_name = '${col.name}'
          ) THEN
            ALTER TABLE shift_assignments ADD COLUMN ${col.name} ${col.type};
          END IF;
        END $$;
      `);
    }

    // 4. Add `current_shift_id` column to `employees`
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'current_shift_id'
        ) THEN
          ALTER TABLE employees ADD COLUMN current_shift_id UUID REFERENCES shifts(id) ON DELETE SET NULL;
        END IF;
      END $$;
    `);

    // 5. Seed Permissions for Shifts module
    const permissionsToSeed = [
      { name: 'shifts:read', description: 'View work shifts, schedules, and assignments' },
      { name: 'shifts:create', description: 'Create new work shifts and working day templates' },
      { name: 'shifts:update', description: 'Modify work shifts, timings, and grace periods' },
      { name: 'shifts:delete', description: 'Activate, deactivate, or delete unused shifts' },
      { name: 'shifts:assign', description: 'Assign and reassign employees to work shifts' }
    ];

    for (const perm of permissionsToSeed) {
      await client.query(`
        INSERT INTO permissions (name, description, created_at, updated_at)
        VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT (name) DO UPDATE 
        SET description = EXCLUDED.description, updated_at = CURRENT_TIMESTAMP;
      `, [perm.name, perm.description]);
    }

    // 6. Map Shift Permissions to HR Roles
    const rolesRes = await client.query(`SELECT id, name FROM hr_roles;`);
    const rolesMap = {};
    for (const r of rolesRes.rows) {
      rolesMap[r.name] = r.id;
    }

    const permsRes = await client.query(`SELECT id, name FROM permissions WHERE name LIKE 'shifts:%';`);
    const permsMap = {};
    for (const p of permsRes.rows) {
      permsMap[p.name] = p.id;
    }

    // Super Admin: all shift permissions
    // Administrator: all shift permissions
    // HR: shifts:read, shifts:create, shifts:update, shifts:delete, shifts:assign
    // Manager: shifts:read
    // Employee: shifts:read (for viewing own schedule)
    const rolePermAssignments = [
      { role: 'Super Admin', perms: ['shifts:read', 'shifts:create', 'shifts:update', 'shifts:delete', 'shifts:assign'] },
      { role: 'Administrator', perms: ['shifts:read', 'shifts:create', 'shifts:update', 'shifts:delete', 'shifts:assign'] },
      { role: 'HR', perms: ['shifts:read', 'shifts:create', 'shifts:update', 'shifts:delete', 'shifts:assign'] },
      { role: 'Manager', perms: ['shifts:read'] },
      { role: 'Employee', perms: ['shifts:read'] }
    ];

    for (const assignment of rolePermAssignments) {
      const roleId = rolesMap[assignment.role];
      if (roleId) {
        for (const pName of assignment.perms) {
          const permId = permsMap[pName];
          if (permId) {
            await client.query(`
              INSERT INTO role_permissions (role_id, permission_id)
              VALUES ($1, $2)
              ON CONFLICT DO NOTHING;
            `, [roleId, permId]);
          }
        }
      }
    }

    // 7. Seed Initial Realistic Shifts for St. Vincent's High School if none exist
    const existingShifts = await client.query(`SELECT COUNT(*) as count FROM shifts;`);
    let facultyShiftId, adminShiftId, supportShiftId;

    if (parseInt(existingShifts.rows[0].count, 10) === 0) {
      console.log('Seeding initial standard school shifts...');

      // 1. Regular Faculty Teaching Shift (07:30 - 14:00)
      const facultyShiftRes = await client.query(`
        INSERT INTO shifts (
          name, code, description, start_time, end_time, 
          break_start_time, break_end_time, break_duration_minutes, 
          late_grace_minutes, grace_period_minutes, early_departure_grace_minutes,
          working_days, is_overnight, is_active
        ) VALUES (
          'Regular School Teaching Shift', 'SCH-FACULTY', 
          'Standard daily work schedule for primary and secondary teaching faculty, laboratory demonstrators, and academic coordinators.',
          '07:30:00', '14:00:00', '10:30:00', '11:00:00', 30, 
          15, 15, 10,
          ARRAY['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], false, true
        ) RETURNING id;
      `);
      facultyShiftId = facultyShiftRes.rows[0].id;

      // 2. Administration & Office Staff Shift (08:00 - 16:00, Mon-Sat)
      const adminShiftRes = await client.query(`
        INSERT INTO shifts (
          name, code, description, start_time, end_time, 
          break_start_time, break_end_time, break_duration_minutes, 
          late_grace_minutes, grace_period_minutes, early_departure_grace_minutes,
          working_days, is_overnight, is_active
        ) VALUES (
          'School Administration & Office Shift', 'SCH-ADMIN', 
          'General administrative schedule for Principal office, HR, Accounts, Registrar, Admissions, and IT support staff.',
          '08:00:00', '16:00:00', '13:00:00', '13:45:00', 45, 
          15, 15, 15,
          ARRAY['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], false, true
        ) RETURNING id;
      `);
      adminShiftId = adminShiftRes.rows[0].id;

      // 3. Facility, Maintenance & Security Shift (06:30 - 15:00, Mon-Sat)
      const supportShiftRes = await client.query(`
        INSERT INTO shifts (
          name, code, description, start_time, end_time, 
          break_start_time, break_end_time, break_duration_minutes, 
          late_grace_minutes, grace_period_minutes, early_departure_grace_minutes,
          working_days, is_overnight, is_active
        ) VALUES (
          'Facility & Campus Operations Shift', 'SCH-SUPPORT', 
          'Early campus operations schedule for maintenance, laboratory attendants, groundskeeping, and security personnel.',
          '06:30:00', '15:00:00', '11:30:00', '12:15:00', 45, 
          10, 10, 10,
          ARRAY['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], false, true
        ) RETURNING id;
      `);
      supportShiftId = supportShiftRes.rows[0].id;

      // Seed working days into `shift_working_days`
      const daysMap = {
        Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6, Sunday: 7
      };

      const seedDays = async (shiftId, daysList) => {
        for (const day of daysList) {
          await client.query(`
            INSERT INTO shift_working_days (shift_id, day_of_week, day_number, is_working_day)
            VALUES ($1, $2, $3, true)
            ON CONFLICT DO NOTHING;
          `, [shiftId, day, daysMap[day]]);
        }
      };

      await seedDays(facultyShiftId, ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']);
      await seedDays(adminShiftId, ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']);
      await seedDays(supportShiftId, ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']);

      // 8. Assign employees to their appropriate shift based on department
      const allEmpsRes = await client.query(`
        SELECT e.id, e.employee_code, e.department_id, d.name as dept_name, d.code as dept_code
        FROM employees e
        LEFT JOIN departments d ON e.department_id = d.id;
      `);

      const adminUserRes = await client.query(`SELECT id FROM users WHERE email = 'admin@school.edu' LIMIT 1;`);
      const adminUserId = adminUserRes.rows[0]?.id || null;

      for (const emp of allEmpsRes.rows) {
        let assignedShiftId = facultyShiftId;
        const deptName = (emp.dept_name || '').toLowerCase();
        const deptCode = (emp.dept_code || '').toLowerCase();

        if (deptName.includes('admin') || deptName.includes('human') || deptName.includes('finance') || deptName.includes('admission') || deptName.includes('it support') || deptCode.includes('adm')) {
          assignedShiftId = adminShiftId;
        } else if (deptName.includes('maintenance') || deptName.includes('housekeeping') || deptName.includes('security') || deptName.includes('general') || deptName.includes('operations')) {
          assignedShiftId = supportShiftId;
        }

        // Update employee's current_shift_id
        await client.query(`
          UPDATE employees 
          SET current_shift_id = $1, updated_at = CURRENT_TIMESTAMP
          WHERE id = $2;
        `, [assignedShiftId, emp.id]);

        // Insert into shift_assignments
        await client.query(`
          INSERT INTO shift_assignments (
            employee_id, shift_id, start_date, is_active, assigned_by, reason, created_at, updated_at
          ) VALUES (
            $1, $2, '2026-06-01', true, $3, 'Initial academic term work schedule assignment', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          );
        `, [emp.id, assignedShiftId, adminUserId]);
      }

      console.log(`✓ Initial shifts seeded and ${allEmpsRes.rows.length} employees assigned.`);
    } else {
      console.log('Shifts already exist in database. Preserving existing records.');
    }

    await client.query('COMMIT');
    console.log('================================================================');
    console.log('✓ SHIFT & SCHEDULE DATABASE MIGRATION COMPLETED SUCCESSFULLY!');
    console.log('================================================================');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err);
    throw err;
  } finally {
    client.release();
    pool.end();
  }
}

migrateAndSeedShifts();
