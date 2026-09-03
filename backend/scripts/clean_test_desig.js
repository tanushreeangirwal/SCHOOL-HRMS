const pool = require('../db');

async function cleanTestDesignations() {
  await pool.query("DELETE FROM designations WHERE code LIKE 'DESIG-PHY%';");
  console.log('✓ Cleaned test designations');
  await pool.end();
}

cleanTestDesignations();
