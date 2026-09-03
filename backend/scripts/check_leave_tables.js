const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const pool = require('../db');

async function checkAllLeaveTables() {
  const tables = ['leave_types', 'leave_requests', 'leave_policies', 'leave_balances', 'leave_audit_logs'];
  for (const t of tables) {
    const cols = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1;", [t]);
    console.log(`\n=== TABLE: ${t} ===`);
    console.table(cols.rows);
    if (cols.rows.length > 0) {
      const data = await pool.query(`SELECT * FROM ${t} LIMIT 5;`);
      console.log(`Row count in ${t}:`, data.rows.length);
      console.log(data.rows);
    }
  }
  process.exit(0);
}

checkAllLeaveTables().catch(e => { console.error(e); process.exit(1); });
