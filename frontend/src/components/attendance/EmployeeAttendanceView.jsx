import React, { useState, useEffect, useCallback } from 'react';
import {
  User,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  Building2,
  Briefcase,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Search
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { hrmsApi } from '../../services/api';
import { StaffAvatar } from '../common/StaffAvatar';
import { TableSkeleton } from '../common/LoadingSpinner';

export function EmployeeAttendanceView({
  employees = [],
  initialEmployeeId = null
}) {
  const { user, isEmployee } = useAuth();

  // If role is employee, lock to user's employee_id
  const targetEmployeeId = isEmployee && user?.employee_id ? user.employee_id : initialEmployeeId || employees[0]?.id;
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(targetEmployeeId || '');
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));

  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Update selectedEmployeeId when employees prop arrives
  useEffect(() => {
    if (!selectedEmployeeId && employees.length > 0) {
      if (isEmployee && user?.employee_id) {
        setSelectedEmployeeId(user.employee_id);
      } else {
        setSelectedEmployeeId(employees[0].id);
      }
    }
  }, [employees, selectedEmployeeId, isEmployee, user]);

  const fetchEmployeeData = useCallback(async (empId, month, isSilent = false) => {
    if (!empId) return;
    if (!isSilent) setIsLoading(true);
    else setIsRefreshing(true);
    setError(null);

    try {
      const res = await hrmsApi.getEmployeeAttendance(empId, month);
      if (res && res.success) {
        setData(res.data);
      } else {
        throw new Error(res?.message || 'Failed to load employee attendance records.');
      }
    } catch (err) {
      console.error('Fetch employee attendance error:', err);
      setError(err.message || 'Unable to load attendance records.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (selectedEmployeeId) {
      fetchEmployeeData(selectedEmployeeId, selectedMonth);
    }
  }, [selectedEmployeeId, selectedMonth, fetchEmployeeData]);

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

  const employee = data?.employee || null;
  const summary = data?.summary || { working_days: 0, present: 0, late: 0, absent: 0, on_leave: 0, half_day: 0, attendance_rate: 0 };
  const history = data?.history || [];

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
      {/* 1. Page Header & Employee Picker */}
      <div className="page-header-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 4px 0' }}>
            {isEmployee ? 'My Attendance History' : 'Employee Attendance Record'}
          </h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
            Detailed time logs, working hours, and monthly attendance calendar.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Employee Selector (for Admin/HR) */}
          {!isEmployee && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label htmlFor="emp-select-picker" style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                Staff:
              </label>
              <select
                id="emp-select-picker"
                className="filter-select"
                value={selectedEmployeeId}
                onChange={(e) => setSelectedEmployeeId(e.target.value)}
                style={{ fontWeight: 600, maxWidth: '260px' }}
              >
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.first_name} {emp.last_name || ''} ({emp.employee_code})
                  </option>
                ))}
              </select>
            </div>
          )}

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
            onClick={() => fetchEmployeeData(selectedEmployeeId, selectedMonth, true)}
            title="Refresh employee data"
          >
            <RefreshCw size={14} className={isRefreshing ? 'spin-animation' : ''} />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {/* 2. Employee Profile Summary Card */}
      {employee && (
        <div className="table-wrapper-card" style={{ padding: '18px 24px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <StaffAvatar
                firstName={employee.first_name}
                lastName={employee.last_name}
                photoUrl={employee.profile_photo_url}
                size="md"
              />
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                    {employee.full_name}
                  </h3>
                  <span className="code-badge">{employee.employee_code}</span>
                  <span className="status-pill badge-active" style={{ fontSize: '0.72rem' }}>
                    <span className="status-dot"></span>
                    <span>{employee.employment_status || 'Active'}</span>
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  <span>{employee.designation_name || 'Staff'}</span>
                  <span>•</span>
                  <span>{employee.department_name || 'Academic Department'}</span>
                  <span>•</span>
                  <span>{employee.email}</span>
                </div>
              </div>
            </div>

            {/* Shift Details Chip */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: '#f8fafc', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: '8px 14px' }}>
              <CalendarClock size={18} className="text-primary" />
              <div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, display: 'block' }}>
                  Assigned Shift
                </span>
                <span style={{ fontSize: '0.84rem', fontWeight: 700, color: '#1e40af' }}>
                  {employee.shift_name || 'Regular Teaching Shift'} ({employee.start_time ? employee.start_time.slice(0, 5) : '07:30'} – {employee.end_time ? employee.end_time.slice(0, 5) : '14:00'})
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Summary Metric Cards */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', marginBottom: '24px' }}>
        <div className="stat-card stat-indigo">
          <div className="stat-content">
            <span className="stat-title">Recorded Days</span>
            <div className="stat-number-wrapper">
              <span className="stat-number">{summary.working_days}</span>
            </div>
            <span className="stat-subtext">{formattedMonth}</span>
          </div>
          <div className="stat-icon-badge">
            <Calendar size={18} />
          </div>
        </div>

        <div className="stat-card stat-emerald">
          <div className="stat-content">
            <span className="stat-title">Present</span>
            <div className="stat-number-wrapper">
              <span className="stat-number text-emerald">{summary.present}</span>
            </div>
            <span className="stat-subtext">On time</span>
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
            <span className="stat-subtext">Arrivals</span>
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
            <span className="stat-subtext">Departures</span>
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

      {/* 4. Chronological Attendance History Table */}
      <div className="table-wrapper-card">
        <div className="filters-card" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-light)' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 2px 0', color: 'var(--text-main)' }}>
            Attendance Logs — {formattedMonth}
          </h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
            Chronological log of check-in, check-out, working hours, and remarks.
          </p>
        </div>

        {isLoading ? (
          <TableSkeleton rows={6} columns={7} />
        ) : error ? (
          <div className="table-state-container error-state" style={{ padding: '36px', textAlign: 'center' }}>
            <AlertCircle size={32} className="text-danger" style={{ margin: '0 auto 8px' }} />
            <h4 style={{ margin: '0 0 4px', fontSize: '1rem', color: 'var(--text-main)' }}>Unable to load history</h4>
            <p style={{ margin: '0 0 16px', fontSize: '0.84rem', color: 'var(--text-muted)' }}>{error}</p>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => fetchEmployeeData(selectedEmployeeId, selectedMonth)}>
              <RefreshCw size={14} />
              <span>Retry</span>
            </button>
          </div>
        ) : history.length === 0 ? (
          <div className="empty-state-container" style={{ padding: '48px 24px', textAlign: 'center' }}>
            <CalendarClock size={36} className="text-muted" style={{ margin: '0 auto 12px', opacity: 0.6 }} />
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', margin: '0 0 6px 0' }}>
              No attendance logs for {formattedMonth}
            </h3>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', margin: '0 0 16px 0' }}>
              No attendance records have been captured for this employee in this month.
            </p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="employee-table">
              <thead>
                <tr>
                  <th style={{ minWidth: '150px' }}>Date</th>
                  <th style={{ minWidth: '160px' }}>Work Shift</th>
                  <th style={{ minWidth: '110px' }}>Check In</th>
                  <th style={{ minWidth: '110px' }}>Check Out</th>
                  <th style={{ minWidth: '120px' }}>Working Hours</th>
                  <th style={{ minWidth: '110px' }}>Status</th>
                  <th style={{ minWidth: '200px' }}>Remarks</th>
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
                      <span className="text-muted text-xs" style={{ display: 'block', maxWidth: '240px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={h.remarks}>
                        {h.remarks || '—'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default EmployeeAttendanceView;
