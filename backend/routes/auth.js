const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const otplib = require('otplib');
const qrcode = require('qrcode');
const pool = require('../db');
const { authenticateToken, requirePermission } = require('../middleware/auth');
const emailService = require('../services/emailService');
const smsService = require('../services/smsService');
require('dotenv').config();

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'school_hrms_jwt_fallback_secret_key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

// Helper: Query user with role and permissions
async function getUserWithRoleAndPermissions(userId) {
  const result = await pool.query(`
    SELECT 
      u.id,
      u.email,
      u.password_hash,
      u.is_active,
      u.two_factor_enabled,
      u.two_factor_secret,
      u.two_factor_temp_secret,
      u.employee_id,
      u.role_id,
      r.name AS role_name,
      e.employee_code,
      e.first_name,
      e.last_name,
      e.employment_status,
      e.profile_photo_url,
      COALESCE(
        json_agg(p.name) FILTER (WHERE p.name IS NOT NULL),
        '[]'
      ) AS permissions
    FROM users u
    JOIN hr_roles r ON u.role_id = r.id
    LEFT JOIN employees e ON u.employee_id = e.id
    LEFT JOIN role_permissions rp ON r.id = rp.role_id
    LEFT JOIN permissions p ON rp.permission_id = p.id
    WHERE u.id = $1
    GROUP BY u.id, r.name, e.employee_code, e.first_name, e.last_name, e.employment_status, e.profile_photo_url;
  `, [userId]);

  return result.rows[0] || null;
}

// Helper: Format user object for client responses (no secrets)
function formatUserResponse(user) {
  return {
    id: user.id,
    email: user.email,
    role: user.role_name,
    role_id: user.role_id,
    employee_id: user.employee_id,
    employee_code: user.employee_code,
    first_name: user.first_name,
    last_name: user.last_name,
    full_name: [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email.split('@')[0],
    employment_status: user.employment_status,
    profile_photo_url: user.profile_photo_url,
    two_factor_enabled: Boolean(user.two_factor_enabled),
    permissions: Array.isArray(user.permissions) ? user.permissions : []
  };
}

// --------------------------------------------------------------------------
// 1. POST /api/auth/login
// --------------------------------------------------------------------------
router.post('/login', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const identifier = (username || email || '').trim().toLowerCase();

    if (!identifier || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username/email and password are required.'
      });
    }

    // Locate user by email or by employee code
    const userResult = await pool.query(`
      SELECT 
        u.id, 
        u.email, 
        u.password_hash, 
        u.is_active, 
        u.account_status,
        u.two_factor_enabled
      FROM users u
      LEFT JOIN employees e ON u.employee_id = e.id
      WHERE LOWER(u.email) = $1 OR LOWER(e.employee_code) = $1
      LIMIT 1;
    `, [identifier]);

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email/username or password.'
      });
    }

    const basicUser = userResult.rows[0];

    // Check account onboarding status
    if (basicUser.account_status && basicUser.account_status !== 'ACTIVE') {
      return res.status(403).json({
        success: false,
        message: `Account is not active (Status: ${basicUser.account_status.replace(/_/g, ' ')}). Please complete your account onboarding verification.`
      });
    }

    // Check account active flag
    if (!basicUser.is_active) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated. Please contact an administrator.'
      });
    }

    // Check if password has been established
    if (!basicUser.password_hash) {
      return res.status(403).json({
        success: false,
        message: 'No password has been set. Please complete your onboarding invitation flow to create your password.'
      });
    }

    // Verify Password Hash
    const passwordMatch = await bcrypt.compare(password, basicUser.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email/username or password.'
      });
    }

    // Check if Two-Factor Authentication is enabled
    if (basicUser.two_factor_enabled) {
      // Generate a short-lived (10 min) temporary 2FA token
      const tempToken = jwt.sign(
        { userId: basicUser.id, step: '2fa_pending' },
        JWT_SECRET,
        { expiresIn: '10m' }
      );

      return res.json({
        success: true,
        require2fa: true,
        tempToken,
        message: 'Two-Factor Authentication is enabled. Please provide your 6-digit code.'
      });
    }

    // 2FA not enabled -> complete authentication
    const fullUser = await getUserWithRoleAndPermissions(basicUser.id);
    await pool.query('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1', [basicUser.id]);

    const token = jwt.sign({ userId: fullUser.id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    return res.json({
      success: true,
      require2fa: false,
      token,
      user: formatUserResponse(fullUser),
      message: 'Login successful.'
    });

  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      message: 'An internal server error occurred during login.'
    });
  }
});

