const pool = require('../db');

async function inspectConstraints() {
  const constraints = await pool.query(`
    SELECT conname, contype 
    FROM pg_constraint 
    WHERE conrelid = 'designations'::regclass;
  `);
  console.log('=== DESIGNATIONS CONSTRAINTS ===');
  console.table(constraints.rows);

  const indexes = await pool.query(`
    SELECT indexname, indexdef 
    FROM pg_indexes 
    WHERE tablename = 'designations';
  `);
  console.log('=== DESIGNATIONS INDEXES ===');
  console.table(indexes.rows);

  await pool.end();
}

inspectConstraints();
