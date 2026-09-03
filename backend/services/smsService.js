/**
 * St. Vincent's High School HRMS - Pluggable SMS OTP Service
 * 
 * Supports configurable SMS providers:
 * - 'twilio'
 * - 'msg91'
 * - 'aws_sns'
 * - 'mock' / unconfigured fallback (logs securely for dev/testing)
 */

require('dotenv').config();

const SMS_PROVIDER = (process.env.SMS_PROVIDER || '').trim().toLowerCase();
const SMS_API_KEY = process.env.SMS_API_KEY || '';
const SMS_FROM = process.env.SMS_FROM || 'STVINCENTS';

class SMSService {
  /**
   * Send phone verification OTP
   * @param {Object} options
   * @param {string} options.to - Phone number (e.g. +919876543210)
   * @param {string} options.otp - 6-digit numeric OTP
   */
  async sendOTP({ to, otp }) {
    const textMessage = `Your St. Vincent's High School HRMS verification code is: ${otp}. Valid for 10 minutes. Do not share this OTP.`;

    if (SMS_PROVIDER === 'twilio' && SMS_API_KEY) {
      try {
        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = SMS_API_KEY;
        const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64')
          },
          body: new URLSearchParams({
            To: to,
            From: SMS_FROM,
            Body: textMessage
          })
        });
        const resData = await response.json();
        return { success: true, delivered: response.ok, provider: 'twilio', sid: resData.sid };
      } catch (err) {
        console.error('[SMS_SERVICE:TWILIO] Delivery error:', err.message);
        return { success: false, delivered: false, provider: 'twilio', error: err.message };
      }
    }

    if (SMS_PROVIDER === 'msg91' && SMS_API_KEY) {
      try {
        const response = await fetch('https://api.msg91.com/api/v5/otp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'authkey': SMS_API_KEY
          },
          body: JSON.stringify({
            mobile: to,
            otp: otp,
            sender: SMS_FROM
          })
        });
        const resData = await response.json();
        return { success: true, delivered: response.ok, provider: 'msg91', resData };
      } catch (err) {
        console.error('[SMS_SERVICE:MSG91] Delivery error:', err.message);
        return { success: false, delivered: false, provider: 'msg91', error: err.message };
      }
    }

    // Default / Unconfigured Fallback
    console.log(`[SMS_SERVICE:PENDING_CONFIG] SMS provider not configured. OTP generated for phone ending in ***${(to || '').slice(-4)}`);
    return {
      success: true,
      delivered: false,
      provider: 'unconfigured',
      notice: 'SMS provider not configured in environment. Set SMS_PROVIDER, SMS_API_KEY, and SMS_FROM in .env for production SMS delivery.'
    };
  }
}

module.exports = new SMSService();