// --------------------------------------------------------------------------
// 2. POST /api/auth/verify-2fa
// --------------------------------------------------------------------------
router.post('/verify-2fa', async (req, res) => {
  try {
    const { tempToken, code } = req.body;

    if (!tempToken || !code) {
      return res.status(400).json({
        success: false,
        message: 'Temporary token and 6-digit verification code are required.'
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(tempToken, JWT_SECRET);
      if (decoded.step !== '2fa_pending') {
        throw new Error('Invalid token step');
      }
    } catch {
      return res.status(401).json({
        success: false,
        message: '2FA session has expired or is invalid. Please log in again.'
      });
    }

    const user = await getUserWithRoleAndPermissions(decoded.userId);
    if (!user || !user.is_active || !user.two_factor_enabled || !user.two_factor_secret) {
      return res.status(401).json({
        success: false,
        message: 'Unable to verify 2FA for this account.'
      });
    }

    // Verify 6-digit TOTP code
    const cleanCode = code.toString().trim().replace(/\s/g, '');
    let isValidCode = false;

    try {
      const checkResult = otplib.verifySync({
        secret: user.two_factor_secret,
        token: cleanCode
      });
      isValidCode = Boolean(checkResult && checkResult.valid);
    } catch (err) {
      console.warn('TOTP check error:', err.message);
      isValidCode = false;
    }

    if (!isValidCode) {
      return res.status(400).json({
        success: false,
        message: 'Invalid 6-digit authenticator code. Please check your app and try again.'
      });
    }

    // Success -> update login time and issue full JWT
    await pool.query('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    return res.json({
      success: true,
      token,
      user: formatUserResponse(user),
      message: 'Two-factor authentication verified successfully.'
    });

  } catch (error) {
    console.error('2FA verification error:', error);
    return res.status(500).json({
      success: false,
      message: 'An internal server error occurred during 2FA verification.'
    });
  }
});

// --------------------------------------------------------------------------
// 3. POST /api/auth/2fa/setup (Authenticated)
// --------------------------------------------------------------------------
router.post('/2fa/setup', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const userEmail = req.user.email;

    // Generate a fresh base32 secret
    const secret = otplib.generateSecret();
    const serviceName = 'EduCore HRMS';
    const otpauth = otplib.generateURI({
      issuer: serviceName,
      label: userEmail,
      secret
    });

    // Generate QR Code data URL
    const qrCodeDataUrl = await qrcode.toDataURL(otpauth);

    // Store temporarily until confirmed
    await pool.query('UPDATE users SET two_factor_temp_secret = $1 WHERE id = $2', [secret, userId]);

    return res.json({
      success: true,
      qrCode: qrCodeDataUrl,
      secret,
      otpauth,
      message: 'Scan the QR code with your authenticator app (Google Authenticator, Microsoft Authenticator, Authy).'
    });

  } catch (error) {
    console.error('2FA setup error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to initiate 2FA setup.'
    });
  }
});

