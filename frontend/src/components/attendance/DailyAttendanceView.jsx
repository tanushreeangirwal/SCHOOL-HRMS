import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Calendar,
  Search,
  Filter,
  RefreshCw,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Users,
  Edit2,
  UserCheck,
  ChevronLeft,
  ChevronRight,
  X,
  Building2,
  CalendarClock
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { hrmsApi } from '../../services/api';
import { StaffAvatar } from '../common/StaffAvatar';
import { TableSkeleton } from '../common/LoadingSpinner';

export function DailyAttendanceView({
  departments = [],
  shifts = [],
  onOpenMarkModal,
  onOpenEditModal,
  onViewEmployeeAttendance
}) {
  const { hasPermission, hasRole } = useAuth();
  const canMark = hasPermission('attendance:mark') || hasRole('Super Admin', 'Administrator', 'HR', 'Manager');
  const canUpdate = hasPermission('attendance:update') || hasRole('Super Admin', 'Administrator', 'HR');

  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [records, setRecords] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('ALL');
  const [shiftFilter, setShiftFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Quick Batch Mark Loading State
  const [isQuickMarking, setIsQuickMarking] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  const fetchDailyRoster = useCallback(async (date, isSilent = false) => {
    if (!isSilent) setIsLoading(true);
    else setIsRefreshing(true);
    setError(null);

    try {
      const res = await hrmsApi.getDailyAttendance({
        date,
        department_id: departmentFilter !== 'ALL' ? departmentFilter : undefined,
        shift_id: shiftFilter !== 'ALL' ? shiftFilter : undefined,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        search: searchTerm.trim() || undefined
      });

      if (res && res.success) {
        setRecords(res.data?.records || []);
      } else {
        throw new Error(res?.message || 'Failed to load daily attendance roster.');
      }
    } catch (err) {
      console.error('Fetch daily attendance error:', err);
      setError(err.message || 'Unable to load attendance records.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [departmentFilter, shiftFilter, statusFilter, searchTerm]);

  useEffect(() => {
    fetchDailyRoster(selectedDate);
  }, [selectedDate, fetchDailyRoster]);

  const handlePrevDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const handleNextDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const handleToday = () => {
    setSelectedDate(new Date().toISOString().split('T')[0]);
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setDepartmentFilter('ALL');
    setShiftFilter('ALL');
    setStatusFilter('ALL');
  };

  const isFilterActive = searchTerm.trim() !== '' || departmentFilter !== 'ALL' || shiftFilter !== 'ALL' || statusFilter !== 'ALL';

  // Quick Mark All Unmarked as Present
  const handleQuickMarkAll = async () => {
    if (!canMark) return;
    setIsQuickMarking(true);
    try {
      const res = await hrmsApi.quickMarkAttendance({
        date: selectedDate,
        department_id: departmentFilter !== 'ALL' ? departmentFilter : undefined
      });
      if (res && res.success) {
        setToastMessage(`Marked attendance for ${res.data.marked_count} employees.`);
        fetchDailyRoster(selectedDate, true);
        setTimeout(() => setToastMessage(null), 4000);
      }
    } catch (err) {
      console.error('Quick mark error:', err);
      alert(err.message || 'Failed to execute quick attendance marking.');
    } finally {
      setIsQuickMarking(false);
    }
  };

  // Helper for Status Badge Styling
  const renderStatusPill = (status) => {
    switch (status) {
      case 'Present':
        return (
          <span className="status-pill badge-active">
            <span className="status-dot"></span>
            <span>Present</span>
          </span>
        );
      case 'Late':
        return (
          <span className="status-pill badge-probation" style={{ backgroundColor: '#fffbeb', color: '#b45309' }}>
            <span className="status-dot" style={{ backgroundColor: '#f59e0b' }}></span>
            <span>Late</span>
          </span>
        );
      case 'Half Day':
        return (
          <span className="status-pill" style={{ backgroundColor: '#eff6ff', color: '#1e40af' }}>
            <span className="status-dot" style={{ backgroundColor: '#3b82f6' }}></span>
            <span>Half Day</span>
          </span>
        );
      case 'On Leave':
        return (
          <span className="status-pill" style={{ backgroundColor: '#f5f3ff', color: '#7c3aed' }}>
            <span className="status-dot" style={{ backgroundColor: '#8b5cf6' }}></span>
            <span>On Leave</span>
          </span>
        );
      case 'Absent':
        return (
          <span className="status-pill badge-terminated">
            <span className="status-dot"></span>
            <span>Absent</span>
          </span>
        );
      default:
        return (
          <span className="status-pill badge-inactive">
            <span className="status-dot"></span>
            <span>Not Marked</span>
          </span>
        );
    }
  };

  // Compute stats on current roster
  const rosterStats = useMemo(() => {
    let present = 0;
    let late = 0;
    let absent = 0;
    let onLeave = 0;
    let halfDay = 0;
    let notMarked = 0;

    records.forEach(r => {
      if (r.status === 'Present') present++;
      else if (r.status === 'Late') late++;
      else if (r.status === 'Absent') absent++;
      else if (r.status === 'On Leave') onLeave++;
      else if (r.status === 'Half Day') halfDay++;
      else notMarked++;
    });

    return {
      total: records.length,
      present,
      late,
      absent,
      onLeave,
      halfDay,
      notMarked
    };
  }, [records]);

  const formattedDate = new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });

  return (
    <div className="attendance-view-content" style={{ width: '100%', boxSizing: 'border-box' }}>
      {/* 1. Page Header & Actions */}
      <div className="page-header-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 4px 0' }}>
            Daily Attendance Roster
          </h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
            Track daily staff check-in times, work schedule hours, and attendance status.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Date Picker Control */}
          <div className="date-stepper" style={{ display: 'flex', alignItems: 'center', backgroundColor: '#ffffff', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-md)', padding: '2px 4px' }}>
            <button
              type="button"
              className="btn btn-ghost btn-xs"
              onClick={handlePrevDay}
              title="Previous Day"
              style={{ padding: '6px' }}
            >
              <ChevronLeft size={16} />
            </button>
            <input
              type="date"
              className="form-input-inline"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{ border: 'none', background: 'transparent', fontWeight: 600, fontSize: '0.84rem', padding: '4px 8px', outline: 'none' }}
            />
            <button
              type="button"
              className="btn btn-ghost btn-xs"
              onClick={handleNextDay}
              title="Next Day"
              style={{ padding: '6px' }}
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleToday}
            style={{ fontSize: '0.8rem' }}
          >
            Today
          </button>

          {canMark && rosterStats.notMarked > 0 && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleQuickMarkAll}
              disabled={isQuickMarking}
              title="Batch mark unmarked scheduled employees as present"
            >
              {isQuickMarking ? (
                <Loader2 size={14} className="spin-animation" />
              ) : (
                <UserCheck size={14} />
              )}
              <span>Quick Mark Present ({rosterStats.notMarked})</span>
            </button>
          )}

          {canMark && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => onOpenMarkModal && onOpenMarkModal(null, selectedDate)}
            >
              <Clock size={15} />
              <span>Mark Attendance</span>
            </button>
          )}
        </div>
      </div>

      {/* Toast Banner */}
      {toastMessage && (
        <div className="assign-alert-banner success-banner" style={{ marginBottom: '16px' }}>
          <CheckCircle2 size={16} className="alert-banner-icon" />
          <div className="alert-banner-content" style={{ fontSize: '0.84rem' }}>{toastMessage}</div>
          <button type="button" className="alert-banner-close" onClick={() => setToastMessage(null)}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* 2. Top Summary KPI Row */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', marginBottom: '20px' }}>
        <div className="stat-card stat-indigo">
          <div className="stat-content">
            <span className="stat-title">Staff in Roster</span>
            <div className="stat-number-wrapper">
              <span className="stat-number">{rosterStats.total}</span>
            </div>
            <span className="stat-subtext">{formattedDate}</span>
          </div>
          <div className="stat-icon-badge">
            <Users size={18} />
          </div>
        </div>

        <div className="stat-card stat-emerald">
          <div className="stat-content">
            <span className="stat-title">Present</span>
            <div className="stat-number-wrapper">
              <span className="stat-number text-emerald">{rosterStats.present}</span>
            </div>
            <span className="stat-subtext">On time check-in</span>
          </div>
          <div className="stat-icon-badge">
            <CheckCircle2 size={18} />
          </div>
        </div>

        <div className="stat-card stat-amber">
          <div className="stat-content">
            <span className="stat-title">Late</span>
            <div className="stat-number-wrapper">
              <span className="stat-number text-amber">{rosterStats.late}</span>
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
              <span className="stat-number" style={{ color: '#2563eb' }}>{rosterStats.halfDay}</span>
            </div>
            <span className="stat-subtext">Partial shift</span>
          </div>
          <div className="stat-icon-badge" style={{ backgroundColor: '#eff6ff', color: '#2563eb' }}>
            <CalendarClock size={18} />
          </div>
        </div>

        <div className="stat-card stat-slate">
          <div className="stat-content">
            <span className="stat-title">On Leave</span>
            <div className="stat-number-wrapper">
              <span className="stat-number" style={{ color: '#7c3aed' }}>{rosterStats.onLeave}</span>
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
              <span className="stat-number" style={{ color: '#dc2626' }}>{rosterStats.absent}</span>
            </div>
            <span className="stat-subtext">Unexcused</span>
          </div>
          <div className="stat-icon-badge" style={{ backgroundColor: '#fef2f2', color: '#dc2626' }}>
            <XCircle size={18} />
          </div>
        </div>
      </div>

      {/* 3. Table & Standard Filter Toolbar */}
      <div className="table-wrapper-card">
        <div className="filters-card">
          <div className="filters-row">
            {/* Search Input */}
            <div className="search-input-wrapper">
              <Search className="search-icon" size={16} />
              <input
                type="text"
                className="search-input"
                placeholder="Search staff name, code, dept..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button
                  type="button"
                  className="search-clear-btn"
                  onClick={() => setSearchTerm('')}
                  title="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Department Filter */}
            <div className="filter-select-wrapper">
              <label className="filter-label">
                <Building2 size={13} />
                <span>Dept:</span>
              </label>
              <select
                className="filter-select"
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
              >
                <option value="ALL">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Shift Filter */}
            <div className="filter-select-wrapper">
              <label className="filter-label">
                <CalendarClock size={13} />
                <span>Shift:</span>
              </label>
              <select
                className="filter-select"
                value={shiftFilter}
                onChange={(e) => setShiftFilter(e.target.value)}
              >
                <option value="ALL">All Shifts</option>
                {shifts.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div className="filter-select-wrapper">
              <label className="filter-label">
                <Filter size={13} />
                <span>Status:</span>
              </label>
              <select
                className="filter-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="ALL">All Statuses</option>
                <option value="Present">Present</option>
                <option value="Late">Late</option>
                <option value="Half Day">Half Day</option>
                <option value="On Leave">On Leave</option>
                <option value="Absent">Absent</option>
                <option value="Not Marked">Not Marked</option>
              </select>
            </div>

            {/* Reset Button */}
            {isFilterActive && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={handleResetFilters}
                title="Reset filters"
              >
                <RefreshCw size={13} />
                <span>Reset</span>
              </button>
            )}
          </div>

          <div className="filters-results-info">
            <span>
              Showing <strong>{records.length}</strong> staff attendance records on <strong>{formattedDate}</strong>
            </span>
            {isFilterActive && <span className="filtered-indicator-badge">Filtered</span>}
          </div>
        </div>

        {/* Operational Table */}
        {isLoading ? (
          <TableSkeleton rows={6} columns={10} />
        ) : error ? (
          <div className="table-state-container error-state" style={{ padding: '36px', textAlign: 'center' }}>
            <AlertCircle size={32} className="text-danger" style={{ margin: '0 auto 8px' }} />
            <h4 style={{ margin: '0 0 4px', fontSize: '1rem', color: 'var(--text-main)' }}>Unable to load roster</h4>
            <p style={{ margin: '0 0 16px', fontSize: '0.84rem', color: 'var(--text-muted)' }}>{error}</p>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => fetchDailyRoster(selectedDate)}>
              <RefreshCw size={14} />
              <span>Retry</span>
            </button>
          </div>
        ) : records.length === 0 ? (
          <div className="empty-state-container" style={{ padding: '48px 24px', textAlign: 'center' }}>
            <CalendarClock size={36} className="text-muted" style={{ margin: '0 auto 12px', opacity: 0.6 }} />
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', margin: '0 0 6px 0' }}>
              No attendance records found
            </h3>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', margin: '0 0 16px 0' }}>
              {isFilterActive ? 'Try adjusting search or status filters.' : 'Mark attendance to record staff presence for this date.'}
            </p>
            {isFilterActive && (
              <button type="button" className="btn btn-secondary btn-sm" onClick={handleResetFilters}>
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <div className="table-responsive">
            <table className="employee-table">
              <thead>
                <tr>
                  <th style={{ minWidth: '110px' }}>Employee Code</th>
                  <th style={{ minWidth: '200px' }}>Employee</th>
                  <th style={{ minWidth: '170px' }}>Department</th>
                  <th style={{ minWidth: '150px' }}>Designation</th>
                  <th style={{ minWidth: '160px' }}>Shift</th>
                  <th style={{ minWidth: '100px' }}>Shift Start</th>
                  <th style={{ minWidth: '100px' }}>Check In</th>
                  <th style={{ minWidth: '100px' }}>Check Out</th>
                  <th style={{ minWidth: '100px' }}>Working Hours</th>
                  <th style={{ minWidth: '110px' }}>Status</th>
                  <th className="th-actions" style={{ minWidth: '110px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.employee_id} className="employee-table-row">
                    {/* Code */}
                    <td className="cell-code">
                      <span className="code-badge">{r.employee_code}</span>
                    </td>

                    {/* Employee Profile */}
                    <td className="cell-name">
                      <div 
                        style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
                        onClick={() => onViewEmployeeAttendance && onViewEmployeeAttendance(r.employee_id)}
                        title="View monthly attendance summary"
                      >
                        <StaffAvatar
                          firstName={r.first_name}
                          lastName={r.last_name}
                          photoUrl={r.profile_photo_url}
                          size="sm"
                        />
                        <div>
                          <span style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.86rem', display: 'block' }}>
                            {r.employee_name}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Department */}
                    <td className="cell-dept">
                      <span style={{ fontSize: '0.82rem', color: 'var(--text-main)' }}>
                        {r.department_name || 'Academic'}
                      </span>
                    </td>

                    {/* Designation */}
                    <td className="cell-desig">
                      <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                        {r.designation_name || 'Faculty'}
                      </span>
                    </td>

                    {/* Shift */}
                    <td className="cell-shift">
                      <span style={{ fontWeight: 600, color: '#1e40af', fontSize: '0.82rem' }}>
                        {r.shift_name || 'Regular Teaching'}
                      </span>
                    </td>

                    {/* Shift Start */}
                    <td className="cell-time">
                      <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                        {r.shift_start_formatted}
                      </span>
                    </td>

                    {/* Check In */}
                    <td className="cell-checkin">
                      <span style={{ fontSize: '0.82rem', fontWeight: 600, color: r.status === 'Late' ? '#d97706' : 'var(--text-main)' }}>
                        {r.check_in_time_formatted}
                      </span>
                    </td>

                    {/* Check Out */}
                    <td className="cell-checkout">
                      <span style={{ fontSize: '0.82rem', color: 'var(--text-main)' }}>
                        {r.check_out_time_formatted}
                      </span>
                    </td>

                    {/* Working Hours */}
                    <td className="cell-hours">
                      <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                        {r.working_hours_formatted}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="cell-status">
                      {renderStatusPill(r.status)}
                    </td>

                    {/* Actions */}
                    <td className="cell-actions" style={{ textAlign: 'right' }}>
                      <div className="employee-row-actions" style={{ justifyContent: 'flex-end' }}>
                        {r.attendance_id ? (
                          canUpdate && (
                            <button
                              type="button"
                              className="btn-action-icon btn-edit-icon"
                              onClick={() => onOpenEditModal && onOpenEditModal(r, selectedDate)}
                              title={`Edit attendance for ${r.employee_name}`}
                              aria-label={`Edit attendance for ${r.employee_name}`}
                            >
                              <Edit2 size={14} />
                            </button>
                          )
                        ) : (
                          canMark && (
                            <button
                              type="button"
                              className="btn btn-secondary btn-xs"
                              style={{ fontSize: '0.74rem', padding: '3px 8px' }}
                              onClick={() => onOpenMarkModal && onOpenMarkModal(r, selectedDate)}
                              title={`Mark attendance for ${r.employee_name}`}
                            >
                              Mark
                            </button>
                          )
                        )}
                      </div>
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

export default DailyAttendanceView;
