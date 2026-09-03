import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  Calendar,
  AlertCircle,
  RefreshCw,
  Building2,
  CalendarClock,
  ArrowRight,
  TrendingUp,
  Percent,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { hrmsApi } from '../../services/api';

export function AttendanceDashboardView({
  onNavigateToDaily,
  onNavigateToRegister,
  onNavigateToReports
}) {
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [dashboardData, setDashboardData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const fetchDashboard = useCallback(async (date, isSilent = false) => {
    if (!isSilent) setIsLoading(true);
    else setIsRefreshing(true);
    setError(null);

    try {
      const res = await hrmsApi.getAttendanceDashboard(date);
      if (res && res.success) {
        setDashboardData(res.data);
      } else {
        throw new Error(res?.message || 'Failed to retrieve attendance dashboard.');
      }
    } catch (err) {
      console.error('Fetch dashboard error:', err);
      setError(err.message || 'Unable to connect to St. Vincent\'s backend server.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard(selectedDate);
  }, [selectedDate, fetchDashboard]);

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

  const metrics = dashboardData?.metrics || {
    total_staff: 0,
    present: 0,
    absent: 0,
    late: 0,
    on_leave: 0,
    half_day: 0,
    not_marked: 0,
    attendance_rate: 0
  };

  const departmentSummary = dashboardData?.department_summary || [];

  const formattedDate = new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <div className="attendance-view-content" style={{ width: '100%', boxSizing: 'border-box' }}>
      {/* 1. Page Header & Date Picker */}
      <div className="page-header-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 4px 0' }}>
            Attendance Dashboard
          </h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
            Daily workforce presence, late arrival trends, and department attendance rates.
          </p>
        </div>

        {/* Date Selector Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
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

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => fetchDashboard(selectedDate, true)}
            title="Refresh dashboard data"
          >
            <RefreshCw size={14} className={isRefreshing ? 'spin-animation' : ''} />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {/* Date Banner */}
      <div style={{ backgroundColor: '#f8fafc', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: '10px 16px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Calendar size={16} className="text-primary" />
          <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-main)' }}>
            Attendance Overview — {formattedDate}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Attendance Rate: <strong style={{ color: metrics.attendance_rate >= 85 ? '#059669' : '#d97706' }}>{metrics.attendance_rate}%</strong>
          </span>
          <button
            type="button"
            className="btn btn-ghost btn-xs"
            onClick={onNavigateToDaily}
            style={{ fontSize: '0.78rem', color: 'var(--color-primary)' }}
          >
            View Daily Roster <ArrowRight size={12} style={{ display: 'inline', marginLeft: '2px' }} />
          </button>
        </div>
      </div>

      {/* 2. Top 6 KPI Cards (Single responsive grid row) */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', marginBottom: '24px' }}>
        {/* Total Staff */}
        <div className="stat-card stat-indigo">
          <div className="stat-content">
            <span className="stat-title">Total Staff</span>
            <div className="stat-number-wrapper">
              <span className="stat-number">{metrics.total_staff}</span>
            </div>
            <span className="stat-subtext">Active workforce</span>
          </div>
          <div className="stat-icon-badge">
            <Users size={20} />
          </div>
        </div>

        {/* Present */}
        <div className="stat-card stat-emerald">
          <div className="stat-content">
            <span className="stat-title">Present</span>
            <div className="stat-number-wrapper">
              <span className="stat-number text-emerald">{metrics.present}</span>
            </div>
            <span className="stat-subtext">On time attendance</span>
          </div>
          <div className="stat-icon-badge">
            <CheckCircle2 size={20} />
          </div>
        </div>

        {/* Late */}
        <div className="stat-card stat-amber">
          <div className="stat-content">
            <span className="stat-title">Late</span>
            <div className="stat-number-wrapper">
              <span className="stat-number text-amber">{metrics.late}</span>
            </div>
            <span className="stat-subtext">Beyond grace period</span>
          </div>
          <div className="stat-icon-badge">
            <Clock size={20} />
          </div>
        </div>

        {/* Half Day */}
        <div className="stat-card stat-indigo" style={{ borderLeftColor: '#3b82f6' }}>
          <div className="stat-content">
            <span className="stat-title">Half Day</span>
            <div className="stat-number-wrapper">
              <span className="stat-number" style={{ color: '#2563eb' }}>{metrics.half_day}</span>
            </div>
            <span className="stat-subtext">Partial hours</span>
          </div>
          <div className="stat-icon-badge" style={{ backgroundColor: '#eff6ff', color: '#2563eb' }}>
            <CalendarClock size={20} />
          </div>
        </div>

        {/* On Leave */}
        <div className="stat-card stat-slate">
          <div className="stat-content">
            <span className="stat-title">On Leave</span>
            <div className="stat-number-wrapper">
              <span className="stat-number" style={{ color: '#7c3aed' }}>{metrics.on_leave}</span>
            </div>
            <span className="stat-subtext">Approved absences</span>
          </div>
          <div className="stat-icon-badge" style={{ backgroundColor: '#f5f3ff', color: '#7c3aed' }}>
            <Calendar size={20} />
          </div>
        </div>

        {/* Absent */}
        <div className="stat-card stat-amber" style={{ borderLeftColor: '#ef4444' }}>
          <div className="stat-content">
            <span className="stat-title">Absent</span>
            <div className="stat-number-wrapper">
              <span className="stat-number" style={{ color: '#dc2626' }}>{metrics.absent}</span>
            </div>
            <span className="stat-subtext">Unexcused</span>
          </div>
          <div className="stat-icon-badge" style={{ backgroundColor: '#fef2f2', color: '#dc2626' }}>
            <XCircle size={20} />
          </div>
        </div>
      </div>

      {/* 3. Middle Section: Attendance Summary Bar & Quick Breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)', gap: '20px', marginBottom: '24px' }}>
        
        {/* Attendance Summary Distribution */}
        <div className="table-wrapper-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '0.98rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
              Workforce Status Distribution
            </h3>
            <span className="code-badge" style={{ backgroundColor: '#eff6ff', color: '#1d4ed8' }}>
              {metrics.total_staff} Active Staff
            </span>
          </div>

          {/* Stacked Visual Distribution Bar */}
          <div style={{ width: '100%', height: '14px', borderRadius: '7px', backgroundColor: '#e2e8f0', display: 'flex', overflow: 'hidden', marginBottom: '16px' }}>
            {metrics.total_staff > 0 && (
              <>
                <div style={{ width: `${(metrics.present / metrics.total_staff) * 100}%`, backgroundColor: '#10b981' }} title={`Present: ${metrics.present}`} />
                <div style={{ width: `${(metrics.late / metrics.total_staff) * 100}%`, backgroundColor: '#f59e0b' }} title={`Late: ${metrics.late}`} />
                <div style={{ width: `${(metrics.half_day / metrics.total_staff) * 100}%`, backgroundColor: '#3b82f6' }} title={`Half Day: ${metrics.half_day}`} />
                <div style={{ width: `${(metrics.on_leave / metrics.total_staff) * 100}%`, backgroundColor: '#8b5cf6' }} title={`On Leave: ${metrics.on_leave}`} />
                <div style={{ width: `${(metrics.absent / metrics.total_staff) * 100}%`, backgroundColor: '#ef4444' }} title={`Absent: ${metrics.absent}`} />
              </>
            )}
          </div>

          {/* Breakdown List */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
            <div style={{ padding: '10px 12px', borderRadius: '6px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#166534', fontSize: '0.78rem', fontWeight: 600 }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981' }}></span>
                Present
              </div>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#166534', marginTop: '4px' }}>
                {metrics.present} <span style={{ fontSize: '0.74rem', fontWeight: 500 }}>({metrics.total_staff > 0 ? Math.round((metrics.present / metrics.total_staff) * 100) : 0}%)</span>
              </div>
            </div>

            <div style={{ padding: '10px 12px', borderRadius: '6px', backgroundColor: '#fffbeb', border: '1px solid #fde68a' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#92400e', fontSize: '0.78rem', fontWeight: 600 }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#f59e0b' }}></span>
                Late Arrival
              </div>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#92400e', marginTop: '4px' }}>
                {metrics.late} <span style={{ fontSize: '0.74rem', fontWeight: 500 }}>({metrics.total_staff > 0 ? Math.round((metrics.late / metrics.total_staff) * 100) : 0}%)</span>
              </div>
            </div>

            <div style={{ padding: '10px 12px', borderRadius: '6px', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#1e40af', fontSize: '0.78rem', fontWeight: 600 }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#3b82f6' }}></span>
                Half Day
              </div>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#1e40af', marginTop: '4px' }}>
                {metrics.half_day} <span style={{ fontSize: '0.74rem', fontWeight: 500 }}>({metrics.total_staff > 0 ? Math.round((metrics.half_day / metrics.total_staff) * 100) : 0}%)</span>
              </div>
            </div>

            <div style={{ padding: '10px 12px', borderRadius: '6px', backgroundColor: '#faf5ff', border: '1px solid #e9d5ff' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#6b21a8', fontSize: '0.78rem', fontWeight: 600 }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#8b5cf6' }}></span>
                On Leave
              </div>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#6b21a8', marginTop: '4px' }}>
                {metrics.on_leave} <span style={{ fontSize: '0.74rem', fontWeight: 500 }}>({metrics.total_staff > 0 ? Math.round((metrics.on_leave / metrics.total_staff) * 100) : 0}%)</span>
              </div>
            </div>

            <div style={{ padding: '10px 12px', borderRadius: '6px', backgroundColor: '#fef2f2', border: '1px solid #fecaca' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#991b1b', fontSize: '0.78rem', fontWeight: 600 }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444' }}></span>
                Absent
              </div>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#991b1b', marginTop: '4px' }}>
                {metrics.absent} <span style={{ fontSize: '0.74rem', fontWeight: 500 }}>({metrics.total_staff > 0 ? Math.round((metrics.absent / metrics.total_staff) * 100) : 0}%)</span>
              </div>
            </div>

            <div style={{ padding: '10px 12px', borderRadius: '6px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#475569', fontSize: '0.78rem', fontWeight: 600 }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#94a3b8' }}></span>
                Pending
              </div>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#475569', marginTop: '4px' }}>
                {metrics.not_marked} <span style={{ fontSize: '0.74rem', fontWeight: 500 }}>({metrics.total_staff > 0 ? Math.round((metrics.not_marked / metrics.total_staff) * 100) : 0}%)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Navigation Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div 
            className="table-wrapper-card" 
            style={{ padding: '16px', flex: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'transform 0.15s ease' }}
            onClick={onNavigateToDaily}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div className="stat-icon-badge stat-emerald" style={{ width: '42px', height: '42px' }}>
                <CheckCircle2 size={20} />
              </div>
              <div>
                <h4 style={{ fontSize: '0.92rem', fontWeight: 700, margin: '0 0 2px 0', color: 'var(--text-main)' }}>
                  Daily Attendance Roster
                </h4>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
                  Mark check-ins, record working hours, and review time cards.
                </p>
              </div>
            </div>
            <ArrowRight size={18} className="text-muted" />
          </div>

          <div 
            className="table-wrapper-card" 
            style={{ padding: '16px', flex: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'transform 0.15s ease' }}
            onClick={onNavigateToRegister}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div className="stat-icon-badge stat-indigo" style={{ width: '42px', height: '42px' }}>
                <Calendar size={20} />
              </div>
              <div>
                <h4 style={{ fontSize: '0.92rem', fontWeight: 700, margin: '0 0 2px 0', color: 'var(--text-main)' }}>
                  Monthly Attendance Register
                </h4>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
                  View complete monthly matrix of P, A, L, H, and Leave codes.
                </p>
              </div>
            </div>
            <ArrowRight size={18} className="text-muted" />
          </div>

          <div 
            className="table-wrapper-card" 
            style={{ padding: '16px', flex: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'transform 0.15s ease' }}
            onClick={onNavigateToReports}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div className="stat-icon-badge stat-slate" style={{ width: '42px', height: '42px' }}>
                <Percent size={20} />
              </div>
              <div>
                <h4 style={{ fontSize: '0.92rem', fontWeight: 700, margin: '0 0 2px 0', color: 'var(--text-main)' }}>
                  Attendance Reports & Export
                </h4>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
                  Generate custom date range summaries and export CSV data.
                </p>
              </div>
            </div>
            <ArrowRight size={18} className="text-muted" />
          </div>
        </div>
      </div>

      {/* 4. Department Attendance Progress */}
      <div className="table-wrapper-card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 2px 0', color: 'var(--text-main)' }}>
              Department Attendance Summary
            </h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
              Staff presence breakdown across academic and administrative departments.
            </p>
          </div>
        </div>

        <div className="table-responsive">
          <table className="employee-table">
            <thead>
              <tr>
                <th style={{ minWidth: '220px' }}>Department</th>
                <th style={{ minWidth: '90px' }}>Total Staff</th>
                <th style={{ minWidth: '90px' }}>Present</th>
                <th style={{ minWidth: '80px' }}>Late</th>
                <th style={{ minWidth: '80px' }}>On Leave</th>
                <th style={{ minWidth: '80px' }}>Absent</th>
                <th style={{ minWidth: '160px' }}>Attendance Rate</th>
              </tr>
            </thead>
            <tbody>
              {departmentSummary.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                    No department data available for this date.
                  </td>
                </tr>
              ) : (
                departmentSummary.map((dept, idx) => (
                  <tr key={idx} className="employee-table-row">
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Building2 size={15} className="text-muted" />
                        <span style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.86rem' }}>
                          {dept.department}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className="code-badge">{dept.total}</span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, color: '#059669', fontSize: '0.84rem' }}>
                        {dept.present}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, color: '#d97706', fontSize: '0.84rem' }}>
                        {dept.late}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, color: '#7c3aed', fontSize: '0.84rem' }}>
                        {dept.onLeave}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, color: '#dc2626', fontSize: '0.84rem' }}>
                        {dept.absent}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ flex: 1, height: '6px', borderRadius: '3px', backgroundColor: '#e2e8f0', overflow: 'hidden' }}>
                          <div
                            style={{
                              width: `${dept.attendanceRate}%`,
                              height: '100%',
                              backgroundColor: dept.attendanceRate >= 85 ? '#10b981' : dept.attendanceRate >= 70 ? '#f59e0b' : '#ef4444'
                            }}
                          />
                        </div>
                        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-main)', width: '36px' }}>
                          {dept.attendanceRate}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default AttendanceDashboardView;
