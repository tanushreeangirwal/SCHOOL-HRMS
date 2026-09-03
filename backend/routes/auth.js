const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const otplib = require('otplib');
const qrcode = require('qrcode');
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');
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

    // Check account status
    if (!basicUser.is_active) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated. Please contact an administrator.'
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
// 7. POST /api/auth/logout
// --------------------------------------------------------------------------
router.post('/logout', (req, res) => {
  return res.json({
    success: true,
    message: 'Logged out successfully.'
  });
});

module.exports = router;
