const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const pool = require('../db');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/jwtConfig');
const express = require('express');
const trainingRoutes = require('../routes/training');

const app = express();
app.use(express.json());
app.use('/api/training', trainingRoutes);

async function runE2ETests() {
  console.log('--- STARTING TRAINING MODULE END-TO-END VERIFICATION ---');

  // 1. Fetch an admin user and an employee user
  const adminUserRes = await pool.query(`
    SELECT u.id, u.email, r.name as role_name, u.employee_id 
    FROM users u 
    JOIN hr_roles r ON u.role_id = r.id 
    WHERE r.name IN ('Super Admin', 'Administrator', 'HR') 
    LIMIT 1
  `);

  const employeeUserRes = await pool.query(`
    SELECT u.id, u.email, r.name as role_name, u.employee_id, e.first_name, e.last_name 
    FROM users u 
    JOIN hr_roles r ON u.role_id = r.id 
    LEFT JOIN employees e ON u.employee_id = e.id
    WHERE r.name = 'Employee' AND u.employee_id IS NOT NULL
    LIMIT 1
  `);

  if (!adminUserRes.rows[0] || !employeeUserRes.rows[0]) {
    throw new Error('Could not find both Admin and Employee user records to test.');
  }

  const adminUser = adminUserRes.rows[0];
  const employeeUser = employeeUserRes.rows[0];

  console.log(`Admin user: ${adminUser.email} (${adminUser.role_name})`);
  console.log(`Employee user: ${employeeUser.email} (${employeeUser.first_name} ${employeeUser.last_name})`);

  const adminToken = jwt.sign({ userId: adminUser.id }, JWT_SECRET, { expiresIn: '1h' });
  const employeeToken = jwt.sign({ userId: employeeUser.id }, JWT_SECRET, { expiresIn: '1h' });

  // Start local ephemeral server for supertest/fetch
  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/api/training`;

  let testProgramId = null;
  let testCertId = null;

  try {
    // 1. Dashboard Metrics Test
    console.log('\n[1] Testing Dashboard Metrics API...');
    const dashRes = await fetch(`${baseUrl}/dashboard`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const dashData = await dashRes.json();
    if (!dashData.success || typeof dashData.data.total_trainings !== 'number') {
      throw new Error(`Failed to fetch dashboard: ${JSON.stringify(dashData)}`);
    }
    console.log(`✓ Dashboard loaded: ${dashData.data.total_trainings} total trainings, ${dashData.data.total_employees_enrolled} enrolled, ${dashData.data.training_hours_completed} total hours, ${dashData.data.completion_percentage}% completion.`);

    // 2. Training Programs List
    console.log('\n[2] Testing Training Programs List API...');
    const progRes = await fetch(`${baseUrl}/programs`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const progData = await progRes.json();
    if (!progData.success || !Array.isArray(progData.data)) {
      throw new Error(`Failed to list programs: ${JSON.stringify(progData)}`);
    }
    console.log(`✓ Retrieved ${progData.data.length} training programs.`);

    // 3. Create a New Training Program
    console.log('\n[3] Testing Create Training Program API...');
    const createRes = await fetch(`${baseUrl}/programs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        title: 'Modern AI in Secondary Classroom Pedagogy 2026',
        category: 'Pedagogy & Teaching Methodology',
        description: 'Hands-on practical CPD workshop for integrating generative learning responsibly.',
        training_type: 'Workshop',
        trainer_name: 'Dr. Alistair Vance',
        training_provider: 'Apex Education Research Institute',
        location_type: 'On-Campus',
        location_venue: 'Main School Auditorium & Science Lab 3',
        start_date: '2026-09-15',
        end_date: '2026-09-16',
        start_time: '09:30:00',
        end_time: '16:00:00',
        duration_hours: 12.0,
        target_audience: 'Teaching Staff',
        status: 'Scheduled',
        max_participants: 30
      })
    });
    const createData = await createRes.json();
    if (!createData.success || !createData.data.id) {
      throw new Error(`Failed to create program: ${JSON.stringify(createData)}`);
    }
    testProgramId = createData.data.id;
    console.log(`✓ Created Program ID: ${testProgramId} - "${createData.data.title}"`);

    // 4. Enroll Employee
    console.log('\n[4] Testing Enroll Employee API...');
    const enrollRes = await fetch(`${baseUrl}/programs/${testProgramId}/enroll`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        enrollment_type: 'Individual',
        employee_ids: [employeeUser.employee_id],
        enrollment_status: 'Assigned'
      })
    });
    const enrollData = await enrollRes.json();
    if (!enrollData.success || enrollData.enrolled_count !== 1) {
      throw new Error(`Failed to enroll employee: ${JSON.stringify(enrollData)}`);
    }
    console.log(`✓ Successfully enrolled ${enrollData.enrolled_count} staff member(s).`);

    // 5. Query Participants & Update Attendance
    console.log('\n[5] Testing Participants & Bulk Attendance API...');
    const partRes = await fetch(`${baseUrl}/programs/${testProgramId}/participants`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const partData = await partRes.json();
    if (!partData.success || partData.data.length === 0) {
      throw new Error('Failed to retrieve program participants.');
    }
    console.log(`✓ Participant loaded: ${partData.data[0].first_name} ${partData.data[0].last_name}`);

    const bulkAttRes = await fetch(`${baseUrl}/programs/${testProgramId}/bulk-attendance`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        updates: [
          {
            employee_id: employeeUser.employee_id,
            attendance_status: 'Present',
            hours_completed: 12.0,
            completion_status: 'Completed',
            remarks: 'Active engagement in AI lesson design scenarios.'
          }
        ]
      })
    });
    const bulkAttData = await bulkAttRes.json();
    if (!bulkAttData.success) {
      throw new Error(`Failed to update attendance: ${JSON.stringify(bulkAttData)}`);
    }
    console.log('✓ Updated attendance and marked completion successfully.');

    // 6. Log Certificate
    console.log('\n[6] Testing Certificate Issuance & Registry API...');
    const certNum = `STV-E2E-${Date.now()}`;
    const certRes = await fetch(`${baseUrl}/certificates`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        employee_id: employeeUser.employee_id,
        training_id: testProgramId,
        certificate_name: 'Certified Modern AI Pedagogical Practitioner',
        certificate_number: certNum,
        training_provider: 'Apex Education Research Institute',
        issue_date: '2026-09-16',
        expiry_date: '2029-09-16',
        document_reference: 'Apex Credential ID #APX-9821-E2E'
      })
    });
    const certData = await certRes.json();
    if (!certData.success || !certData.data.id) {
      throw new Error(`Failed to log certificate: ${JSON.stringify(certData)}`);
    }
    testCertId = certData.data.id;
    console.log(`✓ Registered Certificate: ${certData.data.certificate_name} (#${certData.data.certificate_number})`);

    // 7. Test Reports API
    console.log('\n[7] Testing 5 Training Reports API datasets...');
    const reportTypes = [
      'completion',
      'employee_hours',
      'department_participation',
      'pending',
      'certificates'
    ];
    for (const rType of reportTypes) {
      const repRes = await fetch(`${baseUrl}/reports?type=${rType}`, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      const repData = await repRes.json();
      if (!repData.success || !Array.isArray(repData.data)) {
        throw new Error(`Report "${rType}" failed: ${JSON.stringify(repData)}`);
      }
      console.log(`  ✓ Report [${rType}]: ${repData.data.length} records returned.`);
    }

    // 8. Test Employee Self-Service (My Training View)
    console.log('\n[8] Testing Employee Self-Service API (My Training)...');
    const myRes = await fetch(`${baseUrl}/my-trainings`, {
      headers: { 'Authorization': `Bearer ${employeeToken}` }
    });
    const myData = await myRes.json();
    if (!myData.success || !myData.data.summary) {
      throw new Error(`Failed to load employee self-service: ${JSON.stringify(myData)}`);
    }
    console.log(`✓ Employee Self-Service loaded:`);
    console.log(`  Summary: Completed Hours: ${myData.data.summary.total_hours_completed}, Certificates: ${myData.data.summary.total_certificates}`);
    console.log(`  All Assigned Trainings: ${myData.data.all_trainings.length}`);
    console.log(`  Certificates: ${myData.data.certificates.length}`);

    // 9. Verify RBAC Guard (Employee attempting to create program)
    console.log('\n[9] Verifying RBAC Guard (Employee attempting to create program)...');
    const unauthorizedRes = await fetch(`${baseUrl}/programs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${employeeToken}`
      },
      body: JSON.stringify({ title: 'Illegal Unauthorized Program' })
    });
    if (unauthorizedRes.status === 403) {
      console.log('✓ Correctly rejected with HTTP 403 Forbidden.');
    } else {
      throw new Error(`Expected 403 Forbidden, got ${unauthorizedRes.status}`);
    }

    // 10. Clean up test records
    console.log('\n[10] Cleaning up ephemeral test records...');
    if (testCertId) {
      await pool.query('DELETE FROM training_certificates WHERE id = $1', [testCertId]);
    }
    if (testProgramId) {
      await pool.query('DELETE FROM training_enrollments WHERE training_id = $1', [testProgramId]);
      await pool.query('DELETE FROM training_programs WHERE id = $1', [testProgramId]);
    }
    console.log('✓ Cleaned up test database records.');

    console.log('\n🎉 ALL TRAINING MODULE E2E TESTS PASSED WITH 100% SUCCESS!');
  } finally {
    server.close();
    await pool.end();
  }
}

runE2ETests().catch((err) => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
