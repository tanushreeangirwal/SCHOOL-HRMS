const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const pool = require('../db');

async function seedThreeV1Trainings() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log('--- RESETTING TRAINING MODULE TO EXACT 3 V1 SCHOOL TRAININGS ---');

    // 1. Clean existing records in training tables
    await client.query('DELETE FROM training_certificates;');
    await client.query('DELETE FROM training_enrollments;');
    await client.query('DELETE FROM training_programs;');
    console.log('✓ Cleared previous training records.');

    // 2. Fetch admin user id for created_by
    const adminUserRes = await client.query(`
      SELECT id FROM users 
      WHERE email = 'admin@school.edu' OR role_id IN (SELECT id FROM hr_roles WHERE name IN ('Super Admin', 'Administrator', 'HR')) 
      LIMIT 1;
    `);
    const adminUserId = adminUserRes.rows[0]?.id || null;

    // 3. Fetch departments to link realistic school departments
    const deptRes = await client.query(`SELECT id, name FROM departments;`);
    const depts = {};
    deptRes.rows.forEach(d => { depts[d.name] = d.id; });

    // 4. Insert EXACTLY THE 3 REQUIRED TRAININGS
    console.log('--- Inserting the 3 Practical School Trainings ---');

    // Training 1: AI & Digital Tools for Teachers
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
      ) RETURNING id, title;
    `, [depts['IT Support & Computer Labs'] || null, adminUserId]);
    const t1Id = t1Res.rows[0].id;
    console.log(`✓ [1/3] Created: ${t1Res.rows[0].title} (ID: ${t1Id})`);

    // Training 2: Child Safety & Safeguarding
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
      ) RETURNING id, title;
    `, [depts['School Administration & HR'] || null, adminUserId]);
    const t2Id = t2Res.rows[0].id;
    console.log(`✓ [2/3] Created: ${t2Res.rows[0].title} (ID: ${t2Id})`);

    // Training 3: First Aid & Emergency Response
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
      ) RETURNING id, title;
    `, [depts['Physical Education & Sports'] || null, adminUserId]);
    const t3Id = t3Res.rows[0].id;
    console.log(`✓ [3/3] Created: ${t3Res.rows[0].title} (ID: ${t3Id})`);

    // 5. Fetch all employees to seed realistic enrollments
    const empRes = await client.query(`
      SELECT e.id, e.employee_code, e.first_name, e.last_name, e.work_email, d.name AS dept_name
      FROM employees e
      LEFT JOIN departments d ON e.department_id = d.id
      WHERE e.employment_status IN ('Active', 'Probation')
      ORDER BY e.employee_code ASC;
    `);
    const allEmployees = empRes.rows;
    console.log(`Found ${allEmployees.length} active employees to enroll.`);

    // Group teaching vs all staff
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

    // Enroll Training 1: AI & Digital Tools (Teaching staff)
    for (const empId of teacherIds) {
      await client.query(`
        INSERT INTO training_enrollments (
          training_id, employee_id, enrollment_type, enrollment_status,
          attendance_status, completion_status, assigned_by
        ) VALUES ($1, $2, 'Individual', 'Assigned', 'Pending', 'Pending', $3);
      `, [t1Id, empId, adminUserId]);
    }
    console.log(`✓ Enrolled ${teacherIds.length} teachers in [AI & Digital Tools for Teachers].`);

    // Enroll Training 2: Child Safety & Safeguarding (All staff)
    for (const emp of allEmployees) {
      await client.query(`
        INSERT INTO training_enrollments (
          training_id, employee_id, enrollment_type, enrollment_status,
          attendance_status, completion_status, assigned_by
        ) VALUES ($1, $2, 'Department-wide', 'Assigned', 'Pending', 'Pending', $3);
      `, [t2Id, emp.id, adminUserId]);
    }
    console.log(`✓ Enrolled all ${allEmployees.length} staff members in [Child Safety & Safeguarding].`);

    // Enroll Training 3: First Aid & Emergency Response (Teaching & Non-Teaching mix)
    const firstAidStaff = allEmployees.slice(0, 16);
    for (const emp of firstAidStaff) {
      await client.query(`
        INSERT INTO training_enrollments (
          training_id, employee_id, enrollment_type, enrollment_status,
          attendance_status, completion_status, assigned_by
        ) VALUES ($1, $2, 'Individual', 'Assigned', 'Pending', 'Pending', $3);
      `, [t3Id, emp.id, adminUserId]);
    }
    console.log(`✓ Enrolled ${firstAidStaff.length} staff members in [First Aid & Emergency Response].`);

    await client.query('COMMIT');
    console.log('\n🎉 DATABASE RESET TO EXACT 3 V1 TRAININGS SUCCESSFULLY COMPLETED!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error seeding 3 V1 trainings:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seedThreeV1Trainings().catch(err => {
  console.error(err);
  process.exit(1);
});
