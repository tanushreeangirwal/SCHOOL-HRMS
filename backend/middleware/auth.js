const jwt = require('jsonwebtoken');
const pool = require('../db');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'school_hrms_jwt_fallback_secret_key';

/**
 * Authentication Middleware:
 * Validates the JWT Bearer token and attaches the authenticated user, role, and permissions to req.user.
 */
async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : null;

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Authentication token is required. Please log in.'
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    // Fetch fresh user data along with their assigned role and permissions
    const userResult = await pool.query(`
      SELECT 
        u.id,
        u.email,
        u.is_active,
        u.two_factor_enabled,
        u.employee_id,
        u.role_id,
        r.name AS role_name,
        e.employee_code,
        e.first_name,
        e.last_name,
        e.employment_status,
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
      GROUP BY u.id, r.name, e.employee_code, e.first_name, e.last_name, e.employment_status;
    `, [decoded.userId]);

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'User account no longer exists or token is invalid.'
      });
    }

    const user = userResult.rows[0];

    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated. Please contact an administrator.'
      });
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role_name,
      role_id: user.role_id,
      employee_id: user.employee_id,
      employee_code: user.employee_code,
      first_name: user.first_name,
      last_name: user.last_name,
      employment_status: user.employment_status,
      two_factor_enabled: user.two_factor_enabled,
      permissions: Array.isArray(user.permissions) ? user.permissions : []
    };

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Your session has expired. Please log in again.',
        expired: true
      });
    }
    return res.status(403).json({
      success: false,
      message: 'Invalid or corrupted authentication token.'
    });
  }
}

/**
 * Role Hierarchy Definition & Helpers
 */
const ROLE_RANKS = {
  'super admin': 4,
  'administrator': 3,
  'admin': 3,
  'hr': 2,
  'manager': 2,
  'employee': 1
};

/**
 * Role-Based Access Control Middleware:
 * Ensures the authenticated user has one of the specified roles or higher hierarchical authority.
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
    }

    const normalizedAllowed = allowedRoles.map(r => r.toLowerCase().trim());
    const userRole = (req.user.role || '').toLowerCase().trim();

    // Super Admin has universal access
    if (userRole === 'super admin') {
      return next();
    }

    // Direct match check
    if (normalizedAllowed.includes(userRole)) {
      return next();
    }

    // Administrator has operational access unless Super Admin is specifically required
    if ((userRole === 'administrator' || userRole === 'admin') && !normalizedAllowed.includes('super admin')) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: `Access denied. Requires one of the following roles: ${allowedRoles.join(', ')}.`
    });
  };
}

/**
 * Super Admin-Only Middleware:
 * Strict barrier allowing only Super Admin (Principal) access.
 */
function requireSuperAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required.'
    });
  }

  const userRole = (req.user.role || '').toLowerCase().trim();
  if (userRole !== 'super admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. This action requires Super Admin (Principal) executive privileges.'
    });
  }

  next();
}

/**
 * Permission-Based Access Control Middleware:
 * Ensures the authenticated user possesses all specified permissions.
 */
function requirePermission(...requiredPermissions) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
    }

    const userRole = (req.user.role || '').toLowerCase().trim();

    // Super Admin bypasses all granular permission checks
    if (userRole === 'super admin') {
      return next();
    }

    // Administrators bypass general operational permissions, but NOT Super Admin exclusive permissions
    if (userRole === 'administrator' || userRole === 'admin') {
      const superAdminOnlyPerms = ['roles:manage_superadmin', 'system:governance'];
      const hasSuperAdminPermReq = requiredPermissions.some(p => superAdminOnlyPerms.includes(p));
      if (!hasSuperAdminPermReq) {
        return next();
      }
    }

    const userPerms = req.user.permissions || [];
    const hasAll = requiredPermissions.every(p => userPerms.includes(p));

    if (!hasAll) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Missing required permission: ${requiredPermissions.join(', ')}.`
      });
    }

    next();
  };
}

module.exports = {
  authenticateToken,
  requireRole,
  requireSuperAdmin,
  requirePermission
};

