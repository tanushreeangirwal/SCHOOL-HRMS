const pool = require('../db');

async function initTrainingModule() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log('--- 1. Creating Training Module Tables ---');

    // 1. Master Training Programs Table
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
    `);
    console.log('✓ training_programs table verified/created.');

    // 2. Training Enrollments & Attendance Table
    await client.query(`
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
    `);
    console.log('✓ training_enrollments table verified/created.');

    // 3. Training Certificates Table
    await client.query(`
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
    console.log('✓ training_certificates table verified/created.');

    console.log('--- 2. Setting Up Training Permissions ---');
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
    console.log('✓ Training permissions registered.');

    // Map permissions to roles
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
    console.log('✓ Training permissions assigned across all roles.');

    console.log('--- 3. Seeding Realistic School Training Programs ---');
    // Fetch departments and sample users for realistic linkages
    const deptsRes = await client.query(`SELECT id, name FROM departments;`);
    const depts = deptsRes.rows;
    const findDeptId = (keyword) => {
      const d = depts.find(item => item.name.toLowerCase().includes(keyword.toLowerCase()));
      return d ? d.id : null;
    };

    const adminUserRes = await client.query(`SELECT id FROM users WHERE email = 'admin@school.edu' OR role_id IN (SELECT id FROM hr_roles WHERE name = 'Super Admin' OR name = 'Administrator') LIMIT 1;`);
    const adminUserId = adminUserRes.rows[0]?.id || null;

    const samplePrograms = [
      {
        title: 'Classroom Management & Positive Discipline Workshop',
        category: 'Pedagogy & Classroom Management',
        description: 'Interactive session covering proactive behavior interventions, classroom routine frameworks, and positive reinforcement methodologies in K-12 classrooms.',
        trainer_name: 'Dr. Sudha Ramachandran',
        training_provider: 'CBSE Centre of Excellence, South Zone',
        training_type: 'Workshop',
        start_date: '2026-08-10',
        end_date: '2026-08-11',
        start_time: '09:30:00',
        end_time: '12:30:00',
        duration_hours: 6.00,
        location_type: 'On-Campus',
        location_venue: 'Main Auditorium (Block B)',
        max_participants: 40,
        target_audience: 'Primary & Secondary Teaching Faculty',
        department_id: findDeptId('Science') || null,
        status: 'Completed'
      },
      {
        title: 'POCSO Act & Child Safeguarding Compliance 2026',
        category: 'Child Safeguarding & Safety',
        description: 'Mandatory statutory school training detailing Protection of Children from Sexual Offences (POCSO) protocols, student safety standards, and early detection mechanisms.',
        trainer_name: 'Adv. Meenakshi Sundaram',
        training_provider: 'National Commission for Protection of Child Rights (NCPCR)',
        training_type: 'Certification',
        start_date: '2026-08-22',
        end_date: '2026-08-22',
        start_time: '10:00:00',
        end_time: '14:00:00',
        duration_hours: 4.00,
        location_type: 'On-Campus',
        location_venue: 'St. Vincent Seminar Hall',
        max_participants: 60,
        target_audience: 'All Teaching & Administrative Staff',
        department_id: null,
        status: 'Completed'
      },
      {
        title: 'NEP 2020: Competency-Based Learning & Experiential Pedagogy',
        category: 'NEP & Curriculum',
        description: 'Implementation strategies for National Education Policy guidelines, shifting from rote learning to inquiry-led competency modules and multi-disciplinary assessments.',
        trainer_name: 'Prof. Arvind Nambiar',
        training_provider: 'NCERT Curriculum Research Wing',
        training_type: 'Seminar',
        start_date: '2026-09-02',
        end_date: '2026-09-03',
        start_time: '14:00:00',
        end_time: '17:00:00',
        duration_hours: 6.00,
        location_type: 'On-Campus',
        location_venue: 'Conference Room 1',
        max_participants: 35,
        target_audience: 'Middle & Senior Wing Faculty',
        department_id: findDeptId('Humanities') || null,
        status: 'Completed'
      },
      {
        title: 'Campus First Aid & Emergency CPR Response',
        category: 'First Aid & Health',
        description: 'Hands-on emergency resuscitation (CPR), triage, sports trauma handling, and rapid crisis management on school grounds.',
        trainer_name: 'Dr. Vivek Sengupta (MD, Emergency Medicine)',
        training_provider: 'St. John Ambulance Association',
        training_type: 'Certification',
        start_date: '2026-09-08',
        end_date: '2026-09-08',
        start_time: '09:00:00',
        end_time: '15:00:00',
        duration_hours: 6.00,
        location_type: 'On-Campus',
        location_venue: 'School Infirmary & Gymnasium',
        max_participants: 25,
        target_audience: 'PE Teachers, Lab In-Charges, & Wardens',
        department_id: findDeptId('Physical Education') || null,
        status: 'Ongoing'
      },
      {
        title: 'Digital Interactive Whiteboards & Smart Classroom Tools',
        category: 'Digital Teaching Tools',
        description: 'Leveraging smart board digital pen features, multimedia presentation tools, and Google Workspace for Education in daily classroom delivery.',
        trainer_name: 'Priya Sharma (Senior EdTech Specialist)',
        training_provider: 'EduTech Innovations India',
        training_type: 'Workshop',
        start_date: '2026-09-14',
        end_date: '2026-09-15',
        start_time: '15:30:00',
        end_time: '17:00:00',
        duration_hours: 3.00,
        location_type: 'On-Campus',
        location_venue: 'Senior Computer Lab 1',
        max_participants: 30,
        target_audience: 'All Subject Teachers',
        department_id: findDeptId('IT Support') || null,
        status: 'Upcoming'
      },
      {
        title: 'Cyber Safety & Student Data Privacy Guidelines',
        category: 'Digital Teaching Tools',
        description: 'School IT data compliance, DPDP Act adherence, secure handling of student grades, and protecting campus networks against phishing and social engineering.',
        trainer_name: 'Rohan Deshmukh (Cyber Security Consultant)',
        training_provider: 'Cyber Peace Foundation',
        training_type: 'Webinar',
        start_date: '2026-09-20',
        end_date: '2026-09-20',
        start_time: '16:00:00',
        end_time: '18:30:00',
        duration_hours: 2.50,
        location_type: 'Online',
        location_venue: 'Google Meet / Live Stream',
        max_participants: 100,
        target_audience: 'All Faculty & Administrative Staff',
        department_id: null,
        status: 'Upcoming'
      },
      {
        title: 'Inclusive Education: Supporting Neurodiverse Learners',
        category: 'Inclusive Education',
        description: 'Identification of learning differences (Dyslexia, ADHD, Autism Spectrum) and pedagogical differentiation techniques for inclusive classrooms.',
        trainer_name: 'Dr. Ananya Roy (Child Psychologist)',
        training_provider: 'MindCare Child Development Centre',
        training_type: 'Workshop',
        start_date: '2026-09-26',
        end_date: '2026-09-27',
        start_time: '10:00:00',
        end_time: '13:30:00',
        duration_hours: 7.00,
        location_type: 'On-Campus',
        location_venue: 'AV Room 2',
        max_participants: 30,
        target_audience: 'Primary Teachers & School Counselors',
        department_id: findDeptId('Primary Wing') || null,
        status: 'Upcoming'
      },
      {
        title: 'Academic Leadership & Mentorship for HODs',
        category: 'Leadership & Administration',
        description: 'Curriculum audit methodologies, peer observation feedback loops, conflict resolution, and strategic academic planning for department heads.',
        trainer_name: 'Rev. Fr. Donald Pinto',
        training_provider: 'Jesuit Educational Leadership Consortium',
        training_type: 'Seminar',
        start_date: '2026-10-05',
        end_date: '2026-10-06',
        start_time: '09:30:00',
        end_time: '13:30:00',
        duration_hours: 8.00,
        location_type: 'On-Campus',
        location_venue: 'Executive Council Boardroom',
        max_participants: 15,
        target_audience: 'Heads of Departments & Academic Coordinators',
        department_id: findDeptId('School Administration') || null,
        status: 'Planned'
      },
      {
        title: 'Formative Assessment & Question Paper Blueprinting',
        category: 'Examination & Assessment',
        description: 'Designing standardized rubrics, Bloom taxonomy cognitive weightages, and holistic assessment frameworks aligned with CBSE Board specifications.',
        trainer_name: 'Mrs. Jayashree Kulkarni',
        training_provider: 'Council for Educational Evaluation',
        training_type: 'Workshop',
        start_date: '2026-10-12',
        end_date: '2026-10-13',
        start_time: '14:30:00',
        end_time: '17:00:00',
        duration_hours: 5.00,
        location_type: 'On-Campus',
        location_venue: 'Staff Common Room Conference Area',
        max_participants: 40,
        target_audience: 'Secondary & Senior Secondary Faculty',
        department_id: null,
        status: 'Planned'
      },
      {
        title: 'New Faculty Orientation & School Ethos Program',
        category: 'Pedagogy & Classroom Management',
        description: 'Comprehensive institutional onboarding program introducing school history, HR policies, ERP modules, classroom ethos, and teacher-parent communication protocols.',
        trainer_name: 'Dr. Titus Thangaraj & HR Team',
        training_provider: "St. Vincent's Institutional HR Cell",
        training_type: 'Internal',
        start_date: '2026-07-28',
        end_date: '2026-07-30',
        start_time: '09:00:00',
        end_time: '13:00:00',
        duration_hours: 12.00,
        location_type: 'On-Campus',
        location_venue: 'Library Reading Hall',
        max_participants: 20,
        target_audience: 'Newly Recruited Teachers & Interns',
        department_id: null,
        status: 'Completed'
      }
    ];

    const insertedPrograms = [];
    for (const prog of samplePrograms) {
      // Check if program with same title already exists
      const existing = await client.query(`SELECT id FROM training_programs WHERE title = $1;`, [prog.title]);
      let progId;
      if (existing.rows.length === 0) {
        const ins = await client.query(`
          INSERT INTO training_programs (
            title, category, description, trainer_name, training_provider,
            training_type, start_date, end_date, start_time, end_time,
            duration_hours, location_type, location_venue, max_participants,
            target_audience, department_id, status, sync_calendar, created_by
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
          RETURNING id, title, status, duration_hours;
        `, [
          prog.title, prog.category, prog.description, prog.trainer_name, prog.training_provider,
          prog.training_type, prog.start_date, prog.end_date, prog.start_time, prog.end_time,
          prog.duration_hours, prog.location_type, prog.location_venue, prog.max_participants,
          prog.target_audience, prog.department_id, prog.status, prog.sync_calendar, adminUserId
        ]);
        progId = ins.rows[0].id;
        insertedPrograms.push(ins.rows[0]);
      } else {
        progId = existing.rows[0].id;
        insertedPrograms.push(existing.rows[0]);
      }
    }
    console.log(`✓ ${insertedPrograms.length} training programs seeded.`);

    console.log('--- 4. Seeding Realistic Participant Enrollments & Attendance ---');
    // Fetch active employees
    const employeesRes = await client.query(`
      SELECT e.id, e.employee_code, e.first_name, e.last_name, e.department_id
      FROM employees e
      WHERE e.employment_status IN ('Active', 'Probation')
      ORDER BY e.employee_code;
    `);
    const employees = employeesRes.rows;

    // Get all current programs in DB
    const allProgsRes = await client.query(`SELECT id, title, status, duration_hours, start_date, training_provider FROM training_programs;`);
    const allProgs = allProgsRes.rows;

    let totalEnrollmentsCount = 0;
    let totalCertificatesCount = 0;

    for (const prog of allProgs) {
      // Determine participant sample based on program target
      let targetEmployees = [];
      if (prog.title.includes('Safeguarding') || prog.title.includes('Orientation')) {
        // Universal training
        targetEmployees = employees.slice(0, 15);
      } else if (prog.title.includes('First Aid')) {
        targetEmployees = employees.filter(e => e.employee_code === 'EMP-1023' || e.employee_code === 'EMP-1024' || e.employee_code === 'EMP-1001' || e.employee_code === 'EMP-1002');
      } else if (prog.title.includes('Classroom Management')) {
        targetEmployees = employees.slice(0, 8);
      } else if (prog.title.includes('NEP')) {
        targetEmployees = employees.slice(2, 10);
      } else {
        targetEmployees = employees.slice(0, 6);
      }

      for (let i = 0; i < targetEmployees.length; i++) {
        const emp = targetEmployees[i];
        let enrollmentStatus = 'Assigned';
        let attendanceStatus = 'Pending';
        let hoursCompleted = 0;
        let completionStatus = 'Pending';
        let completionDate = null;
        let attendanceDate = null;

        if (prog.status === 'Completed') {
          // 85% attended & completed, 15% absent
          if (i % 6 === 5) {
            enrollmentStatus = 'Attended';
            attendanceStatus = 'Absent';
            hoursCompleted = 0;
            completionStatus = 'Incomplete';
          } else {
            enrollmentStatus = 'Completed';
            attendanceStatus = 'Present';
            hoursCompleted = prog.duration_hours;
            completionStatus = 'Completed';
            completionDate = prog.start_date;
            attendanceDate = prog.start_date;
          }
        } else if (prog.status === 'Ongoing') {
          enrollmentStatus = 'In Progress';
          attendanceStatus = 'Present';
          hoursCompleted = Math.round(Number(prog.duration_hours) * 0.5 * 10) / 10;
          completionStatus = 'Pending';
          attendanceDate = prog.start_date;
        } else if (prog.status === 'Upcoming') {
          enrollmentStatus = i % 2 === 0 ? 'Registered' : 'Assigned';
          attendanceStatus = 'Pending';
          completionStatus = 'Pending';
        }

        const enrollmentIns = await client.query(`
          INSERT INTO training_enrollments (
            training_id, employee_id, enrollment_type, enrollment_status,
            attendance_status, attendance_date, hours_completed, completion_status,
            completion_date, remarks, assigned_by
          ) VALUES ($1, $2, 'Department-wide', $3, $4, $5, $6, $7, $8, $9, $10)
          ON CONFLICT (training_id, employee_id) DO UPDATE
          SET enrollment_status = EXCLUDED.enrollment_status,
              attendance_status = EXCLUDED.attendance_status,
              hours_completed = EXCLUDED.hours_completed,
              completion_status = EXCLUDED.completion_status
          RETURNING id;
        `, [
          prog.id, emp.id, enrollmentStatus,
          attendanceStatus, attendanceDate, hoursCompleted, completionStatus,
          completionDate, 'Institutional professional development allocation', adminUserId
        ]);
        totalEnrollmentsCount++;

        const enrollmentId = enrollmentIns.rows[0].id;

        // If completed and is a Certification or Child Safeguarding / First Aid, record certificate
        if (completionStatus === 'Completed' && (prog.title.includes('Safeguarding') || prog.title.includes('First Aid') || prog.title.includes('Classroom Management') || prog.title.includes('Orientation'))) {
          const certNum = `SV-CPD-${prog.title.substring(0, 3).toUpperCase()}-${emp.employee_code.replace('EMP-', '')}-2026`;
          const expiryDate = prog.title.includes('First Aid') ? '2028-08-31' : prog.title.includes('Safeguarding') ? '2027-08-22' : null;

          const existingCert = await client.query(`SELECT id FROM training_certificates WHERE training_id = $1 AND employee_id = $2;`, [prog.id, emp.id]);
          if (existingCert.rows.length === 0) {
            await client.query(`
              INSERT INTO training_certificates (
                training_id, employee_id, enrollment_id, certificate_name,
                certificate_number, training_provider, issue_date, expiry_date,
                document_reference, status, issued_by
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'Active', $10);
            `, [
              prog.id, emp.id, enrollmentId,
              `Certificate of Completion: ${prog.title}`,
              certNum,
              prog.training_provider || "St. Vincent's Academy",
              prog.start_date,
              expiryDate,
              `REF/HR/2026/${certNum}`,
              adminUserId
            ]);
            totalCertificatesCount++;
          }
        }
      }
    }

    console.log(`✓ Processed ${totalEnrollmentsCount} participant enrollments and ${totalCertificatesCount} certification records.`);

    await client.query('COMMIT');
    console.log('\n=== TRAINING MODULE DATABASE INITIALIZATION COMPLETED SUCCESSFULLY ===');
    process.exit(0);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error initializing Training Module database:', err);
    process.exit(1);
  } finally {
    client.release();
  }
}

initTrainingModule();
