const pool = require('../db');

async function migrateAndSeedEnhancedDepartments() {
  console.log('--- STARTING ENHANCED DEPARTMENT MIGRATIONS & SEEDING ---');

  try {
    // 1. Create department_categories table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS department_categories (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(150) NOT NULL UNIQUE,
        code VARCHAR(50) UNIQUE,
        description TEXT,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✓ Created/verified department_categories table.');

    // 2. Add category_id and effective_date to departments table
    await pool.query(`
      ALTER TABLE departments 
        ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES department_categories(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS effective_date DATE DEFAULT CURRENT_DATE;
    `);
    console.log('✓ Verified/added category_id and effective_date columns to departments.');

    // 3. Create employee_department_history table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS employee_department_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
        previous_department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
        effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
        reason TEXT,
        assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✓ Created/verified employee_department_history table.');

    // 4. Seed Categories
    const categories = [
      {
        code: 'CAT-ACAD',
        name: 'Academic Faculties & Curricula',
        description: 'Subject divisions, teaching faculties, science labs, language wings, and academic examination boards.'
      },
      {
        code: 'CAT-ADMIN',
        name: 'Institutional Administration',
        description: 'General school administration, admissions, student records, secretarial staff, and human resources.'
      },
      {
        code: 'CAT-FIN',
        name: 'Finance & Accounts Management',
        description: 'Institutional budgets, fee collection, procurement, accounting, and staff payroll management.'
      },
      {
        code: 'CAT-SPORTS',
        name: 'Sports, Athletics & Physical Education',
        description: 'Physical training, athletics, team sports coaching, gymnasium, and inter-school championships.'
      },
      {
        code: 'CAT-IT',
        name: 'Information Technology & Smart Campus',
        description: 'ICT computer laboratories, smart digital boards, campus network infrastructure, and school portal.'
      },
      {
        code: 'CAT-PASTORAL',
        name: 'Student Affairs & Pastoral Care',
        description: 'Student counseling, career guidance, co-curricular societies, and student welfare programs.'
      }
    ];

    const categoryMap = {};

    for (const cat of categories) {
      const res = await pool.query(`
        INSERT INTO department_categories (id, name, code, description, is_active, created_at, updated_at)
        VALUES (gen_random_uuid(), $1, $2, $3, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT (name) DO UPDATE SET 
          code = EXCLUDED.code,
          description = EXCLUDED.description,
          updated_at = CURRENT_TIMESTAMP
        RETURNING id, code;
      `, [cat.name, cat.code, cat.description]);

      if (res.rows.length > 0) {
        categoryMap[res.rows[0].code] = res.rows[0].id;
      } else {
        const existing = await pool.query('SELECT id FROM department_categories WHERE code = $1;', [cat.code]);
        if (existing.rows.length > 0) categoryMap[cat.code] = existing.rows[0].id;
      }
    }
    console.log('✓ Seeded St. Vincent\'s Department Categories.');

    // 5. Update existing departments with category_id
    if (categoryMap['CAT-ACAD']) {
      await pool.query("UPDATE departments SET category_id = $1 WHERE code IN ('DEPT-SCI', 'DEPT-HUM', 'DEPT-PRI');", [categoryMap['CAT-ACAD']]);
    }
    if (categoryMap['CAT-ADMIN']) {
      await pool.query("UPDATE departments SET category_id = $1 WHERE code = 'DEPT-ADMIN';", [categoryMap['CAT-ADMIN']]);
    }
    if (categoryMap['CAT-SPORTS']) {
      await pool.query("UPDATE departments SET category_id = $1 WHERE code = 'DEPT-PE';", [categoryMap['CAT-SPORTS']]);
    }
    if (categoryMap['CAT-IT']) {
      await pool.query("UPDATE departments SET category_id = $1 WHERE code = 'DEPT-IT';", [categoryMap['CAT-IT']]);
    }
    console.log('✓ Categorized existing departments.');

    // 6. Seed Department Category & Assignment Permissions
    const newPermissions = [
      { name: 'department_categories:read', description: 'View department categories and counts' },
      { name: 'department_categories:create', description: 'Create new department categories' },
      { name: 'department_categories:update', description: 'Modify department category details' },
      { name: 'department_categories:delete', description: 'Activate or deactivate department categories' },
      { name: 'departments:assign', description: 'Assign faculty and staff to departments with history' }
    ];

    for (const perm of newPermissions) {
      await pool.query(`
        INSERT INTO permissions (id, name, description, created_at, updated_at)
        VALUES (gen_random_uuid(), $1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description;
      `, [perm.name, perm.description]);
    }

    // Assign to Administrator and HR roles
    await pool.query(`
      INSERT INTO role_permissions (role_id, permission_id)
      SELECT r.id, p.id
      FROM hr_roles r
      CROSS JOIN permissions p
      WHERE r.name IN ('Administrator', 'HR') 
        AND p.name IN (
          'department_categories:read', 
          'department_categories:create', 
          'department_categories:update', 
          'department_categories:delete',
          'departments:assign'
        )
      ON CONFLICT DO NOTHING;
    `);

    // Assign read to Manager
    await pool.query(`
      INSERT INTO role_permissions (role_id, permission_id)
      SELECT r.id, p.id
      FROM hr_roles r
      CROSS JOIN permissions p
      WHERE r.name = 'Manager' 
        AND p.name = 'department_categories:read'
      ON CONFLICT DO NOTHING;
    `);
    console.log('✓ Seeded and assigned category & assignment permissions.');

    // 7. Seed initial employee department history entries if not already present
    const empRes = await pool.query('SELECT id, department_id, joining_date FROM employees WHERE department_id IS NOT NULL;');
    for (const emp of empRes.rows) {
      const histExists = await pool.query('SELECT id FROM employee_department_history WHERE employee_id = $1;', [emp.id]);
      if (histExists.rows.length === 0) {
        await pool.query(`
          INSERT INTO employee_department_history (
            id, employee_id, department_id, previous_department_id, effective_date, reason, created_at
          )
          VALUES (
            gen_random_uuid(), $1, $2, NULL, COALESCE($3, CURRENT_DATE), $4, CURRENT_TIMESTAMP
          );
        `, [emp.id, emp.department_id, emp.joining_date, "Initial institutional appointment at St. Vincent's High School"]);
      }
    }
    console.log('✓ Initialized department assignment audit history for active staff.');

    console.log('--- ENHANCED DEPARTMENT MIGRATION COMPLETED SUCCESSFULLY ---');
  } catch (err) {
    console.error('Migration error:', err);
    throw err;
  }
}

migrateAndSeedEnhancedDepartments()
  .then(() => pool.end())
  .catch((err) => {
    console.error(err);
    pool.end();
  });
