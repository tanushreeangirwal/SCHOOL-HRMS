const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const pool = require('../db');

async function inspectTables() {
  const tables = await pool.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
  `);
  console.log('=== EXISTING PUBLIC TABLES ===');
  console.log(tables.rows.map(r => r.table_name));

  for (const t of tables.rows) {
    const cols = await pool.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = $1 
      ORDER BY ordinal_position;
    `, [t.table_name]);
    console.log(`\n--- TABLE: ${t.table_name} ---`);
    console.table(cols.rows);
  }

  process.exit(0);
}

inspectTables().catch(err => {
  console.error(err);
  process.exit(1);
});
