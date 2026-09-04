import React, { useState, useEffect, useCallback } from 'react';
import { 
  Users, 
  Building2, 
  CalendarCheck, 
  Clock, 
  UserPlus, 
  ArrowRight,
  Sparkles,
  Award,
  CheckCircle2,
  ShieldCheck,
  ShieldAlert,
  User,
  Mail,
  IdCard,
  GraduationCap,
  UserCheck,
  DollarSign,
  AlertCircle,
  FileText,
  Check,
  ExternalLink,
  RefreshCw,
  Layers,
  Calendar,
  AlertTriangle,
  ChevronRight,
  TrendingUp,
  CreditCard,
  Briefcase
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCalendarSync } from '../../context/CalendarSyncContext';
import { hrmsApi } from '../../services/api';

export function DashboardView({ 
  employees = [], 
  departments = [],
  onNavigateToEmployees, 
  onNavigateToDepartments,
  onNavigateToAttendance,
  onNavigateToShifts,
  onNavigateToLeave,
  onNavigateToCalendar,
  onNavigateToPayroll,
  onNavigateToMyAttendance,
  onNavigateToMyPayslips,
  onAddEmployee,
  onAddDepartment,
  onOpen2FAModal 
}) {
  const { user, hasPermission, isSuperAdmin, isAdmin, isHR, isManager, isEmployee } = useAuth();
  const { calendarVersion } = useCalendarSync();

  // Cross-module live data states
  const [attendanceData, setAttendanceData] = useState(null);
  const [leaveData, setLeaveData] = useState(null);
  const [payrollData, setPayrollData] = useState(null);
  const [calendarData, setCalendarData] = useState(null);
  const [shiftsData, setShiftsData] = useState([]);
  const [isLoadingKPIs, setIsLoadingKPIs] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [kpiError, setKpiError] = useState(null);

  // Fetch cross-module KPI data using existing summary APIs
  const fetchDashboardKPIs = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsLoadingKPIs(true);
    else setIsRefreshing(true);
    setKpiError(null);

    try {
      const promises = [
        hrmsApi.getAttendanceDashboard().catch(err => ({ error: true, message: err.message })),
        hrmsApi.getLeaveDashboard().catch(err => ({ error: true, message: err.message })),
        hrmsApi.getCalendarOverview().catch(err => ({ error: true, message: err.message })),
        hrmsApi.getShifts().catch(err => ({ error: true, message: err.message }))
      ];

      // Only fetch payroll if authorized (Super Admin, HR, or with payroll:read)
      if (isSuperAdmin || isHR || hasPermission('payroll:read')) {
        promises.push(hrmsApi.getPayrollOverview().catch(err => ({ error: true, message: err.message })));
      }

      const results = await Promise.all(promises);
      const [attRes, leaveRes, calRes, shiftsRes, payRes] = results;

      if (attRes && attRes.success && attRes.data) {
        setAttendanceData(attRes.data);
      }
      if (leaveRes && leaveRes.success && leaveRes.data) {
        setLeaveData(leaveRes.data);
      }
      if (calRes && calRes.success && calRes.data) {
        setCalendarData(calRes.data);
      }
      if (shiftsRes && shiftsRes.success && shiftsRes.data) {
        setShiftsData(shiftsRes.data || []);
      }
      if (payRes && payRes.success && payRes.data) {
        setPayrollData(payRes.data);
      }
    } catch (err) {
      console.error('Error fetching dashboard KPIs:', err);
      setKpiError('Unable to load some real-time metrics.');
    } finally {
      setIsLoadingKPIs(false);
      setIsRefreshing(false);
    }
  }, [isSuperAdmin, isHR, hasPermission]);

  useEffect(() => {
    fetchDashboardKPIs();
  }, [fetchDashboardKPIs]);

  // Real-time synchronization: Re-fetch dashboard KPIs when calendar events are modified
  useEffect(() => {
    if (calendarVersion > 0) {
      fetchDashboardKPIs(true);
    }
  }, [calendarVersion, fetchDashboardKPIs]);

  // Derived Workforce Stats
  const totalEmployees = employees.length;
  const activeEmployees = employees.filter(e => (e.employment_status || '').toLowerCase() === 'active').length;
  const probationEmployees = employees.filter(e => (e.employment_status || '').toLowerCase() === 'probation').length;
  const inactiveEmployees = employees.filter(e => (e.employment_status || '').toLowerCase() === 'inactive').length;
  
  // Teaching vs Non-Teaching calculation
  const teachingStaff = employees.filter(e => {
    const dept = (e.department_name || e.department || '').toLowerCase();
    return dept.includes('faculty') || dept.includes('science') || dept.includes('humanities') || dept.includes('language') || dept.includes('sports') || dept.includes('academic');
  }).length;
  const nonTeachingStaff = totalEmployees - teachingStaff;

  const totalDepartments = departments.length;
  const activeDepartments = departments.filter(d => d.is_active).length;
  const departmentsWithHead = departments.filter(d => Boolean(d.head_name)).length;
  const vacantHODDepts = departments.filter(d => !d.head_name && d.is_active);

  const employeesWithShift = employees.filter(e => e.current_shift_id || e.shift_name);
  const employeesWithoutShift = employees.filter(e => !e.current_shift_id && !e.shift_name && (e.employment_status || '').toLowerCase() !== 'inactive');

  const employeesWithSalary = employees.filter(e => e.salary_structure_name);
  const employeesWithoutSalary = employees.filter(e => !e.salary_structure_name && (e.employment_status || '').toLowerCase() !== 'inactive');

  // Attendance Metrics
  const attMetrics = attendanceData?.metrics;
  const presentCount = attMetrics ? (Number(attMetrics.present || 0) + Number(attMetrics.late || 0)) : null;
  const onLeaveToday = attMetrics ? Number(attMetrics.on_leave || 0) : (leaveData?.on_leave_today_count || 0);
  const absentCount = attMetrics ? Number(attMetrics.absent || 0) : null;
  const attendanceRate = attMetrics?.attendance_rate != null ? `${attMetrics.attendance_rate}%` : null;

  // Calendar Metrics
  const activeTermName = calendarData?.active_term?.name || calendarData?.active_year?.name || 'Active Term';
  const upcomingEvent = calendarData?.upcoming_events?.[0] || calendarData?.upcoming_holiday || null;

  // Manager Scope
  const managerEmpId = user?.employee_id;
  const managerEmployee = employees.find(e => e.id === managerEmpId || e.work_email === user?.email);
  const managerDeptId = managerEmployee?.department_id;
  const managerDept = departments.find(d => d.id === managerDeptId || d.name === managerEmployee?.department_name);
  const managerTeam = employees.filter(e => e.department_id === managerDeptId || (managerDept && e.department_name === managerDept.name));
  
  // Department Attendance for Manager
  const deptAttSummary = attendanceData?.department_summary?.find(ds => ds.department === managerDept?.name);
  const mgrPresent = deptAttSummary ? (Number(deptAttSummary.present || 0) + Number(deptAttSummary.late || 0)) : managerTeam.filter(e => (e.attendance_status || '').toLowerCase() === 'present').length;
  const mgrLate = deptAttSummary ? Number(deptAttSummary.late || 0) : 0;
  const mgrAbsent = deptAttSummary ? Number(deptAttSummary.absent || 0) : 0;
  const mgrOnLeave = deptAttSummary ? Number(deptAttSummary.onLeave || 0) : 0;
  const mgrRate = deptAttSummary?.attendanceRate != null ? `${deptAttSummary.attendanceRate}%` : (managerTeam.length > 0 ? `${Math.round((mgrPresent / managerTeam.length) * 100)}%` : '—');

  // Manager Pending Leaves
  const managerPendingLeaves = (leaveData?.pending_requests || []).filter(lr => 
    lr.department_name === managerDept?.name || managerTeam.some(m => m.id === lr.employee_id)
  );

  const canCreateStaff = hasPermission('employees:create') || isSuperAdmin || isAdmin || isHR;

  // -------------------------------------------------------------------------
  // ACTION REQUIRED HUB RENDERER
  // -------------------------------------------------------------------------
  const renderActionRequiredHub = () => {
    const actionItems = [];

    // 1. Pending Leaves (Super Admin, HR, or Manager with team leaves)
    const pendingLeaveCount = isManager && !isSuperAdmin && !isHR 
      ? managerPendingLeaves.length 
      : (leaveData?.pending_leaves_count || 0);

    if (pendingLeaveCount > 0) {
      actionItems.push({
        id: 'leaves-pending',
        title: `${pendingLeaveCount} Leave Request${pendingLeaveCount > 1 ? 's' : ''} Awaiting Review`,
        priority: 'high',
        description: isManager && !isSuperAdmin && !isHR 
          ? `Department staff have submitted ${pendingLeaveCount} leave request(s) requiring managerial recommendation.`
          : `Faculty and staff have submitted ${pendingLeaveCount} leave application(s) awaiting administrative review.`,
        actionLabel: 'Review Leaves',
        icon: <CalendarCheck size={16} className="text-amber" />,
        onClick: () => onNavigateToLeave && onNavigateToLeave('requests')
      });
    }

    // 2. Payroll Run Pending or Awaiting Approval (Super Admin, HR)
    if ((isSuperAdmin || isHR) && payrollData) {
      if (payrollData.run_status === 'Processed') {
        actionItems.push({
          id: 'payroll-approval',
          title: `Payroll Awaiting Approval (${payrollData.month_name || 'Current Month'})`,
          priority: 'high',
          description: `Calculation completed for ${payrollData.processed_employees} staff members (Net: ₹${Number(payrollData.net_payroll || 0).toLocaleString('en-IN')}). Awaiting administrative sign-off.`,
          actionLabel: 'Review Payroll',
          icon: <DollarSign size={16} className="text-emerald" />,
          onClick: () => onNavigateToPayroll && onNavigateToPayroll('records')
        });
      } else if (payrollData.run_status === 'Pending Run' || payrollData.pending_employees > 0) {
        actionItems.push({
          id: 'payroll-pending',
          title: `Monthly Payroll Not Yet Processed (${payrollData.month_name || 'Current Month'})`,
          priority: 'medium',
          description: `${payrollData.total_employees} staff members are scheduled for monthly compensation calculation.`,
          actionLabel: 'Open Payroll',
          icon: <DollarSign size={16} className="text-blue" />,
          onClick: () => onNavigateToPayroll && onNavigateToPayroll('dashboard')
        });
      }
    }

    // 3. Unassigned Shifts (Admin, HR, Super Admin)
    if ((isAdmin || isHR || isSuperAdmin) && employeesWithoutShift.length > 0) {
      actionItems.push({
        id: 'shifts-unassigned',
        title: `${employeesWithoutShift.length} Staff Member${employeesWithoutShift.length > 1 ? 's' : ''} Without Shift Assigned`,
        priority: 'medium',
        description: 'Unassigned employees cannot track roster adherence or calculate tardiness grace periods.',
        actionLabel: 'Assign Shifts',
        icon: <Clock size={16} className="text-indigo" />,
        onClick: () => onNavigateToShifts && onNavigateToShifts('assign')
      });
    }

    // 4. Unassigned Salary Structures (HR, Super Admin)
    if ((isHR || isSuperAdmin) && employeesWithoutSalary.length > 0) {
      actionItems.push({
        id: 'salaries-unassigned',
        title: `${employeesWithoutSalary.length} Employee${employeesWithoutSalary.length > 1 ? 's' : ''} Without Salary Structure`,
        priority: 'medium',
        description: 'Staff members need a mapped structure and monthly gross before automated payroll runs.',
        actionLabel: 'Assign Structures',
        icon: <CreditCard size={16} className="text-purple" />,
        onClick: () => onNavigateToPayroll && onNavigateToPayroll('structures')
      });
    }

    // 5. Vacant HODs (Admin, Super Admin)
    if ((isAdmin || isSuperAdmin) && vacantHODDepts.length > 0) {
      actionItems.push({
        id: 'hod-vacant',
        title: `${vacantHODDepts.length} Academic Department${vacantHODDepts.length > 1 ? 's' : ''} Without HOD`,
        priority: 'low',
        description: `Wings without designated leadership: ${vacantHODDepts.map(d => d.name).slice(0, 2).join(', ')}${vacantHODDepts.length > 2 ? '...' : ''}.`,
        actionLabel: 'Appoint HOD',
        icon: <Building2 size={16} className="text-slate" />,
        onClick: () => onNavigateToDepartments && onNavigateToDepartments()
      });
    }

    if (actionItems.length === 0) {
      return null;
    }

    return (
      <div className="action-required-container" style={{
        backgroundColor: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        padding: '18px 22px',
        marginBottom: '24px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444' }}></div>
            <h3 style={{ fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#0f172a', margin: 0 }}>
              Action Required & Pending Approvals
            </h3>
            <span style={{ fontSize: '0.72rem', backgroundColor: '#fee2e2', color: '#b91c1c', fontWeight: 700, padding: '2px 8px', borderRadius: '12px' }}>
              {actionItems.length}
            </span>
          </div>
          <button 
            type="button" 
            className="btn btn-ghost btn-xs" 
            onClick={() => fetchDashboardKPIs(true)}
            disabled={isRefreshing}
            style={{ fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#64748b' }}
          >
            <RefreshCw size={12} className={isRefreshing ? 'spin-anim' : ''} />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {actionItems.map(item => (
            <div 
              key={item.id} 
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                backgroundColor: item.priority === 'high' ? '#fffaf0' : '#f8fafc',
                border: item.priority === 'high' ? '1px solid #fed7aa' : '1px solid #e2e8f0',
                borderRadius: '8px',
                gap: '12px',
                flexWrap: 'wrap'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', flex: 1, minWidth: '240px' }}>
                <div style={{ marginTop: '2px' }}>{item.icon}</div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#0f172a' }}>
                      {item.title}
                    </span>
                    <span style={{
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      padding: '1px 6px',
                      borderRadius: '4px',
                      backgroundColor: item.priority === 'high' ? '#fee2e2' : '#e0f2fe',
                      color: item.priority === 'high' ? '#991b1b' : '#0369a1'
                    }}>
                      {item.priority} priority
                    </span>
                  </div>
                  <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                    {item.description}
                  </p>
                </div>
              </div>

              <div>
                <button
                  type="button"
                  className="btn btn-secondary btn-xs"
                  onClick={item.onClick}
                  style={{
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    color: '#2563eb',
                    backgroundColor: '#ffffff',
                    border: '1px solid #cbd5e1',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <span>{item.actionLabel}</span>
                  <ChevronRight size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // =========================================================================
  // 1. SUPER ADMIN / PRINCIPAL DASHBOARD
  // =========================================================================
  if (isSuperAdmin) {
    return (
      <div className="dashboard-content">
        {/* Principal Welcome Banner */}
        <div className="dashboard-welcome-banner superadmin-banner">
          <div className="welcome-text-container">
            <div className="welcome-tag">
              <Sparkles size={14} />
              <span>👑 Super Admin • Principal Portal</span>
            </div>

            <h2 className="welcome-title">
              St. Vincent's High School • Institutional Governance & Executive Oversight
            </h2>

            <p className="welcome-subtitle">
              Welcome, Principal! Comprehensive institutional dashboard providing school-wide workforce analytics, faculty headcounts, academic department status, and system security controls.
            </p>

            <div className="welcome-buttons">
              <button 
                type="button" 
                className="btn btn-primary" 
                onClick={onNavigateToDepartments}
              >
                <Building2 size={16} />
                <span>{`Academic Faculties (${totalDepartments})`}</span>
              </button>

              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={onNavigateToEmployees}
              >
                <Users size={16} />
                <span>{`Staff Directory (${totalEmployees})`}</span>
              </button>

              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => onNavigateToPayroll && onNavigateToPayroll('dashboard')}
              >
                <DollarSign size={16} />
                <span>Payroll Console</span>
              </button>

              {user?.employee_id && onNavigateToMyAttendance && (
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={onNavigateToMyAttendance}
                  title="Mark your personal daily attendance"
                >
                  <Clock size={16} />
                  <span>My Attendance</span>
                </button>
              )}

              {canCreateStaff && (
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={onAddEmployee}
                >
                  <UserPlus size={16} />
                  <span>Register Staff</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Action Required Hub */}
        {renderActionRequiredHub()}

        {/* 4 Executive KPI Cards */}
        <div className="dashboard-metrics-grid">
          {/* Card 1: LIVE CAMPUS PRESENCE */}
          <div 
            className="kpi-card" 
            onClick={onNavigateToAttendance} 
            style={{ cursor: 'pointer' }}
            title="Click to open full Attendance Management Console"
          >
            <div className="kpi-header">
              <span className="kpi-title">Live Campus Presence</span>
              <div className="kpi-icon-pill emerald">
                <CalendarCheck size={18} />
              </div>
            </div>
            <div className="kpi-body">
              <span className="kpi-value">
                {presentCount !== null ? presentCount : '—'}
                <span style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: 500, marginLeft: '6px' }}>
                  / {totalEmployees} on duty
                </span>
              </span>
              <div className="kpi-trend trend-positive" style={{ marginTop: '4px' }}>
                <span>
                  {attendanceRate ? `${attendanceRate} punctuality` : `${activeEmployees} active staff`}
                  {onLeaveToday > 0 && ` • ${onLeaveToday} on leave`}
                  {absentCount > 0 && ` • ${absentCount} absent`}
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: MONTHLY PAYROLL */}
          <div 
            className="kpi-card" 
            onClick={() => onNavigateToPayroll && onNavigateToPayroll('dashboard')} 
            style={{ cursor: 'pointer' }}
            title="Click to open Payroll Management Console"
          >
            <div className="kpi-header">
              <span className="kpi-title">
                {payrollData?.month_name ? `Payroll (${payrollData.month_name})` : 'Monthly Payroll'}
              </span>
              <div className="kpi-icon-pill indigo">
                <DollarSign size={18} />
              </div>
            </div>
            <div className="kpi-body">
              <span className="kpi-value">
                {payrollData?.net_payroll != null ? `₹${Number(payrollData.net_payroll).toLocaleString('en-IN')}` : '—'}
              </span>
              <div className="kpi-trend trend-positive" style={{ marginTop: '4px' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  {payrollData ? (
                    <>
                      <span>{payrollData.processed_employees}/{payrollData.total_employees} processed</span>
                      <span className={`badge badge-${payrollData.run_status === 'Paid' ? 'success' : payrollData.run_status === 'Approved' ? 'info' : 'warning'}`} style={{ fontSize: '0.65rem', padding: '1px 5px' }}>
                        {payrollData.run_status}
                      </span>
                    </>
                  ) : (
                    <span>Compensation status</span>
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Card 3: ACADEMIC CALENDAR */}
          <div 
            className="kpi-card" 
            onClick={() => onNavigateToCalendar && onNavigateToCalendar('overview')} 
            style={{ cursor: 'pointer' }}
            title="Click to open Academic Calendar"
          >
            <div className="kpi-header">
              <span className="kpi-title">{activeTermName}</span>
              <div className="kpi-icon-pill sky">
                <Calendar size={18} />
              </div>
            </div>
            <div className="kpi-body">
              <span className="kpi-value" style={{ fontSize: '1.25rem', lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {upcomingEvent?.title || 'Active Session'}
              </span>
              <div className="kpi-trend trend-neutral" style={{ marginTop: '4px' }}>
                <span>
                  {upcomingEvent ? (
                    `${upcomingEvent.days_remaining > 0 ? `${upcomingEvent.days_remaining} days away` : 'Happening today'}${upcomingEvent.start_time ? ` at ${upcomingEvent.start_time}` : ''} • ${upcomingEvent.category || upcomingEvent.event_type || 'Event'}`
                  ) : (
                    'Academic Term in Progress'
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Card 4: INSTITUTIONAL FACULTIES */}
          <div 
            className="kpi-card" 
            onClick={onNavigateToDepartments} 
            style={{ cursor: 'pointer' }}
            title="Click to view Academic Departments"
          >
            <div className="kpi-header">
              <span className="kpi-title">Faculties & Wings</span>
              <div className="kpi-icon-pill amber">
                <Building2 size={18} />
              </div>
            </div>
            <div className="kpi-body">
              <span className="kpi-value">{totalDepartments}</span>
              <div className="kpi-trend trend-positive" style={{ marginTop: '4px' }}>
                <span>
                  {teachingStaff} Teaching • {nonTeachingStaff} Support Staff
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Lower Institutional Governance Grid */}
        <div className="dashboard-sections-grid">
          {/* Department Breakdown */}
          <div className="dashboard-card">
            <div className="dashboard-card-header">
              <div>
                <h3 className="card-title">Academic Faculties & Head of Departments</h3>
                <p className="card-subtitle">Real-time faculty allocations and leadership oversight</p>
              </div>
              <button type="button" className="btn-link" onClick={onNavigateToDepartments}>
                <span>Manage All</span>
                <ArrowRight size={14} />
              </button>
            </div>

            <div className="recent-staff-list">
              {departments.slice(0, 5).map((dept) => (
                <div key={dept.id} className="recent-staff-item" onClick={onNavigateToDepartments} style={{ cursor: 'pointer' }}>
                  <div className="staff-avatar-initials small" style={{ backgroundColor: '#ede9fe', color: '#5b21b6' }}>
                    <Building2 size={14} />
                  </div>
                  <div className="recent-staff-info">
                    <span className="recent-staff-name">{dept.name}</span>
                    <span className="recent-staff-code text-monospace">
                      {dept.code || 'DEPT'} • {dept.head_name ? `HOD: ${dept.head_name}` : 'HOD: Pending Appointment'}
                    </span>
                  </div>
                  <span className="staff-count-badge badge-has-staff">
                    <Users size={11} />
                    <span>{dept.employee_count || 0} Faculty</span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Institutional Governance & Quick Launchpad */}
          <div className="dashboard-card quick-actions-card">
            <div className="dashboard-card-header">
              <div>
                <h3 className="card-title">Executive Governance & Controls</h3>
                <p className="card-subtitle">Institutional security, 2FA status and RBAC controls</p>
              </div>
            </div>

            <div className="quick-actions-grid">
              <div className="action-card" onClick={onNavigateToAttendance} style={{ cursor: 'pointer' }}>
                <div className="action-icon-pill" style={{ backgroundColor: '#eff6ff', color: '#2563eb' }}>
                  <CalendarCheck size={18} />
                </div>
                <div className="action-info">
                  <span className="action-title">Campus Attendance</span>
                  <span className="action-desc">Daily check-ins & roster audits</span>
                </div>
              </div>

              <div className="action-card" onClick={() => onNavigateToPayroll && onNavigateToPayroll('dashboard')} style={{ cursor: 'pointer' }}>
                <div className="action-icon-pill" style={{ backgroundColor: '#ecfdf5', color: '#10b981' }}>
                  <DollarSign size={18} />
                </div>
                <div className="action-info">
                  <span className="action-title">Payroll Governance</span>
                  <span className="action-desc">Disbursement & salary structures</span>
                </div>
              </div>

              <div className="action-card" onClick={() => onNavigateToLeave && onNavigateToLeave('dashboard')} style={{ cursor: 'pointer' }}>
                <div className="action-icon-pill" style={{ backgroundColor: '#fffbeb', color: '#f59e0b' }}>
                  <Clock size={18} />
                </div>
                <div className="action-info">
                  <span className="action-title">Leave Approvals</span>
                  <span className="action-desc">{leaveData?.pending_leaves_count || 0} pending applications</span>
                </div>
              </div>

              <div className="action-card" onClick={() => onNavigateToCalendar && onNavigateToCalendar('overview')} style={{ cursor: 'pointer' }}>
                <div className="action-icon-pill" style={{ backgroundColor: '#f5f3ff', color: '#7c3aed' }}>
                  <Calendar size={18} />
                </div>
                <div className="action-info">
                  <span className="action-title">Academic Calendar</span>
                  <span className="action-desc">Terms, exams & official closures</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // 2. ADMINISTRATOR DASHBOARD
  // =========================================================================
  if (isAdmin) {
    return (
      <div className="dashboard-content">
        {/* Admin Welcome Banner */}
        <div className="dashboard-welcome-banner admin-banner">
          <div className="welcome-text-container">
            <div className="welcome-tag">
              <ShieldCheck size={14} />
              <span>🏛️ Administrative Operations Control</span>
            </div>

            <h2 className="welcome-title">
              Operations & Campus Logistics Console
            </h2>

            <p className="welcome-subtitle">
              Manage school work shifts, staff schedules, departmental capacity, and campus attendance rosters.
            </p>

            <div className="welcome-buttons">
              <button type="button" className="btn btn-primary" onClick={onNavigateToAttendance}>
                <CalendarCheck size={16} />
                <span>Attendance Console</span>
              </button>
              <button type="button" className="btn btn-secondary" onClick={onNavigateToShifts}>
                <Clock size={16} />
                <span>Shifts & Rosters</span>
              </button>
              <button type="button" className="btn btn-secondary" onClick={onNavigateToEmployees}>
                <Users size={16} />
                <span>{`Staff Directory (${totalEmployees})`}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Action Required Hub */}
        {renderActionRequiredHub()}

        {/* Operational Admin KPIs */}
        <div className="dashboard-metrics-grid">
          {/* Card 1: SHIFT COVERAGE */}
          <div 
            className="kpi-card" 
            onClick={onNavigateToShifts} 
            style={{ cursor: 'pointer' }}
            title="Click to open Shift & Schedule Management"
          >
            <div className="kpi-header">
              <span className="kpi-title">Shift Coverage</span>
              <div className="kpi-icon-pill indigo">
                <Clock size={18} />
              </div>
            </div>
            <div className="kpi-body">
              <span className="kpi-value">{employeesWithShift.length}</span>
              <div className="kpi-trend trend-positive" style={{ marginTop: '4px' }}>
                <span>
                  {employeesWithoutShift.length === 0 ? (
                    '100% staff shift coverage'
                  ) : (
                    `${employeesWithoutShift.length} unassigned staff`
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: ATTENDANCE PUNCTUALITY */}
          <div 
            className="kpi-card" 
            onClick={onNavigateToAttendance} 
            style={{ cursor: 'pointer' }}
            title="Click to open Attendance Management"
          >
            <div className="kpi-header">
              <span className="kpi-title">Daily Punctuality</span>
              <div className="kpi-icon-pill emerald">
                <CheckCircle2 size={18} />
              </div>
            </div>
            <div className="kpi-body">
              <span className="kpi-value">
                {attMetrics?.present != null ? attMetrics.present : '—'}
                <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 500, marginLeft: '6px' }}>
                  on time
                </span>
              </span>
              <div className="kpi-trend trend-neutral" style={{ marginTop: '4px' }}>
                <span>
                  {attMetrics ? (
                    `${attMetrics.late || 0} late arrivals • ${attMetrics.on_leave || 0} on leave`
                  ) : (
                    'Punctuality index'
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Card 3: DEPARTMENT CAPACITY */}
          <div 
            className="kpi-card" 
            onClick={onNavigateToDepartments} 
            style={{ cursor: 'pointer' }}
            title="Click to open Departments"
          >
            <div className="kpi-header">
              <span className="kpi-title">Department Wings</span>
              <div className="kpi-icon-pill sky">
                <Building2 size={18} />
              </div>
            </div>
            <div className="kpi-body">
              <span className="kpi-value">{totalDepartments}</span>
              <div className="kpi-trend trend-positive" style={{ marginTop: '4px' }}>
                <span>
                  {vacantHODDepts.length === 0 ? (
                    'All HOD chairs appointed'
                  ) : (
                    `${vacantHODDepts.length} HOD appointment pending`
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Card 4: ACTIVE WORKFORCE */}
          <div 
            className="kpi-card" 
            onClick={onNavigateToEmployees} 
            style={{ cursor: 'pointer' }}
            title="Click to view Staff Directory"
          >
            <div className="kpi-header">
              <span className="kpi-title">Workforce Strength</span>
              <div className="kpi-icon-pill amber">
                <Users size={18} />
              </div>
            </div>
            <div className="kpi-body">
              <span className="kpi-value">{totalEmployees}</span>
              <div className="kpi-trend trend-positive" style={{ marginTop: '4px' }}>
                <span>{activeEmployees} active • {probationEmployees} probation</span>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Operations Launchpad */}
        <div className="dashboard-sections-grid">
          <div className="dashboard-card">
            <div className="dashboard-card-header">
              <div>
                <h3 className="card-title">Quick Operations Launchpad</h3>
                <p className="card-subtitle">Direct shortcuts to operational school management modules</p>
              </div>
            </div>

            <div className="quick-actions-grid">
              <div className="action-card" onClick={onNavigateToAttendance} style={{ cursor: 'pointer' }}>
                <div className="action-icon-pill" style={{ backgroundColor: '#eff6ff', color: '#2563eb' }}>
                  <CalendarCheck size={18} />
                </div>
                <div className="action-info">
                  <span className="action-title">Attendance Management</span>
                  <span className="action-desc">Daily logs & biometric audits</span>
                </div>
              </div>

              <div className="action-card" onClick={onNavigateToShifts} style={{ cursor: 'pointer' }}>
                <div className="action-icon-pill" style={{ backgroundColor: '#f5f3ff', color: '#7c3aed' }}>
                  <Clock size={18} />
                </div>
                <div className="action-info">
                  <span className="action-title">Shift & Schedule</span>
                  <span className="action-desc">Rosters, timings & assignments</span>
                </div>
              </div>

              <div className="action-card" onClick={onNavigateToDepartments} style={{ cursor: 'pointer' }}>
                <div className="action-icon-pill" style={{ backgroundColor: '#ecfdf5', color: '#10b981' }}>
                  <Building2 size={18} />
                </div>
                <div className="action-info">
                  <span className="action-title">Departments</span>
                  <span className="action-desc">Academic faculties & categories</span>
                </div>
              </div>

              <div className="action-card" onClick={onNavigateToEmployees} style={{ cursor: 'pointer' }}>
                <div className="action-icon-pill" style={{ backgroundColor: '#fffbeb', color: '#f59e0b' }}>
                  <Users size={18} />
                </div>
                <div className="action-info">
                  <span className="action-title">Staff & Faculty</span>
                  <span className="action-desc">Profile dossiers & employment data</span>
                </div>
              </div>
            </div>
          </div>

          {/* Shift Schedule Distribution */}
          <div className="dashboard-card">
            <div className="dashboard-card-header">
              <div>
                <h3 className="card-title">Active Shift Distribution</h3>
                <p className="card-subtitle">Staff coverage across designated work schedules</p>
              </div>
              <button type="button" className="btn-link" onClick={onNavigateToShifts}>
                <span>Manage Shifts</span>
                <ArrowRight size={14} />
              </button>
            </div>

            <div className="recent-staff-list">
              {shiftsData.map((shift) => {
                const count = employees.filter(e => e.current_shift_id === shift.id || e.shift_name === shift.name).length;
                return (
                  <div key={shift.id} className="recent-staff-item" onClick={onNavigateToShifts} style={{ cursor: 'pointer' }}>
                    <div className="staff-avatar-initials small" style={{ backgroundColor: '#e0f2fe', color: '#0369a1' }}>
                      <Clock size={14} />
                    </div>
                    <div className="recent-staff-info">
                      <span className="recent-staff-name">{shift.name}</span>
                      <span className="recent-staff-code text-monospace">
                        {(shift.start_time || '').slice(0, 5)} – {(shift.end_time || '').slice(0, 5)} • {shift.code}
                      </span>
                    </div>
                    <span className="staff-count-badge badge-has-staff">
                      <Users size={11} />
                      <span>{count} Assigned</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // 3. HR EXECUTIVE DASHBOARD
  // =========================================================================
  if (isHR) {
    const leaveDistribution = leaveData?.leave_type_distribution || [];
    return (
      <div className="dashboard-content">
        {/* HR Welcome Banner */}
        <div className="dashboard-welcome-banner hr-banner">
          <div className="welcome-text-container">
            <div className="welcome-tag">
              <Award size={14} />
              <span>👥 Human Resources Management</span>
            </div>

            <h2 className="welcome-title">
              Faculty & Staff Personnel Administration
            </h2>

            <p className="welcome-subtitle">
              Oversee staff lifecycle, leave pipelines, compensation governance, and institutional employment compliance.
            </p>

            <div className="welcome-buttons">
              <button type="button" className="btn btn-primary" onClick={() => onNavigateToLeave && onNavigateToLeave('dashboard')}>
                <CalendarCheck size={16} />
                <span>Leave Management</span>
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => onNavigateToPayroll && onNavigateToPayroll('dashboard')}>
                <DollarSign size={16} />
                <span>Payroll & Salaries</span>
              </button>
              <button type="button" className="btn btn-secondary" onClick={onNavigateToEmployees}>
                <Users size={16} />
                <span>{`Staff Directory (${totalEmployees})`}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Action Required Hub */}
        {renderActionRequiredHub()}

        {/* 4 HR-Specific KPI Cards */}
        <div className="dashboard-metrics-grid">
          {/* Card 1: LEAVE PIPELINE */}
          <div 
            className="kpi-card" 
            onClick={() => onNavigateToLeave && onNavigateToLeave('requests')} 
            style={{ cursor: 'pointer' }}
            title="Click to view pending leave requests"
          >
            <div className="kpi-header">
              <span className="kpi-title">Leave Pipeline</span>
              <div className="kpi-icon-pill amber">
                <Clock size={18} />
              </div>
            </div>
            <div className="kpi-body">
              <span className="kpi-value">
                {leaveData?.pending_leaves_count != null ? leaveData.pending_leaves_count : '—'}
                <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 500, marginLeft: '6px' }}>
                  pending
                </span>
              </span>
              <div className="kpi-trend trend-neutral" style={{ marginTop: '4px' }}>
                <span>
                  {leaveDistribution.length > 0 ? (
                    leaveDistribution.slice(0, 2).map(lt => `${lt.code || lt.name}: ${lt.approved_count || 0}`).join(' • ')
                  ) : (
                    `${onLeaveToday} on leave today`
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: SALARY COVERAGE */}
          <div 
            className="kpi-card" 
            onClick={() => onNavigateToPayroll && onNavigateToPayroll('structures')} 
            style={{ cursor: 'pointer' }}
            title="Click to open Salary Structure Registry"
          >
            <div className="kpi-header">
              <span className="kpi-title">Salary Coverage</span>
              <div className="kpi-icon-pill emerald">
                <CreditCard size={18} />
              </div>
            </div>
            <div className="kpi-body">
              <span className="kpi-value">
                {employeesWithSalary.length}
                <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 500, marginLeft: '6px' }}>
                  / {totalEmployees}
                </span>
              </span>
              <div className="kpi-trend trend-positive" style={{ marginTop: '4px' }}>
                <span>
                  {employeesWithoutSalary.length === 0 ? (
                    '100% compensation mapped'
                  ) : (
                    `${employeesWithoutSalary.length} pending structure assignment`
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Card 3: STAFF STATUS */}
          <div 
            className="kpi-card" 
            onClick={onNavigateToEmployees} 
            style={{ cursor: 'pointer' }}
            title="Click to view Staff Directory"
          >
            <div className="kpi-header">
              <span className="kpi-title">Staff Lifecycle</span>
              <div className="kpi-icon-pill sky">
                <Users size={18} />
              </div>
            </div>
            <div className="kpi-body">
              <span className="kpi-value">{activeEmployees}</span>
              <div className="kpi-trend trend-positive" style={{ marginTop: '4px' }}>
                <span>
                  {probationEmployees} in probation • {onLeaveToday} on leave
                </span>
              </div>
            </div>
          </div>

          {/* Card 4: LOSS OF PAY (LOP) WATCH */}
          <div 
            className="kpi-card" 
            onClick={() => onNavigateToPayroll && onNavigateToPayroll('records')} 
            style={{ cursor: 'pointer' }}
            title="Click to review Payroll Ledger"
          >
            <div className="kpi-header">
              <span className="kpi-title">Loss of Pay (LOP) Watch</span>
              <div className="kpi-icon-pill indigo">
                <DollarSign size={18} />
              </div>
            </div>
            <div className="kpi-body">
              <span className="kpi-value">
                {payrollData?.total_lop != null ? `₹${Number(payrollData.total_lop).toLocaleString('en-IN')}` : '₹0'}
              </span>
              <div className="kpi-trend trend-neutral" style={{ marginTop: '4px' }}>
                <span>
                  {payrollData?.month_name || 'Current Month'} compensation cycle
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* HR Operations Grid */}
        <div className="dashboard-sections-grid">
          {/* Department Faculty Distribution */}
          <div className="dashboard-card">
            <div className="dashboard-card-header">
              <div>
                <h3 className="card-title">Department Personnel Allocations</h3>
                <p className="card-subtitle">Active faculty numbers and departmental supervision</p>
              </div>
              <button type="button" className="btn-link" onClick={onNavigateToDepartments}>
                <span>View Departments</span>
                <ArrowRight size={14} />
              </button>
            </div>

            <div className="recent-staff-list">
              {departments.map((dept) => (
                <div key={dept.id} className="recent-staff-item" onClick={onNavigateToDepartments} style={{ cursor: 'pointer' }}>
                  <div className="staff-avatar-initials small" style={{ backgroundColor: '#ede9fe', color: '#5b21b6' }}>
                    <Building2 size={14} />
                  </div>
                  <div className="recent-staff-info">
                    <span className="recent-staff-name">{dept.name}</span>
                    <span className="recent-staff-code text-monospace">
                      {dept.code || 'DEPT'} • HOD: {dept.head_name || 'Pending'}
                    </span>
                  </div>
                  <span className="staff-count-badge badge-has-staff">
                    <Users size={11} />
                    <span>{dept.employee_count || 0} Staff</span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Staff Navigation */}
          <div className="dashboard-card">
            <div className="dashboard-card-header">
              <div>
                <h3 className="card-title">Recently Onboarded Personnel</h3>
                <p className="card-subtitle">Latest additions to the school directory</p>
              </div>
              <button type="button" className="btn-link" onClick={onNavigateToEmployees}>
                <span>View All</span>
                <ArrowRight size={14} />
              </button>
            </div>

            <div className="recent-staff-list">
              {employees.slice(0, 5).map((emp) => (
                <div key={emp.id} className="recent-staff-item" onClick={onNavigateToEmployees} style={{ cursor: 'pointer' }}>
                  <div className="staff-avatar-initials small">
                    {emp.first_name ? emp.first_name[0] : 'S'}
                  </div>
                  <div className="recent-staff-info">
                    <span className="recent-staff-name">{emp.first_name} {emp.last_name}</span>
                    <span className="recent-staff-code text-monospace">
                      {emp.employee_code} • {emp.designation_name || emp.designation || 'Faculty'}
                    </span>
                  </div>
                  <span className={`status-pill status-${(emp.employment_status || 'active').toLowerCase()}`}>
                    {emp.employment_status || 'Active'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // 4. DEPARTMENT MANAGER / HOD DASHBOARD
  // =========================================================================
  if (isManager) {
    return (
      <div className="dashboard-content">
        {/* Manager Welcome Banner */}
        <div className="dashboard-welcome-banner manager-banner">
          <div className="welcome-text-container">
            <div className="welcome-tag">
              <Building2 size={14} />
              <span>🎓 Department Leadership • Head of Department</span>
            </div>

            <h2 className="welcome-title">
              {managerDept ? `${managerDept.name} • Faculty Console` : 'Academic Department Leadership Console'}
            </h2>

            <p className="welcome-subtitle">
              Monitor daily department faculty attendance, approve team leave requests, inspect work shifts, and coordinate academic events.
            </p>

            <div className="welcome-buttons">
              <button type="button" className="btn btn-primary" onClick={onNavigateToAttendance}>
                <CalendarCheck size={16} />
                <span>Department Attendance</span>
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => onNavigateToLeave && onNavigateToLeave('requests')}>
                <Clock size={16} />
                <span>Team Leave Requests</span>
              </button>
              {user?.employee_id && onNavigateToMyAttendance && (
                <button type="button" className="btn btn-secondary" onClick={onNavigateToMyAttendance}>
                  <Clock size={16} />
                  <span>My Attendance</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Action Required Hub */}
        {renderActionRequiredHub()}

        {/* 4 Department-Scoped KPI Cards */}
        <div className="dashboard-metrics-grid">
          {/* Card 1: MY FACULTY ATTENDANCE */}
          <div 
            className="kpi-card" 
            onClick={onNavigateToAttendance} 
            style={{ cursor: 'pointer' }}
            title="Click to view department attendance"
          >
            <div className="kpi-header">
              <span className="kpi-title">Faculty Presence Today</span>
              <div className="kpi-icon-pill emerald">
                <CalendarCheck size={18} />
              </div>
            </div>
            <div className="kpi-body">
              <span className="kpi-value">
                {mgrPresent}
                <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 500, marginLeft: '6px' }}>
                  / {managerTeam.length} on duty
                </span>
              </span>
              <div className="kpi-trend trend-positive" style={{ marginTop: '4px' }}>
                <span>
                  {mgrRate} present {mgrLate > 0 && ` • ${mgrLate} late`} {mgrOnLeave > 0 && ` • ${mgrOnLeave} on leave`}
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: DEPARTMENT LEAVE */}
          <div 
            className="kpi-card" 
            onClick={() => onNavigateToLeave && onNavigateToLeave('requests')} 
            style={{ cursor: 'pointer' }}
            title="Click to review team leave applications"
          >
            <div className="kpi-header">
              <span className="kpi-title">Team Leaves</span>
              <div className="kpi-icon-pill amber">
                <Clock size={18} />
              </div>
            </div>
            <div className="kpi-body">
              <span className="kpi-value">
                {managerPendingLeaves.length}
                <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 500, marginLeft: '6px' }}>
                  awaiting review
                </span>
              </span>
              <div className="kpi-trend trend-neutral" style={{ marginTop: '4px' }}>
                <span>
                  {managerPendingLeaves.length === 0 ? 'All applications reviewed' : 'Pending HOD recommendation'}
                </span>
              </div>
            </div>
          </div>

          {/* Card 3: DEPARTMENT SHIFT ROSTER */}
          <div 
            className="kpi-card" 
            onClick={onNavigateToShifts} 
            style={{ cursor: 'pointer' }}
            title="Click to view department roster"
          >
            <div className="kpi-header">
              <span className="kpi-title">Department Rosters</span>
              <div className="kpi-icon-pill indigo">
                <Layers size={18} />
              </div>
            </div>
            <div className="kpi-body">
              <span className="kpi-value">{managerTeam.length}</span>
              <div className="kpi-trend trend-positive" style={{ marginTop: '4px' }}>
                <span>Active department faculty members</span>
              </div>
            </div>
          </div>

          {/* Card 4: UPCOMING ACADEMIC EVENTS */}
          <div 
            className="kpi-card" 
            onClick={() => onNavigateToCalendar && onNavigateToCalendar('overview')} 
            style={{ cursor: 'pointer' }}
            title="Click to view Academic Calendar"
          >
            <div className="kpi-header">
              <span className="kpi-title">Academic Schedule</span>
              <div className="kpi-icon-pill sky">
                <Calendar size={18} />
              </div>
            </div>
            <div className="kpi-body">
              <span className="kpi-value" style={{ fontSize: '1.25rem', lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {upcomingEvent?.title || 'Academic Term in Session'}
              </span>
              <div className="kpi-trend trend-neutral" style={{ marginTop: '4px' }}>
                <span>
                  {upcomingEvent ? (
                    `${upcomingEvent.days_remaining > 0 ? `${upcomingEvent.days_remaining} days away` : 'Today'}`
                  ) : (
                    activeTermName
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Department Members List */}
        <div className="dashboard-sections-grid">
          <div className="dashboard-card" style={{ gridColumn: '1 / -1' }}>
            <div className="dashboard-card-header">
              <div>
                <h3 className="card-title">Department Faculty Members</h3>
                <p className="card-subtitle">Staff assigned to {managerDept?.name || 'your department'}</p>
              </div>
              <button type="button" className="btn-link" onClick={onNavigateToEmployees}>
                <span>View Full Profiles</span>
                <ArrowRight size={14} />
              </button>
            </div>

            <div className="recent-staff-list">
              {managerTeam.map((emp) => (
                <div key={emp.id} className="recent-staff-item" onClick={onNavigateToEmployees} style={{ cursor: 'pointer' }}>
                  <div className="staff-avatar-initials small">
                    {emp.first_name ? emp.first_name[0] : 'F'}
                  </div>
                  <div className="recent-staff-info">
                    <span className="recent-staff-name">{emp.first_name} {emp.last_name}</span>
                    <span className="recent-staff-code text-monospace">
                      {emp.employee_code} • {emp.designation_name || emp.designation || 'Faculty'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="table-code-badge text-monospace">
                      {emp.shift_name || 'Standard Shift'}
                    </span>
                    <span className={`status-pill status-${(emp.employment_status || 'active').toLowerCase()}`}>
                      {emp.employment_status || 'Active'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Fallback default
  return null;
}

export default DashboardView;
