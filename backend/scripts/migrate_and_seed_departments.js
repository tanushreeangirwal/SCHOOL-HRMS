const pool = require('../db');

async function migrateAndSeedDepartments() {
  console.log('--- STARTING ADDITIVE DEPARTMENT MIGRATION & SEEDING ---');

  try {
    // 1. Additive columns on departments table
    await pool.query(`
      ALTER TABLE departments 
        ADD COLUMN IF NOT EXISTS description TEXT,
        ADD COLUMN IF NOT EXISTS head_id UUID REFERENCES employees(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;
    `);
    console.log('✓ Verified/added additive columns to departments (description, head_id, branch_id).');

    // 2. Add Department Permissions to permissions table
    const deptPermissions = [
      { name: 'departments:read', description: 'View departmental directory and organizational hierarchy' },
      { name: 'departments:create', description: 'Create new academic and administrative departments' },
      { name: 'departments:update', description: 'Modify department details, head assignments, and settings' },
      { name: 'departments:delete', description: 'Deactivate or toggle status of departments' }
    ];

    for (const perm of deptPermissions) {
      await pool.query(`
        INSERT INTO permissions (id, name, description, created_at, updated_at)
        VALUES (gen_random_uuid(), $1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description;
      `, [perm.name, perm.description]);
    }
    console.log('✓ Seeded department permissions.');

    // 3. Map permissions to roles
    // Administrator & HR get all department permissions; Manager gets read-only
    await pool.query(`
      INSERT INTO role_permissions (role_id, permission_id)
      SELECT r.id, p.id
      FROM hr_roles r
      CROSS JOIN permissions p
      WHERE r.name IN ('Administrator', 'HR') 
        AND p.name IN ('departments:read', 'departments:create', 'departments:update', 'departments:delete')
      ON CONFLICT DO NOTHING;
    `);

    await pool.query(`
      INSERT INTO role_permissions (role_id, permission_id)
      SELECT r.id, p.id
      FROM hr_roles r
      CROSS JOIN permissions p
      WHERE r.name = 'Manager' 
        AND p.name = 'departments:read'
      ON CONFLICT DO NOTHING;
    `);
    console.log('✓ Assigned departmental permissions to Administrator, HR, and Manager roles.');

    // 4. Fetch existing employees to link as Department Heads and staff members
    const empRes = await pool.query('SELECT id, employee_code, first_name, last_name FROM employees ORDER BY employee_code;');
    const employees = empRes.rows;
    const empMap = {};
    employees.forEach(e => { empMap[e.employee_code] = e.id; });

    // 5. Seed St. Vincent's High School Departments
    const schoolDepartments = [
      {
        code: 'DEPT-SCI',
        name: 'Science & Mathematics Faculty',
        description: 'Secondary & Higher Secondary STEM curriculum, Physics, Chemistry, Biology laboratories, and Olympiad mentoring.',
        head_code: 'EMP-1001', // Eleanor Vance
        is_active: true
      },
      {
        code: 'DEPT-HUM',
        name: 'Humanities & Languages Faculty',
        description: 'English literature, regional languages, Social Studies, History, Geography, and linguistic development programs.',
        head_code: 'EMP-1002', // Marcus Thorne
        is_active: true
      },
      {
        code: 'DEPT-PRI',
        name: 'Primary Wing & Elementary Education',
        description: 'Foundational learning, basic numeracy, reading circles, and holistic early childhood education for junior classes.',
        head_code: null,
        is_active: true
      },
      {
        code: 'DEPT-ADMIN',
        name: 'School Administration & Finance',
        description: 'Institutional accounts, admissions, fee management, student records, and general administrative operations.',
        head_code: 'EMP-1003', // Tanushree Angirwal
        is_active: true
      },
      {
        code: 'DEPT-PE',
        name: 'Physical Education & Sports Academy',
        description: 'Athletics, football, cricket, basketball coaching, fitness routines, and inter-school championship training.',
        head_code: 'EMP-1004', // David Miller
        is_active: true
      },
      {
        code: 'DEPT-IT',
        name: 'Computer Science & Educational Technology',
        description: 'ICT laboratories, digital smart-boards, school management systems, and student coding clubs.',
        head_code: null,
        is_active: true
      }
    ];

    const seededDepts = {};

    for (const dept of schoolDepartments) {
      const headId = dept.head_code ? empMap[dept.head_code] || null : null;
      
      const res = await pool.query(`
        INSERT INTO departments (id, name, code, description, head_id, is_active, created_at, updated_at)
        VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT DO NOTHING
        RETURNING id, code;
      `, [dept.name, dept.code, dept.description, headId, dept.is_active]);

      if (res.rows.length > 0) {
        seededDepts[res.rows[0].code] = res.rows[0].id;
      } else {
        // Query existing ID
        const existing = await pool.query('SELECT id FROM departments WHERE code = $1 OR name = $2 LIMIT 1;', [dept.code, dept.name]);
        if (existing.rows.length > 0) {
          seededDepts[dept.code] = existing.rows[0].id;
          // Update details
          await pool.query(`
            UPDATE departments 
            SET description = $1, head_id = $2, is_active = $3, updated_at = CURRENT_TIMESTAMP
            WHERE id = $4;
          `, [dept.description, headId, dept.is_active, existing.rows[0].id]);
        }
      }
    }
    console.log('✓ Seeded foundational departments for St. Vincent\'s High School.');

    // 6. Associate existing employees with their respective departments
    if (empMap['EMP-1001'] && seededDepts['DEPT-SCI']) {
      await pool.query('UPDATE employees SET department_id = $1 WHERE id = $2', [seededDepts['DEPT-SCI'], empMap['EMP-1001']]);
    }
    if (empMap['EMP-1002'] && seededDepts['DEPT-HUM']) {
      await pool.query('UPDATE employees SET department_id = $1 WHERE id = $2', [seededDepts['DEPT-HUM'], empMap['EMP-1002']]);
    }
    if (empMap['EMP-1003'] && seededDepts['DEPT-ADMIN']) {
      await pool.query('UPDATE employees SET department_id = $1 WHERE id = $2', [seededDepts['DEPT-ADMIN'], empMap['EMP-1003']]);
    }
    if (empMap['EMP-1004'] && seededDepts['DEPT-PE']) {
      await pool.query('UPDATE employees SET department_id = $1 WHERE id = $2', [seededDepts['DEPT-PE'], empMap['EMP-1004']]);
    }
    console.log('✓ Associated existing faculty and staff with their departments.');

    console.log('--- DEPARTMENT MIGRATION & SEEDING COMPLETED SUCCESSFULLY ---');
  } catch (err) {
    console.error('Migration error:', err);
    throw err;
  }
}

migrateAndSeedDepartments()
  .then(() => pool.end())
  .catch((err) => {
    console.error(err);
    pool.end();
  });
