import React, { useState, useEffect } from 'react';
import { 
  X, 
  ShieldCheck, 
  ShieldAlert, 
  QrCode, 
  Copy, 
  Check, 
  Loader2, 
  AlertCircle,
  Lock,
  Smartphone
} from 'lucide-react';
import { hrmsApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export function TwoFactorSetupModal({ onClose, onStatusUpdated }) {
  const { user, refreshUser } = useAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Setup Data
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [confirmCode, setConfirmCode] = useState('');
  const [copied, setCopied] = useState(false);

  // Disable Data
  const [disablePassword, setDisablePassword] = useState('');

  const is2FAEnabled = Boolean(user?.two_factor_enabled);

  useEffect(() => {
    if (!is2FAEnabled) {
      initiateSetup();
    } else {
      setIsLoading(false);
    }
  }, [is2FAEnabled]);

  const initiateSetup = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const response = await hrmsApi.setup2FA();
      if (response && response.success) {
        setQrCodeUrl(response.qrCode);
        setSecretKey(response.secret);
      } else {
        throw new Error(response.message || 'Failed to initialize 2FA setup.');
      }
    } catch (err) {
      console.error('Setup 2FA error:', err);
      setErrorMessage(err.message || 'Unable to generate 2FA setup QR code.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopySecret = () => {
    if (!secretKey) return;
    navigator.clipboard.writeText(secretKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleConfirm2FA = async (e) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanCode = confirmCode.trim();
    if (!cleanCode || cleanCode.length < 6) {
      setErrorMessage('Please enter the 6-digit verification code from your authenticator app.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await hrmsApi.confirm2FA(cleanCode);
      if (response && response.success) {
        setSuccessMessage('Two-Factor Authentication is now enabled successfully!');
        await refreshUser();
        if (onStatusUpdated) onStatusUpdated(true);
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        throw new Error(response.message || 'Invalid code.');
      }
    } catch (err) {
      console.error('Confirm 2FA error:', err);
      setErrorMessage(err.message || 'Invalid verification code.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDisable2FA = async (e) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!disablePassword) {
      setErrorMessage('Please enter your account password to confirm disabling 2FA.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await hrmsApi.disable2FA({ password: disablePassword });
      if (response && response.success) {
        setSuccessMessage('Two-Factor Authentication has been disabled.');
        await refreshUser();
        if (onStatusUpdated) onStatusUpdated(false);
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        throw new Error(response.message || 'Failed to disable 2FA.');
      }
    } catch (err) {
      console.error('Disable 2FA error:', err);
      setErrorMessage(err.message || 'Incorrect password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div 
        className="modal-container modal-form" 
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="modal-header">
          <div className="modal-header-icon-title">
            <div className={`icon-badge-primary ${is2FAEnabled ? 'badge-success-glow' : ''}`}>
              <ShieldCheck size={22} />
            </div>
            <div>
              <h2 className="modal-title">Two-Factor Authentication (2FA)</h2>
              <p className="modal-subtitle">
                {is2FAEnabled 
                  ? 'Manage your TOTP Authenticator app security settings' 
                  : 'Enhance your HRMS account security with TOTP authentication'}
              </p>
            </div>
          </div>
          <button 
            type="button" 
            className="modal-close-btn" 
            onClick={onClose}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body">
          {/* Alerts */}
          {errorMessage && (
            <div className="form-alert-error">
              <AlertCircle size={18} className="alert-icon" />
              <div className="alert-text">{errorMessage}</div>
            </div>
          )}

          {successMessage && (
            <div className="form-alert-success">
              <Check size={18} className="alert-icon" />
              <div className="alert-text">{successMessage}</div>
            </div>
          )}

          {isLoading ? (
            <div className="modal-loading-wrapper">
              <Loader2 size={32} className="spin-animation text-primary" />
              <p>Generating secure 2FA keys and QR Code...</p>
            </div>
          ) : is2FAEnabled ? (
            /* VIEW: 2FA ALREADY ENABLED -> DISABLE OPTION */
            <div className="two-factor-active-view">
              <div className="active-2fa-card">
                <div className="active-badge-large">
                  <ShieldCheck size={36} className="text-success" />
                </div>
                <h3>2FA Protection is Active</h3>
                <p>
                  Your account is protected by TOTP Two-Factor Authentication. A 6-digit code from your authenticator app is required on every login.
                </p>
              </div>

              <form onSubmit={handleDisable2FA} className="disable-2fa-section">
                <h4>Disable Two-Factor Authentication</h4>
                <p className="text-muted text-xs">
                  To turn off 2FA, please enter your current account password below:
                </p>
                <div className="form-group" style={{ marginTop: '10px' }}>
                  <label className="form-label" htmlFor="disable-password">
                    Account Password
                  </label>
                  <input
                    type="password"
                    id="disable-password"
                    className="form-input"
                    placeholder="Enter password to confirm"
                    value={disablePassword}
                    onChange={(e) => setDisablePassword(e.target.value)}
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="btn btn-secondary text-danger"
                  style={{ marginTop: '12px', width: '100%' }}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={16} className="spin-animation" />
                      <span>Disabling 2FA...</span>
                    </>
                  ) : (
                    <>
                      <ShieldAlert size={16} />
                      <span>Disable Two-Factor Authentication</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          ) : (
            /* VIEW: 2FA SETUP STEPS */
            <div className="two-factor-setup-steps">
              {/* Step 1: Scan QR Code */}
              <div className="setup-step-box">
                <div className="step-badge">1</div>
                <div className="step-content">
                  <h4 className="step-title">Scan QR Code in Authenticator App</h4>
                  <p className="step-desc">
                    Open Google Authenticator, Microsoft Authenticator, or Authy on your mobile device and scan this QR code:
                  </p>
                  <div className="qr-code-wrapper">
                    {qrCodeUrl && (
                      <img 
                        src={qrCodeUrl} 
                        alt="2FA QR Code" 
                        className="qr-code-img"
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Step 2: Manual Key Option */}
              <div className="setup-step-box">
                <div className="step-badge">2</div>
                <div className="step-content">
                  <h4 className="step-title">Or Enter Secret Key Manually</h4>
                  <div className="secret-key-copy-row">
                    <input
                      type="text"
                      className="form-input text-monospace text-center"
                      value={secretKey}
                      readOnly
                    />
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={handleCopySecret}
                      title="Copy secret key"
                    >
                      {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                      <span>{copied ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Step 3: Verify and Activate */}
              <form onSubmit={handleConfirm2FA} className="setup-step-box">
                <div className="step-badge">3</div>
                <div className="step-content">
                  <h4 className="step-title">Verify 6-Digit Code</h4>
                  <p className="step-desc">
                    Enter the 6-digit verification code displayed in your authenticator app to activate 2FA:
                  </p>
                  <div className="form-group" style={{ marginTop: '8px' }}>
                    <input
                      type="text"
                      className="form-input text-monospace text-center text-lg"
                      placeholder="000000"
                      maxLength={6}
                      value={confirmCode}
                      onChange={(e) => setConfirmCode(e.target.value)}
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    className="btn btn-primary"
                    style={{ marginTop: '12px', width: '100%' }}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 size={16} className="spin-animation" />
                        <span>Verifying & Activating...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck size={16} />
                        <span>Activate Two-Factor Authentication</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="modal-footer">
          <button 
            type="button" 
            className="btn btn-secondary" 
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default TwoFactorSetupModal;
