import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2, 
  AlertCircle, 
  Mail, 
  Phone, 
  Lock, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  ShieldCheck, 
  Loader2, 
  UserCheck, 
  Building2,
  Calendar,
  Sparkles,
  KeyRound,
  Check
} from 'lucide-react';
import StVincentsLogo from '../common/StVincentsLogo';
import { hrmsApi } from '../../services/api';

export function OnboardingWizard({ token, onComplete }) {
  // Step: 1 = Welcome, 2 = Verify Email, 3 = Verify Phone, 4 = Password, 5 = Success
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Employee details from token
  const [employeeData, setEmployeeData] = useState(null);

  // Form states
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Password states
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Step 1: Validate Token on mount
  useEffect(() => {
    async function validateToken() {
      if (!token) {
        setError('No invitation token was provided in the URL. Please use the link sent to your email.');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const res = await hrmsApi.verifyOnboardingToken(token);
        if (res && res.success) {
          if (res.alreadyActive) {
            setStep(5);
            setSuccessMsg('Your account is already active. You can proceed directly to log in.');
          } else {
            setEmployeeData(res.data);
            setPhone(res.data.employee?.phone || '');

            // Fast-forward step if parts already verified
            if (res.data.phone_verified && res.data.email_verified) {
              setStep(4);
            } else if (res.data.email_verified) {
              setStep(3);
            } else {
              setStep(1);
            }
          }
        } else {
          throw new Error(res?.message || 'Invalid or expired invitation link.');
        }
      } catch (err) {
        console.error('Token validation error:', err);
        setError(err.message || 'This invitation link is invalid or has expired. Please contact School HR.');
      } finally {
        setLoading(false);
      }
    }

    validateToken();
  }, [token]);

  // Resend OTP Cooldown Timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Handle Step 2: Email Verification
  const handleVerifyEmail = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await hrmsApi.verifyOnboardingEmail(token);
      if (res && res.success) {
        setStep(3);
      } else {
        throw new Error(res?.message || 'Failed to verify email address.');
      }
    } catch (err) {
      setError(err.message || 'Unable to verify email address.');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Step 3: Send Phone OTP
  const handleSendPhoneOtp = async () => {
    if (!phone || phone.replace(/[^0-9]/g, '').length < 10) {
      setError('Please provide a valid phone number (minimum 10 digits).');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await hrmsApi.sendOnboardingPhoneOtp(token, phone);
      if (res && res.success) {
        setOtpSent(true);
        setResendCooldown(30);
        setSuccessMsg(res.message);
        setTimeout(() => setSuccessMsg(null), 6000);
      } else {
        throw new Error(res?.message || 'Failed to send verification code.');
      }
    } catch (err) {
      setError(err.message || 'Unable to dispatch OTP. Please check your number.');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Step 3: Verify Phone OTP
  const handleVerifyPhoneOtp = async () => {
    if (!otp || otp.trim().length !== 6) {
      setError('Please enter the 6-digit verification code sent to your phone.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await hrmsApi.verifyOnboardingPhoneOtp(token, otp.trim(), phone);
      if (res && res.success) {
        setStep(4);
      } else {
        throw new Error(res?.message || 'Invalid verification code.');
      }
    } catch (err) {
      setError(err.message || 'OTP verification failed.');
    } finally {
      setSubmitting(false);
    }
  };

  // Password Strength Calculation
  const hasLength = password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumberOrSpecial = /[0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password);
  const passwordsMatch = password && password === confirmPassword;

  const strengthScore = [hasLength, hasUpper, hasLower, hasNumberOrSpecial].filter(Boolean).length;
  const isPasswordValid = hasLength && hasUpper && hasLower && hasNumberOrSpecial && passwordsMatch;

  // Handle Step 4: Complete Onboarding & Set Password
  const handleCompleteOnboarding = async (e) => {
    e.preventDefault();
    if (!isPasswordValid) {
      setError('Please satisfy all password security requirements.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await hrmsApi.completeOnboarding(token, password, confirmPassword);
      if (res && res.success) {
        setStep(5);
      } else {
        throw new Error(res?.message || 'Failed to activate account.');
      }
    } catch (err) {
      setError(err.message || 'Unable to set password. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Loading Screen
  if (loading) {
    return (
      <div className="onboarding-page-wrapper">
        <div className="onboarding-card" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <Loader2 size={36} className="spin-anim text-primary" style={{ margin: '0 auto 16px' }} />
          <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#172033', margin: 0 }}>
            Validating St. Vincent's Invitation
          </h2>
          <p style={{ fontSize: '0.84rem', color: '#64748b', marginTop: '6px' }}>
            Connecting to secure institutional directory...
          </p>
        </div>
      </div>
    );
  }

  // Error Screen (Invalid/Expired token)
  if (error && !employeeData && step !== 5) {
    return (
      <div className="onboarding-page-wrapper">
        <div className="onboarding-card" style={{ textAlign: 'center', padding: '40px 24px' }}>
          <div style={{ width: '52px', height: '52px', borderRadius: '50%', backgroundColor: '#fee2e2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <AlertCircle size={28} />
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#172033', margin: '0 0 8px 0' }}>
            Invitation Link Not Valid
          </h2>
          <p style={{ fontSize: '0.88rem', color: '#64748b', margin: '0 0 24px 0', lineHeight: 1.5 }}>
            {error}
          </p>
          <a
            href="/"
            className="btn btn-primary"
            style={{ width: '100%', minHeight: '44px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}
          >
            Go to HRMS Sign In
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="onboarding-page-wrapper">
      {/* Container */}
      <div className="onboarding-card">
        
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ display: 'inline-flex', justifyContent: 'center', marginBottom: '8px' }}>
            <StVincentsLogo size={42} />
          </div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#172033', margin: '4px 0 2px 0', letterSpacing: '-0.02em' }}>
            St. Vincent's High School
          </h1>
          <p style={{ fontSize: '0.78rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, margin: 0 }}>
            Account Onboarding & Verification
          </p>
        </div>

        {/* Wizard Step Progress Indicator */}
        {step < 5 && (
          <div className="onboarding-steps-bar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', position: 'relative' }}>
            {[
              { num: 1, label: 'Welcome' },
              { num: 2, label: 'Email' },
              { num: 3, label: 'Phone' },
              { num: 4, label: 'Password' }
            ].map(s => {
              const isDone = step > s.num;
              const isCurrent = step === s.num;
              return (
                <div key={s.num} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, zIndex: 1 }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    backgroundColor: isDone ? '#10b981' : isCurrent ? '#3155D9' : '#e2e8f0',
                    color: isDone || isCurrent ? '#ffffff' : '#64748b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    transition: 'all 0.2s ease'
                  }}>
                    {isDone ? <Check size={16} /> : s.num}
                  </div>
                  <span style={{ fontSize: '0.68rem', fontWeight: 700, color: isCurrent ? '#3155D9' : '#64748b', marginTop: '4px' }}>
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Global Notifications */}
        {error && (
          <div className="assign-alert-error" style={{ marginBottom: '16px' }}>
            <AlertCircle size={16} className="alert-icon" />
            <div className="alert-text">{error}</div>
          </div>
        )}

        {successMsg && (
          <div className="assign-alert-success" style={{ marginBottom: '16px' }}>
            <CheckCircle2 size={16} className="alert-icon" />
            <div className="alert-text">{successMsg}</div>
          </div>
        )}

        {/* ================================================================= */}
        {/* STEP 1: WELCOME & DOSSIER CONFIRMATION                            */}
        {/* ================================================================= */}
        {step === 1 && (
          <div>
            <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '18px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span className="code-badge">{employeeData?.employee?.employee_code || 'EMP-ROSTER'}</span>
                <span className="status-pill status-active" style={{ fontSize: '0.72rem' }}>
                  {employeeData?.employee?.designation_name}
                </span>
              </div>

              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#172033', margin: '0 0 4px 0' }}>
                {employeeData?.employee?.full_name}
              </h3>
              <p style={{ fontSize: '0.84rem', color: '#64748b', margin: 0 }}>
                {employeeData?.employee?.department_name} • Faculty Dossier
              </p>
            </div>

            <p style={{ fontSize: '0.86rem', color: '#475569', lineHeight: 1.5, marginBottom: '24px' }}>
              Welcome to St. Vincent's High School! Please complete the quick 2-minute identity verification to activate your employee self-service portal.
            </p>

            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setStep(2)}
              style={{ width: '100%', minHeight: '46px', fontSize: '0.95rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              <span>Begin Verification</span>
              <ArrowRight size={16} />
            </button>
          </div>
        )}

        {/* ================================================================= */}
        {/* STEP 2: EMAIL VERIFICATION                                        */}
        {/* ================================================================= */}
        {step === 2 && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: '#eef2ff', color: '#3155D9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                <Mail size={24} />
              </div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#172033', margin: '0 0 6px 0' }}>
                Verify Your Email Address
              </h2>
              <p style={{ fontSize: '0.84rem', color: '#64748b', margin: 0 }}>
                Confirming that you have access to your registered school email.
              </p>
            </div>

            <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px', marginBottom: '20px', textAlign: 'center' }}>
              <span style={{ fontSize: '0.74rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Institutional Email</span>
              <div style={{ fontSize: '1rem', fontWeight: 800, color: '#172033', marginTop: '2px' }}>
                {employeeData?.email}
              </div>
            </div>

            <button
              type="button"
              className="btn btn-primary"
              onClick={handleVerifyEmail}
              disabled={submitting}
              style={{ width: '100%', minHeight: '46px', fontSize: '0.95rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              {submitting ? (
                <>
                  <Loader2 size={16} className="spin-anim" />
                  <span>Verifying Email...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={16} />
                  <span>Confirm Email & Continue</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* ================================================================= */}
        {/* STEP 3: PHONE VERIFICATION (SMS OTP)                              */}
        {/* ================================================================= */}
        {step === 3 && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: '#ecfdf5', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                <Phone size={24} />
              </div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#172033', margin: '0 0 6px 0' }}>
                Verify Phone Number
              </h2>
              <p style={{ fontSize: '0.84rem', color: '#64748b', margin: 0 }}>
                We'll send a 6-digit OTP to verify your contact number.
              </p>
            </div>

            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#172033', marginBottom: '6px' }}>
                Mobile Phone Number
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="tel"
                  className="form-input"
                  placeholder="+919876543210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={submitting || (otpSent && resendCooldown > 0)}
                  style={{ flex: 1, minHeight: '44px', fontSize: '0.92rem' }}
                />
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleSendPhoneOtp}
                  disabled={submitting || resendCooldown > 0}
                  style={{ minHeight: '44px', minWidth: '100px', fontSize: '0.82rem', fontWeight: 700 }}
                >
                  {resendCooldown > 0 ? `${resendCooldown}s` : otpSent ? 'Resend' : 'Send OTP'}
                </button>
              </div>
            </div>

            {otpSent && (
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#172033', marginBottom: '6px' }}>
                  Enter 6-Digit Code
                </label>
                <input
                  type="text"
                  maxLength={6}
                  className="form-input"
                  placeholder="• • • • • •"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ''))}
                  disabled={submitting}
                  style={{
                    minHeight: '48px',
                    fontSize: '1.25rem',
                    textAlign: 'center',
                    letterSpacing: '0.3em',
                    fontWeight: 800,
                    fontFamily: 'monospace'
                  }}
                />
                <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '6px', textAlign: 'center' }}>
                  Valid for 10 minutes.
                </p>

                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleVerifyPhoneOtp}
                  disabled={submitting || otp.length !== 6}
                  style={{ width: '100%', minHeight: '46px', marginTop: '14px', fontSize: '0.95rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                >
                  {submitting ? (
                    <>
                      <Loader2 size={16} className="spin-anim" />
                      <span>Verifying OTP...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={16} />
                      <span>Verify & Continue</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* STEP 4: PASSWORD CREATION                                         */}
        {/* ================================================================= */}
        {step === 4 && (
          <form onSubmit={handleCompleteOnboarding}>
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: '#fef3c7', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                <KeyRound size={24} />
              </div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#172033', margin: '0 0 6px 0' }}>
                Create Your Password
              </h2>
              <p style={{ fontSize: '0.84rem', color: '#64748b', margin: 0 }}>
                Set a strong password to secure your institutional portal account.
              </p>
            </div>

            {/* Password input */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#172033', marginBottom: '6px' }}>
                New Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="form-input"
                  placeholder="Min 8 chars, mixed case & numbers"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ minHeight: '44px', paddingRight: '42px', fontSize: '0.92rem' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '6px' }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Confirm password input */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#172033', marginBottom: '6px' }}>
                Confirm Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  className="form-input"
                  placeholder="Re-enter your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  style={{ minHeight: '44px', paddingRight: '42px', fontSize: '0.92rem' }}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '6px' }}
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Password Strength Meter */}
            <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
                {[1, 2, 3, 4].map(idx => (
                  <div
                    key={idx}
                    style={{
                      flex: 1,
                      height: '4px',
                      borderRadius: '2px',
                      backgroundColor: idx <= strengthScore 
                        ? (strengthScore <= 2 ? '#f59e0b' : strengthScore === 3 ? '#3b82f6' : '#10b981')
                        : '#e2e8f0'
                    }}
                  />
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', fontSize: '0.72rem', color: '#64748b' }}>
                <span style={{ color: hasLength ? '#10b981' : '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {hasLength ? '✓' : '•'} At least 8 characters
                </span>
                <span style={{ color: hasUpper ? '#10b981' : '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {hasUpper ? '✓' : '•'} Uppercase letter
                </span>
                <span style={{ color: hasLower ? '#10b981' : '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {hasLower ? '✓' : '•'} Lowercase letter
                </span>
                <span style={{ color: hasNumberOrSpecial ? '#10b981' : '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {hasNumberOrSpecial ? '✓' : '•'} Number or symbol
                </span>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting || !isPasswordValid}
              style={{ width: '100%', minHeight: '46px', fontSize: '0.95rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              {submitting ? (
                <>
                  <Loader2 size={16} className="spin-anim" />
                  <span>Activating Account...</span>
                </>
              ) : (
                <>
                  <ShieldCheck size={16} />
                  <span>Create Account & Activate</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* ================================================================= */}
        {/* STEP 5: SUCCESS & DIRECT LOGIN                                    */}
        {/* ================================================================= */}
        {step === 5 && (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <CheckCircle2 size={32} />
            </div>

            <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#172033', margin: '0 0 6px 0' }}>
              Your Account is Active!
            </h2>
            <p style={{ fontSize: '0.86rem', color: '#64748b', lineHeight: 1.5, margin: '0 0 24px 0' }}>
              Verification complete. You can now sign in to mark attendance, apply for leaves, and view your payslips.
            </p>

            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                if (onComplete) onComplete();
                else window.location.href = '/';
              }}
              style={{ width: '100%', minHeight: '46px', fontSize: '0.95rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              <span>Sign In to Portal</span>
              <ArrowRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default OnboardingWizard;