// --------------------------------------------------------------------------
// 4. POST /api/auth/2fa/confirm (Authenticated)
// --------------------------------------------------------------------------
router.post('/2fa/confirm', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        message: '6-digit verification code is required.'
      });
    }

    const userResult = await pool.query('SELECT two_factor_temp_secret FROM users WHERE id = $1', [userId]);
    const tempSecret = userResult.rows[0]?.two_factor_temp_secret;

    if (!tempSecret) {
      return res.status(400).json({
        success: false,
        message: 'No pending 2FA setup found. Please initiate setup again.'
      });
    }

    const cleanCode = code.toString().trim().replace(/\s/g, '');
    let isValid = false;

    try {
      const checkResult = otplib.verifySync({
        secret: tempSecret,
        token: cleanCode
      });
      isValid = Boolean(checkResult && checkResult.valid);
    } catch (err) {
      console.warn('TOTP check error:', err.message);
      isValid = false;
    }

    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid verification code. Please check your authenticator app and try again.'
      });
    }

    // Activate 2FA
    await pool.query(`
      UPDATE users 
      SET 
        two_factor_secret = two_factor_temp_secret, 
        two_factor_temp_secret = NULL, 
        two_factor_enabled = true 
      WHERE id = $1
    `, [userId]);

    return res.json({
      success: true,
      message: 'Two-Factor Authentication is now enabled on your account.'
    });

  } catch (error) {
    console.error('2FA confirm error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to confirm 2FA setup.'
    });
  }
});

// --------------------------------------------------------------------------
// 5. POST /api/auth/2fa/disable (Authenticated)
// --------------------------------------------------------------------------
router.post('/2fa/disable', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { password, code } = req.body;

    const user = await pool.query('SELECT password_hash, two_factor_secret FROM users WHERE id = $1', [userId]);
    if (user.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    let verified = false;
    if (password) {
      verified = await bcrypt.compare(password, user.rows[0].password_hash);
    } else if (code && user.rows[0].two_factor_secret) {
      const cleanCode = code.toString().trim().replace(/\s/g, '');
      try {
        const checkResult = otplib.verifySync({
          secret: user.rows[0].two_factor_secret,
          token: cleanCode
        });
        verified = Boolean(checkResult && checkResult.valid);
      } catch {
        verified = false;
      }
    }

    if (!verified) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid account password or authenticator code to disable 2FA.'
      });
    }

    await pool.query(`
      UPDATE users 
      SET 
        two_factor_enabled = false, 
        two_factor_secret = NULL, 
        two_factor_temp_secret = NULL 
      WHERE id = $1
    `, [userId]);

    return res.json({
      success: true,
      message: 'Two-Factor Authentication has been disabled.'
    });

  } catch (error) {
    console.error('2FA disable error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to disable 2FA.'
    });
  }
});

// --------------------------------------------------------------------------
// 6. GET /api/auth/me (Authenticated)
// --------------------------------------------------------------------------
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await getUserWithRoleAndPermissions(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User profile not found.'
      });
    }

    return res.json({
      success: true,
      user: formatUserResponse(user)
    });
  } catch (error) {
    console.error('Auth me error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve profile.'
    });
  }
});

// --------------------------------------------------------------------------
// 8. ONBOARDING & VERIFICATION ENDPOINTS
// --------------------------------------------------------------------------

// Helper to hash tokens securely with SHA-256
function hashToken(rawToken) {
  return crypto.createHash('sha256').update(String(rawToken).trim()).digest('hex');
}

