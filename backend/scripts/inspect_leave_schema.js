const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const pool = require('../db');

async function inspect() {
  const tables = await pool.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
  `);
  console.log('=== EXISTING PUBLIC TABLES ===');
  console.log(tables.rows.map(r => r.table_name));

  const perms = await pool.query("SELECT id, name, description FROM permissions ORDER BY name;");
  console.log('\n=== EXISTING PERMISSIONS ===');
  console.table(perms.rows);

  const roles = await pool.query("SELECT id, name FROM roles ORDER BY name;");
  console.log('\n=== EXISTING ROLES ===');
  console.table(roles.rows);

  process.exit(0);
}

inspect().catch(err => {
  console.error(err);
  process.exit(1);
});
