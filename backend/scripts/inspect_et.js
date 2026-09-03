const pool = require('../db');

async function inspectEt() {
  const constraints = await pool.query(`
    SELECT conname, contype 
    FROM pg_constraint 
    WHERE conrelid = 'employment_types'::regclass;
  `);
  console.log('=== EMPLOYMENT_TYPES CONSTRAINTS ===');
  console.table(constraints.rows);

  const indexes = await pool.query(`
    SELECT indexname, indexdef 
    FROM pg_indexes 
    WHERE tablename = 'employment_types';
  `);
  console.log('=== EMPLOYMENT_TYPES INDEXES ===');
  console.table(indexes.rows);

  await pool.end();
}

inspectEt();
