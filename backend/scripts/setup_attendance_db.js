const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const pool = require('../db');

async function setupAttendanceDatabase() {
  const client = await pool.connect();
  try {
    console.log('--- SETTING UP ATTENDANCE DATABASE & RBAC ---');
    await client.query('BEGIN');

    // 1. Ensure attendance_records table exists with necessary columns and constraints
    await client.query(`
      CREATE TABLE IF NOT EXISTS attendance_records (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        shift_id UUID REFERENCES shifts(id) ON DELETE SET NULL,
        attendance_date DATE NOT NULL,
        check_in TIMESTAMP WITHOUT TIME ZONE,
        check_out TIMESTAMP WITHOUT TIME ZONE,
        status VARCHAR(50) NOT NULL DEFAULT 'Present',
        source VARCHAR(50) DEFAULT 'MANUAL',
        late_minutes INTEGER DEFAULT 0,
        early_departure_minutes INTEGER DEFAULT 0,
        overtime_minutes INTEGER DEFAULT 0,
        remarks TEXT,
        created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT attendance_records_employee_id_attendance_date_key UNIQUE (employee_id, attendance_date)
      );
    `);
    console.log('✓ attendance_records table verified');

    // 2. Create attendance_audit_logs table for tracking historical corrections
    await client.query(`
      CREATE TABLE IF NOT EXISTS attendance_audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        attendance_id UUID REFERENCES attendance_records(id) ON DELETE SET NULL,
        employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        attendance_date DATE NOT NULL,
        previous_status VARCHAR(50),
        new_status VARCHAR(50),
        previous_check_in TIMESTAMP WITHOUT TIME ZONE,
        new_check_in TIMESTAMP WITHOUT TIME ZONE,
        previous_check_out TIMESTAMP WITHOUT TIME ZONE,
        new_check_out TIMESTAMP WITHOUT TIME ZONE,
        reason TEXT,
        changed_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        changed_by_name VARCHAR(150),
        created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✓ attendance_audit_logs table verified');

    // Indexes for high performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_attendance_records_emp_date ON attendance_records (employee_id, attendance_date);
      CREATE INDEX IF NOT EXISTS idx_attendance_records_date ON attendance_records (attendance_date);
      CREATE INDEX IF NOT EXISTS idx_attendance_records_status ON attendance_records (status);
      CREATE INDEX IF NOT EXISTS idx_attendance_audit_logs_emp ON attendance_audit_logs (employee_id);
    `);
    console.log('✓ attendance indexes created');

    // 3. Seed Attendance Permissions
    const permissionsToSeed = [
      { name: 'attendance:read', description: 'View staff attendance dashboard, daily records, register, and reports' },
      { name: 'attendance:read_self', description: 'View own personal attendance history' },
      { name: 'attendance:mark', description: 'Mark, check-in, and check-out staff attendance' },
      { name: 'attendance:update', description: 'Edit, correct, and adjust historical attendance records' },
      { name: 'attendance:export', description: 'Export attendance registers and reports to CSV' }
    ];

    for (const perm of permissionsToSeed) {
      await client.query(`
        INSERT INTO permissions (id, name, description, created_at, updated_at)
        VALUES (gen_random_uuid(), $1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description, updated_at = CURRENT_TIMESTAMP;
      `, [perm.name, perm.description]);
    }
    console.log('✓ attendance permissions seeded in permissions table');

    // 4. Map permissions to roles
    const rolesRes = await client.query('SELECT id, name FROM hr_roles;');
    const rolesMap = {};
    rolesRes.rows.forEach(r => { rolesMap[r.name] = r.id; });

    const permsRes = await client.query("SELECT id, name FROM permissions WHERE name LIKE 'attendance:%';");
    const permsMap = {};
    permsRes.rows.forEach(p => { permsMap[p.name] = p.id; });

    // Super Admin & Administrator: All 5 perms
    const adminRoles = [rolesMap['Super Admin'], rolesMap['Administrator'], rolesMap['HR']].filter(Boolean);
    for (const roleId of adminRoles) {
      for (const permName of Object.keys(permsMap)) {
        await client.query(`
          INSERT INTO role_permissions (role_id, permission_id)
          VALUES ($1, $2)
          ON CONFLICT DO NOTHING;
        `, [roleId, permsMap[permName]]);
      }
    }

    // Manager: attendance:read, attendance:read_self, attendance:mark
    if (rolesMap['Manager']) {
      const managerPerms = ['attendance:read', 'attendance:read_self', 'attendance:mark'];
      for (const pName of managerPerms) {
        if (permsMap[pName]) {
          await client.query(`
            INSERT INTO role_permissions (role_id, permission_id)
            VALUES ($1, $2)
            ON CONFLICT DO NOTHING;
          `, [rolesMap['Manager'], permsMap[pName]]);
        }
      }
    }

    // Employee: attendance:read_self
    if (rolesMap['Employee']) {
      if (permsMap['attendance:read_self']) {
        await client.query(`
          INSERT INTO role_permissions (role_id, permission_id)
          VALUES ($1, $2)
          ON CONFLICT DO NOTHING;
        `, [rolesMap['Employee'], permsMap['attendance:read_self']]);
      }
    }
    console.log('✓ role_permissions updated with attendance permissions');

    // 5. Seed Realistic Demo Attendance Data for August & September 2026
    const employeesRes = await client.query(`
      SELECT 
        e.id, 
        e.employee_code, 
        e.first_name, 
        e.last_name, 
        e.department_id,
        e.current_shift_id,
        s.name as shift_name,
        s.start_time,
        s.end_time,
        s.late_grace_minutes
      FROM employees e
      LEFT JOIN shifts s ON e.current_shift_id = s.id
      WHERE e.employment_status = 'Active';
    `);
    const activeEmployees = employeesRes.rows;
    console.log(`Found ${activeEmployees.length} active employees to generate attendance for.`);

    // Fetch working days for each shift
    const shiftDaysRes = await client.query('SELECT shift_id, day_of_week FROM shift_working_days;');
    const shiftDaysMap = {};
    shiftDaysRes.rows.forEach(row => {
      if (!shiftDaysMap[row.shift_id]) shiftDaysMap[row.shift_id] = [];
      shiftDaysMap[row.shift_id].push(row.day_of_week);
    });

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    // Generate dates from Aug 1, 2026 to Sep 3, 2026
    const startDate = new Date(2026, 7, 1); // Aug 1, 2026
    const endDate = new Date(2026, 8, 3);   // Sep 3, 2026

    let insertedRecords = 0;

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      const dayOfWeek = dayNames[d.getDay()];

      for (const emp of activeEmployees) {
        const allowedDays = emp.current_shift_id && shiftDaysMap[emp.current_shift_id]
          ? shiftDaysMap[emp.current_shift_id]
          : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

        const isWorkingDay = allowedDays.includes(dayOfWeek);

        if (!isWorkingDay) {
          // Non-working days (weekends/scheduled off) are not marked as absent
          continue;
        }

        // Realistic seed distribution on working days:
        // ~85% Present, ~8% Late, ~4% On Leave, ~2% Half Day, ~1% Absent
        const rand = Math.random();
        let status = 'Present';
        let checkIn = null;
        let checkOut = null;
        let lateMinutes = 0;
        let remarks = null;

        const shiftStartStr = emp.start_time ? emp.start_time.slice(0, 5) : '07:30';
        const shiftEndStr = emp.end_time ? emp.end_time.slice(0, 5) : '14:00';
        const [sH, sM] = shiftStartStr.split(':').map(Number);
        const [eH, eM] = shiftEndStr.split(':').map(Number);

        if (rand < 0.82) {
          // Present (on time)
          status = 'Present';
          const variance = Math.floor(Math.random() * 12) - 8; // e.g. -8 to +4 mins
          const inM = sM + variance;
          const inH = sH + (inM < 0 ? -1 : 0);
          const finalInM = (inM + 60) % 60;
          
          checkIn = `${dateStr} ${String(inH).padStart(2, '0')}:${String(finalInM).padStart(2, '0')}:00`;
          checkOut = `${dateStr} ${String(eH).padStart(2, '0')}:${String(eM + Math.floor(Math.random() * 10)).padStart(2, '0')}:00`;
        } else if (rand < 0.90) {
          // Late
          status = 'Late';
          lateMinutes = (emp.late_grace_minutes || 15) + Math.floor(Math.random() * 25) + 2; // e.g. 17-42 mins late
          const totalInM = sM + lateMinutes;
          const inH = sH + Math.floor(totalInM / 60);
          const finalInM = totalInM % 60;

          checkIn = `${dateStr} ${String(inH).padStart(2, '0')}:${String(finalInM).padStart(2, '0')}:00`;
          checkOut = `${dateStr} ${String(eH).padStart(2, '0')}:${String(eM + 5).padStart(2, '0')}:00`;
          remarks = `Late arrival by ${lateMinutes} mins`;
        } else if (rand < 0.94) {
          // On Leave
          status = 'On Leave';
          remarks = 'Approved personal / casual leave';
        } else if (rand < 0.97) {
          // Half Day
          status = 'Half Day';
          checkIn = `${dateStr} ${String(sH).padStart(2, '0')}:${String(sM).padStart(2, '0')}:00`;
          checkOut = `${dateStr} ${String(sH + 3).padStart(2, '0')}:30:00`;
          remarks = 'Approved half-day afternoon departure';
        } else {
          // Absent
          status = 'Absent';
          remarks = 'Unexcused absence';
        }

        await client.query(`
          INSERT INTO attendance_records (
            id, employee_id, shift_id, attendance_date, check_in, check_out, status, source, late_minutes, early_departure_minutes, overtime_minutes, remarks, created_at, updated_at
          ) VALUES (
            gen_random_uuid(), $1, $2, $3, $4, $5, $6, 'MANUAL', $7, 0, 0, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          )
          ON CONFLICT (employee_id, attendance_date) DO UPDATE SET
            shift_id = EXCLUDED.shift_id,
            check_in = EXCLUDED.check_in,
            check_out = EXCLUDED.check_out,
            status = EXCLUDED.status,
            late_minutes = EXCLUDED.late_minutes,
            remarks = EXCLUDED.remarks,
            updated_at = CURRENT_TIMESTAMP;
        `, [
          emp.id,
          emp.current_shift_id || null,
          dateStr,
          checkIn,
          checkOut,
          status,
          lateMinutes,
          remarks
        ]);

        insertedRecords++;
      }
    }

    console.log(`✓ Generated/updated ${insertedRecords} attendance records across August & September 2026.`);

    await client.query('COMMIT');
    console.log('====================================================');
    console.log('  ATTENDANCE DATABASE SETUP COMPLETED SUCCESSFULLY');
    console.log('====================================================');
    process.exit(0);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Attendance setup failed:', err);
    process.exit(1);
  } finally {
    client.release();
  }
}

setupAttendanceDatabase();
