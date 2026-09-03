const pool = require('../db');

async function migrateOnboardingSchema() {
  console.log('=== ST. VINCENT\'S HRMS — ONBOARDING SCHEMA MIGRATION ===');
  try {
    // 1. Allow password_hash to be NULL for invited accounts before password creation
    await pool.query(`
      ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
    `);
    console.log('[PASS] users.password_hash is now nullable for pending invites.');

    // 2. Add onboarding & verification columns
    await pool.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS account_status VARCHAR(50) DEFAULT 'ACTIVE',
        ADD COLUMN IF NOT EXISTS invitation_token_hash TEXT,
        ADD COLUMN IF NOT EXISTS invitation_expires_at TIMESTAMP,
        ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMP,
        ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMP,
        ADD COLUMN IF NOT EXISTS phone_otp_hash TEXT,
        ADD COLUMN IF NOT EXISTS phone_otp_expires_at TIMESTAMP,
        ADD COLUMN IF NOT EXISTS phone_otp_attempts INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS phone_otp_last_sent_at TIMESTAMP;
    `);
    console.log('[PASS] Added onboarding & verification columns to users table.');

    // 3. Ensure existing users have account_status = 'ACTIVE'
    const updateRes = await pool.query(`
      UPDATE users 
      SET account_status = 'ACTIVE' 
      WHERE account_status IS NULL OR account_status = '';
    `);
    console.log(`[PASS] Set account_status = 'ACTIVE' for ${updateRes.rowCount} existing user accounts.`);

    // 4. Verify columns
    const cols = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name IN (
        'password_hash', 'account_status', 'invitation_token_hash', 
        'invitation_expires_at', 'email_verified_at', 'phone_verified_at', 
        'phone_otp_hash', 'phone_otp_expires_at', 'phone_otp_attempts'
      )
      ORDER BY column_name;
    `);
    console.table(cols.rows);

    console.log('\n=== MIGRATION COMPLETED SUCCESSFULLY ===');
  } catch (err) {
    console.error('[ERROR] Schema migration failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrateOnboardingSchema();
