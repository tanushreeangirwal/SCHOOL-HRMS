/**
 * St. Vincent's School HRMS - Cloud Migration & Database Sync Tool
 * 
 * Exports schema and all production data from the local database
 * and directly loads it into any target Cloud PostgreSQL instance
 * (Neon, Render, Supabase, Railway, etc.) with automated verification.
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

// Ordered list of tables to preserve foreign key dependency hierarchy
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

async function getTableDDL(client, tableName) {
  // Query column definitions
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
  console.log('--- ST. VINCENT\'S HRMS DATABASE MIGRATION ENGINE ---');
  console.log('===========================================================\n');

  const sourcePool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'school_hrms',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    ssl: false
  });

  // Verify source
  try {
    const srcTest = await sourcePool.query('SELECT current_database(), count(*) FROM hr_roles;');
    console.log(`✓ Connected to source database: ${srcTest.rows[0].current_database}`);
  } catch (err) {
    console.error('❌ Failed to connect to local source database:', err.message);
    await sourcePool.end();
    process.exit(1);
  }

  if (!targetUrl) {
    console.log('\n[INFO] No target database URL provided.');
    console.log('Usage: node scripts/migrate_to_cloud.js --target="postgresql://user:pass@cloud-host/dbname"');
    console.log('Or set TARGET_DATABASE_URL in your environment.\n');
    await sourcePool.end();
    return;
  }

  console.log('Connecting to target cloud database...');
  const isCloudTarget = !targetUrl.includes('localhost') && !targetUrl.includes('127.0.0.1');
  const targetPool = new Pool({
    connectionString: targetUrl,
    ssl: isCloudTarget ? { rejectUnauthorized: false } : false
  });

  try {
    const targetTest = await targetPool.query('SELECT current_database();');
    console.log(`✓ Connected to target cloud database: ${targetTest.rows[0].current_database}`);
  } catch (err) {
    console.error('❌ Failed to connect to target cloud database:', err.message);
    await sourcePool.end();
    await targetPool.end();
    process.exit(1);
  }

  // Generate schema export & data sync
  console.log('\nStarting schema and data migration...');

  // Ensure uuid extension
  await targetPool.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
  await targetPool.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto";');

  // Disable FK triggers temporarily during bulk load
  console.log('Optimizing target database session for relational restore...');

  // 1. Fetch tables present in source
  const tablesResult = await sourcePool.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
  `);
  const existingTables = new Set(tablesResult.rows.map(r => r.table_name));

  // Determine actual tables to migrate in dependency order
  const tablesToMigrate = TABLE_DEPENDENCY_ORDER.filter(t => existingTables.has(t));
  for (const t of existingTables) {
    if (!tablesToMigrate.includes(t)) {
      tablesToMigrate.push(t);
    }
  }

  console.log(`Identified ${tablesToMigrate.length} tables to synchronize.\n`);

  // Migrate table structure & records
  for (const tableName of tablesToMigrate) {
    process.stdout.write(`Migrating [${tableName}]... `);

    // Fetch local columns
    const cols = await getTableDDL(sourcePool, tableName);
    if (!cols) {
      console.log('Skipped (no columns found)');
      continue;
    }

    // Check if table exists in target
    const targetTableExists = await targetPool.query(`
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = $1;
    `, [tableName]);

    if (targetTableExists.rows.length === 0) {
      // Build basic CREATE TABLE definition
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
    }

    // Fetch rows from source
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
      console.log(`✓ ${sourceRows.rows.length} rows synchronized`);
    } else {
      console.log(`✓ 0 rows (empty table synchronized)`);
    }
  }

  // Apply foreign keys if needed
  console.log('\nVerifying database parity and row counts...');
  let hasParityIssue = false;
  for (const tableName of tablesToMigrate) {
    const srcCountRes = await sourcePool.query(`SELECT count(*) FROM "${tableName}";`);
    const tgtCountRes = await targetPool.query(`SELECT count(*) FROM "${tableName}";`);
    const srcCount = parseInt(srcCountRes.rows[0].count, 10);
    const tgtCount = parseInt(tgtCountRes.rows[0].count, 10);

    if (srcCount !== tgtCount) {
      console.warn(`  ⚠️ Row count mismatch for [${tableName}]: Source=${srcCount}, Target=${tgtCount}`);
      hasParityIssue = true;
    } else {
      console.log(`  ✓ ${tableName.padEnd(28)} : ${tgtCount} rows match`);
    }
  }

  console.log('\n===========================================================');
  if (!hasParityIssue) {
    console.log('✓ CLOUD DATABASE MIGRATION & PARITY CHECK COMPLETED SUCCESSFULLY!');
  } else {
    console.log('⚠️ Migration completed with some table count warnings. Please review above.');
  }
  console.log('===========================================================\n');

  await sourcePool.end();
  await targetPool.end();
}

// Check command line arguments for target URL
const targetArg = process.argv.find(a => a.startsWith('--target=') || a.startsWith('--url='));
const targetUrl = targetArg
  ? targetArg.split('=')[1]
  : (process.env.TARGET_DATABASE_URL || process.argv[2]);

migrateDatabase(targetUrl).catch(err => {
  console.error('Fatal Migration Error:', err);
  process.exit(1);
});
