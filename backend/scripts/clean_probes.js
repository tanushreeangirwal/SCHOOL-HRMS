const pool = require('../db');

async function cleanProbes() {
  await pool.query("DELETE FROM departments WHERE code = 'TEST-PROBE';");
  await pool.query("DELETE FROM designations WHERE code = 'SEC-TEST';");
  console.log('✓ Probe test artifacts cleaned from database.');
  await pool.end();
}

cleanProbes();
