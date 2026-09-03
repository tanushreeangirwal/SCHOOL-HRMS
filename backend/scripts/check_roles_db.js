const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const pool = require('../db');

async function checkRoles() {
  const t = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE '%role%';");
  console.log('Role tables:', t.rows);
  const u = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users';");
  console.log('User columns:', u.rows);
  const rp = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'role_permissions';");
  console.log('Role_permissions columns:', rp.rows);
  if (rp.rows.length > 0) {
    const sample = await pool.query("SELECT * FROM role_permissions LIMIT 5;");
    console.log('Sample role_permissions:', sample.rows);
  }
  process.exit(0);
}

checkRoles().catch(e => { console.error(e); process.exit(1); });
