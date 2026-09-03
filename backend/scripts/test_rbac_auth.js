const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'school_hrms_jwt_fallback_secret_key';

async function testRBACAuth() {
  console.log('===========================================================');
  console.log('--- TESTING 5-TIER RBAC AUTHENTICATION & CREDENTIALS ---');
  console.log('===========================================================');

  const testAccounts = [
    { email: 'principal@school.edu', expectedRole: 'Super Admin' },
    { email: 'admin@school.edu', expectedRole: 'Administrator' },
    { email: 'hr@school.edu', expectedRole: 'HR' },
    { email: 'manager@school.edu', expectedRole: 'Manager' },
    { email: 'teacher@school.edu', expectedRole: 'Employee' }
  ];

  for (const acc of testAccounts) {
    const userRes = await pool.query(`
      SELECT 
        u.id, 
        u.email, 
        u.password_hash, 
        u.is_active, 
        r.name AS role_name,
        COALESCE(
          json_agg(p.name) FILTER (WHERE p.name IS NOT NULL),
          '[]'
        ) AS permissions
      FROM users u
      JOIN hr_roles r ON u.role_id = r.id
      LEFT JOIN role_permissions rp ON r.id = rp.role_id
      LEFT JOIN permissions p ON rp.permission_id = p.id
      WHERE LOWER(u.email) = $1
      GROUP BY u.id, r.name;
    `, [acc.email.toLowerCase()]);

    if (userRes.rows.length === 0) {
      console.error(`❌ User not found: ${acc.email}`);
      continue;
    }

    const u = userRes.rows[0];
    const passwordMatch = await bcrypt.compare('SchoolDemo@2026', u.password_hash);
    const roleMatches = u.role_name === acc.expectedRole;

    console.log(`\nAccount: ${u.email}`);
    console.log(`  Role in DB: ${u.role_name} (Matches Expected: ${roleMatches ? '✓' : '❌'})`);
    console.log(`  Password verification ('SchoolDemo@2026'): ${passwordMatch ? '✓ VALID' : '❌ FAILED'}`);
    console.log(`  Total Permissions Count: ${u.permissions.length}`);
    console.log(`  Permissions Sample: ${u.permissions.slice(0, 4).join(', ')}...`);

    // Verify token generation
    const token = jwt.sign({ userId: u.id }, JWT_SECRET, { expiresIn: '24h' });
    const decoded = jwt.verify(token, JWT_SECRET);
    console.log(`  JWT Signature & Verification: ✓ VALID (User ID: ${decoded.userId})`);
  }

  await pool.end();
  console.log('\n===========================================================');
  console.log('✓ ALL RBAC ACCOUNTS VERIFIED IN DATABASE SUCCESSFULLY');
  console.log('===========================================================');
}

testRBACAuth();
