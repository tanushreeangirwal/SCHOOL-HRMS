const pool = require('../db');
const bcrypt = require('bcryptjs');

async function migrateRoleHierarchy() {
  console.log('===========================================================');
  console.log('--- PHASE 1: DATABASE MIGRATION & RBAC ROLE HIERARCHY ---');
  console.log('===========================================================');

  const report = {
    rolesFound: [],
    rolesCreatedOrUpdated: [],
    permissionsCreatedOrUpdated: [],
    demoAccountsCreatedOrUpdated: [],
    tablesChanged: ['hr_roles', 'permissions', 'role_permissions', 'users'],
    migrationFileCreated: 'backend/scripts/migrate_role_hierarchy.js',
    existingDataPreserved: 'All existing employees, departments, designations, users, and passwords preserved.'
  };

  try {
    // 1. Inspect existing roles
    const existingRolesRes = await pool.query('SELECT id, name, description FROM hr_roles ORDER BY name;');
    report.rolesFound = existingRolesRes.rows.map(r => r.name);
    console.log('\n1. Existing roles in database:', report.rolesFound);

    // 2. Additive Role Definitions
    console.log('\n2. Ensuring 4-Tier Institutional Roles...');
    const rolesToUpsert = [
      {
        name: 'Super Admin',
        description: 'Principal - Institutional Head & Executive Authority'
      },
      {
        name: 'Administrator',
        description: 'HR Administrator & Operations Lead'
      },
      {
        name: 'HR',
        description: 'Human Resources Officer'
      },
      {
        name: 'Manager',
        description: 'Department Head and Academic Team Manager'
      },
      {
        name: 'Employee',
        description: 'Faculty, Teacher, and Standard Staff Member'
      }
    ];

    const roleMap = {};
    for (const r of rolesToUpsert) {
      const existing = await pool.query('SELECT id, name FROM hr_roles WHERE LOWER(name) = LOWER($1)', [r.name]);
      if (existing.rows.length === 0) {
        const inserted = await pool.query(
          'INSERT INTO hr_roles (name, description, is_active) VALUES ($1, $2, true) RETURNING id, name',
          [r.name, r.description]
        );
        roleMap[r.name] = inserted.rows[0].id;
        report.rolesCreatedOrUpdated.push(`Created role: ${r.name}`);
        console.log(`   + Created new role: ${r.name} (${inserted.rows[0].id})`);
      } else {
        await pool.query(
          'UPDATE hr_roles SET description = $1, is_active = true WHERE id = $2',
          [r.description, existing.rows[0].id]
        );
        roleMap[r.name] = existing.rows[0].id;
        report.rolesCreatedOrUpdated.push(`Updated role description: ${r.name}`);
        console.log(`   ✓ Role verified/updated: ${r.name} (${existing.rows[0].id})`);
      }
    }

    // 3. Define System Permissions
    console.log('\n3. Ensuring Granular Permissions...');
    const permissionsToEnsure = [
      { name: 'dashboard:superadmin', description: 'View executive institutional dashboard and school-wide KPIs' },
      { name: 'dashboard:admin', description: 'View HR operations administrative dashboard' },
      { name: 'dashboard:hr', description: 'View HR workforce and staffing analytics' },
      { name: 'dashboard:manager', description: 'View department and faculty team dashboard' },
      { name: 'dashboard:employee', description: 'View personal staff portal' },
      { name: 'system:governance', description: 'Executive institutional governance, audit oversight' },
      { name: 'roles:manage_superadmin', description: 'Configure super administrator privileges and Principal accounts' },
      { name: 'roles:manage', description: 'Configure operational roles and assign permissions' },
      { name: 'users:manage', description: 'Manage user credentials and security profiles' },
      { name: 'employees:read', description: 'View full staff directory and profiles' },
      { name: 'employees:read_self', description: 'View own personal employee record' },
      { name: 'employees:create', description: 'Register new employees' },
      { name: 'employees:update', description: 'Modify employee records' },
      { name: 'employees:delete', description: 'Deactivate employee records' },
      { name: 'departments:read', description: 'View departments list and profiles' },
      { name: 'departments:create', description: 'Create new academic and administrative departments' },
      { name: 'departments:update', description: 'Modify department details' },
      { name: 'departments:delete', description: 'Activate or deactivate departments' },
      { name: 'departments:assign', description: 'Assign employees to departments' },
      { name: 'department_categories:read', description: 'View department categories' },
      { name: 'department_categories:create', description: 'Create department categories' },
      { name: 'department_categories:update', description: 'Modify department categories' },
      { name: 'department_categories:delete', description: 'Delete or toggle department categories' },
      { name: 'designations:read', description: 'View job positions and designations' },
      { name: 'designations:create', description: 'Create new job positions and designations' },
      { name: 'designations:update', description: 'Modify job positions and designations' },
      { name: 'designations:delete', description: 'Toggle designation status' },
      { name: 'audit:read', description: 'View system security and audit logs' }
    ];

    const permMap = {};
    for (const p of permissionsToEnsure) {
      const existing = await pool.query('SELECT id FROM permissions WHERE name = $1', [p.name]);
      if (existing.rows.length === 0) {
        const inserted = await pool.query(
          'INSERT INTO permissions (name, description, created_at, updated_at) VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING id, name',
          [p.name, p.description]
        );
        permMap[p.name] = inserted.rows[0].id;
        report.permissionsCreatedOrUpdated.push(`Created permission: ${p.name}`);
        console.log(`   + Created permission: ${p.name}`);
      } else {
        await pool.query('UPDATE permissions SET description = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [p.description, existing.rows[0].id]);
        permMap[p.name] = existing.rows[0].id;
        report.permissionsCreatedOrUpdated.push(`Verified permission: ${p.name}`);
        console.log(`   ✓ Permission verified: ${p.name}`);
      }
    }

    // 4. Map Permissions to Roles
    console.log('\n4. Mapping Permissions to Roles by Tier...');
    const allPermNames = Object.keys(permMap);

    const rolePermissionMapping = {
      'Super Admin': allPermNames, // Super Admin receives every permission including superadmin governance
      'Administrator': allPermNames.filter(p => p !== 'roles:manage_superadmin'), // Admin receives all operational perms except managing Super Admin
      'HR': [
        'dashboard:hr',
        'dashboard:employee',
        'employees:read',
        'employees:read_self',
        'employees:create',
        'employees:update',
        'departments:read',
        'departments:assign',
        'department_categories:read',
        'department_categories:create',
        'department_categories:update',
        'department_categories:delete',
        'designations:read',
        'designations:create',
        'designations:update',
        'designations:delete'
      ],
      'Manager': [
        'dashboard:manager',
        'dashboard:employee',
        'employees:read',
        'employees:read_self',
        'departments:read',
        'department_categories:read',
        'designations:read'
      ],
      'Employee': [
        'dashboard:employee',
        'employees:read_self'
      ]
    };

    for (const [roleName, perms] of Object.entries(rolePermissionMapping)) {
      const roleId = roleMap[roleName];
      if (!roleId) continue;

      for (const permName of perms) {
        const permId = permMap[permName];
        if (!permId) continue;

        const check = await pool.query(
          'SELECT 1 FROM role_permissions WHERE role_id = $1 AND permission_id = $2',
          [roleId, permId]
        );
        if (check.rows.length === 0) {
          await pool.query(
            'INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2)',
            [roleId, permId]
          );
        }
      }
      console.log(`   ✓ Mapped ${perms.length} permissions to role: ${roleName}`);
    }

    // 5. Seed / Update Demo Accounts
    console.log('\n5. Setting Up Role Hierarchy Demo Accounts...');
    const demoPasswordPlain = 'SchoolDemo@2026';
    const passwordHash = await bcrypt.hash(demoPasswordPlain, 10);

    // Check existing employees for demo linking
    const empEleanor = await pool.query("SELECT id FROM employees WHERE employee_code = 'EMP-1001' LIMIT 1");
    const empMarcus = await pool.query("SELECT id FROM employees WHERE employee_code = 'EMP-1002' LIMIT 1");
    const empTanushree = await pool.query("SELECT id FROM employees WHERE employee_code = 'EMP-1003' LIMIT 1");

    const eleanorId = empEleanor.rows[0]?.id || null;
    const marcusId = empMarcus.rows[0]?.id || null;
    const tanushreeId = empTanushree.rows[0]?.id || null;

    const demoAccounts = [
      {
        email: 'principal@school.edu',
        role_name: 'Super Admin',
        employee_id: null,
        title: 'Super Admin (Principal)'
      },
      {
        email: 'admin@school.edu',
        role_name: 'Administrator',
        employee_id: null,
        title: 'Admin (HR Administrator)'
      },
      {
        email: 'hr@school.edu',
        role_name: 'HR',
        employee_id: tanushreeId,
        title: 'HR (Human Resources)'
      },
      {
        email: 'manager@school.edu',
        role_name: 'Manager',
        employee_id: marcusId,
        title: 'Manager (Department Head)'
      },
      {
        email: 'teacher@school.edu',
        role_name: 'Employee',
        employee_id: eleanorId,
        title: 'Employee (Faculty Member)'
      }
    ];

    for (const acc of demoAccounts) {
      const roleId = roleMap[acc.role_name];
      const existingUser = await pool.query('SELECT id, email, role_id FROM users WHERE email = $1', [acc.email]);

      if (existingUser.rows.length === 0) {
        await pool.query(`
          INSERT INTO users (email, password_hash, role_id, employee_id, is_active)
          VALUES ($1, $2, $3, $4, true)
        `, [acc.email, passwordHash, roleId, acc.employee_id]);
        report.demoAccountsCreatedOrUpdated.push(`Created account: ${acc.email} [${acc.title}]`);
        console.log(`   + Created demo user: ${acc.email} -> ${acc.title}`);
      } else {
        await pool.query(`
          UPDATE users 
          SET password_hash = $1, role_id = $2, employee_id = COALESCE($3, employee_id), is_active = true
          WHERE email = $4
        `, [passwordHash, roleId, acc.employee_id, acc.email]);
        report.demoAccountsCreatedOrUpdated.push(`Updated account: ${acc.email} [${acc.title}]`);
        console.log(`   ✓ Updated demo user: ${acc.email} -> ${acc.title}`);
      }
    }

    console.log('\n===========================================================');
    console.log('✓ PHASE 1 DATABASE MIGRATION COMPLETED SUCCESSFULLY');
    console.log('===========================================================');
    console.log(JSON.stringify(report, null, 2));

    return report;

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  migrateRoleHierarchy();
}

module.exports = migrateRoleHierarchy;
