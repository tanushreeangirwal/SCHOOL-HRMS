import React, { useState, useEffect, useCallback } from 'react';
import {
  Clock,
  Calendar,
  CheckCircle2,
  AlertCircle,
  CalendarClock,
  ArrowRight,
  RefreshCw,
  Sparkles,
  Loader2,
  Coffee,
  XCircle,
  HelpCircle,
  Check,
  Building2,
  UserCheck,
  DollarSign,
  CreditCard,
  FileText,
  CalendarCheck,
  ChevronRight
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { hrmsApi } from '../../services/api';
import { StaffAvatar } from '../common/StaffAvatar';

export function EmployeeDashboardView({
  onNavigateToAttendanceHistory,
  onNavigateToMyShift,
  onNavigateToMyLeaves,
  onNavigateToMyPayslips,
  onNavigateToCalendar
}) {
  const { user } = useAuth();

  const [todayData, setTodayData] = useState(null);
  const [monthlySummary, setMonthlySummary] = useState(null);
  const [leaveSummary, setLeaveSummary] = useState(null);
  const [latestPayslip, setLatestPayslip] = useState(null);
  const [calendarOverview, setCalendarOverview] = useState(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [error, setError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);

  // Live Digital Clock
  const [currentTime, setCurrentTime] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchDashboardData = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsLoading(true);
    else setIsRefreshing(true);
    setError(null);

    try {
      const [todayRes, summaryRes, leaveRes, payslipsRes, calRes] = await Promise.all([
        hrmsApi.getMyTodayAttendance(),
        hrmsApi.getMyAttendanceSummary(),
        hrmsApi.getMyLeaveSummary().catch(() => null),
        hrmsApi.getMyPayslips().catch(() => null),
        hrmsApi.getCalendarOverview().catch(() => null)
      ]);

      if (todayRes && todayRes.success) {
        setTodayData(todayRes.data);
      } else {
        throw new Error(todayRes?.message || 'Failed to load today\'s attendance status.');
      }

      if (summaryRes && summaryRes.success) {
        setMonthlySummary(summaryRes.data?.summary || null);
      }

      if (leaveRes && leaveRes.success) {
        setLeaveSummary(leaveRes.data);
      }

      if (payslipsRes && payslipsRes.success && Array.isArray(payslipsRes.data) && payslipsRes.data.length > 0) {
        setLatestPayslip(payslipsRes.data[0]);
      }

      if (calRes && calRes.success) {
        setCalendarOverview(calRes.data);
      }
    } catch (err) {
      console.error('Fetch employee dashboard error:', err);
      setError(err.message || 'Unable to connect to St. Vincent\'s server.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Handle Self Check-In
  const handleCheckIn = async () => {
    setIsCheckingIn(true);
    setError(null);
    setActionSuccess(null);

    try {
      const res = await hrmsApi.employeeCheckIn();
      if (res && res.success) {
        setActionSuccess(res.message || 'Check-in recorded successfully!');
        await fetchDashboardData(true);
        setTimeout(() => setActionSuccess(null), 5000);
      } else {
        throw new Error(res?.message || 'Failed to record check-in.');
      }
    } catch (err) {
      console.error('Check-in error:', err);
      setError(err.message || 'Unable to mark check-in. Please try again.');
    } finally {
      setIsCheckingIn(false);
    }
  };

  // Handle Self Check-Out
  const handleCheckOut = async () => {
    setIsCheckingOut(true);
    setError(null);
    setActionSuccess(null);

    try {
      const res = await hrmsApi.employeeCheckOut();
      if (res && res.success) {
        setActionSuccess(res.message || 'Check-out recorded successfully!');
        await fetchDashboardData(true);
        setTimeout(() => setActionSuccess(null), 5000);
      } else {
        throw new Error(res?.message || 'Failed to record check-out.');
      }
    } catch (err) {
      console.error('Check-out error:', err);
      setError(err.message || 'Unable to record check-out. Please try again.');
    } finally {
      setIsCheckingOut(false);
    }
  };

  const employee = todayData?.employee || {
    first_name: user?.first_name || 'Faculty',
    last_name: user?.last_name || '',
    full_name: user?.full_name || 'Faculty Member',
    employee_code: user?.employee_code || 'EMP-1001',
    department_name: 'Academic Faculty',
    designation_name: 'Teacher'
  };

  const shift = todayData?.shift || {
    name: 'Regular School Teaching Shift',
    start_time_formatted: '7:30 AM',
    end_time_formatted: '2:00 PM',
    late_grace_minutes: 15,
    working_days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
  };

  const state = todayData?.state || 'NOT_MARKED';
  const attendance = todayData?.attendance || null;
  const isWorkingDay = todayData?.is_working_day !== false;

  const currentHour = currentTime.getHours();
  const greeting = currentHour < 12 ? 'Good Morning' : currentHour < 17 ? 'Good Afternoon' : 'Good Evening';

  const formattedCurrentDate = currentTime.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const formattedLiveClock = currentTime.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });

  const currentMonthName = currentTime.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  // Self-Service Derived Metrics
  const pendingLeavesCount = leaveSummary?.pending_requests_count || (leaveSummary?.requests?.filter(r => r.status === 'Pending').length || 0);
  const remainingLeaveDays = leaveSummary?.balances ? leaveSummary.balances.reduce((sum, b) => sum + Number(b.remaining_days || 0), 0) : null;
  
  const upcomingSchoolEvent = calendarOverview?.upcoming_events?.[0] || calendarOverview?.upcoming_holiday || null;
  const activeTerm = calendarOverview?.active_term?.name || calendarOverview?.active_year?.name || 'Active Academic Term';

  return (
    <div className="employee-dashboard-container" style={{ width: '100%', maxWidth: '1100px', margin: '0 auto', boxSizing: 'border-box' }}>
      
      {/* 1. Top Greeting Banner */}
      <div 
        className="employee-welcome-banner" 
        style={{
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderLeft: '4px solid #3155D9',
          borderRadius: '12px',
          padding: '22px 26px',
          color: '#172033',
          marginBottom: '24px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '18px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <StaffAvatar
            firstName={employee.first_name}
            lastName={employee.last_name}
            photoUrl={employee.profile_photo_url}
            size="lg"
          />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', backgroundColor: '#eef2ff', color: '#3155D9', border: '1px solid #dbeafe', padding: '3px 9px', borderRadius: '5px' }}>
                St. Vincent's High School
              </span>
              <span className="code-badge">
                {employee.employee_code}
              </span>
              <span className="status-pill status-active" style={{ fontSize: '0.7rem', padding: '2px 8px' }}>
                {employee.designation_name}
              </span>
            </div>

            <h1 style={{ fontSize: '1.45rem', fontWeight: 800, margin: '0 0 4px 0', color: '#172033', letterSpacing: '-0.02em' }}>
              {greeting}, {employee.first_name}!
            </h1>

            <p style={{ fontSize: '0.84rem', color: '#64748b', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>{employee.department_name}</span>
              <span>•</span>
              <span style={{ color: '#10b981', fontWeight: 600 }}>Active Faculty Dossier</span>
            </p>
          </div>
        </div>

        {/* Live Digital Clock */}
        <div 
          className="employee-live-clock-card"
          style={{
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '12px 20px',
            textAlign: 'right',
            minWidth: '180px'
          }}
        >
          <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '5px' }}>
            <CalendarClock size={13} style={{ color: '#3155D9' }} />
            <span>{formattedCurrentDate}</span>
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#172033', letterSpacing: '-0.02em', marginTop: '2px', fontFamily: 'monospace' }}>
            {formattedLiveClock}
          </div>
          <div style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px', marginTop: '2px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981' }}></span>
            <span>Campus Terminal Sync Active</span>
          </div>
        </div>
      </div>

      {actionSuccess && (
        <div className="assign-alert-success" style={{ marginBottom: '20px' }}>
          <CheckCircle2 size={18} className="alert-icon" />
          <div className="alert-text">{actionSuccess}</div>
        </div>
      )}

      {error && (
        <div className="assign-alert-error" style={{ marginBottom: '20px' }}>
          <AlertCircle size={18} className="alert-icon" />
          <div className="alert-text">{error}</div>
        </div>
      )}

      {/* 2. Self-Service Overview KPI Grid (4 Tailored Cards) */}
      <div className="dashboard-metrics-grid" style={{ marginBottom: '24px' }}>
        {/* Card 1: MY ATTENDANCE */}
        <div 
          className="kpi-card" 
          onClick={onNavigateToAttendanceHistory} 
          style={{ cursor: 'pointer' }}
          title="Click to view full attendance register"
        >
          <div className="kpi-header">
            <span className="kpi-title">Today's Attendance</span>
            <div className="kpi-icon-pill emerald">
              <Clock size={18} />
            </div>
          </div>
          <div className="kpi-body">
            <span className="kpi-value" style={{ fontSize: '1.4rem' }}>
              {state === 'CHECKED_IN' ? 'On Duty' : state === 'CHECKED_OUT' ? 'Shift Completed' : state === 'NOT_MARKED' ? 'Pending Check-In' : state}
            </span>
            <div className="kpi-trend trend-positive" style={{ marginTop: '4px' }}>
              <span>
                {attendance?.check_in ? `In: ${new Date(attendance.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : `Shift: ${shift.start_time_formatted}`}
                {attendance?.working_hours && ` • ${attendance.working_hours}`}
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: MY LEAVE PIPELINE */}
        <div 
          className="kpi-card" 
          onClick={onNavigateToMyLeaves} 
          style={{ cursor: 'pointer' }}
          title="Click to apply or review your leave requests"
        >
          <div className="kpi-header">
            <span className="kpi-title">Leave Status</span>
            <div className="kpi-icon-pill amber">
              <CalendarCheck size={18} />
            </div>
          </div>
          <div className="kpi-body">
            <span className="kpi-value" style={{ fontSize: '1.4rem' }}>
              {pendingLeavesCount > 0 ? `${pendingLeavesCount} Pending` : remainingLeaveDays != null ? `${remainingLeaveDays} Days Bal` : 'Active'}
            </span>
            <div className="kpi-trend trend-neutral" style={{ marginTop: '4px' }}>
              <span>
                {pendingLeavesCount > 0 ? 'Awaiting administrative approval' : 'Paid leaves available'}
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: MY LATEST PAYSLIP */}
        <div 
          className="kpi-card" 
          onClick={onNavigateToMyPayslips} 
          style={{ cursor: 'pointer' }}
          title="Click to view and download your official payslips"
        >
          <div className="kpi-header">
            <span className="kpi-title">Latest Payslip</span>
            <div className="kpi-icon-pill indigo">
              <DollarSign size={18} />
            </div>
          </div>
          <div className="kpi-body">
            <span className="kpi-value" style={{ fontSize: '1.4rem' }}>
              {latestPayslip?.net_salary != null ? `₹${Number(latestPayslip.net_salary).toLocaleString('en-IN')}` : 'Generated'}
            </span>
            <div className="kpi-trend trend-positive" style={{ marginTop: '4px' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <span>{latestPayslip ? `${latestPayslip.payroll_year}-${String(latestPayslip.payroll_month).padStart(2, '0')}` : 'September 2026'}</span>
                {latestPayslip?.status && (
                  <span className={`badge badge-${latestPayslip.status === 'paid' ? 'success' : latestPayslip.status === 'approved' ? 'info' : 'warning'}`} style={{ fontSize: '0.65rem', padding: '1px 5px' }}>
                    {latestPayslip.status}
                  </span>
                )}
              </span>
            </div>
          </div>
        </div>

        {/* Card 4: UPCOMING CALENDAR EVENT */}
        <div 
          className="kpi-card" 
          onClick={onNavigateToCalendar} 
          style={{ cursor: 'pointer' }}
          title="Click to view school academic calendar"
        >
          <div className="kpi-header">
            <span className="kpi-title">Next School Event</span>
            <div className="kpi-icon-pill sky">
              <Calendar size={18} />
            </div>
          </div>
          <div className="kpi-body">
            <span className="kpi-value" style={{ fontSize: '1.2rem', lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {upcomingSchoolEvent?.title || 'Academic Session'}
            </span>
            <div className="kpi-trend trend-neutral" style={{ marginTop: '4px' }}>
              <span>
                {upcomingSchoolEvent ? (
                  `${upcomingSchoolEvent.days_remaining > 0 ? `${upcomingSchoolEvent.days_remaining} days away` : 'Today'} • ${upcomingSchoolEvent.event_type || 'Event'}`
                ) : (
                  activeTerm
                )}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Main Grid: Today's Attendance Check-in Card + Shift Schedule Card */}
      <div className="employee-main-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.35fr) minmax(0, 1fr)', gap: '20px', marginBottom: '24px' }}>
        
        {/* Attendance Action Card */}
        <div 
          className="table-wrapper-card employee-attendance-card" 
          style={{
            padding: '24px',
            border: '1px solid var(--border-medium)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div className="stat-icon-badge stat-emerald" style={{ width: '36px', height: '36px', borderRadius: '8px' }}>
                <Clock size={18} />
              </div>
              <div>
                <h2 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                  Today's Attendance Clock
                </h2>
                <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                  Web Self-Service • {formattedCurrentDate}
                </span>
              </div>
            </div>

            <button
              type="button"
              className="btn btn-ghost btn-xs"
              onClick={() => fetchDashboardData(true)}
              title="Refresh attendance status"
            >
              <RefreshCw size={14} className={isRefreshing ? 'spin-animation' : ''} />
            </button>
          </div>

          <div style={{ margin: '14px 0', textAlign: 'center' }}>
            {isLoading ? (
              <div style={{ padding: '30px', color: 'var(--text-muted)' }}>
                <Loader2 size={28} className="spin-animation text-primary" style={{ margin: '0 auto 8px' }} />
                <span style={{ fontSize: '0.84rem' }}>Checking attendance records...</span>
              </div>
            ) : !isWorkingDay ? (
              <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '24px 16px' }}>
                <Coffee size={32} style={{ color: '#94a3b8', margin: '0 auto 8px' }} />
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', margin: '0 0 4px 0' }}>
                  Non-Working Day
                </h3>
                <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', margin: 0 }}>
                  Today is not a scheduled working day for your assigned shift. No attendance is required.
                </p>
              </div>
            ) : state === 'NOT_MARKED' ? (
              <div>
                <div style={{ marginBottom: '16px' }}>
                  <span className="status-pill badge-inactive" style={{ fontSize: '0.82rem', padding: '4px 12px' }}>
                    <span className="status-dot"></span>
                    <span>Status: Not Marked</span>
                  </span>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '8px', marginBottom: 0 }}>
                    Scheduled Shift: <strong>{shift.start_time_formatted} – {shift.end_time_formatted}</strong>
                  </p>
                </div>

                <button
                  type="button"
                  className="btn btn-primary employee-checkin-btn"
                  onClick={handleCheckIn}
                  disabled={isCheckingIn}
                  style={{
                    width: '100%',
                    maxWidth: '320px',
                    padding: '14px 24px',
                    fontSize: '1rem',
                    fontWeight: 800,
                    margin: '0 auto',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    borderRadius: '10px',
                    boxShadow: '0 4px 14px rgba(49, 85, 217, 0.3)'
                  }}
                >
                  {isCheckingIn ? (
                    <>
                      <Loader2 size={18} className="spin-animation" />
                      <span>Recording Check-In...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={18} />
                      <span>Mark Morning Check-In</span>
                    </>
                  )}
                </button>
              </div>
            ) : state === 'CHECKED_IN' ? (
              <div>
                <div style={{ marginBottom: '16px' }}>
                  <span className="status-pill status-active" style={{ fontSize: '0.82rem', padding: '4px 12px' }}>
                    <span className="status-dot" style={{ backgroundColor: '#10b981' }}></span>
                    <span>Status: Checked In</span>
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', marginTop: '12px' }}>
                    <div>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Check-In Time</span>
                      <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#10b981' }}>
                        {attendance?.check_in ? new Date(attendance.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                      </div>
                    </div>
                    {attendance?.late_minutes > 0 && (
                      <div>
                        <span style={{ fontSize: '0.72rem', color: '#f59e0b', textTransform: 'uppercase', fontWeight: 600 }}>Late Arrival</span>
                        <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#f59e0b' }}>
                          +{attendance.late_minutes}m
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  className="btn btn-secondary employee-checkout-btn"
                  onClick={handleCheckOut}
                  disabled={isCheckingOut}
                  style={{
                    width: '100%',
                    maxWidth: '320px',
                    padding: '12px 24px',
                    fontSize: '0.92rem',
                    fontWeight: 700,
                    margin: '0 auto',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    borderRadius: '10px'
                  }}
                >
                  {isCheckingOut ? (
                    <>
                      <Loader2 size={16} className="spin-animation" />
                      <span>Recording Check-Out...</span>
                    </>
                  ) : (
                    <>
                      <Clock size={16} />
                      <span>Record End of Shift Check-Out</span>
                    </>
                  )}
                </button>
              </div>
            ) : state === 'CHECKED_OUT' ? (
              <div style={{ backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '8px', padding: '20px 16px' }}>
                <CheckCircle2 size={32} style={{ color: '#059669', margin: '0 auto 8px' }} />
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#065f46', margin: '0 0 4px 0' }}>
                  Daily Shift Completed
                </h3>
                <p style={{ fontSize: '0.84rem', color: '#047857', margin: 0 }}>
                  Working Hours: <strong>{attendance?.working_hours || 'Complete'}</strong>
                </p>
              </div>
            ) : (
              <div style={{ backgroundColor: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: '8px', padding: '20px 16px' }}>
                <span className="status-pill" style={{ backgroundColor: '#f5f3ff', color: '#7c3aed', fontSize: '0.84rem' }}>
                  Status: {state}
                </span>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '8px 0 0 0' }}>
                  Official absence or leave recorded on institutional file.
                </p>
              </div>
            )}
          </div>

          <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <HelpCircle size={13} />
              Need an Attendance Correction?
            </span>
            <span style={{ fontWeight: 600, color: 'var(--color-primary)' }}>
              Please contact HR / Administrator
            </span>
          </div>
        </div>

        {/* Today's Shift Details Card */}
        <div 
          className="table-wrapper-card" 
          style={{
            padding: '24px',
            border: '1px solid var(--border-medium)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div className="stat-icon-badge stat-indigo" style={{ width: '36px', height: '36px', borderRadius: '8px' }}>
                  <Building2 size={18} />
                </div>
                <div>
                  <h2 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                    My Work Schedule
                  </h2>
                  <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                    Assigned Teaching Shift
                  </span>
                </div>
              </div>

              <button
                type="button"
                className="btn btn-ghost btn-xs"
                onClick={onNavigateToMyShift}
                style={{ fontSize: '0.75rem', color: 'var(--color-primary)' }}
              >
                View Roster
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', backgroundColor: '#f8fafc', borderRadius: '8px', fontSize: '0.84rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Shift Name:</span>
                <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>{shift.name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', backgroundColor: '#f8fafc', borderRadius: '8px', fontSize: '0.84rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Timings:</span>
                <span style={{ fontWeight: 700, color: '#3155D9' }}>{shift.start_time_formatted} – {shift.end_time_formatted}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', backgroundColor: '#f8fafc', borderRadius: '8px', fontSize: '0.84rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Grace Period:</span>
                <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{shift.late_grace_minutes} Minutes</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onNavigateToMyShift}
            style={{ width: '100%', marginTop: '16px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
          >
            <span>My Shift Details</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>

      {/* 4. Monthly Attendance Summary Row */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
            {currentMonthName} — Attendance Overview
          </h3>
          <button
            type="button"
            className="btn btn-ghost btn-xs"
            onClick={onNavigateToAttendanceHistory}
            style={{ fontSize: '0.8rem', color: 'var(--color-primary)' }}
          >
            View Monthly Register <ArrowRight size={12} style={{ display: 'inline', marginLeft: '2px' }} />
          </button>
        </div>

        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(5, minmax(0, 1fr))' }}>
          {/* Days Present */}
          <div className="stat-card stat-emerald">
            <div className="stat-content">
              <span className="stat-title">Present</span>
              <div className="stat-number-wrapper">
                <span className="stat-number text-emerald">{monthlySummary?.present ?? '—'}</span>
              </div>
              <span className="stat-subtext">On time attendance</span>
            </div>
            <div className="stat-icon-badge">
              <CheckCircle2 size={18} />
            </div>
          </div>

          {/* Late Arrivals */}
          <div className="stat-card stat-amber">
            <div className="stat-content">
              <span className="stat-title">Late</span>
              <div className="stat-number-wrapper">
                <span className="stat-number text-amber">{monthlySummary?.late ?? '—'}</span>
              </div>
              <span className="stat-subtext">Grace exceeded</span>
            </div>
            <div className="stat-icon-badge">
              <Clock size={18} />
            </div>
          </div>

          {/* Half Day */}
          <div className="stat-card stat-indigo" style={{ borderLeftColor: '#3b82f6' }}>
            <div className="stat-content">
              <span className="stat-title">Half Day</span>
              <div className="stat-number-wrapper">
                <span className="stat-number" style={{ color: '#2563eb' }}>{monthlySummary?.half_day ?? '—'}</span>
              </div>
              <span className="stat-subtext">Partial hours</span>
            </div>
            <div className="stat-icon-badge">
              <Clock size={18} />
            </div>
          </div>

          {/* On Leave */}
          <div className="stat-card stat-purple" style={{ borderLeftColor: '#8b5cf6' }}>
            <div className="stat-content">
              <span className="stat-title">On Leave</span>
              <div className="stat-number-wrapper">
                <span className="stat-number" style={{ color: '#7c3aed' }}>{monthlySummary?.on_leave ?? '—'}</span>
              </div>
              <span className="stat-subtext">Approved leaves</span>
            </div>
            <div className="stat-icon-badge">
              <CalendarCheck size={18} />
            </div>
          </div>

          {/* Absent */}
          <div className="stat-card stat-rose">
            <div className="stat-content">
              <span className="stat-title">Absent</span>
              <div className="stat-number-wrapper">
                <span className="stat-number text-rose">{monthlySummary?.absent ?? '—'}</span>
              </div>
              <span className="stat-subtext">Unexcused absence</span>
            </div>
            <div className="stat-icon-badge">
              <XCircle size={18} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default EmployeeDashboardView;
