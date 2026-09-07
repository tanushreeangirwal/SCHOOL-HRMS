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
  CheckCircle2,
  Shield,
  UserCheck,
  Briefcase,
  GraduationCap,
  ClipboardCheck,
  CalendarDays,
  CreditCard
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import StVincentsLogo from '../common/StVincentsLogo';

// 5 RBAC demo roles matching the institutional showcase
const DEMO_ROLES = [
  {
    id: 'superadmin',
    role: 'Super Admin',
    name: 'Dr. Alistair Sterling',
    designation: 'Principal & Executive Head',
    email: 'principal@school.edu',
    password: 'SchoolDemo@2026',
    code: 'EMP-1005',
    icon: ShieldCheck
  },
  {
    id: 'admin',
    role: 'Administrator',
    name: 'Malcolm Haynes',
    designation: 'Campus Operations & Dean',
    email: 'admin@school.edu',
    password: 'SchoolDemo@2026',
    code: 'EMP-1006',
    icon: Shield
  },
  {
    id: 'hr',
    role: 'HR',
    name: 'Clara Higgins',
    designation: 'Head of Human Resources',
    email: 'hr@school.edu',
    password: 'SchoolDemo@2026',
    code: 'EMP-1003',
    icon: UserCheck
  },
  {
    id: 'manager',
    role: 'Manager',
    name: 'Julian Mercer',
    designation: 'Department Lead',
    email: 'manager@school.edu',
    password: 'SchoolDemo@2026',
    code: 'EMP-1002',
    icon: Briefcase
  },
  {
    id: 'employee',
    role: 'Employee',
    name: 'Evelyn Reed',
    designation: 'Senior Faculty Educator',
    email: 'teacher@school.edu',
    password: 'SchoolDemo@2026',
    code: 'EMP-1001',
    icon: GraduationCap
  }
];

