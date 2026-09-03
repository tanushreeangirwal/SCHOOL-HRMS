import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  Building2, 
  Award, 
  Users, 
  ShieldCheck, 
  ChevronRight, 
  ChevronDown, 
  LogOut,
  Plus,
  UserCheck,
  CalendarClock,
  Clock,
  Calendar,
  CalendarRange,
  User,
  FileText
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import StVincentsLogo from '../common/StVincentsLogo';

export function Sidebar({ 
  activeView, 
  setActiveView, 
  departmentSubTab = 'view',
  setDepartmentSubTab,
  designationSubTab = 'view',
  setDesignationSubTab,
  shiftSubTab = 'view',
  setShiftSubTab,
  attendanceSubTab = 'dashboard',
  setAttendanceSubTab,
  leaveSubTab = 'dashboard',
  setLeaveSubTab,
  calendarSubTab = 'overview',
  setCalendarSubTab,
  employeeCount = 0,
  departmentCount = 0,
  designationCount = 0,
  shiftCount = 0,
  onOpen2FAModal,
  onOpenAddDepartment,
  onOpenAddDesignation,
  onOpenAddShift,
  onOpenAddEmployee,
  onOpenMarkAttendance
}) {
  const { user, logout, hasRole, hasPermission, isSuperAdmin, isAdmin, isHR, isManager, isEmployee } = useAuth();
  
  const [isDeptSubmenuOpen, setIsDeptSubmenuOpen] = useState(activeView === 'departments');
  const [isDesigSubmenuOpen, setIsDesigSubmenuOpen] = useState(activeView === 'designations');
  const [isShiftSubmenuOpen, setIsShiftSubmenuOpen] = useState(activeView === 'shifts');
  const [isAttendanceSubmenuOpen, setIsAttendanceSubmenuOpen] = useState(activeView === 'attendance');
  const [isLeaveSubmenuOpen, setIsLeaveSubmenuOpen] = useState(activeView === 'leave');
  const [isCalendarSubmenuOpen, setIsCalendarSubmenuOpen] = useState(activeView === 'calendar');
  const [isMyAttendanceSubmenuOpen, setIsMyAttendanceSubmenuOpen] = useState(activeView === 'my-attendance');
  const [isEmpSubmenuOpen, setIsEmpSubmenuOpen] = useState(activeView === 'employees');

  const hasEmployeeProfile = Boolean(user?.employee_id);
  const canManageDepartments = hasPermission('departments:create') || isSuperAdmin || isAdmin || isHR;
  const canAssignDepartments = hasPermission('departments:assign') || isSuperAdmin || isAdmin || isHR;
  const canManageDesignations = hasPermission('designations:create') || isSuperAdmin || isAdmin || isHR;
  const canManageShifts = hasPermission('shifts:create') || isSuperAdmin || isAdmin || isHR;
  const canAssignShifts = hasPermission('shifts:assign') || isSuperAdmin || isAdmin || isHR;
  const canCreateStaff = hasPermission('employees:create') || isSuperAdmin || isAdmin || isHR;
  const canMarkAttendance = hasPermission('attendance:mark') || isSuperAdmin || isAdmin || isHR || isManager;
  
  // View permissions
  const canViewDepartments = !isEmployee && (hasPermission('departments:read') || isSuperAdmin || isAdmin || isHR || isManager);
  const canViewDesignations = !isEmployee && (hasPermission('designations:read') || isSuperAdmin || isAdmin || isHR || isManager);
  const canViewShifts = !isEmployee && (hasPermission('shifts:read') || isSuperAdmin || isAdmin || isHR || isManager);
  const canViewAttendance = !isEmployee && (hasPermission('attendance:read') || isSuperAdmin || isAdmin || isHR || isManager);
  const canViewEmployeeDirectory = !isEmployee && (hasPermission('employees:read') || isSuperAdmin || isAdmin || isHR || isManager);

  const getDashboardLabel = () => {
    if (isSuperAdmin) return 'Executive Dashboard';
    if (isAdmin) return 'Admin Dashboard';
    if (isHR) return 'HR Dashboard';
    if (isManager) return 'Manager Dashboard';
    return 'Dashboard';
  };

  const getRoleDisplayName = (role) => {
    if (!role) return 'Faculty Member';
    if (role === 'Super Admin') return 'Principal / Super Admin';
    if (role === 'Administrator') return 'System Administrator';
    if (role === 'HR') return 'HR Officer';
    if (role === 'Manager') return 'Department Head';
    return 'Teaching Faculty';
  };

  const initials = user?.first_name && user?.last_name
    ? `${user.first_name[0]}${user.last_name[0]}`.toUpperCase()
    : (user?.email ? user.email.slice(0, 2).toUpperCase() : 'SV');

  return (
    <aside className="sidebar-clean" aria-label="Main Navigation">
      {/* Brand Header */}
      <div className="sidebar-clean-header">
        <StVincentsLogo 
          size={42} 
          title="St. Vincent's School" 
          subtitle="Human Resource System" 
          theme="dark"
        />
      </div>

      {/* Navigation List */}
      <nav className="sidebar-clean-nav">
        {/* ================================================================= */}
        {/* EMPLOYEE ROLE: DEDICATED SIMPLIFIED NAVIGATION                    */}
        {/* ================================================================= */}
        {isEmployee ? (
          <>
            {/* 1. Dashboard */}
            <button
              type="button"
              className={`clean-nav-item ${activeView === 'dashboard' ? 'active' : ''}`}
              onClick={() => setActiveView('dashboard')}
            >
              <div className="clean-nav-left">
                <LayoutDashboard size={18} className="clean-nav-icon" />
                <span className="clean-nav-text">Dashboard</span>
              </div>
              {activeView === 'dashboard' && <div className="clean-active-indicator"></div>}
            </button>

            {/* 2. My Profile */}
            <button
              type="button"
              className={`clean-nav-item ${activeView === 'employees' ? 'active' : ''}`}
              onClick={() => setActiveView('employees')}
            >
              <div className="clean-nav-left">
                <User size={18} className="clean-nav-icon" />
                <span className="clean-nav-text">My Profile</span>
              </div>
              {activeView === 'employees' && <div className="clean-active-indicator"></div>}
            </button>

            {/* 3. My Attendance */}
            <div className="clean-nav-group">
              <button
                type="button"
                className={`clean-nav-item ${activeView === 'my-attendance' ? 'active' : ''}`}
                onClick={() => {
                  setActiveView('my-attendance');
                  setIsMyAttendanceSubmenuOpen(!isMyAttendanceSubmenuOpen);
                }}
              >
                <div className="clean-nav-left">
                  <Clock size={18} className="clean-nav-icon" />
                  <span className="clean-nav-text">My Attendance</span>
                </div>
                <div className="clean-nav-right">
                  {isMyAttendanceSubmenuOpen ? (
                    <ChevronDown size={14} className="clean-chevron" />
                  ) : (
                    <ChevronRight size={14} className="clean-chevron" />
                  )}
                </div>
                {activeView === 'my-attendance' && <div className="clean-active-indicator"></div>}
              </button>

              {isMyAttendanceSubmenuOpen && (
                <div className="clean-subnav-container">
                  <button
                    type="button"
                    className={`clean-subnav-btn ${activeView === 'my-attendance' && attendanceSubTab === 'mark' ? 'active' : ''}`}
                    onClick={() => {
                      setActiveView('my-attendance');
                      setAttendanceSubTab('mark');
                    }}
                  >
                    <span className="subnav-dot">•</span>
                    <span>Mark Attendance</span>
                  </button>

                  <button
                    type="button"
                    className={`clean-subnav-btn ${activeView === 'my-attendance' && attendanceSubTab === 'history' ? 'active' : ''}`}
                    onClick={() => {
                      setActiveView('my-attendance');
                      setAttendanceSubTab('history');
                    }}
                  >
                    <span className="subnav-dot">•</span>
                    <span>Attendance History</span>
                  </button>
                </div>
              )}
            </div>

            {/* 4. My Shift */}
            <button
              type="button"
              className={`clean-nav-item ${activeView === 'my-shift' ? 'active' : ''}`}
              onClick={() => setActiveView('my-shift')}
            >
              <div className="clean-nav-left">
                <CalendarClock size={18} className="clean-nav-icon" />
                <span className="clean-nav-text">My Shift</span>
              </div>
              {activeView === 'my-shift' && <div className="clean-active-indicator"></div>}
            </button>

            {/* 5. My Leave */}
            <button
              type="button"
              className={`clean-nav-item ${activeView === 'my-leave' ? 'active' : ''}`}
              onClick={() => {
                setActiveView('my-leave');
                if (setLeaveSubTab) setLeaveSubTab('my-leave');
              }}
            >
              <div className="clean-nav-left">
                <CalendarRange size={18} className="clean-nav-icon" />
                <span className="clean-nav-text">My Leave</span>
              </div>
              {activeView === 'my-leave' && <div className="clean-active-indicator"></div>}
            </button>

            {/* 6. Academic Calendar (Staff & Faculty) */}
            <button
              type="button"
              className={`clean-nav-item ${activeView === 'calendar' ? 'active' : ''}`}
              onClick={() => {
                setActiveView('calendar');
                if (setCalendarSubTab) setCalendarSubTab('overview');
              }}
            >
              <div className="clean-nav-left">
                <Calendar size={18} className="clean-nav-icon" />
                <span className="clean-nav-text">Academic Calendar</span>
              </div>
              {activeView === 'calendar' && <div className="clean-active-indicator"></div>}
            </button>

            {/* 7. My Payslips (Coming Soon) */}
            <div className="clean-nav-item" style={{ opacity: 0.6, cursor: 'default' }} title="Payroll & Payslips Module — Coming Soon">
              <div className="clean-nav-left">
                <FileText size={18} className="clean-nav-icon" />
                <span className="clean-nav-text">My Payslips</span>
              </div>
              <div className="clean-nav-right">
                <span className="clean-nav-badge" style={{ backgroundColor: '#f1f5f9', color: '#64748b', fontSize: '0.65rem' }}>Soon</span>
              </div>
            </div>
          </>
        ) : (
          /* =============================================================== */
          /* ADMINISTRATIVE / MANAGEMENT NAVIGATION                          */
          /* =============================================================== */
          <>
            {/* 1. Role-Adaptive Dashboard */}
            <button
              type="button"
              className={`clean-nav-item ${activeView === 'dashboard' ? 'active' : ''}`}
              onClick={() => setActiveView('dashboard')}
            >
              <div className="clean-nav-left">
                <LayoutDashboard size={18} className="clean-nav-icon" />
                <span className="clean-nav-text">{getDashboardLabel()}</span>
              </div>
              {activeView === 'dashboard' && <div className="clean-active-indicator"></div>}
            </button>

            {/* 2. My Attendance (Personal for Principal, Admin, HR, Manager) */}
            {hasEmployeeProfile && (
              <div className="clean-nav-group">
                <button
                  type="button"
                  className={`clean-nav-item ${activeView === 'my-attendance' || activeView === 'my-shift' ? 'active' : ''}`}
                  onClick={() => {
                    setActiveView('my-attendance');
                    setIsMyAttendanceSubmenuOpen(!isMyAttendanceSubmenuOpen);
                  }}
                >
                  <div className="clean-nav-left">
                    <Clock size={18} className="clean-nav-icon" />
                    <span className="clean-nav-text">My Attendance</span>
                  </div>
                  <div className="clean-nav-right">
                    {isMyAttendanceSubmenuOpen ? (
                      <ChevronDown size={14} className="clean-chevron" />
                    ) : (
                      <ChevronRight size={14} className="clean-chevron" />
                    )}
                  </div>
                  {(activeView === 'my-attendance' || activeView === 'my-shift') && <div className="clean-active-indicator"></div>}
                </button>

                {isMyAttendanceSubmenuOpen && (
                  <div className="clean-subnav-container">
                    <button
                      type="button"
                      className={`clean-subnav-btn ${activeView === 'my-attendance' && attendanceSubTab === 'mark' ? 'active' : ''}`}
                      onClick={() => {
                        setActiveView('my-attendance');
                        setAttendanceSubTab('mark');
                      }}
                    >
                      <span className="subnav-dot">•</span>
                      <span>Mark Attendance</span>
                    </button>

                    <button
                      type="button"
                      className={`clean-subnav-btn ${activeView === 'my-attendance' && attendanceSubTab === 'history' ? 'active' : ''}`}
                      onClick={() => {
                        setActiveView('my-attendance');
                        setAttendanceSubTab('history');
                      }}
                    >
                      <span className="subnav-dot">•</span>
                      <span>Attendance History</span>
                    </button>

                    <button
                      type="button"
                      className={`clean-subnav-btn ${activeView === 'my-shift' ? 'active' : ''}`}
                      onClick={() => {
                        setActiveView('my-shift');
                      }}
                    >
                      <span className="subnav-dot">•</span>
                      <span>My Shift</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* 3. Departments with Sub-Navigation */}
            {canViewDepartments && (
              <div className="clean-nav-group">
                <button
                  type="button"
                  className={`clean-nav-item ${activeView === 'departments' ? 'active' : ''}`}
                  onClick={() => {
                    setActiveView('departments');
                    setIsDeptSubmenuOpen(!isDeptSubmenuOpen);
                  }}
                >
                  <div className="clean-nav-left">
                    <Building2 size={18} className="clean-nav-icon" />
                    <span className="clean-nav-text">Departments</span>
                  </div>
                  <div className="clean-nav-right">
                    {departmentCount > 0 && (
                      <span className="clean-nav-badge">{departmentCount}</span>
                    )}
                    {isDeptSubmenuOpen ? (
                      <ChevronDown size={14} className="clean-chevron" />
                    ) : (
                      <ChevronRight size={14} className="clean-chevron" />
                    )}
                  </div>
                  {activeView === 'departments' && <div className="clean-active-indicator"></div>}
                </button>

                {/* Submenu for Departments */}
                {isDeptSubmenuOpen && (
                  <div className="clean-subnav-container">
                    <button
                      type="button"
                      className={`clean-subnav-btn ${activeView === 'departments' && departmentSubTab === 'view' ? 'active' : ''}`}
                      onClick={() => {
                        setActiveView('departments');
                        setDepartmentSubTab('view');
                      }}
                    >
                      <span className="subnav-dot">•</span>
                      <span>View Departments</span>
                    </button>

                    {(isSuperAdmin || isAdmin || isHR) && (
                      <button
                        type="button"
                        className={`clean-subnav-btn ${activeView === 'departments' && departmentSubTab === 'categories' ? 'active' : ''}`}
                        onClick={() => {
                          setActiveView('departments');
                          setDepartmentSubTab('categories');
                        }}
                      >
                        <span className="subnav-dot">•</span>
                        <span>Department Categories</span>
                      </button>
                    )}

                    {canAssignDepartments && (
                      <button
                        type="button"
                        className={`clean-subnav-btn ${activeView === 'departments' && departmentSubTab === 'assign' ? 'active' : ''}`}
                        onClick={() => {
                          setActiveView('departments');
                          setDepartmentSubTab('assign');
                        }}
                      >
                        <span className="subnav-dot">•</span>
                        <span>Assign Employees</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 4. Designations with Sub-Navigation */}
            {canViewDesignations && (
              <div className="clean-nav-group">
                <button
                  type="button"
                  className={`clean-nav-item ${activeView === 'designations' ? 'active' : ''}`}
                  onClick={() => {
                    setActiveView('designations');
                    setIsDesigSubmenuOpen(!isDesigSubmenuOpen);
                  }}
                >
                  <div className="clean-nav-left">
                    <Award size={18} className="clean-nav-icon" />
                    <span className="clean-nav-text">Designations</span>
                  </div>
                  <div className="clean-nav-right">
                    {designationCount > 0 && (
                      <span className="clean-nav-badge">{designationCount}</span>
                    )}
                    {isDesigSubmenuOpen ? (
                      <ChevronDown size={14} className="clean-chevron" />
                    ) : (
                      <ChevronRight size={14} className="clean-chevron" />
                    )}
                  </div>
                  {activeView === 'designations' && <div className="clean-active-indicator"></div>}
                </button>

                {/* Submenu for Designations */}
                {isDesigSubmenuOpen && (
                  <div className="clean-subnav-container">
                    <button
                      type="button"
                      className={`clean-subnav-btn ${activeView === 'designations' && designationSubTab === 'view' ? 'active' : ''}`}
                      onClick={() => {
                        setActiveView('designations');
                        setDesignationSubTab('view');
                      }}
                    >
                      <span className="subnav-dot">•</span>
                      <span>View Designations</span>
                    </button>

                    {canManageDesignations && (
                      <button
                        type="button"
                        className="clean-subnav-btn"
                        onClick={onOpenAddDesignation}
                      >
                        <span className="subnav-dot">•</span>
                        <span>Add Designation</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 5. Shift & Schedule with Sub-Navigation */}
            {canViewShifts && (
              <div className="clean-nav-group">
                <button
                  type="button"
                  className={`clean-nav-item ${activeView === 'shifts' ? 'active' : ''}`}
                  onClick={() => {
                    setActiveView('shifts');
                    setIsShiftSubmenuOpen(!isShiftSubmenuOpen);
                  }}
                >
                  <div className="clean-nav-left">
                    <CalendarClock size={18} className="clean-nav-icon" />
                    <span className="clean-nav-text">Shift & Schedule</span>
                  </div>
                  <div className="clean-nav-right">
                    {shiftCount > 0 && (
                      <span className="clean-nav-badge">{shiftCount}</span>
                    )}
                    {isShiftSubmenuOpen ? (
                      <ChevronDown size={14} className="clean-chevron" />
                    ) : (
                      <ChevronRight size={14} className="clean-chevron" />
                    )}
                  </div>
                  {activeView === 'shifts' && <div className="clean-active-indicator"></div>}
                </button>

                {/* Submenu for Shifts */}
                {isShiftSubmenuOpen && (
                  <div className="clean-subnav-container">
                    <button
                      type="button"
                      className={`clean-subnav-btn ${activeView === 'shifts' && shiftSubTab === 'view' ? 'active' : ''}`}
                      onClick={() => {
                        setActiveView('shifts');
                        setShiftSubTab('view');
                      }}
                    >
                      <span className="subnav-dot">•</span>
                      <span>View Shifts</span>
                    </button>

                    {canManageShifts && (
                      <button
                        type="button"
                        className="clean-subnav-btn"
                        onClick={onOpenAddShift}
                      >
                        <span className="subnav-dot">•</span>
                        <span>Add Shift</span>
                      </button>
                    )}

                    {canAssignShifts && (
                      <button
                        type="button"
                        className={`clean-subnav-btn ${activeView === 'shifts' && shiftSubTab === 'assign' ? 'active' : ''}`}
                        onClick={() => {
                          setActiveView('shifts');
                          setShiftSubTab('assign');
                        }}
                      >
                        <span className="subnav-dot">•</span>
                        <span>Assign Employees</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 6. Attendance Management (Administrative) */}
            {canViewAttendance && (
              <div className="clean-nav-group">
                <button
                  type="button"
                  className={`clean-nav-item ${activeView === 'attendance' ? 'active' : ''}`}
                  onClick={() => {
                    setActiveView('attendance');
                    setIsAttendanceSubmenuOpen(!isAttendanceSubmenuOpen);
                  }}
                >
                  <div className="clean-nav-left">
                    <ShieldCheck size={18} className="clean-nav-icon" />
                    <span className="clean-nav-text">Attendance Management</span>
                  </div>
                  <div className="clean-nav-right">
                    {isAttendanceSubmenuOpen ? (
                      <ChevronDown size={14} className="clean-chevron" />
                    ) : (
                      <ChevronRight size={14} className="clean-chevron" />
                    )}
                  </div>
                  {activeView === 'attendance' && <div className="clean-active-indicator"></div>}
                </button>

                {/* Submenu for Attendance */}
                {isAttendanceSubmenuOpen && (
                  <div className="clean-subnav-container">
                    <button
                      type="button"
                      className={`clean-subnav-btn ${activeView === 'attendance' && attendanceSubTab === 'dashboard' ? 'active' : ''}`}
                      onClick={() => {
                        setActiveView('attendance');
                        setAttendanceSubTab('dashboard');
                      }}
                    >
                      <span className="subnav-dot">•</span>
                      <span>Attendance Dashboard</span>
                    </button>

                    <button
                      type="button"
                      className={`clean-subnav-btn ${activeView === 'attendance' && attendanceSubTab === 'daily' ? 'active' : ''}`}
                      onClick={() => {
                        setActiveView('attendance');
                        setAttendanceSubTab('daily');
                      }}
                    >
                      <span className="subnav-dot">•</span>
                      <span>Daily Attendance</span>
                    </button>

                    <button
                      type="button"
                      className={`clean-subnav-btn ${activeView === 'attendance' && attendanceSubTab === 'register' ? 'active' : ''}`}
                      onClick={() => {
                        setActiveView('attendance');
                        setAttendanceSubTab('register');
                      }}
                    >
                      <span className="subnav-dot">•</span>
                      <span>Attendance Register</span>
                    </button>

                    <button
                      type="button"
                      className={`clean-subnav-btn ${activeView === 'attendance' && attendanceSubTab === 'employee' ? 'active' : ''}`}
                      onClick={() => {
                        setActiveView('attendance');
                        setAttendanceSubTab('employee');
                      }}
                    >
                      <span className="subnav-dot">•</span>
                      <span>Employee Attendance</span>
                    </button>

                    <button
                      type="button"
                      className={`clean-subnav-btn ${activeView === 'attendance' && attendanceSubTab === 'reports' ? 'active' : ''}`}
                      onClick={() => {
                        setActiveView('attendance');
                        setAttendanceSubTab('reports');
                      }}
                    >
                      <span className="subnav-dot">•</span>
                      <span>Attendance Reports</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* 7. Leave Management */}
            <div className="clean-nav-group">
              <button
                type="button"
                className={`clean-nav-item ${activeView === 'leave' || activeView === 'my-leave' ? 'active' : ''}`}
                onClick={() => {
                  setActiveView('leave');
                  setIsLeaveSubmenuOpen(!isLeaveSubmenuOpen);
                }}
              >
                <div className="clean-nav-left">
                  <CalendarRange size={18} className="clean-nav-icon" />
                  <span className="clean-nav-text">Leave Management</span>
                </div>
                <div className="clean-nav-right">
                  {isLeaveSubmenuOpen ? (
                    <ChevronDown size={14} className="clean-chevron" />
                  ) : (
                    <ChevronRight size={14} className="clean-chevron" />
                  )}
                </div>
                {(activeView === 'leave' || activeView === 'my-leave') && <div className="clean-active-indicator"></div>}
              </button>

              {/* Submenu for Leave */}
              {isLeaveSubmenuOpen && (
                <div className="clean-subnav-container">
                  <button
                    type="button"
                    className={`clean-subnav-btn ${activeView === 'leave' && leaveSubTab === 'dashboard' ? 'active' : ''}`}
                    onClick={() => {
                      setActiveView('leave');
                      if (setLeaveSubTab) setLeaveSubTab('dashboard');
                    }}
                  >
                    <span className="subnav-dot">•</span>
                    <span>Leave Dashboard</span>
                  </button>

                  <button
                    type="button"
                    className={`clean-subnav-btn ${activeView === 'leave' && leaveSubTab === 'requests' ? 'active' : ''}`}
                    onClick={() => {
                      setActiveView('leave');
                      if (setLeaveSubTab) setLeaveSubTab('requests');
                    }}
                  >
                    <span className="subnav-dot">•</span>
                    <span>Leave Requests</span>
                  </button>

                  <button
                    type="button"
                    className={`clean-subnav-btn ${activeView === 'my-leave' || (activeView === 'leave' && leaveSubTab === 'my-leave') ? 'active' : ''}`}
                    onClick={() => {
                      setActiveView('my-leave');
                      if (setLeaveSubTab) setLeaveSubTab('my-leave');
                    }}
                  >
                    <span className="subnav-dot">•</span>
                    <span>My Leave Quota</span>
                  </button>

                  <button
                    type="button"
                    className={`clean-subnav-btn ${activeView === 'leave' && leaveSubTab === 'calendar' ? 'active' : ''}`}
                    onClick={() => {
                      setActiveView('leave');
                      if (setLeaveSubTab) setLeaveSubTab('calendar');
                    }}
                  >
                    <span className="subnav-dot">•</span>
                    <span>Absence Calendar</span>
                  </button>

                  {(isSuperAdmin || isAdmin || isHR) && (
                    <button
                      type="button"
                      className={`clean-subnav-btn ${activeView === 'leave' && leaveSubTab === 'types' ? 'active' : ''}`}
                      onClick={() => {
                        setActiveView('leave');
                        if (setLeaveSubTab) setLeaveSubTab('types');
                      }}
                    >
                      <span className="subnav-dot">•</span>
                      <span>Leave Categories</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* 8. Academic Calendar & Holiday Management */}
            <div className="clean-nav-group">
              <button
                type="button"
                className={`clean-nav-item ${activeView === 'calendar' ? 'active' : ''}`}
                onClick={() => {
                  setActiveView('calendar');
                  setIsCalendarSubmenuOpen(!isCalendarSubmenuOpen);
                }}
              >
                <div className="clean-nav-left">
                  <Calendar size={18} className="clean-nav-icon" />
                  <span className="clean-nav-text">Academic Calendar</span>
                </div>
                <div className="clean-nav-right">
                  {isCalendarSubmenuOpen ? (
                    <ChevronDown size={14} className="clean-chevron" />
                  ) : (
                    <ChevronRight size={14} className="clean-chevron" />
                  )}
                </div>
                {activeView === 'calendar' && <div className="clean-active-indicator"></div>}
              </button>

              {/* Submenu for Calendar */}
              {isCalendarSubmenuOpen && (
                <div className="clean-subnav-container">
                  <button
                    type="button"
                    className={`clean-subnav-btn ${activeView === 'calendar' && calendarSubTab === 'overview' ? 'active' : ''}`}
                    onClick={() => {
                      setActiveView('calendar');
                      if (setCalendarSubTab) setCalendarSubTab('overview');
                    }}
                  >
                    <span className="subnav-dot">•</span>
                    <span>Calendar Overview</span>
                  </button>

                  <button
                    type="button"
                    className={`clean-subnav-btn ${activeView === 'calendar' && calendarSubTab === 'holidays' ? 'active' : ''}`}
                    onClick={() => {
                      setActiveView('calendar');
                      if (setCalendarSubTab) setCalendarSubTab('holidays');
                    }}
                  >
                    <span className="subnav-dot">•</span>
                    <span>Holidays & Closures</span>
                  </button>

                  <button
                    type="button"
                    className={`clean-subnav-btn ${activeView === 'calendar' && calendarSubTab === 'terms' ? 'active' : ''}`}
                    onClick={() => {
                      setActiveView('calendar');
                      if (setCalendarSubTab) setCalendarSubTab('terms');
                    }}
                  >
                    <span className="subnav-dot">•</span>
                    <span>School Terms</span>
                  </button>

                  <button
                    type="button"
                    className={`clean-subnav-btn ${activeView === 'calendar' && calendarSubTab === 'years' ? 'active' : ''}`}
                    onClick={() => {
                      setActiveView('calendar');
                      if (setCalendarSubTab) setCalendarSubTab('years');
                    }}
                  >
                    <span className="subnav-dot">•</span>
                    <span>Academic Sessions</span>
                  </button>
                </div>
              )}
            </div>

            {/* 9. Staff & Faculty with Submenu */}
            <div className="clean-nav-group">
              <button
                type="button"
                className={`clean-nav-item ${activeView === 'employees' ? 'active' : ''}`}
                onClick={() => {
                  setActiveView('employees');
                  setIsEmpSubmenuOpen(!isEmpSubmenuOpen);
                }}
              >
                <div className="clean-nav-left">
                  <Users size={18} className="clean-nav-icon" />
                  <span className="clean-nav-text">Staff & Faculty</span>
                </div>
                <div className="clean-nav-right">
                  {employeeCount > 0 && (
                    <span className="clean-nav-badge">{employeeCount}</span>
                  )}
                  {isEmpSubmenuOpen ? (
                    <ChevronDown size={14} className="clean-chevron" />
                  ) : (
                    <ChevronRight size={14} className="clean-chevron" />
                  )}
                </div>
                {activeView === 'employees' && <div className="clean-active-indicator"></div>}
              </button>

              {/* Submenu for Employees */}
              {isEmpSubmenuOpen && (
                <div className="clean-subnav-container">
                  <button
                    type="button"
                    className="clean-subnav-btn active"
                    onClick={() => setActiveView('employees')}
                  >
                    <span className="subnav-dot">•</span>
                    <span>View Directory</span>
                  </button>

                  {canCreateStaff && (
                    <button
                      type="button"
                      className="clean-subnav-btn"
                      onClick={onOpenAddEmployee}
                    >
                      <span className="subnav-dot">•</span>
                      <span>Add Employee</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {/* 2FA Security Modal Trigger */}
        <button
          type="button"
          className="clean-nav-item"
          onClick={onOpen2FAModal}
        >
          <div className="clean-nav-left">
            <ShieldCheck size={18} className="clean-nav-icon" />
            <span className="clean-nav-text">2FA Security</span>
          </div>
          <div className="clean-nav-right">
            <span className={`clean-security-tag ${user?.two_factor_enabled ? 'active' : ''}`}>
              {user?.two_factor_enabled ? 'Active' : 'Setup'}
            </span>
          </div>
        </button>
      </nav>

      {/* Footer User Info */}
      <div className="clean-sidebar-footer">
        <div className="clean-user-badge">
          <div className="clean-user-avatar">
            {user?.profile_photo_url ? (
              <img src={user.profile_photo_url} alt="" />
            ) : (
              <span>{initials}</span>
            )}
          </div>
          <div className="clean-user-details">
            <span className="clean-user-name" title={user?.email}>
              {user?.full_name || user?.email?.split('@')[0]}
            </span>
            <span className="clean-user-role">{getRoleDisplayName(user?.role)}</span>
          </div>
          <button
            type="button"
            className="clean-logout-btn"
            onClick={logout}
            title="Sign out"
            aria-label="Sign out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
