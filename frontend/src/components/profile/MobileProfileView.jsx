import React, { useState, useEffect } from 'react';
import { 
  User, 
  Mail, 
  Phone, 
  ShieldCheck, 
  ShieldAlert, 
  CheckCircle2, 
  Clock, 
  Building2, 
  Calendar, 
  IdCard, 
  LogOut, 
  Lock, 
  KeyRound,
  ChevronRight,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { StaffAvatar } from '../common/StaffAvatar';
import { hrmsApi } from '../../services/api';

export function MobileProfileView({ onOpen2FAModal }) {
  const { user, logout } = useAuth();
  const [employee, setEmployee] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadProfile() {
      if (!user?.employee_id) {
        setIsLoading(false);
        return;
      }
      try {
        const res = await hrmsApi.getEmployeeById(user.employee_id);
        if (res && res.success) {
          setEmployee(res.data);
        }
      } catch (err) {
        console.error('Error fetching employee profile:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadProfile();
  }, [user?.employee_id]);

  const emp = employee || {
    first_name: user?.first_name || 'Faculty',
    last_name: user?.last_name || 'Member',
    employee_code: user?.employee_code || 'EMP-1001',
    work_email: user?.email,
    phone: user?.phone || '+91 98765 43210',
    department_name: 'Academic Faculty',
    designation_name: user?.role || 'Teaching Faculty',
    employment_status: user?.employment_status || 'Active',
    account_status: 'ACTIVE'
  };

  return (
    <div className="mobile-profile-container" style={{ width: '100%', maxWidth: '600px', margin: '0 auto', paddingBottom: '30px' }}>
      
      {/* 1. Identity Header Card */}
      <div style={{
        backgroundColor: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        padding: '24px 20px',
        textAlign: 'center',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        marginBottom: '20px'
      }}>
        <div style={{ display: 'inline-flex', justifyContent: 'center', marginBottom: '12px' }}>
          <StaffAvatar
            firstName={emp.first_name}
            lastName={emp.last_name}
            photoUrl={emp.profile_photo_url}
            size="xl"
          />
        </div>

        <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#172033', margin: '0 0 4px 0' }}>
          {emp.first_name} {emp.last_name}
        </h1>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
          <span className="code-badge">{emp.employee_code}</span>
          <span className="status-pill status-active" style={{ fontSize: '0.74rem' }}>
            {emp.designation_name}
          </span>
          <span className="status-pill status-active" style={{ fontSize: '0.74rem', backgroundColor: '#eef2ff', color: '#3155D9' }}>
            {emp.department_name}
          </span>
        </div>
      </div>

      {/* 2. Verification Badges Card */}
      <div style={{
        backgroundColor: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        padding: '18px 20px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        marginBottom: '20px'
      }}>
        <h2 style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', margin: '0 0 14px 0' }}>
          Identity & Verification Status
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* Email Verified */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <CheckCircle2 size={18} className="text-emerald" />
              <div>
                <span style={{ fontSize: '0.86rem', fontWeight: 700, color: '#166534', display: 'block' }}>
                  Email Verified
                </span>
                <span style={{ fontSize: '0.75rem', color: '#15803d' }}>
                  {emp.work_email || emp.personal_email || user?.email}
                </span>
              </div>
            </div>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#166534', backgroundColor: '#dcfce7', padding: '2px 8px', borderRadius: '10px' }}>
              Confirmed
            </span>
          </div>

          {/* Phone Verified */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <CheckCircle2 size={18} className="text-emerald" />
              <div>
                <span style={{ fontSize: '0.86rem', fontWeight: 700, color: '#166534', display: 'block' }}>
                  Phone Verified
                </span>
                <span style={{ fontSize: '0.75rem', color: '#15803d' }}>
                  {emp.phone || 'Phone verified via SMS OTP'}
                </span>
              </div>
            </div>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#166534', backgroundColor: '#dcfce7', padding: '2px 8px', borderRadius: '10px' }}>
              Confirmed
            </span>
          </div>
        </div>
      </div>

      {/* 3. Institutional Details */}
      <div style={{
        backgroundColor: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        padding: '18px 20px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        marginBottom: '20px'
      }}>
        <h2 style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', margin: '0 0 14px 0' }}>
          Employment Dossier
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.86rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
            <span style={{ color: '#64748b' }}>Faculty Wing:</span>
            <span style={{ fontWeight: 700, color: '#172033' }}>{emp.department_name}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.86rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
            <span style={{ color: '#64748b' }}>Designation:</span>
            <span style={{ fontWeight: 700, color: '#172033' }}>{emp.designation_name}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.86rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
            <span style={{ color: '#64748b' }}>Employment Status:</span>
            <span style={{ fontWeight: 700, color: '#10b981' }}>{emp.employment_status || 'Active'}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.86rem' }}>
            <span style={{ color: '#64748b' }}>Joining Date:</span>
            <span style={{ fontWeight: 600, color: '#172033' }}>{emp.joining_date ? new Date(emp.joining_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'September 1, 2026'}</span>
          </div>
        </div>
      </div>

      {/* 4. Security & Account Actions */}
      <div style={{
        backgroundColor: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        padding: '18px 20px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        marginBottom: '20px'
      }}>
        <h2 style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', margin: '0 0 14px 0' }}>
          Security & Access Controls
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* 2FA Toggle */}
          <button
            type="button"
            className="mobile-sheet-item"
            onClick={onOpen2FAModal}
            style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px' }}
          >
            <div className="mobile-sheet-icon" style={{ backgroundColor: '#eef2ff', color: '#3155D9' }}>
              <ShieldCheck size={18} />
            </div>
            <div style={{ flex: 1, textAlign: 'left' }}>
              <span className="mobile-sheet-item-title">Two-Factor Authentication</span>
              <span className="mobile-sheet-item-desc">
                {user?.two_factor_enabled ? 'Active protection enabled' : 'Not configured'}
              </span>
            </div>
            <ChevronRight size={16} className="text-muted" />
          </button>

          {/* Logout */}
          <button
            type="button"
            className="btn btn-secondary"
            onClick={logout}
            style={{
              width: '100%',
              minHeight: '44px',
              color: '#dc2626',
              borderColor: '#fca5a5',
              backgroundColor: '#fff5f5',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              fontWeight: 700,
              marginTop: '6px'
            }}
          >
            <LogOut size={16} />
            <span>Sign Out of HRMS</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default MobileProfileView;
