import React, { useState, useEffect } from 'react';
import { 
  X, 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Briefcase, 
  Calendar, 
  Building2, 
  ShieldCheck, 
  Clock,
  IdCard,
  FileText,
  AlertCircle,
  Copy,
  Check,
  DollarSign,
  Send,
  KeyRound,
  CheckCircle2
} from 'lucide-react';
import { hrmsApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { StaffAvatar } from '../common/StaffAvatar';
import AssignSalaryModal from '../payroll/AssignSalaryModal';

export function EmployeeDetailModal({ employeeId, onClose }) {
  const { isSuperAdmin, isAdmin, isHR } = useAuth();
  const canManageSalary = isSuperAdmin || isAdmin || isHR;
  const canManageInvites = isSuperAdmin || isAdmin || isHR;

  const [employee, setEmployee] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copiedField, setCopiedField] = useState(null);
  const [isAssignSalaryOpen, setIsAssignSalaryOpen] = useState(false);

  // Invitation & Onboarding management states
  const [isSendingInvite, setIsSendingInvite] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState(null);
  const [inviteError, setInviteError] = useState(null);
  const [inviteCooldown, setInviteCooldown] = useState(0);
  const [lastInviteUrl, setLastInviteUrl] = useState(null);

  const fetchDetails = async () => {
    if (!employeeId) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await hrmsApi.getEmployeeById(employeeId);
      if (response && response.success && response.data) {
        setEmployee(response.data);
      } else {
        throw new Error(response?.message || 'Employee record not found.');
      }
    } catch (err) {
      console.error('Error fetching employee details:', err);
      setError(err.message || 'Failed to fetch employee details.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDetails();
  }, [employeeId]);

  useEffect(() => {
    if (inviteCooldown <= 0) return;
    const timer = setInterval(() => setInviteCooldown(prev => Math.max(0, prev - 1)), 1000);
    return () => clearInterval(timer);
  }, [inviteCooldown]);

  const handleSendOrResendInvite = async () => {
    if (!employee?.id) return;
    setIsSendingInvite(true);
    setInviteError(null);
    setInviteSuccess(null);
    try {
      const isResend = employee.account_status && employee.account_status !== 'INVITATION_PENDING';
      const res = isResend 
        ? await hrmsApi.resendEmployeeInvitation(employee.id)
        : await hrmsApi.sendEmployeeInvitation(employee.id);

      if (res && res.success) {
        setInviteSuccess(res.message);
        if (res.data?.inviteUrl) setLastInviteUrl(res.data.inviteUrl);
        setInviteCooldown(45);
        await fetchDetails();
      } else {
        throw new Error(res?.message || 'Failed to send invitation.');
      }
    } catch (err) {
      setInviteError(err.message || 'Unable to send invitation.');
    } finally {
      setIsSendingInvite(false);
    }
  };

  const copyToClipboard = (text, fieldName) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const fullName = employee
    ? [employee.first_name, employee.middle_name, employee.last_name].filter(Boolean).join(' ')
    : 'Employee Profile';

  const initials = employee
    ? (
        (employee.first_name ? employee.first_name[0] : '') +
        (employee.last_name ? employee.last_name[0] : (employee.middle_name ? employee.middle_name[0] : ''))
      ).toUpperCase() || 'EM'
    : 'EM';

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Not Provided';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  const formatTimestamp = (ts) => {
    if (!ts) return '—';
    try {
      const d = new Date(ts);
      if (isNaN(d.getTime())) return ts;
      return d.toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short'
      });
    } catch {
      return ts;
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div 
        className="modal-container modal-lg" 
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="modal-header">
          {isLoading ? (
            <div className="modal-header-loading">
              <span className="modal-title">Loading Employee Record...</span>
            </div>
          ) : error ? (
            <div className="modal-header-error">
              <span className="modal-title text-danger">Failed to Load Profile</span>
            </div>
          ) : (
            <div className="modal-header-profile">
              <StaffAvatar
                firstName={employee?.first_name}
                lastName={employee?.last_name}
                photoUrl={employee?.profile_photo_url}
                size="lg"
              />
              <div className="modal-header-text">
                <div className="modal-title-row">
                  <h2 className="modal-title">{fullName}</h2>
                  <span className={`status-pill badge-${(employee?.employment_status || 'active').toLowerCase()}`}>
                    <span className="status-dot"></span>
                    <span>{employee?.employment_status || 'Active'}</span>
                  </span>
                </div>
                <div className="modal-subtitle-row">
                  <span 
                    className="code-badge clickable-badge"
                    onClick={() => copyToClipboard(employee?.employee_code, 'code')}
                    title="Click to copy employee code"
                  >
                    {employee?.employee_code}
                    {copiedField === 'code' ? <Check size={12} className="inline-icon text-success" /> : <Copy size={12} className="inline-icon" />}
                  </span>
                  <span className="modal-dot-separator">•</span>
                  <span className="modal-designation">
                    {employee?.designation_name || employee?.designation || 'Staff Member'}
                  </span>
                  <span className="modal-dot-separator">•</span>
                  <span className="modal-department">
                    {employee?.department_name || employee?.department || 'Academic & School Operations'}
                  </span>
                </div>
              </div>
            </div>
          )}

          <button 
            type="button" 
            className="modal-close-btn" 
            onClick={onClose}
            aria-label="Close profile modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body">
          {isLoading ? (
            <div className="modal-loading-wrapper">
              <LoadingSpinner text="Fetching full employee dossier from database (GET /api/employees/:id)..." size={28} />
            </div>
          ) : error ? (
            <div className="modal-error-wrapper">
              <AlertCircle size={32} className="text-danger" />
              <p className="error-message">{error}</p>
              <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
                Close
              </button>
            </div>
          ) : employee ? (
            <div className="detail-sections-grid">
              {/* 1. Personal Details */}
              <div className="detail-card">
                <div className="detail-card-header">
                  <User size={17} className="detail-icon" />
                  <h3>Personal Information</h3>
                </div>
                <div className="detail-grid">
                  <div className="detail-item">
                    <span className="detail-label">Employee Code</span>
                    <span className="detail-value text-monospace font-bold">{employee.employee_code || '—'}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Full Name</span>
                    <span className="detail-value">{fullName}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Date of Birth</span>
                    <span className="detail-value">{formatDate(employee.date_of_birth)}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Gender</span>
                    <span className="detail-value">{employee.gender || 'Not specified'}</span>
                  </div>
                </div>
              </div>

              {/* 2. Contact & Communication */}
              <div className="detail-card">
                <div className="detail-card-header">
                  <Mail size={17} className="detail-icon" />
                  <h3>Contact Information</h3>
                </div>
                <div className="detail-grid">
                  <div className="detail-item full-width">
                    <span className="detail-label">Institutional / Work Email</span>
                    <span className="detail-value font-medium">
                      {employee.work_email ? (
                        <a href={`mailto:${employee.work_email}`} className="email-link">
                          {employee.work_email}
                        </a>
                      ) : '—'}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Personal Email</span>
                    <span className="detail-value">
                      {employee.personal_email ? (
                        <a href={`mailto:${employee.personal_email}`} className="email-link">
                          {employee.personal_email}
                        </a>
                      ) : '—'}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Phone Number</span>
                    <span className="detail-value">
                      {employee.phone ? (
                        <a href={`tel:${employee.phone}`} className="phone-link">
                          {employee.phone}
                        </a>
                      ) : '—'}
                    </span>
                  </div>
                </div>
              </div>

              {/* 3. Address & Residence */}
              <div className="detail-card">
                <div className="detail-card-header">
                  <MapPin size={17} className="detail-icon" />
                  <h3>Residential Address</h3>
                </div>
                <div className="detail-grid">
                  <div className="detail-item full-width">
                    <span className="detail-label">Street Address</span>
                    <span className="detail-value">{employee.address || '—'}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">City</span>
                    <span className="detail-value">{employee.city || '—'}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">State / Province</span>
                    <span className="detail-value">{employee.state || '—'}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Postal / ZIP Code</span>
                    <span className="detail-value">{employee.postal_code || '—'}</span>
                  </div>
                </div>
              </div>

              {/* 4. Employment & Organizational Profile */}
              <div className="detail-card">
                <div className="detail-card-header">
                  <Briefcase size={17} className="detail-icon" />
                  <h3>Institutional & Role Profile</h3>
                </div>
                <div className="detail-grid">
                  <div className="detail-item">
                    <span className="detail-label">Employment Status</span>
                    <span className="detail-value font-medium">{employee.employment_status || 'Active'}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Joining Date</span>
                    <span className="detail-value">{formatDate(employee.joining_date)}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Department</span>
                    <span className="detail-value">{employee.department_name || employee.department || 'Academic Faculty'}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Designation</span>
                    <span className="detail-value">{employee.designation_name || employee.designation || 'Staff Member'}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Employment Type</span>
                    <span className="detail-value">{employee.employment_type_name || employee.employment_type || 'Full Time'}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Reporting Manager</span>
                    <span className="detail-value">{employee.reporting_manager_name || (employee.reporting_manager_id ? `ID: ${employee.reporting_manager_id.slice(0, 8)}...` : 'Principal / HR Head')}</span>
                  </div>
                  <div className="detail-item full-width">
                    <span className="detail-label">Work Shift & Schedule</span>
                    <span className="detail-value font-medium" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {employee.shift_name ? (
                        <>
                          <span style={{ color: '#1e40af', fontWeight: 700 }}>{employee.shift_name}</span>
                          <span className="table-code-badge text-monospace">{employee.shift_code}</span>
                          {employee.shift_start_time && (
                            <span className="text-muted" style={{ fontSize: '0.82rem' }}>
                              ({employee.shift_start_time.slice(0, 5)} – {employee.shift_end_time.slice(0, 5)})
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="unassigned-badge">No Shift Assigned</span>
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* 5. Account Onboarding & Verification Lifecycle */}
              <div className="detail-card">
                <div className="detail-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <KeyRound size={17} className="detail-icon" style={{ color: '#3155D9' }} />
                    <h3>Portal Account & Onboarding Status</h3>
                  </div>

                  {canManageInvites && employee.account_status !== 'ACTIVE' && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-xs"
                      onClick={handleSendOrResendInvite}
                      disabled={isSendingInvite || inviteCooldown > 0}
                      style={{ fontSize: '0.74rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Send size={12} />
                      <span>
                        {inviteCooldown > 0 
                          ? `Wait ${inviteCooldown}s` 
                          : isSendingInvite 
                            ? 'Sending...' 
                            : employee.account_status === 'INVITATION_PENDING' 
                              ? 'Send Invitation' 
                              : 'Resend Invitation'}
                      </span>
                    </button>
                  )}
                </div>

                {inviteSuccess && (
                  <div style={{ padding: '8px 12px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', fontSize: '0.78rem', color: '#166534', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <CheckCircle2 size={14} />
                    <span>{inviteSuccess}</span>
                  </div>
                )}

                {inviteError && (
                  <div style={{ padding: '8px 12px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', fontSize: '0.78rem', color: '#991b1b', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <AlertCircle size={14} />
                    <span>{inviteError}</span>
                  </div>
                )}

                <div className="detail-grid">
                  <div className="detail-item">
                    <span className="detail-label">Account Lifecycle Status</span>
                    <span className="detail-value">
                      <span className={`status-pill ${
                        employee.account_status === 'ACTIVE' 
                          ? 'status-active' 
                          : employee.account_status === 'PHONE_VERIFIED' || employee.account_status === 'EMAIL_VERIFIED'
                            ? 'status-active'
                            : employee.account_status === 'INVITED'
                              ? 'status-probation'
                              : 'status-inactive'
                      }`}>
                        <span className="status-dot"></span>
                        <span>{employee.account_status ? employee.account_status.replace(/_/g, ' ') : 'INVITATION PENDING'}</span>
                      </span>
                    </span>
                  </div>

                  <div className="detail-item">
                    <span className="detail-label">Email Verification</span>
                    <span className="detail-value" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {employee.email_verified_at ? (
                        <>
                          <CheckCircle2 size={14} className="text-emerald" />
                          <span style={{ color: '#166534', fontWeight: 600, fontSize: '0.84rem' }}>
                            Verified ({formatDate(employee.email_verified_at)})
                          </span>
                        </>
                      ) : (
                        <span className="text-muted" style={{ fontSize: '0.84rem' }}>Pending Email Confirmation</span>
                      )}
                    </span>
                  </div>

                  <div className="detail-item">
                    <span className="detail-label">Phone OTP Verification</span>
                    <span className="detail-value" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {employee.phone_verified_at ? (
                        <>
                          <CheckCircle2 size={14} className="text-emerald" />
                          <span style={{ color: '#166534', fontWeight: 600, fontSize: '0.84rem' }}>
                            Verified via SMS OTP
                          </span>
                        </>
                      ) : (
                        <span className="text-muted" style={{ fontSize: '0.84rem' }}>Pending Phone OTP</span>
                      )}
                    </span>
                  </div>

                  <div className="detail-item">
                    <span className="detail-label">Password Setup</span>
                    <span className="detail-value">
                      {employee.account_status === 'ACTIVE' ? (
                        <span style={{ color: '#10b981', fontWeight: 700, fontSize: '0.84rem' }}>
                          Configured by Employee
                        </span>
                      ) : (
                        <span className="text-muted" style={{ fontSize: '0.84rem' }}>
                          Awaiting Onboarding Setup
                        </span>
                      )}
                    </span>
                  </div>

                  {lastInviteUrl && (
                    <div className="detail-item full-width" style={{ backgroundColor: '#f8fafc', padding: '10px 12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                      <span className="detail-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>Direct Invitation Link</span>
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs"
                          onClick={() => copyToClipboard(lastInviteUrl, 'inviteUrl')}
                          style={{ fontSize: '0.72rem', color: '#3155D9' }}
                        >
                          {copiedField === 'inviteUrl' ? <Check size={12} /> : <Copy size={12} />}
                          <span>{copiedField === 'inviteUrl' ? 'Copied' : 'Copy Link'}</span>
                        </button>
                      </span>
                      <span className="detail-value text-monospace" style={{ fontSize: '0.75rem', wordBreak: 'break-all', color: '#475569' }}>
                        {lastInviteUrl}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* 6. Compensation & Salary Structure */}
              <div className="detail-card">
                <div className="detail-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <DollarSign size={17} className="detail-icon" style={{ color: '#16a34a' }} />
                    <h3>Compensation & Salary Structure</h3>
                  </div>
                  {canManageSalary && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs"
                      onClick={() => setIsAssignSalaryOpen(true)}
                      style={{ fontSize: '0.74rem', color: '#2563eb', fontWeight: 600 }}
                    >
                      {employee.salary_structure_name ? 'Change Structure' : '+ Assign Structure'}
                    </button>
                  )}
                </div>
                <div className="detail-grid">
                  <div className="detail-item full-width">
                    <span className="detail-label">Assigned Salary Structure</span>
                    <span className="detail-value font-medium">
                      {employee.salary_structure_name ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ color: '#0f172a', fontWeight: 700 }}>{employee.salary_structure_name}</span>
                          <span className="table-code-badge text-monospace">{employee.salary_structure_code}</span>
                        </span>
                      ) : (
                        <span className="unassigned-badge">No Salary Structure Assigned</span>
                      )}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Monthly Base Gross</span>
                    <span className="detail-value font-bold" style={{ color: '#16a34a', fontSize: '0.92rem' }}>
                      {employee.monthly_gross 
                        ? `₹${Number(employee.monthly_gross).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                        : '—'
                      }
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Annual CTC</span>
                    <span className="detail-value font-bold" style={{ color: '#2563eb', fontSize: '0.92rem' }}>
                      {employee.annual_ctc 
                        ? `₹${Number(employee.annual_ctc).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                        : '—'
                      }
                    </span>
                  </div>
                  <div className="detail-item full-width">
                    <span className="detail-label">Effective From</span>
                    <span className="detail-value">
                      {employee.salary_effective_from ? formatDate(employee.salary_effective_from) : 'Active'}
                    </span>
                  </div>
                </div>
              </div>

              {/* System Audit Metadata Footer */}
              <div className="detail-meta-footer full-width-span">
                <div className="meta-col">
                  <span className="meta-label">Database UUID:</span>
                  <span className="meta-val text-monospace">{employee.id}</span>
                </div>
                <div className="meta-col">
                  <span className="meta-label">Record Registered:</span>
                  <span className="meta-val">{formatTimestamp(employee.created_at)}</span>
                </div>
                <div className="meta-col">
                  <span className="meta-label">Last Database Sync:</span>
                  <span className="meta-val">{formatTimestamp(employee.updated_at)}</span>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Modal Footer */}
        <div className="modal-footer">
          <div className="footer-left">
            <span className="text-muted text-xs">
              St. Vincent's School • Faculty & Staff Profile Record
            </span>
          </div>
          <div className="footer-right">
            <button 
              type="button" 
              className="btn btn-secondary" 
              onClick={onClose}
            >
              Close Profile
            </button>
          </div>
        </div>
      </div>

      {/* Assign Salary Modal from Profile */}
      {isAssignSalaryOpen && (
        <AssignSalaryModal
          isOpen={isAssignSalaryOpen}
          onClose={() => setIsAssignSalaryOpen(false)}
          onAssigned={() => {
            fetchDetails();
          }}
          initialEmployee={employee}
        />
      )}
    </div>
  );
}

export default EmployeeDetailModal;
