require('dotenv').config();

const isProduction = (process.env.NODE_ENV || '').toLowerCase() === 'production';

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (isProduction) {
      console.error('[FATAL SECURITY ERROR] JWT_SECRET environment variable is required in production.');
      process.exit(1);
    }
    return 'school_hrms_jwt_fallback_secret_key';
  }
  return secret;
}

const JWT_SECRET = getJwtSecret();
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

module.exports = {
  getJwtSecret,
  JWT_SECRET,
  JWT_EXPIRES_IN
};