// POST /api/auth/onboarding/verify-token
router.post('/onboarding/verify-token', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token || !token.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Onboarding invitation token is required.'
      });
    }

    const tokenHash = hashToken(token);

    const result = await pool.query(`
      SELECT 
        u.id,
        u.email,
        u.account_status,
        u.email_verified_at,
        u.phone_verified_at,
        u.invitation_expires_at,
        e.id AS employee_id,
        e.employee_code,
        e.first_name,
        e.last_name,
        e.phone AS employee_phone,
        d.name AS department_name,
        des.name AS designation_name
      FROM users u
      LEFT JOIN employees e ON u.employee_id = e.id
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN designations des ON e.designation_id = des.id
      WHERE u.invitation_token_hash = $1
      LIMIT 1;
    `, [tokenHash]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Invalid or unrecognized invitation link. Please request a new invitation from HR.'
      });
    }

    const user = result.rows[0];

    // Check expiration
    if (user.invitation_expires_at && new Date(user.invitation_expires_at) < new Date()) {
      return res.status(400).json({
        success: false,
        expired: true,
        message: 'This invitation link has expired. Please contact School HR to send you a fresh invitation.'
      });
    }

    // Check if already active
    if (user.account_status === 'ACTIVE') {
      return res.json({
        success: true,
        alreadyActive: true,
        message: 'This account is already activated. You can proceed to log in.',
        data: {
          account_status: 'ACTIVE'
        }
      });
    }

    return res.json({
      success: true,
      data: {
        userId: user.id,
        email: user.email,
        account_status: user.account_status || 'INVITED',
        email_verified: Boolean(user.email_verified_at),
        phone_verified: Boolean(user.phone_verified_at),
        employee: {
          id: user.employee_id,
          employee_code: user.employee_code,
          first_name: user.first_name,
          last_name: user.last_name,
          full_name: [user.first_name, user.last_name].filter(Boolean).join(' '),
          phone: user.employee_phone || '',
          department_name: user.department_name || 'Academic Wing',
          designation_name: user.designation_name || 'Faculty Member'
        }
      }
    });
  } catch (error) {
    console.error('Onboarding verify token error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to validate invitation token.'
    });
  }
});

// POST /api/auth/onboarding/verify-email
router.post('/onboarding/verify-email', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token || !token.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Invitation token is required.'
      });
    }

    const tokenHash = hashToken(token);

    const userResult = await pool.query(`
      SELECT id, account_status, invitation_expires_at 
      FROM users 
      WHERE invitation_token_hash = $1
      LIMIT 1;
    `, [tokenHash]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Invalid invitation token.'
      });
    }

    const user = userResult.rows[0];
    if (user.invitation_expires_at && new Date(user.invitation_expires_at) < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Invitation has expired. Please contact HR.'
      });
    }

    // Mark email verified
    const updateResult = await pool.query(`
      UPDATE users 
      SET 
        email_verified_at = CURRENT_TIMESTAMP,
        account_status = CASE 
          WHEN account_status = 'INVITED' THEN 'EMAIL_VERIFIED' 
          ELSE account_status 
        END,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING email_verified_at, account_status;
    `, [user.id]);

    return res.json({
      success: true,
      message: 'Email address verified successfully.',
      data: updateResult.rows[0]
    });
  } catch (error) {
    console.error('Onboarding email verify error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to verify email address.'
    });
  }
});

