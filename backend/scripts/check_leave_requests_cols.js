const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const pool = require('../db');

async function check() {
  const cols = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'leave_requests';");
  console.log('leave_requests columns in DB:', cols.rows);
  process.exit(0);
}

check().catch(e => { console.error(e); process.exit(1); });
