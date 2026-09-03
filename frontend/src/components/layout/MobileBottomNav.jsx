import React, { useState } from 'react';
import { 
  Home, 
  Clock, 
  CalendarCheck, 
  CreditCard, 
  MoreHorizontal, 
  Calendar, 
  User, 
  ShieldCheck, 
  LogOut, 
  X,
  ChevronRight,
  Building2,
  Users
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { StaffAvatar } from '../common/StaffAvatar';

export function MobileBottomNav({
  activeView,
  setActiveView,
  onOpen2FAModal,
  onNavigateToCalendar,
  onNavigateToAttendance,
  onNavigateToLeave,
  onNavigateToPayslips
}) {
  const { user, logout, isSuperAdmin, isAdmin, isHR, isManager, isEmployee } = useAuth();
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  const handleNavClick = (viewName, callback) => {
    setIsMoreOpen(false);
    if (callback) {
      callback();
    } else {
      setActiveView(viewName);
    }
  };

  const isHomeActive = activeView === 'dashboard';
  const isAttendanceActive = activeView === 'attendance' || activeView === 'my-attendance';
  const isLeaveActive = activeView === 'leave';
  const isPayslipsActive = activeView === 'my-payslips' || (activeView === 'payroll' && isEmployee);

  return (
    <>
      {/* 1. Slide-Up "More" Sheet Overlay Backdrop */}
      {isMoreOpen && (
        <div 
          className="mobile-sheet-backdrop" 
          onClick={() => setIsMoreOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* 2. Slide-Up "More" Bottom Sheet */}
      <div className={`mobile-bottom-sheet ${isMoreOpen ? 'open' : ''}`}>
        <div className="mobile-sheet-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <StaffAvatar
              firstName={user?.first_name}
              lastName={user?.last_name}
              photoUrl={user?.profile_photo_url}
              size="md"
            />
            <div>
              <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#172033' }}>
                {user?.full_name || user?.email}
              </div>
              <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                {user?.role || 'Staff Member'} • {user?.employee_code || 'EMP'}
              </div>
            </div>
          </div>

          <button 
            type="button" 
            className="btn btn-ghost btn-xs" 
            onClick={() => setIsMoreOpen(false)}
            style={{ width: '36px', height: '36px', borderRadius: '50%', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        <div className="mobile-sheet-content">
          {/* Quick Profile */}
          <button 
            type="button" 
            className="mobile-sheet-item"
            onClick={() => handleNavClick('profile')}
          >
            <div className="mobile-sheet-icon" style={{ backgroundColor: '#eef2ff', color: '#3155D9' }}>
              <User size={18} />
            </div>
            <div style={{ flex: 1, textAlign: 'left' }}>
              <span className="mobile-sheet-item-title">My Employee Profile</span>
              <span className="mobile-sheet-item-desc">Personal details & verification status</span>
            </div>
            <ChevronRight size={16} className="text-muted" />
          </button>

          {/* Academic Calendar */}
          <button 
            type="button" 
            className="mobile-sheet-item"
            onClick={() => handleNavClick('calendar', onNavigateToCalendar)}
          >
            <div className="mobile-sheet-icon" style={{ backgroundColor: '#f0fdf4', color: '#16a34a' }}>
              <Calendar size={18} />
            </div>
            <div style={{ flex: 1, textAlign: 'left' }}>
              <span className="mobile-sheet-item-title">Academic Calendar</span>
              <span className="mobile-sheet-item-desc">Terms, holidays & exam schedule</span>
            </div>
            <ChevronRight size={16} className="text-muted" />
          </button>

          {/* Two-Factor Authentication Security */}
          <button 
            type="button" 
            className="mobile-sheet-item"
            onClick={() => {
              setIsMoreOpen(false);
              if (onOpen2FAModal) onOpen2FAModal();
            }}
          >
            <div className="mobile-sheet-icon" style={{ backgroundColor: '#fffbeb', color: '#d97706' }}>
              <ShieldCheck size={18} />
            </div>
            <div style={{ flex: 1, textAlign: 'left' }}>
              <span className="mobile-sheet-item-title">Two-Factor Security</span>
              <span className="mobile-sheet-item-desc">
                {user?.two_factor_enabled ? 'Active protection enabled' : 'Protect your account'}
              </span>
            </div>
            <ChevronRight size={16} className="text-muted" />
          </button>

          {/* Admin Switch Notice (if Admin/HR) */}
          {(!isEmployee) && (
            <div style={{ padding: '12px 14px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', margin: '8px 0', fontSize: '0.78rem', color: '#64748b', lineHeight: 1.4 }}>
              <span style={{ fontWeight: 700, color: '#172033', display: 'block', marginBottom: '2px' }}>
                Administrative Access:
              </span>
              Use a tablet or desktop browser for full faculty management, shift rosters, and payroll disbursement.
            </div>
          )}

          {/* Sign Out */}
          <button 
            type="button" 
            className="mobile-sheet-item logout-item"
            onClick={() => {
              setIsMoreOpen(false);
              logout();
            }}
          >
            <div className="mobile-sheet-icon" style={{ backgroundColor: '#fee2e2', color: '#dc2626' }}>
              <LogOut size={18} />
            </div>
            <div style={{ flex: 1, textAlign: 'left' }}>
              <span className="mobile-sheet-item-title text-danger">Sign Out</span>
              <span className="mobile-sheet-item-desc">Safely end this session</span>
            </div>
            <ChevronRight size={16} className="text-muted" />
          </button>
        </div>
      </div>

      {/* 3. Fixed Bottom Navigation Bar */}
      <nav className="mobile-bottom-nav" aria-label="Mobile Navigation">
        {/* Tab 1: Home */}
        <button
          type="button"
          className={`mobile-nav-btn ${isHomeActive ? 'active' : ''}`}
          onClick={() => handleNavClick('dashboard')}
          aria-label="Home Dashboard"
        >
          <div className="mobile-nav-icon-wrapper">
            <Home size={20} />
          </div>
          <span className="mobile-nav-label">Home</span>
        </button>

        {/* Tab 2: Attendance */}
        <button
          type="button"
          className={`mobile-nav-btn ${isAttendanceActive ? 'active' : ''}`}
          onClick={() => handleNavClick('my-attendance', onNavigateToAttendance)}
          aria-label="Attendance"
        >
          <div className="mobile-nav-icon-wrapper">
            <Clock size={20} />
          </div>
          <span className="mobile-nav-label">Attendance</span>
        </button>

        {/* Tab 3: Leave */}
        <button
          type="button"
          className={`mobile-nav-btn ${isLeaveActive ? 'active' : ''}`}
          onClick={() => handleNavClick('leave', onNavigateToLeave)}
          aria-label="Leave Requests"
        >
          <div className="mobile-nav-icon-wrapper">
            <CalendarCheck size={20} />
          </div>
          <span className="mobile-nav-label">Leave</span>
        </button>

        {/* Tab 4: Payslips */}
        <button
          type="button"
          className={`mobile-nav-btn ${isPayslipsActive ? 'active' : ''}`}
          onClick={() => handleNavClick('my-payslips', onNavigateToPayslips)}
          aria-label="My Payslips"
        >
          <div className="mobile-nav-icon-wrapper">
            <CreditCard size={20} />
          </div>
          <span className="mobile-nav-label">Payslips</span>
        </button>

        {/* Tab 5: More */}
        <button
          type="button"
          className={`mobile-nav-btn ${isMoreOpen ? 'active' : ''}`}
          onClick={() => setIsMoreOpen(true)}
          aria-label="More Menu"
        >
          <div className="mobile-nav-icon-wrapper">
            <MoreHorizontal size={20} />
          </div>
          <span className="mobile-nav-label">More</span>
        </button>
      </nav>
    </>
  );
}

export default MobileBottomNav;
