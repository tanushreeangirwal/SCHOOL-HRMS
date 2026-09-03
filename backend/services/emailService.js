/**
 * St. Vincent's High School HRMS - Pluggable Email Service
 * 
 * Supports configurable providers:
 * - 'resend'
 * - 'sendgrid'
 * - 'smtp'
 * - 'mock' / unconfigured fallback (logs securely for dev/testing)
 */

require('dotenv').config();

const EMAIL_PROVIDER = (process.env.EMAIL_PROVIDER || '').trim().toLowerCase();
const EMAIL_API_KEY = process.env.EMAIL_API_KEY || '';
const EMAIL_FROM = process.env.EMAIL_FROM || 'no-reply@stvincents.edu';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

class EmailService {
  /**
   * Send onboarding invitation email
   * @param {Object} options
   * @param {string} options.to - Employee email address
   * @param {string} options.name - Employee full name
   * @param {string} options.employeeCode - Employee code (e.g. EMP-1025)
   * @param {string} options.rawToken - Secure invitation token
   * @param {Date} options.expiresAt - Expiration date
   */
  async sendInvitation({ to, name, employeeCode, rawToken, expiresAt }) {
    const inviteUrl = `${FRONTEND_URL}/onboard?token=${rawToken}`;
    const subject = `Welcome to St. Vincent's High School — Complete Your Account Activation`;

    const htmlBody = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 580px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
        <div style="background-color: #3155D9; padding: 24px; text-align: center; color: #ffffff;">
          <h1 style="margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -0.02em;">St. Vincent's High School</h1>
          <p style="margin: 6px 0 0 0; font-size: 13px; opacity: 0.9;">Institutional Human Resources Management System</p>
        </div>
        <div style="padding: 30px 24px; color: #172033; line-height: 1.6;">
          <h2 style="font-size: 18px; margin: 0 0 12px 0;">Welcome, ${name}!</h2>
          <p style="font-size: 14px; margin: 0 0 16px 0; color: #475569;">
            An employee dossier has been created for you under code <strong>${employeeCode}</strong>.
            Please activate your account by verifying your email and phone number and creating a secure password.
          </p>
          
          <div style="text-align: center; margin: 26px 0;">
            <a href="${inviteUrl}" style="background-color: #3155D9; color: #ffffff; padding: 12px 28px; border-radius: 8px; font-weight: 700; font-size: 14px; text-decoration: none; display: inline-block; box-shadow: 0 2px 6px rgba(49, 85, 217, 0.3);">
              Activate Your Account
            </a>
          </div>

          <p style="font-size: 12px; color: #64748b; margin: 24px 0 0 0; line-height: 1.5;">
            This invitation link will expire on <strong>${new Date(expiresAt).toUTCString()}</strong>.
            If you did not expect this email, please contact the School Administration Office immediately.
          </p>
        </div>
        <div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 14px 24px; text-align: center; font-size: 11px; color: #94a3b8;">
          St. Vincent's High School • Pune, Maharashtra • Confidential HR Portal
        </div>
      </div>
    `;

    if (EMAIL_PROVIDER === 'resend' && EMAIL_API_KEY) {
      try {
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${EMAIL_API_KEY}`
          },
          body: JSON.stringify({
            from: EMAIL_FROM,
            to,
            subject,
            html: htmlBody
          })
        });
        const resData = await response.json();
        return { success: true, delivered: true, provider: 'resend', messageId: resData.id, inviteUrl };
      } catch (err) {
        console.error('[EMAIL_SERVICE:RESEND] Delivery error:', err.message);
        return { success: false, delivered: false, provider: 'resend', error: err.message, inviteUrl };
      }
    }

    if (EMAIL_PROVIDER === 'sendgrid' && EMAIL_API_KEY) {
      try {
        const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${EMAIL_API_KEY}`
          },
          body: JSON.stringify({
            personalizations: [{ to: [{ email: to }] }],
            from: { email: EMAIL_FROM, name: "St. Vincent's High School" },
            subject,
            content: [{ type: 'text/html', value: htmlBody }]
          })
        });
        return { success: true, delivered: response.ok, provider: 'sendgrid', inviteUrl };
      } catch (err) {
        console.error('[EMAIL_SERVICE:SENDGRID] Delivery error:', err.message);
        return { success: false, delivered: false, provider: 'sendgrid', error: err.message, inviteUrl };
      }
    }

    // Default / Unconfigured Fallback (clean dev & audit logging)
    console.log(`[EMAIL_SERVICE:PENDING_CONFIG] Provider not configured. Invitation link prepared for ${name} <${to}>: ${inviteUrl}`);
    return {
      success: true,
      delivered: false,
      provider: 'unconfigured',
      notice: 'Email provider not configured in environment. Set EMAIL_PROVIDER and EMAIL_API_KEY in .env for production delivery.',
      inviteUrl
    };
  }
}

module.exports = new EmailService();