// POST /api/auth/onboarding/send-phone-otp
router.post('/onboarding/send-phone-otp', async (req, res) => {
  try {
    const { token, phone } = req.body;
    if (!token || !token.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Invitation token is required.'
      });
    }

    const cleanPhone = (phone || '').replace(/[^0-9+]/g, '').trim();
    if (!cleanPhone || cleanPhone.length < 10) {
      return res.status(400).json({
        success: false,
        message: 'A valid phone number with country code is required (min 10 digits).'
      });
    }

    const tokenHash = hashToken(token);
    const userResult = await pool.query(`
      SELECT id, phone_otp_last_sent_at, invitation_expires_at 
      FROM users 
      WHERE invitation_token_hash = $1
      LIMIT 1;
    `, [tokenHash]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Invalid invitation token.'
      });
    }

    const user = userResult.rows[0];
    if (user.invitation_expires_at && new Date(user.invitation_expires_at) < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Invitation has expired.'
      });
    }

    // Cooldown check (30 seconds between requests)
    if (user.phone_otp_last_sent_at) {
      const elapsedSeconds = (Date.now() - new Date(user.phone_otp_last_sent_at).getTime()) / 1000;
      if (elapsedSeconds < 30) {
        return res.status(429).json({
          success: false,
          cooldownRemaining: Math.ceil(30 - elapsedSeconds),
          message: `Please wait ${Math.ceil(30 - elapsedSeconds)}s before requesting a new OTP.`
        });
      }
    }

    // Generate secure 6-digit numeric OTP
    const rawOtp = String(crypto.randomInt(100000, 999999));
    const otpHash = hashToken(rawOtp);

    // Save hashed OTP with 10-minute expiry and reset attempts
    await pool.query(`
      UPDATE users 
      SET 
        phone_otp_hash = $1,
        phone_otp_expires_at = CURRENT_TIMESTAMP + interval '10 minutes',
        phone_otp_attempts = 0,
        phone_otp_last_sent_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2;
    `, [otpHash, user.id]);

    // Dispatch OTP via SMS service
    const smsResult = await smsService.sendOTP({ to: cleanPhone, otp: rawOtp });

    // In non-production testing, if ALLOW_DEV_OTP is enabled or provider unconfigured, pass test OTP
    const isDev = process.env.NODE_ENV !== 'production';
    const allowDevOtp = process.env.ALLOW_DEV_OTP === 'true' || isDev;

    return res.json({
      success: true,
      message: `Verification code sent to ${cleanPhone.slice(0, 3)}****${cleanPhone.slice(-4)}. Valid for 10 minutes.`,
      phone: cleanPhone,
      delivered: smsResult.delivered,
      provider: smsResult.provider,
      ...(allowDevOtp && !smsResult.delivered ? { devOtp: rawOtp } : {})
    });
  } catch (error) {
    console.error('Onboarding send OTP error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to send phone verification OTP.'
    });
  }
});

// POST /api/auth/onboarding/verify-phone-otp
router.post('/onboarding/verify-phone-otp', async (req, res) => {
  try {
    const { token, otp, phone } = req.body;
    if (!token || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Token and OTP code are required.'
      });
    }

    const cleanOtp = String(otp).trim();
    if (!/^\d{6}$/.test(cleanOtp)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid 6-digit verification code.'
      });
    }

    const tokenHash = hashToken(token);
    const userResult = await pool.query(`
      SELECT 
        id, 
        employee_id, 
        phone_otp_hash, 
        phone_otp_expires_at, 
        phone_otp_attempts,
        invitation_expires_at 
      FROM users 
      WHERE invitation_token_hash = $1
      LIMIT 1;
    `, [tokenHash]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Invalid invitation token.'
      });
    }

    const user = userResult.rows[0];

    // Check attempts limit (max 5)
    if (Number(user.phone_otp_attempts || 0) >= 5) {
      return res.status(429).json({
        success: false,
        message: 'Maximum OTP verification attempts reached. Please request a new code.'
      });
    }

    // Check expiration
    if (!user.phone_otp_expires_at || new Date(user.phone_otp_expires_at) < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Verification code has expired. Please request a new code.'
      });
    }

    // Compare hash
    const inputOtpHash = hashToken(cleanOtp);
    if (inputOtpHash !== user.phone_otp_hash) {
      await pool.query('UPDATE users SET phone_otp_attempts = phone_otp_attempts + 1 WHERE id = $1', [user.id]);
      const remaining = 4 - Number(user.phone_otp_attempts || 0);
      return res.status(400).json({
        success: false,
        message: `Invalid verification code. ${remaining > 0 ? `${remaining} attempt(s) remaining.` : 'Please request a new code.'}`
      });
    }

    // OTP matches -> verify phone and update employee phone if provided
    await pool.query(`
      UPDATE users 
      SET 
        phone_verified_at = CURRENT_TIMESTAMP,
        account_status = CASE 
          WHEN account_status IN ('INVITED', 'EMAIL_VERIFIED') THEN 'PHONE_VERIFIED' 
          ELSE account_status 
        END,
        phone_otp_hash = NULL,
        phone_otp_expires_at = NULL,
        phone_otp_attempts = 0,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1;
    `, [user.id]);

    if (phone && user.employee_id) {
      await pool.query(`
        UPDATE employees 
        SET phone = $1, updated_at = CURRENT_TIMESTAMP 
        WHERE id = $2 AND (phone IS NULL OR phone = '');
      `, [phone.trim(), user.employee_id]);
    }

    return res.json({
      success: true,
      message: 'Phone number verified successfully!'
    });
  } catch (error) {
    console.error('Onboarding verify OTP error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to verify phone OTP.'
    });
  }
});

