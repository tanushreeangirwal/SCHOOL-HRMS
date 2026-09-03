const pool = require('../db');

async function inspectTables() {
  const etCols = await pool.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'employment_types'
    ORDER BY ordinal_position;
  `);
  console.log('=== EMPLOYMENT_TYPES COLUMNS ===');
  console.table(etCols.rows);

  const branches = await pool.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'branches'
    ORDER BY ordinal_position;
  `);
  console.log('=== BRANCHES COLUMNS ===');
  console.table(branches.rows);

  await pool.end();
}

inspectTables();
