import React, { useState } from 'react';
import { 
  Lock, 
  Mail, 
  ShieldCheck, 
  ArrowRight, 
  Loader2, 
  AlertCircle, 
  Eye, 
  EyeOff, 
  KeyRound,
  ArrowLeft,
  Users,
  CheckCircle2
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import StVincentsLogo from '../common/StVincentsLogo';

export function LoginView({ onLoginSuccess }) {
  const { login, verify2FA } = useAuth();

  // Form State
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  // 2FA Verification State
  const [is2FAStage, setIs2FAStage] = useState(false);
  const [tempToken, setTempToken] = useState(null);
  const [totpCode, setTotpCode] = useState('');

  // Submit Step 1: Username/Password
  const handleCredentialSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!identifier.trim() || !password) {
      setErrorMessage('Please enter your school email and password.');
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await login(identifier.trim(), password);
      if (result.require2fa) {
        setTempToken(result.tempToken);
        setIs2FAStage(true);
      } else {
        if (onLoginSuccess) onLoginSuccess(result.user);
      }
    } catch (err) {
      console.error('Login submission error:', err);
      setErrorMessage(err.message || 'Invalid email/password or backend server is unavailable.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Step 2: 2FA 6-digit Code
  const handle2FASubmit = async (e) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanCode = totpCode.trim();
    if (!cleanCode || cleanCode.length < 6) {
      setErrorMessage('Please enter the full 6-digit verification code.');
      return;
    }

    setIsSubmitting(true);

    try {
      const user = await verify2FA(tempToken, cleanCode);
      if (onLoginSuccess) onLoginSuccess(user);
    } catch (err) {
      console.error('2FA verification error:', err);
      setErrorMessage(err.message || 'Invalid 2FA verification code.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-screen-wrapper">
      <div className="login-container">
        {/* Top Institutional Branding Header */}
        <div className="login-brand-header">
          <StVincentsLogo 
            variant="full" 
            size="xl" 
            title="St. Vincent's High School"
            subtitle="Human Resource Management System" 
            theme="light"
          />
        </div>

        {/* Main Sign-In Card */}
        <div className="login-card">
          {/* Error Alert */}
          {errorMessage && (
            <div className="login-error-alert" role="alert">
              <AlertCircle size={18} className="alert-icon" />
              <span className="alert-text">{errorMessage}</span>
            </div>
          )}

          {/* STAGE 1: Standard Credentials */}
          {!is2FAStage ? (
            <form onSubmit={handleCredentialSubmit} className="login-form">
              <div className="login-form-header">
                <h2 className="login-form-title">Staff Portal Sign In</h2>
                <p className="login-form-subtitle">Enter your institutional credentials to access your account</p>
              </div>

              {/* Email / Username Input */}
              <div className="login-field-group">
                <label className="login-field-label" htmlFor="login-identifier">
                  School Email / Employee Code
                </label>
                <div className="login-input-wrapper">
                  <Mail className="login-input-icon" size={17} />
                  <input
                    type="text"
                    id="login-identifier"
                    className="login-input-control"
                    placeholder="e.g. admin@school.edu or EMP-1001"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    required
                    autoFocus
                    autoComplete="username"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="login-field-group">
                <div className="login-field-header">
                  <label className="login-field-label" htmlFor="login-password">
                    Password
                  </label>
                </div>
                <div className="login-input-wrapper">
                  <Lock className="login-input-icon" size={17} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="login-password"
                    className="login-input-control"
                    placeholder="Enter account password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="login-password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    title={showPassword ? 'Hide password' : 'Show password'}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                className="btn-login-action"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={18} className="spin-animation" />
                    <span>Verifying Credentials...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In to Portal</span>
                    <ArrowRight size={17} />
                  </>
                )}
              </button>
            </form>
          ) : (
            /* STAGE 2: 2FA Code Input */
            <form onSubmit={handle2FASubmit} className="login-form">
              <div className="login-form-header">
                <div className="two-factor-icon-badge">
                  <ShieldCheck size={28} />
                </div>
                <h2 className="login-form-title">Two-Factor Authentication</h2>
                <p className="login-form-subtitle">
                  Enter the 6-digit verification code from your authenticator app.
                </p>
              </div>

              <div className="login-field-group">
                <label className="login-field-label" htmlFor="totp-code">
                  6-Digit Verification Code
                </label>
                <div className="login-input-wrapper code-input-wrapper">
                  <KeyRound className="login-input-icon" size={17} />
                  <input
                    type="text"
                    id="totp-code"
                    className="login-input-control text-center text-monospace text-lg"
                    placeholder="000 000"
                    maxLength={7}
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value)}
                    required
                    autoFocus
                    autoComplete="one-time-code"
                  />
                </div>
              </div>

              <div className="two-factor-actions">
                <button
                  type="submit"
                  className="btn-login-action"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={18} className="spin-animation" />
                      <span>Verifying 2FA Code...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={18} />
                      <span>Confirm & Access Portal</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  className="btn-login-back"
                  onClick={() => {
                    setIs2FAStage(false);
                    setTotpCode('');
                    setErrorMessage(null);
                  }}
                  disabled={isSubmitting}
                >
                  <ArrowLeft size={14} />
                  <span>Back to Sign In</span>
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Institutional Footer */}
        <footer className="login-page-footer">
          <p>© 2026 St. Vincent's High School, Pune • Human Resource Management System</p>
        </footer>
      </div>
    </div>
  );
}

export default LoginView;