// POST /api/auth/onboarding/complete
router.post('/onboarding/complete', async (req, res) => {
  try {
    const { token, password, confirmPassword } = req.body;
    if (!token || !password) {
      return res.status(400).json({
        success: false,
        message: 'Token and new password are required.'
      });
    }

    if (confirmPassword && password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Password confirmation does not match.'
      });
    }

    // Password strength rules: min 8 chars, 1 uppercase, 1 lowercase, 1 number or symbol
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long.'
      });
    }
    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
      return res.status(400).json({
        success: false,
        message: 'Password must contain at least one uppercase letter, one lowercase letter, and one number or special character.'
      });
    }

    const tokenHash = hashToken(token);
    const userResult = await pool.query(`
      SELECT 
        id, 
        email, 
        account_status, 
        email_verified_at, 
        phone_verified_at, 
        invitation_expires_at 
      FROM users 
      WHERE invitation_token_hash = $1
      LIMIT 1;
    `, [tokenHash]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Invalid or expired invitation token.'
      });
    }

    const user = userResult.rows[0];

    // Check verification prerequisites
    if (!user.email_verified_at) {
      return res.status(400).json({
        success: false,
        message: 'Please complete email verification before setting your password.'
      });
    }
    if (!user.phone_verified_at) {
      return res.status(400).json({
        success: false,
        message: 'Please complete phone verification before setting your password.'
      });
    }

    // Hash password with bcrypt
    const passwordHash = await bcrypt.hash(password, 10);

    // Activate account and clear single-use invitation tokens
    await pool.query(`
      UPDATE users 
      SET 
        password_hash = $1,
        is_active = true,
        account_status = 'ACTIVE',
        invitation_token_hash = NULL,
        invitation_expires_at = NULL,
        phone_otp_hash = NULL,
        phone_otp_expires_at = NULL,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2;
    `, [passwordHash, user.id]);

    return res.json({
      success: true,
      message: 'Account activated successfully! You can now log in with your credentials.',
      email: user.email
    });
  } catch (error) {
    console.error('Onboarding complete error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to complete onboarding and activate account.'
    });
  }
});

// --------------------------------------------------------------------------
// 9. HR/ADMIN INVITATION MANAGEMENT ENDPOINTS
// --------------------------------------------------------------------------