export function LoginView({ onLoginSuccess }) {
  const { login, verify2FA } = useAuth();

  // Form State
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedRoleId, setSelectedRoleId] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  // 2FA Verification State
  const [is2FAStage, setIs2FAStage] = useState(false);
  const [tempToken, setTempToken] = useState(null);
  const [totpCode, setTotpCode] = useState('');

  // Submit Step 1: Username/Password
  const handleCredentialSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
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

  // Select demo role and auto-populate
  const handleSelectDemo = (demo) => {
    setIdentifier(demo.email);
    setPassword(demo.password);
    setSelectedRoleId(demo.id);
    setErrorMessage(null);
  };

  // Quick fill principal
  const handleFillPrincipal = (e) => {
    e.preventDefault();
    const principal = DEMO_ROLES.find(r => r.id === 'superadmin');
    if (principal) {
      handleSelectDemo(principal);
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
    <div className="split-login-wrapper">
      {/* Left Column: Institutional Brand & Features Showcase */}
      <div className="split-login-left">
        <div className="split-login-left-inner">
          {/* Top Brand Header */}
          <div className="split-login-brand">
            <StVincentsLogo 
              variant="horizontal" 
              size={46}
              title="St. Vincent's High School"
              subtitle="HUMAN RESOURCE MANAGEMENT SYSTEM" 
              theme="light"
            />
          </div>

          {/* Hero Content */}
          <div className="split-login-hero">
            <h1 className="split-login-headline">
              One record for every<br />member of staff.
            </h1>
            <p className="split-login-subline">
              Attendance, leave, payroll, shifts and professional development — kept together, for the people who run the school.
            </p>

            {/* Feature Bullets */}
            <ul className="split-login-features" aria-label="System capabilities">
              <li className="split-feature-item">
                <span className="split-feature-icon-wrap">
                  <ClipboardCheck size={17} className="split-feature-icon" />
                </span>
                <span className="split-feature-text">Daily attendance against each teacher's roster</span>
              </li>
              <li className="split-feature-item">
                <span className="split-feature-icon-wrap">
                  <CalendarDays size={17} className="split-feature-icon" />
                </span>
                <span className="split-feature-text">Leave requests routed to the right approver</span>
              </li>
              <li className="split-feature-item">
                <span className="split-feature-icon-wrap">
                  <CreditCard size={17} className="split-feature-icon" />
                </span>
                <span className="split-feature-text">Monthly payroll with loss-of-pay worked out</span>
              </li>
              <li className="split-feature-item">
                <span className="split-feature-icon-wrap">
                  <GraduationCap size={17} className="split-feature-icon" />
                </span>
                <span className="split-feature-text">Training hours and certificates on file</span>
              </li>
            </ul>
          </div>

          {/* Left Footer Landmark */}
          <div className="split-login-left-footer">
            <span>ST. VINCENT'S HIGH SCHOOL • PUNE</span>
          </div>
        </div>
      </div>

      {/* Right Column: Authentication Card & Role Selector */}
      <div className="split-login-right">
        <div className="split-login-form-container">
          {/* Error Alert */}
          {errorMessage && (
            <div className="login-error-alert" role="alert">
              <AlertCircle size={18} className="alert-icon" />
              <span className="alert-text">{errorMessage}</span>
            </div>
          )}

          {/* STAGE 1: Standard Credentials Form */}
          {!is2FAStage ? (
            <>
              <div className="split-form-header">
                <h2 className="split-form-title">Staff Portal Sign In</h2>
                <p className="split-form-subtitle">Enter your institutional credentials to access your account</p>
              </div>

              <form onSubmit={handleCredentialSubmit} className="split-login-form">
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
                      placeholder="e.g. principal@school.edu or EMP-1005"
                      value={identifier}
                      onChange={(e) => {
                        setIdentifier(e.target.value);
                        setSelectedRoleId(null);
                      }}
                      required
                      autoFocus
                      autoComplete="username"
                    />
                  </div>
                </div>

                {/* Password Input */}
                <div className="login-field-group">
                  <label className="login-field-label" htmlFor="login-password">
                    Password
                  </label>
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
                  className="btn-split-submit"
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

              {/* Evaluation Access Role Selector Grid */}
              <div className="split-eval-section">
                <div className="split-eval-header">
                  <span className="split-eval-title">EVALUATION ACCESS</span>
                  <span className="split-eval-hint">Pick a role to sign in</span>
                </div>

                <div className="split-eval-grid">
                  {DEMO_ROLES.map((demo) => {
                    const IconComp = demo.icon;
                    const isSelected = selectedRoleId === demo.id || identifier.toLowerCase() === demo.email.toLowerCase();

                    return (
                      <button
                        key={demo.id}
                        type="button"
                        className={`split-eval-card ${isSelected ? 'selected' : ''}`}
                        onClick={() => handleSelectDemo(demo)}
                      >
                        <div className="split-eval-card-icon">
                          <IconComp size={16} />
                        </div>
                        <div className="split-eval-card-info">
                          <span className="split-eval-card-role">{demo.role}</span>
                          <span className="split-eval-card-name">{demo.name}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Quick Link to Principal */}
                <div className="split-quick-link-wrap">
                  <a 
                    href="#fill-principal" 
                    className="split-quick-link"
                    onClick={handleFillPrincipal}
                  >
                    Or fill the form with the Principal's credentials
                  </a>
                </div>
              </div>
            </>
          ) : (
            /* STAGE 2: 2FA Code Input */
            <form onSubmit={handle2FASubmit} className="split-login-form">
              <div className="split-form-header">
                <div className="two-factor-icon-badge">
                  <ShieldCheck size={28} />
                </div>
                <h2 className="split-form-title">Two-Factor Authentication</h2>
                <p className="split-form-subtitle">
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
                  className="btn-split-submit"
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

          {/* Institutional Footer */}
          <footer className="split-login-footer">
            <p>© 2026 St. Vincent's High School, Pune • Human Resource Management System</p>
          </footer>
        </div>
      </div>
    </div>
  );
}

export default LoginView;
