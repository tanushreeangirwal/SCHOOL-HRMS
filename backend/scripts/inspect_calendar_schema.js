const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const pool = require('../db');

async function checkCalendarTables() {
  console.log('=== INSPECTING CALENDAR SCHEMA ===\n');

  // Check columns of school_calendar if it exists
  const cols = await pool.query(`
    SELECT table_name, column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name IN ('school_calendar', 'academic_years', 'academic_terms', 'calendar_events', 'holidays')
    ORDER BY table_name, ordinal_position;
  `);

  console.log('Columns in existing calendar-related tables:');
  console.table(cols.rows);

  // Check existing permissions in permissions table
  const perms = await pool.query(`
    SELECT id, name, category, description
    FROM permissions
    WHERE name LIKE '%calendar%' OR name LIKE '%holiday%' OR name LIKE '%term%' OR name LIKE '%academic%'
    ORDER BY category, name;
  `);

  console.log('\nCalendar permissions:');
  console.table(perms.rows);

  process.exit(0);
}

checkCalendarTables().catch(e => { console.error(e); process.exit(1); });
