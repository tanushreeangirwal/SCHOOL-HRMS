import React, { useState, useEffect, useCallback } from 'react';
import {
  Clock,
  CheckCircle2,
  UserCheck,
  Calendar,
  AlertCircle,
  Loader2,
  RefreshCw,
  Edit3,
  Users,
  Check,
  Coffee,
  CalendarClock,
  ArrowRight,
  ShieldCheck,
  FileText
} from 'lucide-react';
import { hrmsApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export function MarkAttendanceView({
  onNavigateToHistory,
  onOpenAdminMarkModal,
  onNavigateToDailyRoster
}) {
  const { user } = useAuth();
  const isAdminOrHR = user?.role === 'Super Admin' || user?.role === 'Administrator' || user?.role === 'HR' || user?.role === 'Manager';

  const [todayData, setTodayData] = useState(null);
  const [recentHistory, setRecentHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [error, setError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [elapsedDuration, setElapsedDuration] = useState('00h 00m 00s');

  // Format time with user's browser clock and fallback to server string
  const formatTimeDisplay = useCallback((rawTime, fallback) => {
    if (!rawTime && !fallback) return '—';
    if (rawTime) {
      const d = new Date(rawTime);
      if (!isNaN(d.getTime())) {
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
      }
    }
    return fallback || '—';
  }, []);

  // Edit / Re-mark Attendance state for completed records
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editStatus, setEditStatus] = useState('Present');
  const [editCheckIn, setEditCheckIn] = useState('');
  const [editCheckOut, setEditCheckOut] = useState('');
  const [editRemarks, setEditRemarks] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  // Keep live clock ticking
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch today's attendance & recent history
  const fetchAttendanceStatus = useCallback(async (isSilent = false) => {
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

      if (summaryRes && summaryRes.success && summaryRes.data?.history) {
        setRecentHistory(summaryRes.data.history.slice(0, 5));
      }
    } catch (err) {
      console.error('Fetch attendance status error:', err);
      setError(err.message || 'Unable to connect to St. Vincent\'s server.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAttendanceStatus();
  }, [fetchAttendanceStatus]);

  // Handle Self Check-In
  const handleCheckIn = async () => {
    setIsCheckingIn(true);
    setError(null);
    setActionSuccess(null);

    try {
      const res = await hrmsApi.employeeCheckIn();
      if (res && res.success) {
        setActionSuccess(res.message || 'Check-in recorded successfully!');
        await fetchAttendanceStatus(true);
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
        await fetchAttendanceStatus(true);
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

  // Open Edit/Re-mark Modal
  const handleOpenEditModal = () => {
    if (todayData?.attendance) {
      setEditStatus(todayData.attendance.status || 'Present');
      const inTime = todayData.attendance.check_in
        ? new Date(todayData.attendance.check_in).toTimeString().slice(0, 5)
        : '';
      const outTime = todayData.attendance.check_out
        ? new Date(todayData.attendance.check_out).toTimeString().slice(0, 5)
        : '';
      setEditCheckIn(inTime);
      setEditCheckOut(outTime);
      setEditRemarks(todayData.attendance.remarks || '');
    }
    setIsEditModalOpen(true);
  };

  // Submit Edit/Re-mark
  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!todayData?.attendance?.id) return;

    setIsUpdating(true);
    setError(null);

    try {
      const payload = {
        status: editStatus,
        check_in: editCheckIn ? `${todayData.today_date} ${editCheckIn}:00` : null,
        check_out: editCheckOut ? `${todayData.today_date} ${editCheckOut}:00` : null,
        remarks: editRemarks || 'Updated from attendance console',
        reason: 'User / Administrator adjustment'
      };

      const res = await hrmsApi.updateAttendance(todayData.attendance.id, payload);
      if (res && res.success) {
        setActionSuccess('Attendance record updated successfully!');
        setIsEditModalOpen(false);
        await fetchAttendanceStatus(true);
        setTimeout(() => setActionSuccess(null), 5000);
      } else {
        throw new Error(res?.message || 'Failed to update attendance.');
      }
    } catch (err) {
      console.error('Update attendance error:', err);
      setError(err.message || 'Failed to update attendance record.');
    } finally {
      setIsUpdating(false);
    }
  };

  const employee = todayData?.employee || {
    first_name: user?.first_name || 'Staff',
    last_name: user?.last_name || '',
    full_name: user?.full_name || 'Staff Member',
    employee_code: user?.employee_code || 'EMP-1001',
    department_name: 'Academic & Administration',
    designation_name: user?.role || 'Staff'
  };

  const shift = todayData?.shift || {
    name: 'Regular School Shift',
    start_time_formatted: '08:00 AM',
    end_time_formatted: '04:00 PM',
    late_grace_minutes: 15,
    working_days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
  };

  const state = todayData?.state || 'NOT_MARKED';
  const attendance = todayData?.attendance || null;
  const isWorkingDay = todayData?.is_working_day !== false;

  // Live shift running duration stopwatch
  useEffect(() => {
    if (state === 'CHECKED_IN' && attendance?.check_in) {
      const updateTimer = () => {
        const checkInMs = new Date(attendance.check_in).getTime();
        const nowMs = new Date().getTime();
        const diffMs = Math.max(0, nowMs - checkInMs);
        const totalSec = Math.floor(diffMs / 1000);
        const hrs = String(Math.floor(totalSec / 3600)).padStart(2, '0');
        const mins = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0');
        const secs = String(totalSec % 60).padStart(2, '0');
        setElapsedDuration(`${hrs}h ${mins}m ${secs}s`);
      };
      updateTimer();
      const interval = setInterval(updateTimer, 1000);
      return () => clearInterval(interval);
    }
  }, [state, attendance?.check_in]);

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

  return (
    <div className="mark-attendance-container" style={{ width: '100%', boxSizing: 'border-box' }}>
      {/* 1. Clear Tabbed Header Navigation */}
      <div className="attendance-header-row">
        <div className="attendance-header-titles">
          <h1 className="attendance-title">
            Mark Attendance
          </h1>
          <p className="attendance-subtitle">
            Live check-in and check-out console for today's scheduled school shift.
          </p>
        </div>

        {/* Action Controls */}
        <div className="attendance-header-actions">
          {isAdminOrHR && onOpenAdminMarkModal && (
            <button
              type="button"
              className="btn btn-secondary btn-sm attendance-action-btn-staff"
              onClick={onOpenAdminMarkModal}
              title="Mark or update attendance for other staff members"
            >
              <Users size={15} />
              <span>Mark Staff Attendance</span>
            </button>
          )}

          <button
            type="button"
            className="btn btn-secondary btn-sm attendance-action-btn-sync"
            onClick={() => fetchAttendanceStatus(true)}
            title="Refresh live status"
          >
            <RefreshCw size={14} className={isRefreshing ? 'spin-animation' : ''} />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {/* 2. Unified Sub-Navigation Tabs */}
      <div className="attendance-subtabs-nav">
        <button
          type="button"
          className="btn btn-primary btn-sm attendance-subtab-btn active"
          style={{ cursor: 'default' }}
        >
          <Clock size={15} />
          <span>Mark Attendance</span>
        </button>

        {onNavigateToHistory && (
          <button
            type="button"
            className="btn btn-secondary btn-sm attendance-subtab-btn"
            onClick={onNavigateToHistory}
          >
            <Calendar size={15} />
            <span>Attendance History</span>
          </button>
        )}

        {isAdminOrHR && onNavigateToDailyRoster && (
          <button
            type="button"
            className="btn btn-secondary btn-sm attendance-subtab-btn"
            onClick={onNavigateToDailyRoster}
          >
            <FileText size={15} />
            <span>Daily Staff Roster</span>
          </button>
        )}
      </div>

      {/* 3. Alerts & Feedback */}
      {actionSuccess && (
        <div className="assign-alert-banner success-banner" style={{ marginBottom: '20px', backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46', padding: '12px 16px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <CheckCircle2 size={18} style={{ color: '#10b981' }} />
          <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>{actionSuccess}</div>
        </div>
      )}

      {error && (
        <div className="assign-alert-error" style={{ marginBottom: '20px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '12px 16px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <AlertCircle size={18} style={{ color: '#ef4444' }} />
          <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>{error}</div>
        </div>
      )}

      {/* 4. Main Console: Two Columns on Desktop, Vertically Stacked on Mobile */}
      <div className="attendance-console-grid">
        
        {/* LEFT COLUMN: HERO ATTENDANCE CARD */}
        <div className="attendance-hero-card">
          {/* Top Info Bar: Employee Identity + Live Clock */}
          <div>
            <div className="attendance-hero-header">
              <div className="attendance-emp-identity">
                <span className="attendance-school-badge">
                  St. Vincent's High School
                </span>
                <h2 className="attendance-emp-name">
                  {employee.full_name}
                </h2>
                <p className="attendance-emp-meta">
                  <span className="code-badge">{employee.employee_code}</span>
                  <span className="attendance-emp-role">{employee.designation_name} • {employee.department_name}</span>
                </p>
              </div>

              {/* Digital Clock Widget */}
              <div className="attendance-live-clock-widget">
                <div className="attendance-live-time">
                  {formattedLiveClock}
                </div>
                <div className="attendance-live-date">
                  {formattedCurrentDate}
                </div>
              </div>
            </div>

            <hr className="attendance-divider" />

            {/* DYNAMIC ATTENDANCE ACTION DECK */}
            {isLoading ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: '#64748b' }}>
                <Loader2 size={32} className="spin-animation" style={{ color: '#3155D9', margin: '0 auto 12px' }} />
                <span style={{ fontSize: '0.88rem', fontWeight: 500 }}>Checking live attendance records...</span>
              </div>
            ) : !isWorkingDay ? (
              /* NON-WORKING DAY STATE */
              <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '24px 20px', textAlign: 'center' }}>
                <Coffee size={36} style={{ color: '#94a3b8', margin: '0 auto 10px' }} />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#172033', margin: '0 0 6px 0' }}>
                  Non-Working Day
                </h3>
                <p style={{ fontSize: '0.84rem', color: '#64748b', margin: '0 0 16px 0' }}>
                  Today is not a scheduled working day for your assigned shift. Attendance is optional or for overtime/special duty.
                </p>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleCheckIn}
                  disabled={isCheckingIn}
                >
                  <UserCheck size={16} />
                  <span>Mark Special Duty Check-In</span>
                </button>
              </div>
            ) : state === 'NOT_MARKED' ? (
              /* STATE 1: NOT MARKED -> PROMINENT CHECK-IN BUTTON */
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <div style={{ marginBottom: '18px' }}>
                  <span className="status-pill badge-inactive" style={{ fontSize: '0.84rem', padding: '5px 14px' }}>
                    <span className="status-dot"></span>
                    <span>Status: Not Marked Yet Today</span>
                  </span>
                  <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '10px', marginBottom: 0 }}>
                    Scheduled Shift: <strong>{shift.start_time_formatted} – {shift.end_time_formatted}</strong>
                  </p>
                </div>

                <button
                  type="button"
                  className="btn btn-primary attendance-main-action-btn"
                  onClick={handleCheckIn}
                  disabled={isCheckingIn}
                >
                  {isCheckingIn ? (
                    <>
                      <Loader2 size={20} className="spin-animation" />
                      <span>Syncing with Clock & Marking...</span>
                    </>
                  ) : (
                    <>
                      <UserCheck size={22} />
                      <span>CHECK IN NOW • {formattedLiveClock}</span>
                    </>
                  )}
                </button>
                <span style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '12px', display: 'block' }}>
                  Synced with School Clock: <strong>{formattedLiveClock}</strong> • Grace period: {shift.late_grace_minutes} mins after {shift.start_time_formatted}
                </span>
              </div>
            ) : state === 'CHECKED_IN' ? (
              /* STATE 2: CHECKED IN -> RUNNING TIMER + PROMINENT CHECK-OUT BUTTON */
              <div style={{ textAlign: 'center', padding: '10px 0' }}>
                <div className="attendance-status-card-checkedin" style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px' }}>
                  <div className="attendance-status-title-row">
                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#16a34a', display: 'inline-block', boxShadow: '0 0 0 4px rgba(22, 163, 74, 0.2)', flexShrink: 0 }}></span>
                    <span style={{ color: '#166534' }}>
                      On Duty • Checked In at {formatTimeDisplay(attendance?.check_in, attendance?.check_in_formatted)}
                    </span>
                    {attendance?.status === 'Late' && (
                      <span className="status-pill badge-probation" style={{ fontSize: '0.72rem' }}>
                        Late Arrival ({attendance.late_minutes}m)
                      </span>
                    )}
                  </div>

                  {/* Live Running Shift Stopwatch */}
                  <div style={{ textAlign: 'center', margin: '10px 0 6px' }}>
                    <span style={{ fontSize: '0.72rem', color: '#166534', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Active Shift Duration</span>
                    <div className="attendance-stopwatch-val" style={{ fontWeight: 900, color: '#14532d', fontVariantNumeric: 'tabular-nums', letterSpacing: '0.02em', marginTop: '2px' }}>
                      ⏱️ {elapsedDuration}
                    </div>
                  </div>

                  <span style={{ fontSize: '0.8rem', color: '#166534', display: 'block', marginTop: '4px' }}>
                    Shift is active. Remember to check out before leaving the school campus.
                  </span>
                </div>

                <button
                  type="button"
                  className="btn btn-secondary attendance-checkout-action-btn"
                  onClick={handleCheckOut}
                  disabled={isCheckingOut}
                >
                  {isCheckingOut ? (
                    <>
                      <Loader2 size={20} className="spin-animation" />
                      <span>Recording Departure...</span>
                    </>
                  ) : (
                    <>
                      <Clock size={20} />
                      <span>CHECK OUT NOW • {formattedLiveClock}</span>
                    </>
                  )}
                </button>
              </div>
            ) : state === 'COMPLETED' ? (
              /* STATE 3: ATTENDANCE COMPLETED -> SHOW DETAILS + RE-MARK/UPDATE BUTTON */
              <div>
                <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '18px', marginBottom: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: '14px' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: '#dcfce7', color: '#166534', padding: '5px 14px', borderRadius: '20px', fontSize: '0.84rem', fontWeight: 700 }}>
                      <Check size={15} />
                      <span>Today's Attendance Completed</span>
                    </div>

                    <span className="status-pill badge-active" style={{ fontSize: '0.8rem', padding: '4px 12px' }}>
                      Status: {attendance?.status || 'Present'}
                    </span>
                  </div>

                  {/* Summary Metric Strip */}
                  <div className="attendance-summary-metrics">
                    <div className="attendance-metric-box">
                      <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block', fontWeight: 600, textTransform: 'uppercase' }}>Check In</span>
                      <strong style={{ fontSize: '1.05rem', color: '#172033', marginTop: '2px', display: 'block' }}>
                        {formatTimeDisplay(attendance?.check_in, attendance?.check_in_formatted)}
                      </strong>
                    </div>
                    <div className="attendance-metric-box">
                      <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block', fontWeight: 600, textTransform: 'uppercase' }}>Check Out</span>
                      <strong style={{ fontSize: '1.05rem', color: '#172033', marginTop: '2px', display: 'block' }}>
                        {formatTimeDisplay(attendance?.check_out, attendance?.check_out_formatted)}
                      </strong>
                    </div>
                    <div className="attendance-metric-box">
                      <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block', fontWeight: 600, textTransform: 'uppercase' }}>Total Duration</span>
                      <strong style={{ fontSize: '1.05rem', color: '#166534', marginTop: '2px', display: 'block' }}>
                        {attendance?.working_hours || '—'}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Always-Visible Action: Re-mark / Update Attendance */}
                <div className="attendance-re-mark-banner" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', padding: '12px 16px', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '0.84rem', color: '#64748b' }}>
                    Need to update your timings or remarks for today?
                  </div>
                  {isAdminOrHR ? (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={handleOpenEditModal}
                    >
                      <Edit3 size={14} />
                      <span>Update / Re-Mark Today</span>
                    </button>
                  ) : (
                    <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                      Contact administration for historical adjustments.
                    </span>
                  )}
                </div>
              </div>
            ) : (
              /* ON LEAVE / ABSENT */
              <div style={{ backgroundColor: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: '10px', padding: '20px', textAlign: 'center' }}>
                <span className="status-pill" style={{ backgroundColor: '#f5f3ff', color: '#7c3aed', fontSize: '0.88rem', padding: '6px 14px' }}>
                  Status: {state}
                </span>
                <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '12px 0 0 0' }}>
                  An approved leave or institutional record has been noted for today.
                </p>
              </div>
            )}
          </div>

          {/* Footer Notice */}
          <div className="attendance-footer-notice">
            <span>Source: Official St. Vincent's Web Self-Service</span>
            {onNavigateToHistory && (
              <button
                type="button"
                className="btn btn-ghost btn-xs"
                onClick={onNavigateToHistory}
                style={{ color: '#3155D9', fontWeight: 600 }}
              >
                View Full History <ArrowRight size={12} style={{ marginLeft: '4px' }} />
              </button>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: SHIFT DETAILS & ADMIN TOOLS */}
        <div className="attendance-sidebar-col">
          
          {/* Shift Details Card */}
          <div className="attendance-shift-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#eef2ff', color: '#3155D9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CalendarClock size={18} />
              </div>
              <div>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#172033', margin: 0 }}>
                  Assigned Shift Details
                </h3>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{shift.name}</span>
              </div>
            </div>

            <div className="shift-kv-list">
              <div className="shift-kv-item">
                <span className="shift-kv-label">Scheduled Hours</span>
                <strong className="shift-kv-value">{shift.start_time_formatted} – {shift.end_time_formatted}</strong>
              </div>
              <div className="shift-kv-item">
                <span className="shift-kv-label">Late Grace Period</span>
                <strong className="shift-kv-value">{shift.late_grace_minutes} minutes</strong>
              </div>
              <div className="shift-kv-item">
                <span className="shift-kv-label">Scheduled Days</span>
                <strong className="shift-kv-value">{(shift.working_days || []).length} days / week</strong>
              </div>
            </div>
          </div>

          {/* Administrative Actions Card (For Admin / HR / Principal / Manager) */}
          {isAdminOrHR && (
            <div className="attendance-admin-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#ecfdf5', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ShieldCheck size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#172033', margin: 0 }}>
                    Staff Management Actions
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Administrative controls</span>
                </div>
              </div>

              <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '0 0 14px 0' }}>
                You have administrative access to mark, correct, or review attendance for other faculty and staff members.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {onOpenAdminMarkModal && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={onOpenAdminMarkModal}
                    style={{ justifyContent: 'flex-start' }}
                  >
                    <Users size={15} />
                    <span>Record / Mark Staff Member Attendance</span>
                  </button>
                )}

                {onNavigateToDailyRoster && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={onNavigateToDailyRoster}
                    style={{ justifyContent: 'flex-start' }}
                  >
                    <FileText size={15} />
                    <span>Open Today's School Roster</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Recent Attendance Preview Strip */}
          <div className="attendance-logs-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <h3 style={{ fontSize: '0.92rem', fontWeight: 700, color: '#172033', margin: 0 }}>
                Recent Personal Logs
              </h3>
              {onNavigateToHistory && (
                <button
                  type="button"
                  className="btn btn-ghost btn-xs"
                  onClick={onNavigateToHistory}
                  style={{ color: '#3155D9', fontSize: '0.76rem', padding: '2px 6px' }}
                >
                  View All
                </button>
              )}
            </div>

            {recentHistory.length === 0 ? (
              <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>No recent records found.</span>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {recentHistory.map((item, idx) => (
                  <div 
                    key={item.id || idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 10px',
                      backgroundColor: '#f8fafc',
                      borderRadius: '6px',
                      fontSize: '0.8rem'
                    }}
                  >
                    <span style={{ fontWeight: 600, color: '#172033' }}>
                      {new Date(item.attendance_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                    <span style={{ color: '#64748b' }}>
                      {formatTimeDisplay(item.check_in, item.check_in_formatted)}
                    </span>
                    <span className={`status-pill ${item.status === 'Present' ? 'badge-active' : item.status === 'Late' ? 'badge-probation' : 'badge-inactive'}`} style={{ fontSize: '0.68rem', padding: '2px 8px' }}>
                      {item.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>

      {/* 5. MODAL: UPDATE / RE-MARK TODAY'S ATTENDANCE */}
      {isEditModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsEditModalOpen(false)}>
          <div className="modal-container" style={{ maxWidth: '460px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-header-icon-title">
                <div className="icon-badge-primary">
                  <Edit3 size={20} />
                </div>
                <div>
                  <h3 className="modal-title">Update Today's Attendance</h3>
                  <span className="modal-subtitle">{formattedCurrentDate} • {employee.full_name}</span>
                </div>
              </div>
              <button type="button" className="modal-close-btn" onClick={() => setIsEditModalOpen(false)}>
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit}>
              <div className="form-section-body" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div className="form-group">
                  <label className="form-label">Attendance Status</label>
                  <select
                    className="form-select"
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                  >
                    <option value="Present">Present</option>
                    <option value="Late">Late</option>
                    <option value="Half Day">Half Day</option>
                    <option value="Absent">Absent</option>
                    <option value="On Leave">On Leave</option>
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Check-In Time</label>
                    <input
                      type="time"
                      className="form-input"
                      value={editCheckIn}
                      onChange={(e) => setEditCheckIn(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Check-Out Time</label>
                    <input
                      type="time"
                      className="form-input"
                      value={editCheckOut}
                      onChange={(e) => setEditCheckOut(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Remarks / Correction Reason</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Adjusted check-in time after morning assembly"
                    value={editRemarks}
                    onChange={(e) => setEditRemarks(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ padding: '14px 20px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '10px', backgroundColor: '#f8fafc' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setIsEditModalOpen(false)}
                  disabled={isUpdating}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={isUpdating}
                >
                  {isUpdating ? (
                    <>
                      <Loader2 size={14} className="spin-animation" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save Changes</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default MarkAttendanceView;
