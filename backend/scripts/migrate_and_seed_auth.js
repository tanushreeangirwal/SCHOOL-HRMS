const pool = require('../db');
const bcrypt = require('bcryptjs');

async function migrateAndSeedAuth() {
  console.log('--- STARTING AUTH & RBAC MIGRATION & SEEDING ---');

  try {
    // 1. Additive Migration on users table for 2FA support
    console.log('1. Applying additive migrations to users table...');
    await pool.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS two_factor_secret TEXT,
      ADD COLUMN IF NOT EXISTS two_factor_temp_secret TEXT;
    `);
    console.log('   ✓ Users table 2FA columns verified/added.');

    // 2. Seed HR Roles
    console.log('\n2. Seeding default HR roles...');
    const rolesToSeed = [
      { name: 'Administrator', description: 'Full institutional and HR system administrative access' },
      { name: 'HR', description: 'Human Resource officer with faculty and staff management access' },
      { name: 'Manager', description: 'Department Head and Academic Team Manager' },
      { name: 'Employee', description: 'Faculty, teacher, and standard staff member' }
    ];

    const roleMap = {};
    for (const r of rolesToSeed) {
      const existing = await pool.query('SELECT * FROM hr_roles WHERE name = $1', [r.name]);
      if (existing.rows.length === 0) {
        const inserted = await pool.query(
          'INSERT INTO hr_roles (name, description) VALUES ($1, $2) RETURNING id, name',
          [r.name, r.description]
        );
        roleMap[r.name] = inserted.rows[0].id;
        console.log(`   + Created role: ${r.name} (${inserted.rows[0].id})`);
      } else {
        roleMap[r.name] = existing.rows[0].id;
        console.log(`   ✓ Role exists: ${r.name} (${existing.rows[0].id})`);
      }
    }

    // 3. Seed Permissions
    console.log('\n3. Seeding system permissions...');
    const permissionsToSeed = [
      { name: 'employees:read', description: 'View full staff directory and profiles' },
      { name: 'employees:read_self', description: 'View own personal employee record' },
      { name: 'employees:create', description: 'Register new employees' },
      { name: 'employees:update', description: 'Modify employee records' },
      { name: 'employees:delete', description: 'Deactivate employee records' },
      { name: 'users:manage', description: 'Manage user credentials and security' },
      { name: 'roles:manage', description: 'Configure roles and assign permissions' },
      { name: 'dashboard:admin', description: 'View executive administrative dashboard' },
      { name: 'dashboard:hr', description: 'View HR workforce analytics' },
      { name: 'dashboard:manager', description: 'View team and department dashboard' },
      { name: 'dashboard:employee', description: 'View personal staff portal' }
    ];

    const permMap = {};
    for (const p of permissionsToSeed) {
      const existing = await pool.query('SELECT * FROM permissions WHERE name = $1', [p.name]);
      if (existing.rows.length === 0) {
        const inserted = await pool.query(
          'INSERT INTO permissions (name, description) VALUES ($1, $2) RETURNING id, name',
          [p.name, p.description]
        );
        permMap[p.name] = inserted.rows[0].id;
        console.log(`   + Created permission: ${p.name}`);
      } else {
        permMap[p.name] = existing.rows[0].id;
        console.log(`   ✓ Permission exists: ${p.name}`);
      }
    }

    // 4. Map Role Permissions
    console.log('\n4. Mapping permissions to roles...');
    const rolePermissionMapping = {
      'Administrator': Object.keys(permMap), // All permissions
      'HR': [
        'employees:read',
        'employees:read_self',
        'employees:create',
        'employees:update',
        'dashboard:hr',
        'dashboard:employee'
      ],
      'Manager': [
        'employees:read',
        'employees:read_self',
        'dashboard:manager',
        'dashboard:employee'
      ],
      'Employee': [
        'employees:read_self',
        'dashboard:employee'
      ]
    };

    for (const [roleName, perms] of Object.entries(rolePermissionMapping)) {
      const roleId = roleMap[roleName];
      if (!roleId) continue;

      for (const permName of perms) {
        const permId = permMap[permName];
        if (!permId) continue;

        const exists = await pool.query(
          'SELECT 1 FROM role_permissions WHERE role_id = $1 AND permission_id = $2',
          [roleId, permId]
        );
        if (exists.rows.length === 0) {
          await pool.query(
            'INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2)',
            [roleId, permId]
          );
        }
      }
      console.log(`   ✓ Mapped ${perms.length} permissions to role: ${roleName}`);
    }

    // 5. Check existing employees for demo account linking
    console.log('\n5. Locating existing employee records for demo linking...');
    const empEleanor = await pool.query("SELECT id FROM employees WHERE employee_code = 'EMP-1001' LIMIT 1");
    const empMarcus = await pool.query("SELECT id FROM employees WHERE employee_code = 'EMP-1002' LIMIT 1");
    const empTanushree = await pool.query("SELECT id FROM employees WHERE employee_code = 'EMP-1003' LIMIT 1");

    const eleanorId = empEleanor.rows[0]?.id || null;
    const marcusId = empMarcus.rows[0]?.id || null;
    const tanushreeId = empTanushree.rows[0]?.id || null;

    // 6. Seed Fictional Demo Users
    console.log('\n6. Seeding fictional demo accounts...');
    const demoPasswordPlain = 'SchoolDemo@2026';
    const passwordHash = await bcrypt.hash(demoPasswordPlain, 10);

    const demoUsers = [
      {
        email: 'admin@school.edu',
        role_name: 'Administrator',
        employee_id: null,
        description: 'System Administrator (Full Access)'
      },
      {
        email: 'hr@school.edu',
        role_name: 'HR',
        employee_id: tanushreeId,
        description: 'HR Manager Account'
      },
      {
        email: 'manager@school.edu',
        role_name: 'Manager',
        employee_id: marcusId,
        description: 'Academic Department Head'
      },
      {
        email: 'teacher@school.edu',
        role_name: 'Employee',
        employee_id: eleanorId,
        description: 'Faculty Teacher Account'
      }
    ];

    for (const u of demoUsers) {
      const roleId = roleMap[u.role_name];
      const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [u.email]);

      if (existingUser.rows.length === 0) {
        await pool.query(`
          INSERT INTO users (email, password_hash, role_id, employee_id, is_active)
          VALUES ($1, $2, $3, $4, true)
        `, [u.email, passwordHash, roleId, u.employee_id]);
        console.log(`   + Created user: ${u.email} [Role: ${u.role_name}]`);
      } else {
        await pool.query(`
          UPDATE users 
          SET password_hash = $1, role_id = $2, employee_id = COALESCE($3, employee_id), is_active = true
          WHERE email = $4
        `, [passwordHash, roleId, u.employee_id, u.email]);
        console.log(`   ✓ Updated existing user: ${u.email} [Role: ${u.role_name}]`);
      }
    }

    console.log('\n======================================================');
    console.log('✓ AUTH MIGRATION & SEEDING COMPLETED SUCCESSFULLY');
    console.log('DEMO ACCOUNTS READY (Password: SchoolDemo@2026):');
    console.log('  1. admin@school.edu    -> Role: Administrator');
    console.log('  2. hr@school.edu       -> Role: HR');
    console.log('  3. manager@school.edu  -> Role: Manager');
    console.log('  4. teacher@school.edu  -> Role: Employee');
    console.log('======================================================\n');

  } catch (error) {
    console.error('Migration & seeding failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  migrateAndSeedAuth();
}

module.exports = migrateAndSeedAuth;
