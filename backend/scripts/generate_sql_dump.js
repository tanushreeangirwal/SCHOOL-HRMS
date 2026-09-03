/**
 * St. Vincent's School HRMS - SQL Dump Generator
 * Generates an idempotent, clean production SQL file containing all DDL and DML data.
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const TABLE_DEPENDENCY_ORDER = [
  'branches',
  'employment_types',
  'hr_roles',
  'permissions',
  'role_permissions',
  'department_categories',
  'departments',
  'designations',
  'shifts',
  'shift_working_days',
  'employees',
  'users',
  'emergency_contacts',
  'employee_bank_accounts',
  'employee_department_history',
  'shift_assignments',
  'attendance_devices',
  'attendance_records',
  'attendance_audit_logs',
  'leave_policies',
  'leave_types',
  'leave_policy_rules',
  'employee_leave_policies',
  'leave_balances',
  'leave_requests',
  'leave_audit_logs',
  'academic_years',
  'academic_terms',
  'calendar_events',
  'school_calendar',
  'salary_components',
  'salary_structures',
  'salary_structure_items',
  'employee_salary_assignments',
  'payroll_records'
];

async function generateDump() {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'school_hrms',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    ssl: false
  });

  console.log('Generating production SQL dump...');
  const outputFile = path.join(__dirname, 'school_hrms_production_dump.sql');
  const writeStream = fs.createWriteStream(outputFile, { encoding: 'utf8' });

  writeStream.write('-- =============================================================\n');
  writeStream.write('-- ST. VINCENT\'S SCHOOL HRMS - PRODUCTION DATABASE DUMP\n');
  writeStream.write(`-- Generated: ${new Date().toISOString()}\n`);
  writeStream.write('-- =============================================================\n\n');

  writeStream.write('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";\n');
  writeStream.write('CREATE EXTENSION IF NOT EXISTS "pgcrypto";\n\n');

  // Query existing tables
  const tablesResult = await pool.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
  `);
  const existingTables = new Set(tablesResult.rows.map(r => r.table_name));
  const orderedTables = TABLE_DEPENDENCY_ORDER.filter(t => existingTables.has(t));

  for (const tableName of orderedTables) {
    const colRes = await pool.query(`
      SELECT 
        column_name, 
        data_type, 
        udt_name,
        character_maximum_length, 
        is_nullable, 
        column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position;
    `, [tableName]);

    if (colRes.rows.length === 0) continue;

    writeStream.write(`-- Table: ${tableName}\n`);
    writeStream.write(`CREATE TABLE IF NOT EXISTS "${tableName}" (\n`);

    const colDefs = colRes.rows.map(c => {
      let type = c.udt_name;
      if (type === 'varchar') type = `varchar(${c.character_maximum_length || 255})`;
      else if (type === '_varchar') type = 'varchar[]';
      else if (type === '_text') type = 'text[]';
      else if (type === 'int4') type = 'integer';
      else if (type === 'int8') type = 'bigint';
      else if (type === 'bool') type = 'boolean';
      else if (type === 'timestamp') type = 'timestamp';
      else if (type === 'timestamptz') type = 'timestamptz';
      else if (type === 'date') type = 'date';
      else if (type === 'time') type = 'time';
      else if (type === 'numeric') type = 'numeric(12,2)';

      let def = `  "${c.column_name}" ${type}`;
      if (c.column_name === 'id') def += ' PRIMARY KEY';
      if (c.is_nullable === 'NO' && c.column_name !== 'id') def += ' NOT NULL';
      if (c.column_default && !c.column_default.includes('nextval')) {
        def += ` DEFAULT ${c.column_default}`;
      }
      return def;
    });

    writeStream.write(colDefs.join(',\n') + '\n);\n\n');

    // Dump Data
    const rowsRes = await pool.query(`SELECT * FROM "${tableName}";`);
    if (rowsRes.rows.length > 0) {
      const colNames = Object.keys(rowsRes.rows[0]);
      const quotedColNames = colNames.map(c => `"${c}"`).join(', ');

      for (const row of rowsRes.rows) {
        const formattedValues = colNames.map(col => {
          const val = row[col];
          if (val === null || val === undefined) return 'NULL';
          if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
          if (typeof val === 'number') return val;
          if (val instanceof Date) return `'${val.toISOString()}'`;
          if (Array.isArray(val)) {
            const arrItems = val.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
            return `'{${arrItems}}'`;
          }
          if (typeof val === 'object') {
            return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
          }
          return `'${String(val).replace(/'/g, "''")}'`;
        });

        const updateSet = colNames
          .filter(c => c !== 'id')
          .map(c => `"${c}" = EXCLUDED."${c}"`)
          .join(', ');

        const conflict = colNames.includes('id')
          ? (updateSet ? ` ON CONFLICT ("id") DO UPDATE SET ${updateSet}` : ` ON CONFLICT ("id") DO NOTHING`)
          : '';

        writeStream.write(
          `INSERT INTO "${tableName}" (${quotedColNames}) VALUES (${formattedValues.join(', ')})${conflict};\n`
        );
      }
      writeStream.write('\n');
    }
  }

  writeStream.end();
  await pool.end();
  console.log(`✓ Production SQL dump generated successfully: ${outputFile}`);
}

generateDump().catch(err => {
  console.error('Error generating dump:', err);
  process.exit(1);
});
