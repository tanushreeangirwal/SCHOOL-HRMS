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
  UserCheck
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { hrmsApi } from '../../services/api';
import { StaffAvatar } from '../common/StaffAvatar';

export function EmployeeDashboardView({
  onNavigateToAttendanceHistory,
  onNavigateToMyShift
}) {
  const { user } = useAuth();

  const [todayData, setTodayData] = useState(null);
  const [monthlySummary, setMonthlySummary] = useState(null);
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
      const [todayRes, summaryRes] = await Promise.all([
        hrmsApi.getMyTodayAttendance(),
        hrmsApi.getMyAttendanceSummary()
      ]);

      if (todayRes && todayRes.success) {
        setTodayData(todayRes.data);
      } else {
        throw new Error(todayRes?.message || 'Failed to load today\'s attendance status.');
      }

      if (summaryRes && summaryRes.success) {
        setMonthlySummary(summaryRes.data?.summary || null);
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

  return (
    <div className="employee-dashboard-container" style={{ width: '100%', maxWidth: '1100px', margin: '0 auto', boxSizing: 'border-box' }}>
      
      {/* 1. Top Greeting Banner */}
      <div 
        className="employee-welcome-banner" 
        style={{
          backgroundColor: '#0f172a',
          border: '1px solid #1e293b',
          borderRadius: 'var(--radius-lg, 12px)',
          padding: '22px 26px',
          color: '#ffffff',
          marginBottom: '24px',
          boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.08))',
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
              <span style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', backgroundColor: 'rgba(255,255,255,0.2)', padding: '2px 8px', borderRadius: '4px' }}>
                St. Vincent's High School
              </span>
              <span className="code-badge" style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: '#ffffff' }}>
                {employee.employee_code}
              </span>
            </div>
            <h1 style={{ fontSize: '1.45rem', fontWeight: 800, margin: '0 0 2px 0', color: '#ffffff', letterSpacing: '-0.02em' }}>
              {greeting}, {employee.first_name}!
            </h1>
            <p style={{ fontSize: '0.85rem', color: '#bfdbfe', margin: 0 }}>
              {employee.designation_name} • {employee.department_name}
            </p>
          </div>
        </div>

        {/* Live Date & Clock Widget */}
        <div style={{ textAlign: 'right', backgroundColor: 'rgba(0,0,0,0.15)', padding: '10px 18px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#ffffff', fontVariantNumeric: 'tabular-nums', letterSpacing: '0.04em' }}>
            {formattedLiveClock}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#bfdbfe', marginTop: '2px' }}>
            {formattedCurrentDate}
          </div>
        </div>
      </div>

      {/* Action Messages */}
      {actionSuccess && (
        <div className="assign-alert-banner success-banner" style={{ marginBottom: '20px' }}>
          <CheckCircle2 size={18} className="alert-banner-icon" />
          <div className="alert-banner-content" style={{ fontSize: '0.88rem', fontWeight: 600 }}>{actionSuccess}</div>
        </div>
      )}

      {error && (
        <div className="assign-alert-error" style={{ marginBottom: '20px' }}>
          <AlertCircle size={18} className="alert-icon" />
          <div className="alert-text">{error}</div>
        </div>
      )}

      {/* 2. Main Grid: Today's Attendance Card + Today's Shift Card */}
      <div className="employee-main-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.35fr) minmax(0, 1fr)', gap: '20px', marginBottom: '24px' }}>
        
        {/* ================================================================= */}
        {/* ATTENDANCE CARD (Prominent Mobile-First Check In / Out) */}
        {/* ================================================================= */}
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
          {/* Card Top Label */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div className="stat-icon-badge stat-emerald" style={{ width: '36px', height: '36px', borderRadius: '8px' }}>
                <Clock size={18} />
              </div>
              <div>
                <h2 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                  Today's Attendance
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

          {/* Card Dynamic Body */}
          <div style={{ margin: '14px 0', textAlign: 'center' }}>
            {isLoading ? (
              <div style={{ padding: '30px', color: 'var(--text-muted)' }}>
                <Loader2 size={28} className="spin-animation text-primary" style={{ margin: '0 auto 8px' }} />
                <span style={{ fontSize: '0.84rem' }}>Checking attendance records...</span>
              </div>
            ) : !isWorkingDay ? (
              /* NON-WORKING DAY */
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
              /* STATE 1: NOT MARKED -> LARGE CHECK IN BUTTON */
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
                    height: '52px',
                    fontSize: '1.05rem',
                    fontWeight: 800,
                    borderRadius: '8px',
                    letterSpacing: '0.04em',
                    boxShadow: '0 4px 14px 0 rgba(37, 99, 235, 0.35)',
                    margin: '0 auto',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px'
                  }}
                >
                  {isCheckingIn ? (
                    <>
                      <Loader2 size={20} className="spin-animation" />
                      <span>Recording Check-In...</span>
                    </>
                  ) : (
                    <>
                      <UserCheck size={20} />
                      <span>CHECK IN</span>
                    </>
                  )}
                </button>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '8px', display: 'block' }}>
                  Grace period: {shift.late_grace_minutes} mins from {shift.start_time_formatted}
                </span>
              </div>
            ) : state === 'CHECKED_IN' ? (
              /* STATE 2: CHECKED IN -> LARGE CHECK OUT BUTTON */
              <div>
                <div style={{ marginBottom: '16px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '4px' }}>
                    <CheckCircle2 size={18} style={{ color: '#166534' }} />
                    <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#166534' }}>
                      Checked In at {attendance?.check_in_formatted}
                    </span>
                    {attendance?.status === 'Late' && (
                      <span className="status-pill badge-probation" style={{ fontSize: '0.72rem' }}>
                        Late Arrival
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: '0.78rem', color: '#166534' }}>
                    Shift in progress. Remember to check out before leaving campus.
                  </span>
                </div>

                <button
                  type="button"
                  className="btn btn-secondary employee-checkout-btn"
                  onClick={handleCheckOut}
                  disabled={isCheckingOut}
                  style={{
                    width: '100%',
                    maxWidth: '320px',
                    height: '52px',
                    fontSize: '1.05rem',
                    fontWeight: 800,
                    borderRadius: '8px',
                    backgroundColor: '#1e40af',
                    color: '#ffffff',
                    border: 'none',
                    letterSpacing: '0.04em',
                    boxShadow: '0 4px 14px 0 rgba(30, 64, 175, 0.3)',
                    margin: '0 auto',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px'
                  }}
                >
                  {isCheckingOut ? (
                    <>
                      <Loader2 size={20} className="spin-animation" />
                      <span>Recording Check-Out...</span>
                    </>
                  ) : (
                    <>
                      <Clock size={20} />
                      <span>CHECK OUT</span>
                    </>
                  )}
                </button>
              </div>
            ) : state === 'COMPLETED' ? (
              /* STATE 3: COMPLETED FOR TODAY */
              <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '18px 16px' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: '#dcfce7', color: '#166534', padding: '4px 12px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 700, marginBottom: '12px' }}>
                  <Check size={14} />
                  <span>Attendance Completed</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginTop: '6px' }}>
                  <div style={{ backgroundColor: '#ffffff', padding: '8px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>Check In</span>
                    <strong style={{ fontSize: '0.92rem', color: 'var(--text-main)' }}>{attendance?.check_in_formatted}</strong>
                  </div>
                  <div style={{ backgroundColor: '#ffffff', padding: '8px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>Check Out</span>
                    <strong style={{ fontSize: '0.92rem', color: 'var(--text-main)' }}>{attendance?.check_out_formatted}</strong>
                  </div>
                  <div style={{ backgroundColor: '#ffffff', padding: '8px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>Working Hours</span>
                    <strong style={{ fontSize: '0.92rem', color: '#166534' }}>{attendance?.working_hours}</strong>
                  </div>
                </div>
              </div>
            ) : (
              /* ON LEAVE / ABSENT */
              <div style={{ backgroundColor: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: '8px', padding: '20px 16px' }}>
                <span className="status-pill" style={{ backgroundColor: '#f5f3ff', color: '#7c3aed', fontSize: '0.84rem' }}>
                  Status: {state}
                </span>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '8px 0 0 0' }}>
                  Official absence recorded on institutional file.
                </p>
              </div>
            )}
          </div>

          {/* Correction Notice Footer */}
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

        {/* ================================================================= */}
        {/* TODAY'S SHIFT CARD */}
        {/* ================================================================= */}
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
                  <CalendarClock size={18} />
                </div>
                <div>
                  <h2 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                    My Assigned Shift
                  </h2>
                  <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                    Work schedule & timing rules
                  </span>
                </div>
              </div>
              <span className="code-badge" style={{ backgroundColor: '#eff6ff', color: '#1d4ed8' }}>
                {shift.code || 'REG-TEACH'}
              </span>
            </div>

            {/* Shift Details Box */}
            <div style={{ backgroundColor: '#f8fafc', border: '1px solid var(--border-light)', borderRadius: '8px', padding: '16px', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '0.98rem', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 6px 0' }}>
                {shift.name}
              </h3>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#1e40af', margin: '6px 0' }}>
                {shift.start_time_formatted} – {shift.end_time_formatted}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Working Days: <strong>{(shift.working_days || []).join(', ')}</strong>
              </div>
              {shift.break_start_time && (
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Break: <strong>{shift.break_start_time} – {shift.break_end_time}</strong>
                </div>
              )}
            </div>
          </div>

          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={onNavigateToMyShift}
            style={{ width: '100%', justifyContent: 'space-between', color: 'var(--color-primary)', fontSize: '0.82rem' }}
          >
            <span>View Full Shift Schedule</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>

      {/* 3. Monthly Attendance Summary KPIs */}
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
              <span className="stat-subtext">Partial shifts</span>
            </div>
            <div className="stat-icon-badge" style={{ backgroundColor: '#eff6ff', color: '#2563eb' }}>
              <CalendarClock size={18} />
            </div>
          </div>

          {/* On Leave */}
          <div className="stat-card stat-slate">
            <div className="stat-content">
              <span className="stat-title">On Leave</span>
              <div className="stat-number-wrapper">
                <span className="stat-number" style={{ color: '#7c3aed' }}>{monthlySummary?.on_leave ?? '—'}</span>
              </div>
              <span className="stat-subtext">Approved leaves</span>
            </div>
            <div className="stat-icon-badge" style={{ backgroundColor: '#f5f3ff', color: '#7c3aed' }}>
              <Calendar size={18} />
            </div>
          </div>

          {/* Absent */}
          <div className="stat-card stat-amber" style={{ borderLeftColor: '#ef4444' }}>
            <div className="stat-content">
              <span className="stat-title">Absent</span>
              <div className="stat-number-wrapper">
                <span className="stat-number" style={{ color: '#dc2626' }}>{monthlySummary?.absent ?? '—'}</span>
              </div>
              <span className="stat-subtext">Unexcused</span>
            </div>
            <div className="stat-icon-badge" style={{ backgroundColor: '#fef2f2', color: '#dc2626' }}>
              <XCircle size={18} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default EmployeeDashboardView;