// POST /api/auth/invitation/send
router.post('/invitation/send', authenticateToken, requirePermission('employees:create'), async (req, res) => {
  try {
    const { employee_id } = req.body;
    if (!employee_id) {
      return res.status(400).json({
        success: false,
        message: 'employee_id is required.'
      });
    }

    // Fetch employee details
    const empResult = await pool.query(`
      SELECT id, employee_code, first_name, last_name, work_email, personal_email, phone 
      FROM employees 
      WHERE id = $1;
    `, [employee_id]);

    if (empResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Employee record not found.'
      });
    }

    const emp = empResult.rows[0];
    const email = (emp.work_email || emp.personal_email || '').trim();
    if (!email) {
      return res.status(400).json({
        success: false,
        message: `Employee "${emp.first_name} ${emp.last_name || ''}" does not have an email address configured. Please add an email first.`
      });
    }

    // Default to Employee role
    const roleResult = await pool.query(`SELECT id FROM hr_roles WHERE name = 'Employee' LIMIT 1;`);
    const defaultRoleId = roleResult.rows[0]?.id || 'e1e81770-815b-4f56-a3fa-372167696c85';

    // Generate secure crypto invitation token (32 bytes = 64 hex chars)
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours

    // Check if user record already exists for this employee
    const existingUser = await pool.query(`SELECT id, account_status FROM users WHERE employee_id = $1 OR LOWER(email) = LOWER($2);`, [emp.id, email]);

    let userId;
    if (existingUser.rows.length > 0) {
      const u = existingUser.rows[0];
      userId = u.id;
      if (u.account_status === 'ACTIVE') {
        return res.status(400).json({
          success: false,
          message: 'This employee already has an active account. Use password reset if needed.'
        });
      }

      await pool.query(`
        UPDATE users 
        SET 
          invitation_token_hash = $1,
          invitation_expires_at = $2,
          account_status = 'INVITED',
          is_active = false,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $3;
      `, [tokenHash, expiresAt, userId]);
    } else {
      const insertUser = await pool.query(`
        INSERT INTO users (
          employee_id, role_id, email, password_hash, is_active, 
          account_status, invitation_token_hash, invitation_expires_at, created_at, updated_at
        )
        VALUES ($1, $2, $3, NULL, false, 'INVITED', $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING id;
      `, [emp.id, defaultRoleId, email, tokenHash, expiresAt]);
      userId = insertUser.rows[0].id;
    }

    // Dispatch invitation email
    const emailResult = await emailService.sendInvitation({
      to: email,
      name: `${emp.first_name} ${emp.last_name || ''}`.trim(),
      employeeCode: emp.employee_code,
      rawToken,
      expiresAt
    });

    return res.json({
      success: true,
      message: `Account invitation generated for ${emp.first_name} (${email}).`,
      data: {
        userId,
        account_status: 'INVITED',
        delivered: emailResult.delivered,
        provider: emailResult.provider,
        inviteUrl: emailResult.inviteUrl,
        expiresAt
      }
    });
  } catch (error) {
    console.error('Send invitation error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to send account invitation.'
    });
  }
});

// POST /api/auth/invitation/resend
router.post('/invitation/resend', authenticateToken, requirePermission('employees:create'), async (req, res) => {
  try {
    const { employee_id } = req.body;
    if (!employee_id) {
      return res.status(400).json({
        success: false,
        message: 'employee_id is required.'
      });
    }

    const userResult = await pool.query(`
      SELECT 
        u.id, 
        u.email, 
        u.account_status, 
        u.updated_at,
        e.employee_code,
        e.first_name,
        e.last_name
      FROM users u
      JOIN employees e ON u.employee_id = e.id
      WHERE u.employee_id = $1
      LIMIT 1;
    `, [employee_id]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No user account found for this employee. Please use Send Invitation first.'
      });
    }

    const user = userResult.rows[0];
    if (user.account_status === 'ACTIVE') {
      return res.status(400).json({
        success: false,
        message: 'Employee account is already activated.'
      });
    }

    // Cooldown check: 45s between resends
    if (user.updated_at) {
      const elapsed = (Date.now() - new Date(user.updated_at).getTime()) / 1000;
      if (elapsed < 45) {
        return res.status(429).json({
          success: false,
          message: `Please wait ${Math.ceil(45 - elapsed)}s before resending the invitation.`
        });
      }
    }

    // Generate fresh token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

    await pool.query(`
      UPDATE users 
      SET 
        invitation_token_hash = $1,
        invitation_expires_at = $2,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $3;
    `, [tokenHash, expiresAt, user.id]);

    const emailResult = await emailService.sendInvitation({
      to: user.email,
      name: `${user.first_name} ${user.last_name || ''}`.trim(),
      employeeCode: user.employee_code,
      rawToken,
      expiresAt
    });

    return res.json({
      success: true,
      message: `Invitation resent successfully to ${user.email}.`,
      data: {
        delivered: emailResult.delivered,
        provider: emailResult.provider,
        inviteUrl: emailResult.inviteUrl,
        expiresAt
      }
    });
  } catch (error) {
    console.error('Resend invitation error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to resend invitation.'
    });
  }
});

module.exports = router;
