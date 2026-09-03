const pool = require('../db');

async function checkPayrollAndExisting() {
  try {
    const tablesRes = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    console.log('ALL TABLES IN DB:');
    console.log(tablesRes.rows.map(r => r.table_name));

    // Check columns of employees table
    const empCols = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'employees'
      ORDER BY ordinal_position;
    `);
    console.log('\nEMPLOYEES COLUMNS:');
    console.log(empCols.rows.map(c => `${c.column_name} (${c.data_type})`));

    // Check attendance records summary & columns
    const attCols = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'attendance_records'
      ORDER BY ordinal_position;
    `);
    console.log('\nATTENDANCE_RECORDS COLUMNS:');
    console.log(attCols.rows.map(c => `${c.column_name} (${c.data_type})`));

    // Check leaves / leave requests / balances
    const leaveTables = tablesRes.rows
      .map(r => r.table_name)
      .filter(t => t.includes('leave'));
    console.log('\nLEAVE TABLES:', leaveTables);

    for (const lt of leaveTables) {
      const cols = await pool.query(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = $1
        ORDER BY ordinal_position;
      `, [lt]);
      console.log(`- ${lt} columns:`, cols.rows.map(c => c.column_name).join(', '));
    }

    // Check calendar tables
    const calTables = tablesRes.rows
      .map(r => r.table_name)
      .filter(t => t.includes('calendar') || t.includes('academic') || t.includes('term'));
    console.log('\nCALENDAR TABLES:', calTables);

    // Check existing payroll tables details
    const payrollTables = [
      'salary_components',
      'salary_structures',
      'salary_structure_items',
      'employee_salary_assignments',
      'payroll_records'
    ];
    console.log('\n=== PAYROLL TABLES SCHEMA & SAMPLES ===');

    for (const pt of payrollTables) {
      const cols = await pool.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = $1
        ORDER BY ordinal_position;
      `, [pt]);
      console.log(`\nTable: ${pt} (${cols.rows.length} columns)`);
      cols.rows.forEach(c => console.log(`  - ${c.column_name}: ${c.data_type} (nullable: ${c.is_nullable}, default: ${c.column_default})`));

      const rows = await pool.query(`SELECT * FROM ${pt} LIMIT 5;`);
      console.log(`  Sample rows (${rows.rows.length}):`, rows.rows);
    }

    // Check existing payroll permissions
    const permsRes = await pool.query(`
      SELECT * FROM permissions 
      WHERE name ILIKE '%payroll%' OR name ILIKE '%salary%' 
      ORDER BY name;
    `);
    console.log('\nEXISTING PAYROLL PERMISSIONS:', permsRes.rows);

    // Check attendance records count and sample
    const attCount = await pool.query(`SELECT count(*) FROM attendance_records;`);
    console.log('\nTOTAL ATTENDANCE RECORDS:', attCount.rows[0].count);

    // Check distinct attendance status values
    const attStatuses = await pool.query(`SELECT DISTINCT status FROM attendance_records;`);
    console.log('ATTENDANCE STATUSES IN DB:', attStatuses.rows.map(r => r.status));

    // Check leave requests count and sample
    const leaveCount = await pool.query(`SELECT count(*) FROM leave_requests;`);
    console.log('TOTAL LEAVE REQUESTS:', leaveCount.rows[0].count);

    const leaveStatuses = await pool.query(`SELECT DISTINCT status FROM leave_requests;`);
    console.log('LEAVE REQUEST STATUSES IN DB:', leaveStatuses.rows.map(r => r.status));

    // Check leave types (paid vs unpaid)
    const leaveTypes = await pool.query(`SELECT id, name, code, is_paid FROM leave_types;`);
    console.log('LEAVE TYPES (PAID VS UNPAID):', leaveTypes.rows);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

checkPayrollAndExisting();

