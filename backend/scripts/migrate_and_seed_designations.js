const pool = require('../db');

async function migrateAndSeedDesignations() {
  console.log('--- Starting Designations Schema & Permissions Migration ---');

  try {
    // 1. Add description column to designations if missing
    await pool.query(`
      ALTER TABLE designations 
      ADD COLUMN IF NOT EXISTS description TEXT;
    `);
    console.log('✓ Ensured description column exists on designations table.');

    // 2. Define permissions
    const desigPermissions = [
      {
        name: 'designations:read',
        description: 'View job positions and designations across St. Vincent\'s School'
      },
      {
        name: 'designations:create',
        description: 'Register and define new job designations and positions'
      },
      {
        name: 'designations:update',
        description: 'Modify designation details, department affiliations, and requirements'
      },
      {
        name: 'designations:delete',
        description: 'Activate or deactivate job designations'
      }
    ];

    for (const perm of desigPermissions) {
      const existing = await pool.query('SELECT id FROM permissions WHERE name = $1;', [perm.name]);
      if (existing.rows.length === 0) {
        await pool.query(`
          INSERT INTO permissions (name, description, created_at, updated_at)
          VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
        `, [perm.name, perm.description]);
        console.log(`✓ Inserted permission: ${perm.name}`);
      }
    }

    // 3. Link permissions to Roles
    const rolesRes = await pool.query('SELECT id, name FROM hr_roles;');
    const rolesMap = {};
    rolesRes.rows.forEach(r => { rolesMap[r.name] = r.id; });

    const permsRes = await pool.query('SELECT id, name FROM permissions WHERE name LIKE \'designations:%\';');
    const permIds = {};
    permsRes.rows.forEach(p => { permIds[p.name] = p.id; });

    const roleAssignments = [
      { role: 'Administrator', perms: ['designations:read', 'designations:create', 'designations:update', 'designations:delete'] },
      { role: 'HR', perms: ['designations:read', 'designations:create', 'designations:update', 'designations:delete'] },
      { role: 'Manager', perms: ['designations:read'] }
    ];

    for (const assign of roleAssignments) {
      const roleId = rolesMap[assign.role];
      if (!roleId) continue;

      for (const pName of assign.perms) {
        const pId = permIds[pName];
        if (!pId) continue;

        const check = await pool.query(
          'SELECT 1 FROM role_permissions WHERE role_id = $1 AND permission_id = $2;',
          [roleId, pId]
        );
        if (check.rows.length === 0) {
          await pool.query(
            'INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2);',
            [roleId, pId]
          );
          console.log(`✓ Granted ${pName} to role ${assign.role}`);
        }
      }
    }

    console.log('✓ Designations migration and permission mapping complete.');
  } catch (err) {
    console.error('Migration error:', err);
  } finally {
    await pool.end();
  }
}

migrateAndSeedDesignations();
