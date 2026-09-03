import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  UserCheck
} from 'lucide-react';
import { hrmsApi } from '../../services/api';
import { TableSkeleton } from '../common/LoadingSpinner';

export function MyAttendanceView({
  onNavigateToMarkAttendance
}) {
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const fetchMyAttendance = useCallback(async (month, isSilent = false) => {
    if (!isSilent) setIsLoading(true);
    else setIsRefreshing(true);
    setError(null);

    try {
      const res = await hrmsApi.getMyAttendanceSummary(month);
      if (res && res.success) {
        setData(res.data);
      } else {
        throw new Error(res?.message || 'Failed to retrieve attendance history.');
      }
    } catch (err) {
      console.error('Fetch my attendance error:', err);
      setError(err.message || 'Unable to connect to St. Vincent\'s server.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchMyAttendance(selectedMonth);
  }, [selectedMonth, fetchMyAttendance]);

  const handlePrevMonth = () => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const d = new Date(y, m - 2, 1);
    setSelectedMonth(d.toISOString().slice(0, 7));
  };

  const handleNextMonth = () => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const d = new Date(y, m, 1);
    setSelectedMonth(d.toISOString().slice(0, 7));
  };

  const handleCurrentMonth = () => {
    setSelectedMonth(new Date().toISOString().slice(0, 7));
  };

  const summary = data?.summary || {
    working_days: 0,
    present: 0,
    late: 0,
    absent: 0,
    on_leave: 0,
    half_day: 0,
    attendance_rate: 0
  };

  const history = data?.history || [];
  const employee = data?.employee || {};

  const formattedMonth = new Date(selectedMonth + '-01T00:00:00').toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric'
  });

  const renderStatusBadge = (status) => {
    switch (status) {
      case 'Present':
        return <span className="status-pill badge-active"><span className="status-dot"></span>Present</span>;
      case 'Late':
        return <span className="status-pill badge-probation" style={{ backgroundColor: '#fffbeb', color: '#b45309' }}><span className="status-dot" style={{ backgroundColor: '#f59e0b' }}></span>Late</span>;
      case 'Half Day':
        return <span className="status-pill" style={{ backgroundColor: '#eff6ff', color: '#1e40af' }}><span className="status-dot" style={{ backgroundColor: '#3b82f6' }}></span>Half Day</span>;
      case 'On Leave':
        return <span className="status-pill" style={{ backgroundColor: '#f5f3ff', color: '#7c3aed' }}><span className="status-dot" style={{ backgroundColor: '#8b5cf6' }}></span>On Leave</span>;
      case 'Absent':
        return <span className="status-pill badge-terminated"><span className="status-dot"></span>Absent</span>;
      default:
        return <span className="status-pill badge-inactive"><span className="status-dot"></span>Not Marked</span>;
    }
  };

  return (
    <div className="attendance-view-content" style={{ width: '100%', boxSizing: 'border-box' }}>
      {/* Sub-Navigation Tabs */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
        {onNavigateToMarkAttendance && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onNavigateToMarkAttendance}
          >
            <Clock size={15} />
            <span>Mark Attendance</span>
          </button>
        )}
        <button
          type="button"
          className="btn btn-primary btn-sm"
          style={{ cursor: 'default' }}
        >
          <Calendar size={15} />
          <span>Attendance History</span>
        </button>
      </div>

      {/* 1. Page Header & Month Selector */}
      <div className="page-header-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 4px 0' }}>
            My Attendance History
          </h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
            Personal monthly attendance logs, check-in timestamps, and working hours.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Month Stepper */}
          <div className="date-stepper" style={{ display: 'flex', alignItems: 'center', backgroundColor: '#ffffff', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-md)', padding: '2px 4px' }}>
            <button
              type="button"
              className="btn btn-ghost btn-xs"
              onClick={handlePrevMonth}
              title="Previous Month"
              style={{ padding: '6px' }}
            >
              <ChevronLeft size={16} />
            </button>
            <input
              type="month"
              className="form-input-inline"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              style={{ border: 'none', background: 'transparent', fontWeight: 600, fontSize: '0.84rem', padding: '4px 8px', outline: 'none' }}
            />
            <button
              type="button"
              className="btn btn-ghost btn-xs"
              onClick={handleNextMonth}
              title="Next Month"
              style={{ padding: '6px' }}
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleCurrentMonth}
            style={{ fontSize: '0.8rem' }}
          >
            Current Month
          </button>

          {onNavigateToMarkAttendance && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={onNavigateToMarkAttendance}
            >
              <UserCheck size={14} />
              <span>Mark Today</span>
            </button>
          )}

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => fetchMyAttendance(selectedMonth, true)}
            title="Refresh attendance records"
          >
            <RefreshCw size={14} className={isRefreshing ? 'spin-animation' : ''} />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {/* 2. Monthly Summary Cards */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', marginBottom: '24px' }}>
        <div className="stat-card stat-emerald">
          <div className="stat-content">
            <span className="stat-title">Present</span>
            <div className="stat-number-wrapper">
              <span className="stat-number text-emerald">{summary.present}</span>
            </div>
            <span className="stat-subtext">On time attendance</span>
          </div>
          <div className="stat-icon-badge">
            <CheckCircle2 size={18} />
          </div>
        </div>

        <div className="stat-card stat-amber">
          <div className="stat-content">
            <span className="stat-title">Late</span>
            <div className="stat-number-wrapper">
              <span className="stat-number text-amber">{summary.late}</span>
            </div>
            <span className="stat-subtext">Grace exceeded</span>
          </div>
          <div className="stat-icon-badge">
            <Clock size={18} />
          </div>
        </div>

        <div className="stat-card stat-indigo" style={{ borderLeftColor: '#3b82f6' }}>
          <div className="stat-content">
            <span className="stat-title">Half Day</span>
            <div className="stat-number-wrapper">
              <span className="stat-number" style={{ color: '#2563eb' }}>{summary.half_day}</span>
            </div>
            <span className="stat-subtext">Partial shifts</span>
          </div>
          <div className="stat-icon-badge" style={{ backgroundColor: '#eff6ff', color: '#2563eb' }}>
            <CalendarClock size={18} />
          </div>
        </div>

        <div className="stat-card stat-slate">
          <div className="stat-content">
            <span className="stat-title">On Leave</span>
            <div className="stat-number-wrapper">
              <span className="stat-number" style={{ color: '#7c3aed' }}>{summary.on_leave}</span>
            </div>
            <span className="stat-subtext">Approved</span>
          </div>
          <div className="stat-icon-badge" style={{ backgroundColor: '#f5f3ff', color: '#7c3aed' }}>
            <Calendar size={18} />
          </div>
        </div>

        <div className="stat-card stat-amber" style={{ borderLeftColor: '#ef4444' }}>
          <div className="stat-content">
            <span className="stat-title">Absent</span>
            <div className="stat-number-wrapper">
              <span className="stat-number" style={{ color: '#dc2626' }}>{summary.absent}</span>
            </div>
            <span className="stat-subtext">Unexcused</span>
          </div>
          <div className="stat-icon-badge" style={{ backgroundColor: '#fef2f2', color: '#dc2626' }}>
            <XCircle size={18} />
          </div>
        </div>
      </div>

      {/* 3. Chronological Log Table */}
      <div className="table-wrapper-card">
        <div className="filters-card" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 2px 0', color: 'var(--text-main)' }}>
              Attendance Records — {formattedMonth}
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
              Official presence log recorded on institutional records.
            </p>
          </div>
          <span className="code-badge" style={{ backgroundColor: '#eff6ff', color: '#1d4ed8' }}>
            Attendance Rate: {summary.attendance_rate}%
          </span>
        </div>

        {isLoading ? (
          <TableSkeleton rows={6} columns={6} />
        ) : error ? (
          <div className="table-state-container error-state" style={{ padding: '36px', textAlign: 'center' }}>
            <AlertCircle size={32} className="text-danger" style={{ margin: '0 auto 8px' }} />
            <h4 style={{ margin: '0 0 4px', fontSize: '1rem', color: 'var(--text-main)' }}>Unable to load records</h4>
            <p style={{ margin: '0 0 16px', fontSize: '0.84rem', color: 'var(--text-muted)' }}>{error}</p>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => fetchMyAttendance(selectedMonth)}>
              <RefreshCw size={14} />
              <span>Retry</span>
            </button>
          </div>
        ) : history.length === 0 ? (
          <div className="empty-state-container" style={{ padding: '48px 24px', textAlign: 'center' }}>
            <CalendarClock size={36} className="text-muted" style={{ margin: '0 auto 12px', opacity: 0.6 }} />
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', margin: '0 0 6px 0' }}>
              No attendance records for {formattedMonth}
            </h3>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', margin: '0 0 16px 0' }}>
              No attendance entries found for this calendar month.
            </p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="employee-table">
              <thead>
                <tr>
                  <th style={{ minWidth: '160px' }}>Date</th>
                  <th style={{ minWidth: '160px' }}>Work Shift</th>
                  <th style={{ minWidth: '110px' }}>Check In</th>
                  <th style={{ minWidth: '110px' }}>Check Out</th>
                  <th style={{ minWidth: '120px' }}>Working Hours</th>
                  <th style={{ minWidth: '110px' }}>Status</th>
                  <th style={{ minWidth: '180px' }}>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id} className="employee-table-row">
                    <td>
                      <span style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.86rem' }}>
                        {h.date_formatted}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, color: '#1e40af', fontSize: '0.82rem' }}>
                        {h.shift_name || 'Regular Teaching'}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.84rem', fontWeight: 600, color: h.status === 'Late' ? '#d97706' : 'var(--text-main)' }}>
                        {h.check_in_formatted}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.84rem', color: 'var(--text-main)' }}>
                        {h.check_out_formatted}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                        {h.working_hours_formatted}
                      </span>
                    </td>
                    <td>
                      {renderStatusBadge(h.status)}
                    </td>
                    <td>
                      <span className="text-muted text-xs" style={{ display: 'block', maxWidth: '220px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={h.remarks}>
                        {h.remarks || '—'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Correction Notice Footer */}
        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border-light)', backgroundColor: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <HelpCircle size={14} className="text-primary" />
            <span>Need an Attendance Correction for past records?</span>
          </div>
          <span style={{ fontWeight: 600, color: 'var(--color-primary)' }}>
            Please contact St. Vincent's HR Administration for formal timecard adjustments.
          </span>
        </div>
      </div>
    </div>
  );
}

export default MyAttendanceView;
