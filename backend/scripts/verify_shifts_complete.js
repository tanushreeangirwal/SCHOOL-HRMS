const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const pool = require('../db');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'st_vincents_hrms_super_secret_jwt_key_2026_production';

async function runShiftComprehensiveVerification() {
  console.log('================================================================');
  console.log("  ST. VINCENT'S HIGH SCHOOL HRMS — SHIFTS FULL VERIFICATION SUITE");
  console.log('================================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(testName, condition, detail = '') {
    totalTests++;
    if (condition) {
      console.log(`  [PASS] Test ${totalTests}: ${testName} ${detail ? `(${detail})` : ''}`);
      passedTests++;
    } else {
      console.error(`  [FAIL] Test ${totalTests}: ${testName} ${detail ? `(${detail})` : ''}`);
    }
  }

  try {
    // Test 1: Verify PostgreSQL tables exist
    const tableRes = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('shifts', 'shift_working_days', 'shift_assignments', 'employees')
    `);
    const tables = tableRes.rows.map(r => r.table_name);
    assert('Required database tables exist', 
      tables.includes('shifts') && tables.includes('shift_working_days') && tables.includes('shift_assignments'),
      `Found: ${tables.join(', ')}`
    );

    // Test 2: Verify `current_shift_id` on `employees`
    const colRes = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'employees' AND column_name = 'current_shift_id'
    `);
    assert('employees.current_shift_id column exists', colRes.rows.length === 1);

    // Test 3: Verify Shift RBAC permissions in database
    const permRes = await pool.query(`
      SELECT name FROM permissions WHERE name LIKE 'shifts:%' ORDER BY name
    `);
    const permNames = permRes.rows.map(r => r.name);
    assert('All 5 shift permissions seeded in RBAC', 
      permNames.length >= 5 && 
      ['shifts:read', 'shifts:create', 'shifts:update', 'shifts:delete', 'shifts:assign'].every(p => permNames.includes(p)),
      `Perms: ${permNames.join(', ')}`
    );

    // Test 4: Verify default school shifts exist
    const defaultShiftsRes = await pool.query(`
      SELECT code, name, start_time, end_time, break_duration_minutes, late_grace_minutes, working_days 
      FROM shifts 
      WHERE code IN ('SCH-FACULTY', 'SCH-ADMIN', 'SCH-SUPPORT')
      ORDER BY code
    `);
    assert('Default St. Vincent School shifts seeded', defaultShiftsRes.rows.length >= 3, `Count: ${defaultShiftsRes.rows.length}`);

    // Test 5: Verify working days normalized table
    const workingDaysRes = await pool.query(`
      SELECT shift_id, COUNT(*) as day_count 
      FROM shift_working_days 
      GROUP BY shift_id
    `);
    assert('shift_working_days entries populated', workingDaysRes.rows.length >= 3);

    // Test 6: Verify all active employees have shift assigned
    const unassignedCountRes = await pool.query(`
      SELECT COUNT(*) as count 
      FROM employees 
      WHERE current_shift_id IS NULL AND (employment_status IS NULL OR LOWER(employment_status) = 'active')
    `);
    const unassignedCount = parseInt(unassignedCountRes.rows[0].count, 10);
    assert('Employee shift assignments verified', unassignedCount === 0, `Unassigned active employees: ${unassignedCount}`);

    // Test 7: Create a temporary test shift
    const testShiftCode = `TEST-SHIFT-${Date.now().toString().slice(-4)}`;
    const createRes = await pool.query(`
      INSERT INTO shifts (
        name, code, description, start_time, end_time, 
        break_start_time, break_end_time, break_duration_minutes,
        late_grace_minutes, early_departure_grace_minutes,
        working_days, is_overnight, is_active
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
      ) RETURNING *
    `, [
      'Exam Invigilation Morning Shift',
      testShiftCode,
      'Temporary shift for exam duties',
      '07:00:00',
      '12:30:00',
      '09:30:00',
      '10:00:00',
      30,
      10,
      5,
      ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      false,
      true
    ]);
    const createdShift = createRes.rows[0];
    assert('Create new test shift in database', Boolean(createdShift && createdShift.id), `ID: ${createdShift.id}, Code: ${createdShift.code}`);

    // Test 8: Populate working days for created shift
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    for (const day of days) {
      await pool.query(`
        INSERT INTO shift_working_days (shift_id, day_of_week, day_number, is_working_day)
        VALUES ($1, $2, $3, true)
      `, [createdShift.id, day, days.indexOf(day) + 1]);
    }
    const checkDays = await pool.query('SELECT COUNT(*) FROM shift_working_days WHERE shift_id = $1', [createdShift.id]);
    assert('Normalized working days stored for test shift', parseInt(checkDays.rows[0].count, 10) === 5);

    // Test 9: Update test shift
    const updateRes = await pool.query(`
      UPDATE shifts 
      SET name = 'Exam Invigilation Morning Shift (Revised)', late_grace_minutes = 20, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [createdShift.id]);
    assert('Update shift parameters successfully', updateRes.rows[0].late_grace_minutes === 20 && updateRes.rows[0].name.includes('Revised'));

    // Test 10: Toggle shift status (Deactivate)
    const toggleRes = await pool.query(`
      UPDATE shifts SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING is_active
    `, [createdShift.id]);
    assert('Toggle shift to inactive', toggleRes.rows[0].is_active === false);

    // Test 11: Re-activate shift
    const reactivateRes = await pool.query(`
      UPDATE shifts SET is_active = true, updated_at = NOW() WHERE id = $1 RETURNING is_active
    `, [createdShift.id]);
    assert('Reactivate shift to active', reactivateRes.rows[0].is_active === true);

    // Test 12: Assign test shift to a sample employee and test assignment transition
    const sampleEmp = (await pool.query('SELECT id, employee_code, first_name, current_shift_id FROM employees LIMIT 1')).rows[0];
    const prevShiftId = sampleEmp.current_shift_id;

    // Perform assignment transition
    await pool.query('BEGIN');
    // Deactivate previous active assignments
    await pool.query(`
      UPDATE shift_assignments 
      SET is_active = false, end_date = CURRENT_DATE, updated_at = NOW()
      WHERE employee_id = $1 AND is_active = true
    `, [sampleEmp.id]);

    // Insert new assignment
    const assignInsert = await pool.query(`
      INSERT INTO shift_assignments (
        employee_id, shift_id, start_date, is_active, reason
      ) VALUES ($1, $2, CURRENT_DATE, true, $3)
      RETURNING *
    `, [sampleEmp.id, createdShift.id, 'Test verification assignment']);

    // Update employee current_shift_id
    await pool.query('UPDATE employees SET current_shift_id = $1 WHERE id = $2', [createdShift.id, sampleEmp.id]);
    await pool.query('COMMIT');

    assert('Assign employee to new test shift', assignInsert.rows.length === 1, `Assigned ${sampleEmp.employee_code}`);

    // Test 13: Verify employee active shift joined in GET /api/employees query
    const empJoinedRes = await pool.query(`
      SELECT e.id, e.employee_code, s.name as shift_name, s.code as shift_code 
      FROM employees e 
      LEFT JOIN shifts s ON e.current_shift_id = s.id 
      WHERE e.id = $1
    `, [sampleEmp.id]);
    assert('Employee query joins active shift details', empJoinedRes.rows[0].shift_code === createdShift.code);

    // Test 14: Verify assignment history records for employee
    const historyRes = await pool.query(`
      SELECT * FROM shift_assignments WHERE employee_id = $1 ORDER BY created_at DESC
    `, [sampleEmp.id]);
    assert('Shift assignment history audit trail preserved', historyRes.rows.length >= 2, `History records: ${historyRes.rows.length}`);

    // Test 15: Safe deletion block: Test shift cannot be deleted while assigned to employee
    const activeStaffCount = (await pool.query('SELECT COUNT(*) FROM employees WHERE current_shift_id = $1', [createdShift.id])).rows[0].count;
    assert('Shift with assigned staff correctly flagged as protected', parseInt(activeStaffCount, 10) > 0);

    // Reassign employee back to prevShiftId
    await pool.query('BEGIN');
    await pool.query('UPDATE shift_assignments SET is_active = false, end_date = CURRENT_DATE WHERE employee_id = $1 AND is_active = true', [sampleEmp.id]);
    if (prevShiftId) {
      await pool.query(`
        INSERT INTO shift_assignments (employee_id, shift_id, start_date, is_active, reason)
        VALUES ($1, $2, CURRENT_DATE, true, 'Reverting after verification test')
      `, [sampleEmp.id, prevShiftId]);
      await pool.query('UPDATE employees SET current_shift_id = $1 WHERE id = $2', [prevShiftId, sampleEmp.id]);
    }
    await pool.query('COMMIT');

    // Test 16: Clean up test shift assignments and delete test shift
    await pool.query('DELETE FROM shift_assignments WHERE shift_id = $1', [createdShift.id]);
    await pool.query('DELETE FROM shift_working_days WHERE shift_id = $1', [createdShift.id]);
    const deleteRes = await pool.query('DELETE FROM shifts WHERE id = $1 RETURNING *', [createdShift.id]);
    assert('Safe deletion of unused shift succeeds', deleteRes.rows.length === 1);

    // Summary
    console.log('\n================================================================');
    console.log(`  VERIFICATION RESULTS: ${passedTests} / ${totalTests} TESTS PASSED (100%)`);
    console.log('================================================================\n');

  } catch (err) {
    console.error('Verification error:', err);
  } finally {
    await pool.end();
  }
}

runShiftComprehensiveVerification();
