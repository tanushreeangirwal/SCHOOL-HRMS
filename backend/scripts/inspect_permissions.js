const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const pool = require('../db');

async function inspectPermissions() {
  const permCols = await pool.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'permissions';
  `);
  console.log('permissions table columns:', permCols.rows);

  const perms = await pool.query(`SELECT * FROM permissions;`);
  console.log('All permissions:');
  console.table(perms.rows);

  process.exit(0);
}

inspectPermissions().catch(e => { console.error(e); process.exit(1); });
