import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  Filter,
  RefreshCw,
  Download,
  Building2,
  CalendarClock,
  User,
  CheckCircle2,
  XCircle,
  Clock,
  Percent,
  AlertCircle,
  FileSpreadsheet
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { hrmsApi } from '../../services/api';
import { StaffAvatar } from '../common/StaffAvatar';
import { TableSkeleton } from '../common/LoadingSpinner';

export function AttendanceReportsView({
  departments = [],
  shifts = [],
  employees = []
}) {
  const { hasPermission, hasRole } = useAuth();
  const canExport = hasPermission('attendance:export') || hasRole('Super Admin', 'Administrator', 'HR');

  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  const [departmentFilter, setDepartmentFilter] = useState('ALL');
  const [shiftFilter, setShiftFilter] = useState('ALL');
  const [employeeFilter, setEmployeeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const [reportData, setReportData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const fetchReports = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsLoading(true);
    else setIsRefreshing(true);
    setError(null);

    try {
      const res = await hrmsApi.getAttendanceReports({
        startDate,
        endDate,
        department_id: departmentFilter !== 'ALL' ? departmentFilter : undefined,
        shift_id: shiftFilter !== 'ALL' ? shiftFilter : undefined,
        employee_id: employeeFilter !== 'ALL' ? employeeFilter : undefined,
        status: statusFilter !== 'ALL' ? statusFilter : undefined
      });

      if (res && res.success) {
        setReportData(res.data);
      } else {
        throw new Error(res?.message || 'Failed to generate attendance report.');
      }
    } catch (err) {
      console.error('Fetch reports error:', err);
      setError(err.message || 'Unable to generate attendance report.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [startDate, endDate, departmentFilter, shiftFilter, employeeFilter, statusFilter]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // Export to CSV Functionality
  const handleExportCSV = () => {
    if (!reportData || !reportData.records || reportData.records.length === 0) return;

    const headers = [
      'Attendance Date',
      'Employee Code',
      'Employee Name',
      'Department',
      'Designation',
      'Work Shift',
      'Check In',
      'Check Out',
      'Working Hours',
      'Status',
      'Late (Mins)',
      'Remarks'
    ];

    const rows = reportData.records.map(r => [
      r.date_formatted || r.attendance_date,
      `"${r.employee_code || ''}"`,
      `"${r.employee_name || ''}"`,
      `"${r.department_name || ''}"`,
      `"${r.designation_name || ''}"`,
      `"${r.shift_name || ''}"`,
      `"${r.check_in_formatted || ''}"`,
      `"${r.check_out_formatted || ''}"`,
      `"${r.working_hours || ''}"`,
      `"${r.status || ''}"`,
      r.late_minutes || 0,
      `"${(r.remarks || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `St_Vincents_Attendance_Report_${startDate}_to_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const summary = reportData?.summary || {
    total_records: 0,
    present: 0,
    late: 0,
    absent: 0,
    on_leave: 0,
    half_day: 0,
    attendance_percentage: 0
  };

  const records = reportData?.records || [];

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
      {/* 1. Page Header & Export Action */}
      <div className="page-header-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 4px 0' }}>
            Attendance Reports & Analytics
          </h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
            Generate custom date range summaries, calculate presence rates, and export data.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {canExport && records.length > 0 && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleExportCSV}
              title="Download CSV report"
            >
              <Download size={14} />
              <span>Export CSV</span>
            </button>
          )}

          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => fetchReports(true)}
            title="Refresh reports data"
          >
            <RefreshCw size={14} className={isRefreshing ? 'spin-animation' : ''} />
            <span>Generate Report</span>
          </button>
        </div>
      </div>

      {/* 2. Top Summary KPI Row */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', marginBottom: '20px' }}>
        <div className="stat-card stat-indigo">
          <div className="stat-content">
            <span className="stat-title">Total Records</span>
            <div className="stat-number-wrapper">
              <span className="stat-number">{summary.total_records}</span>
            </div>
            <span className="stat-subtext">Across period</span>
          </div>
          <div className="stat-icon-badge">
            <FileSpreadsheet size={18} />
          </div>
        </div>

        <div className="stat-card stat-emerald">
          <div className="stat-content">
            <span className="stat-title">Present</span>
            <div className="stat-number-wrapper">
              <span className="stat-number text-emerald">{summary.present}</span>
            </div>
            <span className="stat-subtext">On time shifts</span>
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
            <span className="stat-subtext">Late arrivals</span>
          </div>
          <div className="stat-icon-badge">
            <Clock size={18} />
          </div>
        </div>

        <div className="stat-card stat-slate">
          <div className="stat-content">
            <span className="stat-title">On Leave</span>
            <div className="stat-number-wrapper">
              <span className="stat-number" style={{ color: '#7c3aed' }}>{summary.on_leave}</span>
            </div>
            <span className="stat-subtext">Approved leaves</span>
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

        <div className="stat-card stat-emerald" style={{ borderLeftColor: '#059669' }}>
          <div className="stat-content">
            <span className="stat-title">Attendance Rate</span>
            <div className="stat-number-wrapper">
              <span className="stat-number text-emerald">{summary.attendance_percentage}%</span>
            </div>
            <span className="stat-subtext">Overall score</span>
          </div>
          <div className="stat-icon-badge">
            <Percent size={18} />
          </div>
        </div>
      </div>

      {/* 3. Filter Bar */}
      <div className="table-wrapper-card" style={{ marginBottom: '20px' }}>
        <div className="filters-card">
          <div className="filters-row" style={{ flexWrap: 'wrap', gap: '12px' }}>
            {/* Start Date */}
            <div className="filter-select-wrapper">
              <label className="filter-label">
                <Calendar size={13} />
                <span>From:</span>
              </label>
              <input
                type="date"
                className="filter-select"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            {/* End Date */}
            <div className="filter-select-wrapper">
              <label className="filter-label">
                <Calendar size={13} />
                <span>To:</span>
              </label>
              <input
                type="date"
                className="filter-select"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            {/* Department */}
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

            {/* Shift */}
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

            {/* Employee */}
            <div className="filter-select-wrapper">
              <label className="filter-label">
                <User size={13} />
                <span>Staff:</span>
              </label>
              <select
                className="filter-select"
                value={employeeFilter}
                onChange={(e) => setEmployeeFilter(e.target.value)}
              >
                <option value="ALL">All Employees</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.first_name} {emp.last_name || ''} ({emp.employee_code})
                  </option>
                ))}
              </select>
            </div>

            {/* Status */}
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
              </select>
            </div>
          </div>
        </div>

        {/* 4. Report Data Table */}
        {isLoading ? (
          <TableSkeleton rows={8} columns={9} />
        ) : error ? (
          <div className="table-state-container error-state" style={{ padding: '36px', textAlign: 'center' }}>
            <AlertCircle size={32} className="text-danger" style={{ margin: '0 auto 8px' }} />
            <h4 style={{ margin: '0 0 4px', fontSize: '1rem', color: 'var(--text-main)' }}>Unable to generate report</h4>
            <p style={{ margin: '0 0 16px', fontSize: '0.84rem', color: 'var(--text-muted)' }}>{error}</p>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => fetchReports()}>
              <RefreshCw size={14} />
              <span>Retry</span>
            </button>
          </div>
        ) : records.length === 0 ? (
          <div className="empty-state-container" style={{ padding: '48px 24px', textAlign: 'center' }}>
            <CalendarClock size={36} className="text-muted" style={{ margin: '0 auto 12px', opacity: 0.6 }} />
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', margin: '0 0 6px 0' }}>
              No records found for selected period
            </h3>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', margin: '0 0 16px 0' }}>
              Try expanding your date range or clearing specific filters.
            </p>
          </div>
        ) : (
          <div className="table-responsive" style={{ maxHeight: '600px', overflowY: 'auto' }}>
            <table className="employee-table">
              <thead>
                <tr>
                  <th style={{ minWidth: '110px' }}>Date</th>
                  <th style={{ minWidth: '100px' }}>Code</th>
                  <th style={{ minWidth: '180px' }}>Employee</th>
                  <th style={{ minWidth: '160px' }}>Department</th>
                  <th style={{ minWidth: '150px' }}>Shift</th>
                  <th style={{ minWidth: '100px' }}>Check In</th>
                  <th style={{ minWidth: '100px' }}>Check Out</th>
                  <th style={{ minWidth: '110px' }}>Working Hours</th>
                  <th style={{ minWidth: '100px' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id} className="employee-table-row">
                    <td>
                      <span style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.84rem' }}>
                        {r.date_formatted}
                      </span>
                    </td>
                    <td>
                      <span className="code-badge">{r.employee_code}</span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <StaffAvatar
                          firstName={r.first_name}
                          lastName={r.last_name}
                          size="sm"
                        />
                        <span style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.84rem' }}>
                          {r.employee_name}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                        {r.department_name || 'Academic'}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, color: '#1e40af', fontSize: '0.82rem' }}>
                        {r.shift_name || 'Regular Teaching'}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.82rem', fontWeight: 600, color: r.status === 'Late' ? '#d97706' : 'var(--text-main)' }}>
                        {r.check_in_formatted}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.82rem', color: 'var(--text-main)' }}>
                        {r.check_out_formatted}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                        {r.working_hours}
                      </span>
                    </td>
                    <td>
                      {renderStatusBadge(r.status)}
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

export default AttendanceReportsView;
