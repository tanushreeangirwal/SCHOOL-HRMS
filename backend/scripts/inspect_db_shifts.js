const pool = require('../db');

async function inspectDb() {
  try {
    const permsRes = await pool.query(`SELECT id, name, description FROM permissions ORDER BY name;`);
    console.log('\n--- PERMISSIONS ROWS ---');
    console.log(permsRes.rows);

    const shiftsRes = await pool.query(`SELECT * FROM shifts;`);
    console.log('\n--- EXISTING SHIFTS ---');
    console.log(shiftsRes.rows);

    const assignmentsRes = await pool.query(`SELECT * FROM shift_assignments;`);
    console.log('\n--- EXISTING SHIFT ASSIGNMENTS ---');
    console.log(assignmentsRes.rows);

    // Let's inspect shifts table columns in detail
    const shiftCols = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'shifts';
    `);
    console.log('\n--- SHIFTS TABLE COLUMNS ---');
    console.log(shiftCols.rows);

    // Let's inspect shift_assignments columns in detail
    const assignCols = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'shift_assignments';
    `);
    console.log('\n--- SHIFT_ASSIGNMENTS TABLE COLUMNS ---');
    console.log(assignCols.rows);

  } catch (err) {
    console.error('Inspection error:', err);
  } finally {
    pool.end();
  }
}

inspectDb();
