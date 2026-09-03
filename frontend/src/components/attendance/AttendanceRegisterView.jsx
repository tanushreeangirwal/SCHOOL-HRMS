import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  Search,
  Filter,
  RefreshCw,
  Building2,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  X,
  Users,
  AlertCircle
} from 'lucide-react';
import { hrmsApi } from '../../services/api';
import { StaffAvatar } from '../common/StaffAvatar';
import { TableSkeleton } from '../common/LoadingSpinner';

export function AttendanceRegisterView({
  departments = [],
  shifts = [],
  onViewEmployeeAttendance
}) {
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [registerData, setRegisterData] = useState([]);
  const [daysInMonth, setDaysInMonth] = useState(30);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('ALL');
  const [shiftFilter, setShiftFilter] = useState('ALL');

  const fetchRegister = useCallback(async (month, isSilent = false) => {
    if (!isSilent) setIsLoading(true);
    else setIsRefreshing(true);
    setError(null);

    try {
      const res = await hrmsApi.getAttendanceRegister({
        month,
        department_id: departmentFilter !== 'ALL' ? departmentFilter : undefined,
        shift_id: shiftFilter !== 'ALL' ? shiftFilter : undefined,
        search: searchTerm.trim() || undefined
      });

      if (res && res.success) {
        setRegisterData(res.data?.register || []);
        setDaysInMonth(res.data?.days_in_month || 30);
      } else {
        throw new Error(res?.message || 'Failed to retrieve attendance register matrix.');
      }
    } catch (err) {
      console.error('Fetch register error:', err);
      setError(err.message || 'Unable to load attendance register.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [departmentFilter, shiftFilter, searchTerm]);

  useEffect(() => {
    fetchRegister(selectedMonth);
  }, [selectedMonth, fetchRegister]);

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

  const handleResetFilters = () => {
    setSearchTerm('');
    setDepartmentFilter('ALL');
    setShiftFilter('ALL');
  };

  const isFilterActive = searchTerm.trim() !== '' || departmentFilter !== 'ALL' || shiftFilter !== 'ALL';

  // Helper for rendering day matrix code chip
  const renderDayCell = (dayObj) => {
    const { code, isWorkingDay, check_in, check_out, status } = dayObj;

    let bg = '#f8fafc';
    let color = '#94a3b8';
    let borderColor = '#e2e8f0';

    if (code === 'P') {
      bg = '#ecfdf5';
      color = '#047857';
      borderColor = '#a7f3d0';
    } else if (code === 'L') {
      bg = '#fffbeb';
      color = '#b45309';
      borderColor = '#fde68a';
    } else if (code === 'H') {
      bg = '#eff6ff';
      color = '#1d4ed8';
      borderColor = '#bfdbfe';
    } else if (code === 'LV') {
      bg = '#f5f3ff';
      color = '#7c3aed';
      borderColor = '#ddd6fe';
    } else if (code === 'A') {
      bg = '#fef2f2';
      color = '#b91c1c';
      borderColor = '#fecaca';
    } else if (code === '-') {
      bg = '#f1f5f9';
      color = '#cbd5e1';
      borderColor = '#e2e8f0';
    }

    const titleText = `${dayObj.date} (${dayObj.dayOfWeek}): ${status}${check_in ? ` | In: ${new Date(check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}${check_out ? ` | Out: ${new Date(check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}`;

    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '24px',
          height: '24px',
          borderRadius: '4px',
          fontSize: '0.68rem',
          fontWeight: 700,
          backgroundColor: bg,
          color,
          border: `1px solid ${borderColor}`,
          cursor: isWorkingDay ? 'pointer' : 'default'
        }}
        title={titleText}
      >
        {code}
      </span>
    );
  };

  const formattedMonth = new Date(selectedMonth + '-01T00:00:00').toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric'
  });

  return (
    <div className="attendance-view-content" style={{ width: '100%', boxSizing: 'border-box' }}>
      {/* 1. Page Header & Month Selector */}
      <div className="page-header-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 4px 0' }}>
            Monthly Attendance Register
          </h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
            Comprehensive monthly staff attendance matrix and shift calendar ledger.
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

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => fetchRegister(selectedMonth, true)}
            title="Refresh register data"
          >
            <RefreshCw size={14} className={isRefreshing ? 'spin-animation' : ''} />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {/* 2. Legend Bar */}
      <div style={{ backgroundColor: '#ffffff', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: '12px 18px', marginBottom: '18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Calendar size={16} className="text-primary" />
          <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-main)' }}>
            Register for {formattedMonth} ({registerData.length} Staff)
          </span>
        </div>

        {/* Legend Key */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', fontSize: '0.78rem' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ width: '18px', height: '18px', borderRadius: '3px', backgroundColor: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.65rem' }}>P</span>
            <span>Present</span>
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ width: '18px', height: '18px', borderRadius: '3px', backgroundColor: '#fffbeb', color: '#b45309', border: '1px solid #fde68a', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.65rem' }}>L</span>
            <span>Late</span>
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ width: '18px', height: '18px', borderRadius: '3px', backgroundColor: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.65rem' }}>H</span>
            <span>Half Day</span>
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ width: '18px', height: '18px', borderRadius: '3px', backgroundColor: '#f5f3ff', color: '#7c3aed', border: '1px solid #ddd6fe', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.65rem' }}>LV</span>
            <span>Leave</span>
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ width: '18px', height: '18px', borderRadius: '3px', backgroundColor: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.65rem' }}>A</span>
            <span>Absent</span>
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ width: '18px', height: '18px', borderRadius: '3px', backgroundColor: '#f1f5f9', color: '#94a3b8', border: '1px solid #e2e8f0', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.65rem' }}>-</span>
            <span>Non-Working / Off</span>
          </span>
        </div>
      </div>

      {/* 3. Table & Filter Toolbar */}
      <div className="table-wrapper-card">
        <div className="filters-card">
          <div className="filters-row">
            {/* Search Input */}
            <div className="search-input-wrapper">
              <Search className="search-icon" size={16} />
              <input
                type="text"
                className="search-input"
                placeholder="Search staff name or code..."
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

            {/* Reset Filter Button */}
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
              Showing <strong>{registerData.length}</strong> staff members for <strong>{formattedMonth}</strong>
            </span>
            {isFilterActive && <span className="filtered-indicator-badge">Filtered</span>}
          </div>
        </div>

        {/* Matrix Table */}
        {isLoading ? (
          <TableSkeleton rows={8} columns={15} />
        ) : error ? (
          <div className="table-state-container error-state" style={{ padding: '36px', textAlign: 'center' }}>
            <AlertCircle size={32} className="text-danger" style={{ margin: '0 auto 8px' }} />
            <h4 style={{ margin: '0 0 4px', fontSize: '1rem', color: 'var(--text-main)' }}>Unable to load register</h4>
            <p style={{ margin: '0 0 16px', fontSize: '0.84rem', color: 'var(--text-muted)' }}>{error}</p>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => fetchRegister(selectedMonth)}>
              <RefreshCw size={14} />
              <span>Retry</span>
            </button>
          </div>
        ) : registerData.length === 0 ? (
          <div className="empty-state-container" style={{ padding: '48px 24px', textAlign: 'center' }}>
            <Users size={36} className="text-muted" style={{ margin: '0 auto 12px', opacity: 0.6 }} />
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', margin: '0 0 6px 0' }}>
              No staff records found
            </h3>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', margin: '0 0 16px 0' }}>
              {isFilterActive ? 'Try adjusting search or department filters.' : 'No active employees to display in the register.'}
            </p>
            {isFilterActive && (
              <button type="button" className="btn btn-secondary btn-sm" onClick={handleResetFilters}>
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <div className="table-responsive" style={{ maxHeight: '680px', overflowX: 'auto' }}>
            <table className="employee-table" style={{ fontSize: '0.8rem' }}>
              <thead>
                <tr>
                  <th style={{ minWidth: '190px', position: 'sticky', left: 0, zIndex: 3, backgroundColor: '#f8fafc' }}>
                    Employee
                  </th>
                  <th style={{ minWidth: '90px' }}>Code</th>
                  <th style={{ minWidth: '140px' }}>Department</th>

                  {/* Days 1 to N */}
                  {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((dayNum) => (
                    <th
                      key={dayNum}
                      style={{
                        minWidth: '32px',
                        padding: '10px 4px',
                        textAlign: 'center',
                        fontSize: '0.7rem'
                      }}
                    >
                      {dayNum}
                    </th>
                  ))}

                  {/* Summary Totals */}
                  <th style={{ minWidth: '45px', textAlign: 'center', color: '#047857' }}>P</th>
                  <th style={{ minWidth: '45px', textAlign: 'center', color: '#b45309' }}>L</th>
                  <th style={{ minWidth: '45px', textAlign: 'center', color: '#1d4ed8' }}>H</th>
                  <th style={{ minWidth: '45px', textAlign: 'center', color: '#7c3aed' }}>LV</th>
                  <th style={{ minWidth: '45px', textAlign: 'center', color: '#b91c1c' }}>A</th>
                </tr>
              </thead>
              <tbody>
                {registerData.map((row) => (
                  <tr key={row.employee_id} className="employee-table-row">
                    {/* Fixed Employee Name Column */}
                    <td
                      style={{
                        position: 'sticky',
                        left: 0,
                        zIndex: 2,
                        backgroundColor: '#ffffff',
                        boxShadow: '2px 0 5px rgba(0,0,0,0.03)'
                      }}
                    >
                      <div
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
                        onClick={() => onViewEmployeeAttendance && onViewEmployeeAttendance(row.employee_id)}
                        title="Click to view detailed attendance history"
                      >
                        <StaffAvatar
                          firstName={row.employee_name.split(' ')[0]}
                          lastName={row.employee_name.split(' ')[1]}
                          photoUrl={row.profile_photo_url}
                          size="sm"
                        />
                        <span style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.84rem', whiteSpace: 'nowrap' }}>
                          {row.employee_name}
                        </span>
                      </div>
                    </td>

                    {/* Code */}
                    <td>
                      <span className="code-badge" style={{ fontSize: '0.72rem' }}>{row.employee_code}</span>
                    </td>

                    {/* Department */}
                    <td>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {row.department_name || 'Academic'}
                      </span>
                    </td>

                    {/* Day Cells */}
                    {row.days.map((d) => (
                      <td key={d.day} style={{ padding: '6px 2px', textAlign: 'center' }}>
                        {renderDayCell(d)}
                      </td>
                    ))}

                    {/* Totals */}
                    <td style={{ textAlign: 'center', fontWeight: 700, color: '#047857' }}>{row.summary.present}</td>
                    <td style={{ textAlign: 'center', fontWeight: 700, color: '#b45309' }}>{row.summary.late}</td>
                    <td style={{ textAlign: 'center', fontWeight: 700, color: '#1d4ed8' }}>{row.summary.half_day}</td>
                    <td style={{ textAlign: 'center', fontWeight: 700, color: '#7c3aed' }}>{row.summary.leave}</td>
                    <td style={{ textAlign: 'center', fontWeight: 700, color: '#b91c1c' }}>{row.summary.absent}</td>
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

export default AttendanceRegisterView;
