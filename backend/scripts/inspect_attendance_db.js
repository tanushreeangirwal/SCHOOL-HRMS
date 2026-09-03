const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const db = require('../db');

async function inspectDb() {
  try {
    console.log('--- PERMISSIONS TABLE COLUMNS ---');
    const permCols = await db.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'permissions';");
    console.log(permCols.rows);

    const perms = await db.query("SELECT * FROM permissions;");
    console.log('All permissions:', perms.rows);

    console.log('--- ATTENDANCE RECORDS CONSTRAINTS ---');
    const constraints = await db.query(`
      SELECT tc.constraint_name, tc.constraint_type, kcu.column_name 
      FROM information_schema.table_constraints tc 
      JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name 
      WHERE tc.table_name = 'attendance_records';
    `);
    console.log(constraints.rows);

    const countAtt = await db.query("SELECT COUNT(*) as count FROM attendance_records;");
    console.log('Total attendance records in DB:', countAtt.rows[0].count);

    if (parseInt(countAtt.rows[0].count, 10) > 0) {
      const sample = await db.query("SELECT * FROM attendance_records LIMIT 5;");
      console.log('Sample records:', sample.rows);
    }

    process.exit(0);
  } catch (err) {
    console.error('Inspection failed:', err);
    process.exit(1);
  }
}

inspectDb();
