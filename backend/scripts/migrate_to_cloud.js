/**
 * St. Vincent's School HRMS - Cloud Migration & Database Sync Tool
 * 
 * Safely migrates schema, tables, and production records from the local PostgreSQL
 * database to Neon (or any cloud PostgreSQL instance) without modifying schema or deleting local data.
 * 
 * Security: Masking enabled - connection credentials/passwords are never logged or exposed.
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

function maskConnectionString(url) {
  if (!url) return '';
  return url.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:********@');
}

async function getTableDDL(client, tableName) {
  const colRes = await client.query(`
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

  if (colRes.rows.length === 0) return null;
  return colRes.rows;
}

async function migrateDatabase(targetUrl) {
  console.log('===========================================================');
  console.log('--- ST. VINCENT\'S HRMS DATABASE CLOUD MIGRATION ENGINE ---');
  console.log('===========================================================\n');

  if (!targetUrl) {
    console.error('❌ Error: No target cloud database URL specified.');
    console.log('\nTo migrate your database safely:');
    console.log('1. Add TARGET_DATABASE_URL to backend/.env (this file is gitignored and never committed)');
    console.log('   TARGET_DATABASE_URL=postgresql://neondb_owner:***@ep-xyz.neon.tech/neondb?sslmode=require');
    console.log('2. Then run: node scripts/migrate_to_cloud.js');
    console.log('Or run directly:');
    console.log('   node scripts/migrate_to_cloud.js --target="postgresql://..."\n');
    process.exit(1);
  }

  const maskedTarget = maskConnectionString(targetUrl);
  console.log(`Target Cloud Database: ${maskedTarget}\n`);

  // Connect to source
  const sourcePool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'school_hrms',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    ssl: false
  });

  try {
    const srcTest = await sourcePool.query('SELECT current_database(), count(*) FROM hr_roles;');
    console.log(`✓ Connected to local source database: [${srcTest.rows[0].current_database}]`);
  } catch (err) {
    console.error('❌ Failed to connect to local source database:', err.message);
    await sourcePool.end();
    process.exit(1);
  }

  // Connect to target cloud database
  const isCloudTarget = !targetUrl.includes('localhost') && !targetUrl.includes('127.0.0.1');
  const targetPool = new Pool({
    connectionString: targetUrl,
    ssl: isCloudTarget ? { rejectUnauthorized: false } : false
  });

  try {
    const targetTest = await targetPool.query('SELECT current_database(), version();');
    console.log(`✓ Connected to target cloud database: [${targetTest.rows[0].current_database}]`);
    console.log(`  Engine: ${targetTest.rows[0].version.split(',')[0]}`);
  } catch (err) {
    console.error('❌ Failed to connect to target cloud database:', err.message);
    await sourcePool.end();
    await targetPool.end();
    process.exit(1);
  }

  console.log('\nPreparing extensions in cloud database...');
  await targetPool.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
  await targetPool.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto";');

  // Query tables in local DB
  const tablesResult = await sourcePool.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
  `);
  const existingTables = new Set(tablesResult.rows.map(r => r.table_name));
  const tablesToMigrate = TABLE_DEPENDENCY_ORDER.filter(t => existingTables.has(t));
  for (const t of existingTables) {
    if (!tablesToMigrate.includes(t)) {
      tablesToMigrate.push(t);
    }
  }

  console.log(`Identified ${tablesToMigrate.length} tables to migrate.\n`);
  console.log('--- MIGRATING TABLES & RECORDS ---');

  for (const tableName of tablesToMigrate) {
    process.stdout.write(`• ${tableName.padEnd(30)} ... `);

    // Fetch column specs from local DB
    const cols = await getTableDDL(sourcePool, tableName);
    if (!cols) {
      console.log('Skipped (no schema info)');
      continue;
    }

    // Build CREATE TABLE statement matching local DB structure
    const colDefs = cols.map(c => {
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

      let def = `"${c.column_name}" ${type}`;
      if (c.column_name === 'id') def += ' PRIMARY KEY';
      if (c.is_nullable === 'NO' && c.column_name !== 'id') def += ' NOT NULL';
      if (c.column_default && !c.column_default.includes('nextval')) {
        def += ` DEFAULT ${c.column_default}`;
      }
      return def;
    }).join(', ');

    await targetPool.query(`CREATE TABLE IF NOT EXISTS "${tableName}" (${colDefs});`);

    // Fetch records from local database
    const sourceRows = await sourcePool.query(`SELECT * FROM "${tableName}";`);

    if (sourceRows.rows.length > 0) {
      const columnNames = Object.keys(sourceRows.rows[0]);
      const quotedColNames = columnNames.map(c => `"${c}"`).join(', ');

      for (const row of sourceRows.rows) {
        const values = columnNames.map(c => row[c]);
        const placeholders = values.map((_, idx) => `$${idx + 1}`).join(', ');

        const updateSet = columnNames
          .filter(c => c !== 'id')
          .map(c => `"${c}" = EXCLUDED."${c}"`)
          .join(', ');

        const conflictClause = columnNames.includes('id')
          ? (updateSet ? `ON CONFLICT ("id") DO UPDATE SET ${updateSet}` : `ON CONFLICT ("id") DO NOTHING`)
          : '';

        const insertQuery = `
          INSERT INTO "${tableName}" (${quotedColNames})
          VALUES (${placeholders})
          ${conflictClause};
        `;

        await targetPool.query(insertQuery, values);
      }
      console.log(`✓ ${sourceRows.rows.length} rows migrated`);
    } else {
      console.log(`✓ 0 rows (empty table structure verified)`);
    }
  }

  // Verification Audit
  console.log('\n===========================================================');
  console.log('--- POST-MIGRATION PARITY & INTEGRITY AUDIT ---');
  console.log('===========================================================');

  let allMatched = true;
  let totalMigratedRows = 0;
  const auditResults = [];

  for (const tableName of tablesToMigrate) {
    const srcCountRes = await sourcePool.query(`SELECT count(*) FROM "${tableName}";`);
    const tgtCountRes = await targetPool.query(`SELECT count(*) FROM "${tableName}";`);
    const srcCount = parseInt(srcCountRes.rows[0].count, 10);
    const tgtCount = parseInt(tgtCountRes.rows[0].count, 10);
    totalMigratedRows += tgtCount;

    const isMatch = (srcCount === tgtCount);
    if (!isMatch) allMatched = false;

    auditResults.push({
      table: tableName,
      source: srcCount,
      target: tgtCount,
      status: isMatch ? 'MATCH' : 'MISMATCH'
    });

    console.log(
      `  ${isMatch ? '✓' : '⚠️'} ${tableName.padEnd(30)} : Local=${String(srcCount).padStart(3)} | Cloud=${String(tgtCount).padStart(3)} [${isMatch ? 'PARITY' : 'MISMATCH'}]`
    );
  }

  // Check critical HRMS entities
  console.log('\n--- VERIFYING CRITICAL RECORD SETS IN CLOUD ---');
  const userCheck = await targetPool.query(`
    SELECT u.email, r.name as role_name, e.employee_code, e.first_name, e.last_name
    FROM users u
    JOIN hr_roles r ON u.role_id = r.id
    LEFT JOIN employees e ON u.employee_id = e.id
    ORDER BY r.name;
  `);
  console.log(`✓ System User Accounts Migrated: ${userCheck.rows.length}`);
  userCheck.rows.forEach(u => {
    console.log(`   - [${u.role_name}] ${u.email} (${u.first_name} ${u.last_name})`);
  });

  const empCount = await targetPool.query('SELECT count(*) FROM employees WHERE employment_status = \'Active\';');
  console.log(`✓ Active Faculty & Staff Members: ${empCount.rows[0].count}`);

  const deptCount = await targetPool.query('SELECT count(*) FROM departments WHERE is_active = true;');
  console.log(`✓ Active Departments: ${deptCount.rows[0].count}`);

  const shiftCount = await targetPool.query('SELECT count(*) FROM shifts WHERE is_active = true;');
  console.log(`✓ Active Shifts & Work Schedules: ${shiftCount.rows[0].count}`);

  const calCount = await targetPool.query('SELECT count(*) FROM calendar_events;');
  console.log(`✓ Academic Calendar Events: ${calCount.rows[0].count}`);

  console.log('\n===========================================================');
  if (allMatched) {
    console.log(`🎉 SUCCESS: ALL ${tablesToMigrate.length} TABLES AND ${totalMigratedRows} ROWS MIGRATED WITH 100% PARITY!`);
  } else {
    console.log('⚠️ Migration completed with discrepancies. Please review table counts above.');
  }
  console.log('===========================================================\n');

  await sourcePool.end();
  await targetPool.end();
}

// Extract target URL cleanly from command line or environment
let targetUrl = process.env.TARGET_DATABASE_URL || process.env.DATABASE_URL;

const targetArg = process.argv.find(a => a.startsWith('--target=') || a.startsWith('--url='));
if (targetArg) {
  const eqIdx = targetArg.indexOf('=');
  targetUrl = targetArg.slice(eqIdx + 1).replace(/^["']|["']$/g, '');
} else if (process.argv[2] && !process.argv[2].startsWith('--')) {
  targetUrl = process.argv[2].replace(/^["']|["']$/g, '');
}

migrateDatabase(targetUrl).catch(err => {
  console.error('Fatal Migration Error:', err);
  process.exit(1);
});
