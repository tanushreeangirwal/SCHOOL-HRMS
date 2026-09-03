const pool = require('../db');

async function cleanAndAlignOrgStructure() {
  console.log('--- STARTING ORG STRUCTURE CORRECTION FOR ST. VINCENT\'S SCHOOL ---');

  try {
    // 1. Remove unnecessary / unrequested categories (e.g. Student Affairs & Pastoral Care)
    // First, unassign any department if attached (none are attached, but safe check)
    await pool.query(`
      UPDATE departments 
      SET category_id = NULL 
      WHERE category_id IN (
        SELECT id FROM department_categories 
        WHERE LOWER(name) LIKE '%pastoral%' 
           OR LOWER(name) LIKE '%counselling%'
           OR LOWER(name) LIKE '%higher secondary%'
           OR LOWER(name) LIKE '%junior college%'
           OR LOWER(name) LIKE '%special education%'
           OR LOWER(name) LIKE '%medical%'
      );
    `);

    const deletedCats = await pool.query(`
      DELETE FROM department_categories 
      WHERE LOWER(name) LIKE '%pastoral%' 
         OR LOWER(name) LIKE '%counselling%'
         OR LOWER(name) LIKE '%higher secondary%'
         OR LOWER(name) LIKE '%junior college%'
         OR LOWER(name) LIKE '%special education%'
         OR LOWER(name) LIKE '%medical%'
      RETURNING name;
    `);

    deletedCats.rows.forEach(c => {
      console.log(`✓ Removed unneeded category: "${c.name}"`);
    });

    // 2. Clean & update remaining categories to clear, practical titles & descriptions
    const categoryUpdates = [
      {
        code: 'CAT-ACAD',
        name: 'Academic Departments',
        description: 'Primary, Secondary, and Subject / Teaching academic divisions.'
      },
      {
        code: 'CAT-ADMIN',
        name: 'Administration & Operations',
        description: 'Principal office, Human Resources, Admissions, student records, and general school operations.'
      },
      {
        code: 'CAT-FIN',
        name: 'Finance & Accounts',
        description: 'Institutional budgets, student fee accounting, procurement, and staff payroll.'
      },
      {
        code: 'CAT-IT',
        name: 'IT & Campus Support',
        description: 'IT support, computer laboratories, digital classroom systems, and technical infrastructure.'
      },
      {
        code: 'CAT-SPORTS',
        name: 'Sports & Physical Education',
        description: 'Physical training, athletics coaching, sports activities, and inter-school championships.'
      }
    ];

    for (const cat of categoryUpdates) {
      await pool.query(`
        INSERT INTO department_categories (id, name, code, description, is_active, created_at, updated_at)
        VALUES (gen_random_uuid(), $1, $2, $3, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT (code) DO UPDATE SET
          name = EXCLUDED.name,
          description = EXCLUDED.description,
          updated_at = CURRENT_TIMESTAMP;
      `, [cat.name, cat.code, cat.description]);
      console.log(`✓ Updated / Verified Category: "${cat.name}" (${cat.code})`);
    }

    // 3. Clean & update descriptions for St. Vincent's departments (removing any "Higher Secondary" / generic references)
    await pool.query(`
      UPDATE departments
      SET 
        name = 'Science & Mathematics Department',
        description = 'Secondary and primary STEM curriculum, Physics, Chemistry, and Biology laboratories.',
        updated_at = CURRENT_TIMESTAMP
      WHERE code = 'DEPT-SCI';
    `);

    await pool.query(`
      UPDATE departments
      SET 
        name = 'Humanities & Languages Department',
        description = 'English literature, regional languages, Social Studies, History, and Geography.',
        updated_at = CURRENT_TIMESTAMP
      WHERE code = 'DEPT-HUM';
    `);

    await pool.query(`
      UPDATE departments
      SET 
        name = 'Primary Wing',
        description = 'Primary education, foundational literacy, numeracy, and holistic early childhood learning.',
        updated_at = CURRENT_TIMESTAMP
      WHERE code = 'DEPT-PRI';
    `);

    await pool.query(`
      UPDATE departments
      SET 
        name = 'School Administration & HR',
        description = 'Principal administration, Human Resources, admissions, and front office operations.',
        updated_at = CURRENT_TIMESTAMP
      WHERE code = 'DEPT-ADMIN';
    `);

    await pool.query(`
      UPDATE departments
      SET 
        name = 'Physical Education & Sports',
        description = 'Athletics, sports activities, fitness coaching, and physical education classes.',
        updated_at = CURRENT_TIMESTAMP
      WHERE code = 'DEPT-PE';
    `);

    await pool.query(`
      UPDATE departments
      SET 
        name = 'IT Support & Computer Labs',
        description = 'IT support, computer laboratories, campus networking, and digital teaching equipment.',
        updated_at = CURRENT_TIMESTAMP
      WHERE code = 'DEPT-IT';
    `);

    console.log('✓ Cleaned and aligned department titles and descriptions.');

    // 4. Map departments to updated categories
    await pool.query(`
      UPDATE departments SET category_id = (SELECT id FROM department_categories WHERE code = 'CAT-ACAD') WHERE code IN ('DEPT-SCI', 'DEPT-HUM', 'DEPT-PRI');
      UPDATE departments SET category_id = (SELECT id FROM department_categories WHERE code = 'CAT-ADMIN') WHERE code = 'DEPT-ADMIN';
      UPDATE departments SET category_id = (SELECT id FROM department_categories WHERE code = 'CAT-SPORTS') WHERE code = 'DEPT-PE';
      UPDATE departments SET category_id = (SELECT id FROM department_categories WHERE code = 'CAT-IT') WHERE code = 'DEPT-IT';
    `);
    console.log('✓ Re-verified department-category mappings.');

    console.log('\n=== CURRENT CLEANED CATEGORIES ===');
    const cats = await pool.query(`
      SELECT c.name, c.code, (SELECT COUNT(*)::int FROM departments d WHERE d.category_id = c.id) as dept_count
      FROM department_categories c
      ORDER BY c.name;
    `);
    console.table(cats.rows);

    console.log('\n=== CURRENT CLEANED DEPARTMENTS ===');
    const depts = await pool.query(`
      SELECT d.name, d.code, c.name as category_name,
        (SELECT COUNT(*) FROM employees e WHERE e.department_id = d.id) as emp_count
      FROM departments d
      LEFT JOIN department_categories c ON d.category_id = c.id
      ORDER BY d.name;
    `);
    console.table(depts.rows);

    console.log('\n=== PRESERVED EMPLOYEES ===');
    const emps = await pool.query(`
      SELECT e.employee_code, e.first_name, e.last_name, e.work_email, d.name as department_name
      FROM employees e
      LEFT JOIN departments d ON e.department_id = d.id
      ORDER BY e.created_at;
    `);
    console.table(emps.rows);

    console.log('\n================================================================');
    console.log('✓ ORG STRUCTURE ALIGNMENT COMPLETED SUCCESSFULLY');
    console.log('================================================================');
  } catch (error) {
    console.error('Error updating org structure:', error);
  } finally {
    await pool.end();
  }
}

cleanAndAlignOrgStructure();
