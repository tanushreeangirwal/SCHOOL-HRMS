import React, { useState, useEffect, useCallback } from 'react';
import { 
  Plus, 
  RefreshCw, 
  Server, 
  Calendar, 
  ChevronRight, 
  Home, 
  ShieldCheck, 
  ShieldAlert, 
  LogOut, 
  Building2, 
  Award, 
  Users,
  Clock,
  UserCheck,
  Check,
  Loader2
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { hrmsApi } from '../../services/api';

export function Header({ 
  activeView, 
  departmentSubTab,
  shiftSubTab,
  attendanceSubTab,
  leaveSubTab,
  calendarSubTab,
  selectedEmployeeName,
  selectedDepartmentName,
  selectedDesignationName,
  selectedShiftName,
  onAddEmployee, 
  onAddDepartment,
  onAddDesignation,
  onAddCategory,
  onAddShift,
  onMarkAttendance,
  onRefresh, 
  isRefreshing, 
  backendStatus,
  onOpen2FAModal 
}) {
  const { user, logout, hasPermission, hasRole, isSuperAdmin, isAdmin, isHR, isManager, isEmployee } = useAuth();

  // Quick Today's Attendance State for authenticated staff
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  const fetchQuickAttendance = useCallback(async () => {
    if (!user?.employee_id) return;
    try {
      const res = await hrmsApi.getMyTodayAttendance();
      if (res && res.success) {
        setTodayAttendance(res.data);
      }
    } catch (err) {
      console.error('Quick attendance fetch error:', err);
    }
  }, [user?.employee_id]);

  useEffect(() => {
    fetchQuickAttendance();
  }, [fetchQuickAttendance, isRefreshing]);

  const handleQuickCheckIn = async () => {
    setIsCheckingIn(true);
    try {
      const res = await hrmsApi.employeeCheckIn();
      if (res && res.success) {
        await fetchQuickAttendance();
        if (onRefresh) onRefresh();
      }
    } catch (err) {
      console.error('Quick check-in error:', err);
    } finally {
      setIsCheckingIn(false);
    }
  };

  const handleQuickCheckOut = async () => {
    setIsCheckingOut(true);
    try {
      const res = await hrmsApi.employeeCheckOut();
      if (res && res.success) {
        await fetchQuickAttendance();
        if (onRefresh) onRefresh();
      }
    } catch (err) {
      console.error('Quick check-out error:', err);
    } finally {
      setIsCheckingOut(false);
    }
  };

  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  const canCreateEmployee = hasPermission('employees:create') || isSuperAdmin || isAdmin || isHR;
  const canCreateDepartment = hasPermission('departments:create') || isSuperAdmin || isAdmin || isHR;
  const canCreateDesignation = hasPermission('designations:create') || isSuperAdmin || isAdmin || isHR;
  const canCreateCategory = hasPermission('department_categories:create') || isSuperAdmin || isAdmin || isHR;
  const canCreateShift = hasPermission('shifts:create') || isSuperAdmin || isAdmin || isHR;
  const canMarkAttendance = hasPermission('attendance:mark') || isSuperAdmin || isAdmin || isHR || isManager;

  const getPageMeta = () => {
    switch (activeView) {
      case 'dashboard':
        if (isSuperAdmin) {
          return {
            title: 'Super Admin • Principal Dashboard',
            subtitle: "Institutional Governance & Executive Oversight • St. Vincent's High School",
            breadcrumbs: ["St. Vincent's High School", 'Executive Dashboard']
          };
        }
        if (isAdmin) {
          return {
            title: 'Administrator Dashboard',
            subtitle: "Operations Overview & Staff Governance • St. Vincent's High School",
            breadcrumbs: ["St. Vincent's High School", 'Admin Dashboard']
          };
        }
        if (isHR) {
          return {
            title: 'Human Resources Dashboard',
            subtitle: "Workforce Overview & Talent Records • St. Vincent's High School",
            breadcrumbs: ["St. Vincent's High School", 'HR Dashboard']
          };
        }
        if (isManager) {
          return {
            title: 'Department Head Dashboard',
            subtitle: "Faculty Team Overview & Department Roster • St. Vincent's High School",
            breadcrumbs: ["St. Vincent's High School", 'Manager Dashboard']
          };
        }
        return {
          title: 'Faculty & Staff Portal',
          subtitle: `Welcome back, ${user?.full_name || 'Faculty Member'}! Personal Work & Attendance Ledger`,
          breadcrumbs: ["St. Vincent's High School", 'Staff Portal']
        };

      case 'departments':
        if (departmentSubTab === 'categories') {
          return {
            title: 'Department Categories',
            subtitle: 'Organize academic and administrative departments into functional wings.',
            breadcrumbs: ["St. Vincent's High School", 'Departments', 'Categories']
          };
        }
        if (departmentSubTab === 'assign') {
          return {
            title: 'Assign Employees',
            subtitle: 'Allocate faculty and administrative personnel across academic departments.',
            breadcrumbs: ["St. Vincent's High School", 'Departments', 'Assign Staff']
          };
        }
        return {
          title: 'Department Management',
          subtitle: 'Manage institutional departments, category hierarchies, and faculty rosters.',
          breadcrumbs: selectedDepartmentName 
            ? ["St. Vincent's High School", 'Departments', selectedDepartmentName]
            : ["St. Vincent's High School", 'Departments', 'Directory']
        };

      case 'designations':
        return {
          title: 'Designation Management',
          subtitle: 'Manage faculty ranks, administrative positions, and designation tiers.',
          breadcrumbs: selectedDesignationName
            ? ["St. Vincent's High School", 'Designations', selectedDesignationName]
            : ["St. Vincent's High School", 'Designations', 'Directory']
        };

      case 'shifts':
        if (shiftSubTab === 'assign') {
          return {
            title: 'Assign Employee Shifts',
            subtitle: 'Manage staff work shifts, timing schedules, and roster reassignments.',
            breadcrumbs: ["St. Vincent's High School", 'Shifts & Rosters', 'Assign Shifts']
          };
        }
        return {
          title: 'Shift & Work Schedule',
          subtitle: 'Manage institutional working hours, duty shifts, and grace periods.',
          breadcrumbs: selectedShiftName
            ? ["St. Vincent's High School", 'Shifts & Rosters', selectedShiftName]
            : ["St. Vincent's High School", 'Shifts & Rosters', 'Shift Policies']
        };

      case 'attendance':
        if (isEmployee) {
          return {
            title: 'My Attendance Record',
            subtitle: 'Review personal monthly attendance history, check-in timestamps, and hours.',
            breadcrumbs: ["St. Vincent's High School", 'My Attendance', 'Personal Log']
          };
        }
        if (attendanceSubTab === 'daily') {
          return {
            title: 'Daily Attendance Roster',
            subtitle: 'Real-time staff check-in, check-out, and presence registry.',
            breadcrumbs: ["St. Vincent's High School", 'Attendance Management', 'Daily Roster']
          };
        }
        if (attendanceSubTab === 'register') {
          return {
            title: 'Monthly Attendance Register',
            subtitle: 'Comprehensive monthly attendance matrix and day-by-day status ledger.',
            breadcrumbs: ["St. Vincent's High School", 'Attendance Management', 'Monthly Register']
          };
        }
        if (attendanceSubTab === 'employee') {
          return {
            title: 'Employee Attendance Summary',
            subtitle: 'Detailed time cards, individual employee history, and monthly totals.',
            breadcrumbs: ["St. Vincent's High School", 'Attendance Management', 'Employee History']
          };
        }
        if (attendanceSubTab === 'reports') {
          return {
            title: 'Attendance Reports & Analytics',
            subtitle: 'Calculate institutional presence rates, analyze trends, and export CSV.',
            breadcrumbs: ["St. Vincent's High School", 'Attendance Management', 'Reports & Export']
          };
        }
        return {
          title: 'Attendance Management Dashboard',
          subtitle: "Workforce presence statistics, shift compliance, and department metrics.",
          breadcrumbs: ["St. Vincent's High School", 'Attendance Management', 'Overview']
        };

      case 'my-attendance':
        return {
          title: 'My Attendance',
          subtitle: `Personal presence log, check-in timestamps, and work hours for ${user?.full_name || 'Staff Member'}`,
          breadcrumbs: ["St. Vincent's High School", 'My Attendance', attendanceSubTab === 'history' ? 'Attendance History' : 'Mark Attendance']
        };

      case 'employees':
        return {
          title: isEmployee ? 'My Staff Profile' : 'Staff & Faculty Management',
          subtitle: isEmployee 
            ? 'Your verified institutional employment credentials and contact profile'
            : "Official directory of all teaching faculty, administrators, and support staff",
          breadcrumbs: selectedEmployeeName 
            ? ["St. Vincent's High School", isEmployee ? 'My Profile' : 'Staff & Faculty', selectedEmployeeName]
            : ["St. Vincent's High School", isEmployee ? 'My Profile' : 'Staff & Faculty', isEmployee ? 'Profile' : 'Directory']
        };

      case 'my-shift':
        return {
          title: 'My Work Schedule & Shift',
          subtitle: 'Official institutional duty hours, weekly schedule, and attendance policy.',
          breadcrumbs: ["St. Vincent's High School", 'My Schedule', 'Assigned Shift']
        };

      case 'leave':
        return {
          title: 'Leave Management',
          subtitle: 'Faculty & staff leave applications, approval workflow, and absence tracking.',
          breadcrumbs: ["St. Vincent's High School", 'Leave Management']
        };

      case 'my-leave':
        return {
          title: 'My Leave Quota & History',
          subtitle: `Personal leave balances, entitlement tracking, and absence records for ${user?.full_name || 'Staff Member'}`,
          breadcrumbs: ["St. Vincent's High School", 'My Leave Quota']
        };

      case 'calendar':
        if (calendarSubTab === 'holidays') {
          return {
            title: 'Holidays & School Closures',
            subtitle: 'Gazetted public holidays, festive breaks, and scheduled institutional closures.',
            breadcrumbs: ["St. Vincent's High School", 'Academic Calendar', 'Holidays & Closures']
          };
        }
        if (calendarSubTab === 'terms') {
          return {
            title: 'School Academic Terms',
            subtitle: 'Curricular phases, evaluation windows, and term boundaries.',
            breadcrumbs: ["St. Vincent's High School", 'Academic Calendar', 'School Terms']
          };
        }
        if (calendarSubTab === 'years') {
          return {
            title: 'Academic Sessions & Years',
            subtitle: 'Official academic calendar sessions and institutional schedule setup.',
            breadcrumbs: ["St. Vincent's High School", 'Academic Calendar', 'Academic Sessions']
          };
        }
        return {
          title: 'Academic Calendar & Schedule',
          subtitle: 'Manage academic years, school terms, holidays, non-instructional days, and working schedules.',
          breadcrumbs: ["St. Vincent's High School", 'Academic Calendar', 'Overview']
        };

      default:
        return {
          title: "St. Vincent's High School",
          subtitle: 'Human Resource Management System',
          breadcrumbs: ["St. Vincent's High School"]
        };
    }
  };

  const meta = getPageMeta();

  return (
    <header className="top-header">
      <div className="header-left">
        {/* Breadcrumb Bar */}
        <nav className="header-breadcrumbs" aria-label="Breadcrumb">
          <div className="breadcrumb-brand-badge">
            <span className="breadcrumb-brand-dot"></span>
            <span className="breadcrumb-brand-text">St. Vincent's High School</span>
          </div>

          {meta.breadcrumbs.slice(1).map((crumb, idx) => (
            <React.Fragment key={idx}>
              <ChevronRight size={12} className="breadcrumb-separator" />
              <span className={`breadcrumb-item ${idx === meta.breadcrumbs.length - 2 ? 'active' : ''}`}>
                {crumb}
              </span>
            </React.Fragment>
          ))}
        </nav>

        {/* Page Title & Subtitle */}
        <div className="header-title-container">
          <h1 className="header-title">{meta.title}</h1>
          <p className="header-subtitle">{meta.subtitle}</p>
        </div>
      </div>

      <div className="header-right">
        {/* Quick Self-Attendance Action Pill for authenticated staff with employee_id */}
        {user?.employee_id && todayAttendance && (
          <div className="header-quick-attendance" style={{ display: 'flex', alignItems: 'center' }}>
            {todayAttendance.state === 'NOT_MARKED' && (
              <button
                type="button"
                className="btn btn-primary btn-xs"
                onClick={handleQuickCheckIn}
                disabled={isCheckingIn}
                title={`Check in for today's shift (${todayAttendance.shift?.start_time_formatted || '07:30 AM'})`}
                style={{ borderRadius: '20px', padding: '4px 12px', fontSize: '0.78rem', gap: '6px', backgroundColor: '#2563eb', height: '28px' }}
              >
                {isCheckingIn ? <Loader2 size={12} className="spin-animation" /> : <Clock size={12} />}
                <span>Check In</span>
              </button>
            )}

            {todayAttendance.state === 'CHECKED_IN' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', padding: '2px 6px 2px 10px', borderRadius: '20px', height: '28px', boxSizing: 'border-box' }}>
                <span style={{ fontSize: '0.74rem', color: '#166534', fontWeight: 700 }}>
                  In: {todayAttendance.attendance?.check_in_formatted}
                </span>
                <button
                  type="button"
                  className="btn btn-secondary btn-xs"
                  onClick={handleQuickCheckOut}
                  disabled={isCheckingOut}
                  title="Check out from today's shift"
                  style={{ height: '22px', fontSize: '0.72rem', padding: '0 8px', borderRadius: '12px', backgroundColor: '#1e40af', color: '#ffffff', border: 'none', cursor: 'pointer' }}
                >
                  {isCheckingOut ? <Loader2 size={10} className="spin-animation" /> : 'Check Out'}
                </button>
              </div>
            )}

            {todayAttendance.state === 'COMPLETED' && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', padding: '3px 10px', borderRadius: '20px', fontSize: '0.74rem', fontWeight: 600, height: '28px', boxSizing: 'border-box' }}>
                <Check size={12} />
                <span>Today: {todayAttendance.attendance?.working_hours}</span>
              </div>
            )}
          </div>
        )}

        {/* Date Display */}
        <div className="header-date-pill">
          <Calendar size={13} className="date-icon" />
          <span>{currentDate}</span>
        </div>

        {/* Offline Alert (only displayed if backend connection is lost) */}
        {!backendStatus.online && (
          <div className="status-indicator offline">
            <span className="status-dot"></span>
            <span className="status-label">System Offline</span>
          </div>
        )}

        {/* 2FA Status Pill */}
        <button
          type="button"
          className={`two-factor-header-btn ${user?.two_factor_enabled ? 'enabled' : 'disabled'}`}
          onClick={onOpen2FAModal}
          title={user?.two_factor_enabled ? '2FA Active (Click to manage)' : '2FA Inactive (Click to setup)'}
        >
          {user?.two_factor_enabled ? (
            <>
              <ShieldCheck size={14} className="text-emerald" />
              <span>2FA Secured</span>
            </>
          ) : (
            <>
              <ShieldAlert size={14} className="text-amber" />
              <span>Enable 2FA</span>
            </>
          )}
        </button>

        {/* Master Data Refresh */}
        <button
          type="button"
          className="btn btn-secondary btn-icon-only"
          onClick={onRefresh}
          disabled={isRefreshing}
          title="Refresh real-time data from database"
          aria-label="Refresh data"
        >
          <RefreshCw size={15} className={isRefreshing ? 'spin-animation' : ''} />
        </button>

        {/* Action Button for Departments / Categories */}
        {activeView === 'departments' && departmentSubTab === 'categories' && canCreateCategory && onAddCategory && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={onAddCategory}
          >
            <Plus size={16} />
            <span>Add Category</span>
          </button>
        )}

        {activeView === 'departments' && (departmentSubTab === 'view' || !departmentSubTab) && canCreateDepartment && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={onAddDepartment}
          >
            <Plus size={16} />
            <span>Add Department</span>
          </button>
        )}

        {/* Action Button for Designations */}
        {activeView === 'designations' && canCreateDesignation && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={onAddDesignation}
          >
            <Plus size={16} />
            <span>Add Designation</span>
          </button>
        )}

        {/* Action Button for Shifts */}
        {activeView === 'shifts' && (shiftSubTab === 'view' || !shiftSubTab) && canCreateShift && onAddShift && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={onAddShift}
          >
            <Plus size={16} />
            <span>Add Shift</span>
          </button>
        )}

        {/* Action Button for Employees */}
        {activeView === 'employees' && canCreateEmployee && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={onAddEmployee}
          >
            <Plus size={16} />
            <span>Add Employee</span>
          </button>
        )}
      </div>
    </header>
  );
}

export default Header;
