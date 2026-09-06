const pool = require('../db');

/**
 * Ensures Training Module tables, indexes, permissions, and initial 3 practical
 * school training programs exist in the database. Runs safely on server startup
 * across local and cloud environments (Render, Neon, Supabase, etc.).
 */
async function ensureTrainingModuleSchema(dbPool = pool) {
  const client = await dbPool.connect();
  try {
    // 1. Create tables & indexes
    await client.query(`
      CREATE TABLE IF NOT EXISTS training_programs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title VARCHAR(255) NOT NULL,
        category VARCHAR(100) NOT NULL,
        description TEXT,
        trainer_name VARCHAR(255) NOT NULL,
        training_provider VARCHAR(255),
        training_type VARCHAR(50) NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        start_time VARCHAR(20),
        end_time VARCHAR(20),
        duration_hours NUMERIC(5, 2) NOT NULL DEFAULT 1.00,
        location_type VARCHAR(50) DEFAULT 'On-Campus',
        location_venue VARCHAR(255),
        max_participants INT DEFAULT 0,
        target_audience VARCHAR(255) DEFAULT 'All Faculty',
        department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
        status VARCHAR(50) DEFAULT 'Planned',
        sync_calendar BOOLEAN DEFAULT true,
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_training_programs_dates ON training_programs(start_date, end_date);
      CREATE INDEX IF NOT EXISTS idx_training_programs_status ON training_programs(status);
      CREATE INDEX IF NOT EXISTS idx_training_programs_dept ON training_programs(department_id);

      CREATE TABLE IF NOT EXISTS training_enrollments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        training_id UUID NOT NULL REFERENCES training_programs(id) ON DELETE CASCADE,
        employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        enrollment_type VARCHAR(50) DEFAULT 'Individual',
        enrollment_status VARCHAR(50) DEFAULT 'Assigned',
        attendance_status VARCHAR(50) DEFAULT 'Pending',
        attendance_date DATE,
        hours_completed NUMERIC(5, 2) DEFAULT 0.00,
        completion_status VARCHAR(50) DEFAULT 'Pending',
        completion_date DATE,
        remarks TEXT,
        assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
        assigned_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT uq_training_employee UNIQUE(training_id, employee_id)
      );
      CREATE INDEX IF NOT EXISTS idx_training_enrollments_training ON training_enrollments(training_id);
      CREATE INDEX IF NOT EXISTS idx_training_enrollments_emp ON training_enrollments(employee_id);
      CREATE INDEX IF NOT EXISTS idx_training_enrollments_status ON training_enrollments(enrollment_status, completion_status);

      CREATE TABLE IF NOT EXISTS training_certificates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        training_id UUID REFERENCES training_programs(id) ON DELETE CASCADE,
        employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        enrollment_id UUID REFERENCES training_enrollments(id) ON DELETE SET NULL,
        certificate_name VARCHAR(255) NOT NULL,
        certificate_number VARCHAR(100),
        training_provider VARCHAR(255),
        issue_date DATE NOT NULL,
        expiry_date DATE,
        document_reference VARCHAR(255),
        status VARCHAR(50) DEFAULT 'Active',
        issued_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_training_certs_emp ON training_certificates(employee_id);
      CREATE INDEX IF NOT EXISTS idx_training_certs_training ON training_certificates(training_id);
    `);

    // 2. Register training permissions
    const permissionsToAdd = [
      { name: 'training:read', desc: 'View training programs, dashboard metrics, and training calendars' },
      { name: 'training:manage', desc: 'Create, update, and manage institutional training programs' },
      { name: 'training:assign', desc: 'Enroll and assign employees to training sessions' },
      { name: 'training:attendance', desc: 'Record and update participant attendance and training hours' },
      { name: 'training:certificates', desc: 'Issue and manage staff professional certificates and records' },
      { name: 'training:reports', desc: 'Access institutional training compliance and audit reports' },
      { name: 'training:read_self', desc: 'View own assigned trainings, personal hours, and certificates' }
    ];

    for (const p of permissionsToAdd) {
      await client.query(`
        INSERT INTO permissions (name, description, created_at, updated_at)
        VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT (name) DO UPDATE 
        SET description = EXCLUDED.description, updated_at = CURRENT_TIMESTAMP;
      `, [p.name, p.desc]);
    }

    // Assign permissions to roles
    const rolesRes = await client.query(`SELECT id, name FROM hr_roles;`);
    const rolesMap = {};
    for (const r of rolesRes.rows) {
      rolesMap[r.name.toLowerCase().trim()] = r.id;
    }

    const rolePermAssignments = [
      {
        role: 'super admin',
        perms: ['training:read', 'training:manage', 'training:assign', 'training:attendance', 'training:certificates', 'training:reports', 'training:read_self']
      },
      {
        role: 'administrator',
        perms: ['training:read', 'training:manage', 'training:assign', 'training:attendance', 'training:certificates', 'training:reports', 'training:read_self']
      },
      {
        role: 'hr',
        perms: ['training:read', 'training:manage', 'training:assign', 'training:attendance', 'training:certificates', 'training:reports', 'training:read_self']
      },
      {
        role: 'manager',
        perms: ['training:read', 'training:reports', 'training:read_self']
      },
      {
        role: 'employee',
        perms: ['training:read_self']
      }
    ];

    for (const assignment of rolePermAssignments) {
      const roleId = rolesMap[assignment.role];
      if (!roleId) continue;
      for (const permName of assignment.perms) {
        const permRes = await client.query(`SELECT id FROM permissions WHERE name = $1;`, [permName]);
        if (permRes.rows.length > 0) {
          const permId = permRes.rows[0].id;
          await client.query(`
            INSERT INTO role_permissions (role_id, permission_id)
            VALUES ($1, $2)
            ON CONFLICT DO NOTHING;
          `, [roleId, permId]);
        }
      }
    }

    // 3. Check if training programs are empty and seed the 3 school trainings
    const countRes = await client.query(`SELECT COUNT(*) AS cnt FROM training_programs;`);
    const existingCount = parseInt(countRes.rows[0]?.cnt, 10) || 0;

    if (existingCount === 0) {
      console.log('No training programs found. Auto-seeding the 3 practical school training programs...');

      // Find admin user
      const adminUserRes = await client.query(`
        SELECT id FROM users 
        WHERE email = 'principal@school.edu' 
           OR email = 'admin@school.edu' 
           OR role_id IN (SELECT id FROM hr_roles WHERE name IN ('Super Admin', 'Administrator', 'HR')) 
        LIMIT 1;
      `);
      const adminUserId = adminUserRes.rows[0]?.id || null;

      // Find relevant departments
      const deptRes = await client.query(`SELECT id, name FROM departments;`);
      const depts = {};
      deptRes.rows.forEach(d => { depts[d.name] = d.id; });

      // Program 1: AI & Digital Tools for Teachers
      const t1Res = await client.query(`
        INSERT INTO training_programs (
          title, category, description, trainer_name, training_provider,
          training_type, start_date, end_date, start_time, end_time,
          duration_hours, location_type, location_venue, max_participants,
          target_audience, department_id, status, sync_calendar, created_by
        ) VALUES (
          'AI & Digital Tools for Teachers',
          'Digital Teaching Tools & Pedagogy',
          'Help teachers use AI responsibly for lesson planning, classroom activities, creating educational material and improving productivity.',
          'Priya Sharma (Senior EdTech Specialist)',
          'EduTech Innovations India',
          'Workshop',
          '2026-09-15',
          '2026-09-15',
          '09:30:00',
          '12:30:00',
          3.00,
          'On-Campus',
          'Senior Computer Lab 1',
          30,
          'Teaching Staff',
          $1,
          'Upcoming',
          true,
          $2
        ) RETURNING id;
      `, [depts['IT Support & Computer Labs'] || null, adminUserId]);
      const t1Id = t1Res.rows[0]?.id;

      // Program 2: Child Safety & Safeguarding
      const t2Res = await client.query(`
        INSERT INTO training_programs (
          title, category, description, trainer_name, training_provider,
          training_type, start_date, end_date, start_time, end_time,
          duration_hours, location_type, location_venue, max_participants,
          target_audience, department_id, status, sync_calendar, created_by
        ) VALUES (
          'Child Safety & Safeguarding',
          'Child Safeguarding & Safety',
          'Train teaching and non-teaching staff on student safety, safeguarding practices, identifying concerns and appropriate reporting procedures.',
          'Adv. Meera Nair (Child Rights & POCSO Consultant)',
          'National Child Welfare Council',
          'Workshop',
          '2026-09-22',
          '2026-09-22',
          '14:00:00',
          '16:00:00',
          2.00,
          'On-Campus',
          'Main School Auditorium',
          60,
          'All Staff',
          $1,
          'Upcoming',
          true,
          $2
        ) RETURNING id;
      `, [depts['School Administration & HR'] || null, adminUserId]);
      const t2Id = t2Res.rows[0]?.id;

      // Program 3: First Aid & Emergency Response
      const t3Res = await client.query(`
        INSERT INTO training_programs (
          title, category, description, trainer_name, training_provider,
          training_type, start_date, end_date, start_time, end_time,
          duration_hours, location_type, location_venue, max_participants,
          target_audience, department_id, status, sync_calendar, created_by
        ) VALUES (
          'First Aid & Emergency Response',
          'First Aid & Health',
          'Train school staff to respond appropriately to common medical emergencies and incidents on campus until professional help arrives.',
          'Dr. Vivek Sengupta (MD, Emergency Medicine)',
          'St. John Ambulance Association',
          'Practical Training',
          '2026-09-29',
          '2026-09-29',
          '09:00:00',
          '13:00:00',
          4.00,
          'On-Campus',
          'School Infirmary & Gymnasium',
          40,
          'Teaching & Non-Teaching Staff',
          $1,
          'Upcoming',
          true,
          $2
        ) RETURNING id;
      `, [depts['Physical Education & Sports'] || null, adminUserId]);
      const t3Id = t3Res.rows[0]?.id;

      // Fetch active employees
      const empRes = await client.query(`
        SELECT e.id, d.name AS dept_name
        FROM employees e
        LEFT JOIN departments d ON e.department_id = d.id
        WHERE e.employment_status IN ('Active', 'Probation')
        ORDER BY e.employee_code ASC;
      `);
      const allEmployees = empRes.rows;

      if (allEmployees.length > 0) {
        // Teachers for Program 1
        const teachers = allEmployees.filter(e => 
          e.dept_name && (
            e.dept_name.includes('Science') ||
            e.dept_name.includes('Math') ||
            e.dept_name.includes('English') ||
            e.dept_name.includes('Primary') ||
            e.dept_name.includes('Secondary') ||
            e.dept_name.includes('Language') ||
            e.dept_name.includes('Arts') ||
            e.dept_name.includes('Computer') ||
            e.dept_name.includes('IT')
          )
        );
        const teacherIds = teachers.length > 0 ? teachers.map(t => t.id) : allEmployees.slice(0, 12).map(e => e.id);

        if (t1Id) {
          for (const empId of teacherIds) {
            await client.query(`
              INSERT INTO training_enrollments (
                training_id, employee_id, enrollment_type, enrollment_status,
                attendance_status, completion_status, assigned_by
              ) VALUES ($1, $2, 'Individual', 'Assigned', 'Pending', 'Pending', $3)
              ON CONFLICT (training_id, employee_id) DO NOTHING;
            `, [t1Id, empId, adminUserId]);
          }
        }

        if (t2Id) {
          for (const emp of allEmployees) {
            await client.query(`
              INSERT INTO training_enrollments (
                training_id, employee_id, enrollment_type, enrollment_status,
                attendance_status, completion_status, assigned_by
              ) VALUES ($1, $2, 'Department-wide', 'Assigned', 'Pending', 'Pending', $3)
              ON CONFLICT (training_id, employee_id) DO NOTHING;
            `, [t2Id, emp.id, adminUserId]);
          }
        }

        if (t3Id) {
          const firstAidStaff = allEmployees.slice(0, 16);
          for (const emp of firstAidStaff) {
            await client.query(`
              INSERT INTO training_enrollments (
                training_id, employee_id, enrollment_type, enrollment_status,
                attendance_status, completion_status, assigned_by
              ) VALUES ($1, $2, 'Individual', 'Assigned', 'Pending', 'Pending', $3)
              ON CONFLICT (training_id, employee_id) DO NOTHING;
            `, [t3Id, emp.id, adminUserId]);
          }
        }
      }

      console.log('✓ Successfully auto-seeded 3 practical school training programs and enrollments.');
    }
    console.log('✓ Training module schema and data verification completed.');
  } catch (err) {
    console.error('Training module schema auto-migration error:', err.message);
  } finally {
    client.release();
  }
}

module.exports = {
  ensureTrainingModuleSchema
};
