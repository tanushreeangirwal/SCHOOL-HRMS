import React, { useState, useEffect } from 'react';
import { 
  GraduationCap, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  Users, 
  AlertCircle, 
  Award, 
  ArrowRight, 
  Plus, 
  Search, 
  Building2, 
  RefreshCw,
  PlayCircle,
  FileText,
  UserCheck,
  TrendingUp,
  MapPin,
  ExternalLink
} from 'lucide-react';
import { hrmsApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { LoadingSpinner } from '../common/LoadingSpinner';

export function TrainingDashboardView({ 
  onNavigateToPrograms, 
  onNavigateToAttendance, 
  onNavigateToCertificates, 
  onNavigateToCalendar, 
  onNavigateToReports,
  onOpenCreateProgram,
  departments = []
}) {
  const { isSuperAdmin, isAdmin, isHR, isManager } = useAuth();
  const canManage = isSuperAdmin || isAdmin || isHR;

  const [dashboardData, setDashboardData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedDept, setSelectedDept] = useState('');

  const fetchDashboard = async (isManualRefresh = false) => {
    if (isManualRefresh) setIsRefreshing(true);
    else setIsLoading(true);
    setError(null);

    try {
      const params = {};
      if (selectedDept) params.department_id = selectedDept;
      const res = await hrmsApi.getTrainingDashboard(params);
      if (res && res.success) {
        setDashboardData(res.data);
      } else {
        setError(res?.message || 'Failed to load training dashboard metrics.');
      }
    } catch (err) {
      console.error('Error loading training dashboard:', err);
      setError(err.message || 'Network error fetching training metrics.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, [selectedDept]);

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="training-dashboard-view" style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {/* 1. Header Toolbar with Department Filter & Quick Actions */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '14px',
        backgroundColor: '#ffffff',
        padding: '16px 20px',
        borderRadius: '14px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <GraduationCap size={20} style={{ color: '#3155D9' }} />
            <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#172033', margin: 0 }}>
              Faculty Training & Professional Development
            </h2>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '8px' }}>
            <Building2 size={16} style={{ color: '#64748b' }} />
            <select
              className="form-control"
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              style={{ minWidth: '180px', height: '36px', fontSize: '0.85rem' }}
            >
              <option value="">All School Departments</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => fetchDashboard(true)}
            disabled={isRefreshing || isLoading}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            title="Refresh Training Metrics"
          >
            <RefreshCw size={14} className={isRefreshing ? 'spin-animation' : ''} />
            <span>{isRefreshing ? 'Syncing...' : 'Refresh'}</span>
          </button>

          {canManage && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={onOpenCreateProgram}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Plus size={15} />
              <span>Schedule New Training</span>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div style={{
          padding: '12px 16px',
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '10px',
          color: '#991b1b',
          fontSize: '0.86rem',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {isLoading ? (
        <div style={{ padding: '60px 0', textAlign: 'center' }}>
          <LoadingSpinner text="Computing institutional training metrics & compliance stats..." size={32} />
        </div>
      ) : (
        <>
          {/* 2. Top Primary 9 KPI Cards (Using standard .stats-grid & .stat-card) */}
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))' }}>
            {/* KPI 1: Total Trainings Conducted */}
            <div className="stat-card">
              <div className="stat-content">
                <span className="stat-title">Total Trainings</span>
                <div className="stat-number-wrapper">
                  <span className="stat-number" style={{ color: '#1e293b' }}>
                    {dashboardData?.total_trainings || 0}
                  </span>
                </div>
                <span className="stat-subtext">All institutional sessions</span>
              </div>
              <div className="stat-icon-badge" style={{ backgroundColor: '#eef2ff', color: '#3155D9' }}>
                <GraduationCap size={20} />
              </div>
            </div>

            {/* KPI 2: Upcoming Trainings */}
            <div className="stat-card">
              <div className="stat-content">
                <span className="stat-title">Upcoming Sessions</span>
                <div className="stat-number-wrapper">
                  <span className="stat-number" style={{ color: '#2563eb' }}>
                    {dashboardData?.upcoming_trainings || 0}
                  </span>
                </div>
                <span className="stat-subtext">Scheduled on calendar</span>
              </div>
              <div className="stat-icon-badge" style={{ backgroundColor: '#eff6ff', color: '#2563eb' }}>
                <Calendar size={20} />
              </div>
            </div>

            {/* KPI 3: Ongoing Trainings */}
            <div className="stat-card">
              <div className="stat-content">
                <span className="stat-title">Ongoing Trainings</span>
                <div className="stat-number-wrapper">
                  <span className="stat-number" style={{ color: '#d97706' }}>
                    {dashboardData?.ongoing_trainings || 0}
                  </span>
                </div>
                <span className="stat-subtext">Currently in progress</span>
              </div>
              <div className="stat-icon-badge" style={{ backgroundColor: '#fffbeb', color: '#d97706' }}>
                <PlayCircle size={20} />
              </div>
            </div>

            {/* KPI 4: Completed Trainings */}
            <div className="stat-card">
              <div className="stat-content">
                <span className="stat-title">Completed Trainings</span>
                <div className="stat-number-wrapper">
                  <span className="stat-number" style={{ color: '#16a34a' }}>
                    {dashboardData?.completed_trainings || 0}
                  </span>
                </div>
                <span className="stat-subtext">Successfully concluded</span>
              </div>
              <div className="stat-icon-badge" style={{ backgroundColor: '#ecfdf5', color: '#16a34a' }}>
                <CheckCircle2 size={20} />
              </div>
            </div>

            {/* KPI 5: Total Employees Enrolled */}
            <div className="stat-card">
              <div className="stat-content">
                <span className="stat-title">Employees Enrolled</span>
                <div className="stat-number-wrapper">
                  <span className="stat-number" style={{ color: '#4338ca' }}>
                    {dashboardData?.total_employees_enrolled || 0}
                  </span>
                </div>
                <span className="stat-subtext">Faculty & support staff</span>
              </div>
              <div className="stat-icon-badge" style={{ backgroundColor: '#eef2ff', color: '#4338ca' }}>
                <Users size={20} />
              </div>
            </div>

            {/* KPI 6: Employees Completed */}
            <div className="stat-card">
              <div className="stat-content">
                <span className="stat-title">Staff Completed</span>
                <div className="stat-number-wrapper">
                  <span className="stat-number" style={{ color: '#059669' }}>
                    {dashboardData?.employees_completed || 0}
                  </span>
                </div>
                <span className="stat-subtext">Finished assigned modules</span>
              </div>
              <div className="stat-icon-badge" style={{ backgroundColor: '#ecfdf5', color: '#059669' }}>
                <UserCheck size={20} />
              </div>
            </div>

            {/* KPI 7: Pending Trainings */}
            <div className="stat-card">
              <div className="stat-content">
                <span className="stat-title">Pending Staff</span>
                <div className="stat-number-wrapper">
                  <span className="stat-number" style={{ color: '#ea580c' }}>
                    {dashboardData?.employees_pending || 0}
                  </span>
                </div>
                <span className="stat-subtext">Pending completion/attendance</span>
              </div>
              <div className="stat-icon-badge" style={{ backgroundColor: '#fff7ed', color: '#ea580c' }}>
                <Clock size={20} />
              </div>
            </div>

            {/* KPI 8: Training Hours Completed */}
            <div className="stat-card">
              <div className="stat-content">
                <span className="stat-title">Hours Completed</span>
                <div className="stat-number-wrapper">
                  <span className="stat-number" style={{ color: '#0891b2' }}>
                    {Number(dashboardData?.training_hours_completed || 0).toFixed(1)} hrs
                  </span>
                </div>
                <span className="stat-subtext">Credited faculty CPD hours</span>
              </div>
              <div className="stat-icon-badge" style={{ backgroundColor: '#ecfeff', color: '#0891b2' }}>
                <TrendingUp size={20} />
              </div>
            </div>

            {/* KPI 9: Completion Percentage */}
            <div className="stat-card">
              <div className="stat-content">
                <span className="stat-title">Completion Rate</span>
                <div className="stat-number-wrapper">
                  <span className="stat-number" style={{ color: '#16a34a' }}>
                    {dashboardData?.completion_percentage || 0}%
                  </span>
                </div>
                <span className="stat-subtext">Institutional completion ratio</span>
              </div>
              <div className="stat-icon-badge" style={{ backgroundColor: '#f0fdf4', color: '#16a34a' }}>
                <Award size={20} />
              </div>
            </div>
          </div>

          {/* 3. Mid-Section: Upcoming Sessions & Category Breakdown Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
            gap: '20px'
          }}>
            {/* Left Card: Upcoming Training Sessions */}
            <div style={{
              backgroundColor: '#ffffff',
              borderRadius: '14px',
              border: '1px solid #e2e8f0',
              padding: '20px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Calendar size={18} style={{ color: '#3155D9' }} />
                  <h3 style={{ fontSize: '0.98rem', fontWeight: 700, color: '#172033', margin: 0 }}>
                    Upcoming & Ongoing Sessions
                  </h3>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost btn-xs"
                  onClick={onNavigateToCalendar}
                  style={{ color: '#3155D9', fontWeight: 600, fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <span>View Calendar</span>
                  <ArrowRight size={13} />
                </button>
              </div>

              {(!dashboardData?.upcoming_sessions || dashboardData.upcoming_sessions.length === 0) ? (
                <div style={{ padding: '30px 20px', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
                  No upcoming training sessions scheduled.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {dashboardData.upcoming_sessions.map((session) => (
                    <div
                      key={session.id}
                      style={{
                        padding: '12px 14px',
                        backgroundColor: '#f8fafc',
                        borderRadius: '10px',
                        border: '1px solid #e2e8f0',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                        <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#0f172a', margin: 0 }}>
                          {session.title}
                        </h4>
                        <span className={`status-pill badge-${session.status?.toLowerCase() || 'upcoming'}`} style={{ fontSize: '0.72rem', padding: '2px 8px' }}>
                          <span className="status-dot"></span>
                          <span>{session.status}</span>
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '0.78rem', color: '#64748b', flexWrap: 'wrap' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <Calendar size={13} style={{ color: '#3155D9' }} />
                          {formatDate(session.start_date)}
                          {session.start_time ? ` • ${session.start_time.substring(0, 5)}` : ''}
                        </span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <Clock size={13} />
                          {session.duration_hours} hrs
                        </span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <Users size={13} />
                          {session.enrolled_count || 0} Enrolled
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px', fontSize: '0.78rem' }}>
                        <span style={{ color: '#475569', fontWeight: 500 }}>
                          Trainer: <strong style={{ color: '#1e293b' }}>{session.trainer_name}</strong>
                          {session.training_provider ? ` (${session.training_provider})` : ''}
                        </span>
                        {session.location_venue && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#64748b' }}>
                            <MapPin size={12} />
                            {session.location_venue}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right Card: Training Categories & Quick Shortcuts */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Category Breakdown */}
              <div style={{
                backgroundColor: '#ffffff',
                borderRadius: '14px',
                border: '1px solid #e2e8f0',
                padding: '20px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <TrendingUp size={18} style={{ color: '#16a34a' }} />
                    <h3 style={{ fontSize: '0.98rem', fontWeight: 700, color: '#172033', margin: 0 }}>
                      Training Focus Areas
                    </h3>
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs"
                    onClick={onNavigateToPrograms}
                    style={{ color: '#3155D9', fontWeight: 600, fontSize: '0.78rem' }}
                  >
                    View All Programs
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {(!dashboardData?.category_breakdown || dashboardData.category_breakdown.length === 0) ? (
                    <div style={{ color: '#64748b', fontSize: '0.84rem' }}>No categorized programs.</div>
                  ) : (
                    dashboardData.category_breakdown.slice(0, 5).map((cat, idx) => (
                      <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                          <span style={{ fontWeight: 600, color: '#334155' }}>{cat.category}</span>
                          <span style={{ color: '#64748b' }}>{cat.count} programs • {parseFloat(cat.total_hours).toFixed(0)} hrs</span>
                        </div>
                        <div style={{ width: '100%', height: '6px', backgroundColor: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                          <div
                            style={{
                              width: `${Math.min(100, (parseInt(cat.count, 10) / Math.max(1, dashboardData?.total_trainings || 1)) * 100)}%`,
                              height: '100%',
                              backgroundColor: idx === 0 ? '#3155D9' : idx === 1 ? '#10b981' : idx === 2 ? '#f59e0b' : '#6366f1',
                              borderRadius: '4px'
                            }}
                          />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Quick Module Shortcuts */}
              <div style={{
                backgroundColor: '#ffffff',
                borderRadius: '14px',
                border: '1px solid #e2e8f0',
                padding: '20px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                <h3 style={{ fontSize: '0.92rem', fontWeight: 700, color: '#172033', margin: 0 }}>
                  Quick Training Operations
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={onNavigateToPrograms}
                    style={{ justifyContent: 'flex-start', gap: '8px', padding: '10px 12px' }}
                  >
                    <GraduationCap size={16} style={{ color: '#3155D9' }} />
                    <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>Manage Programs</span>
                  </button>

                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={onNavigateToAttendance}
                    style={{ justifyContent: 'flex-start', gap: '8px', padding: '10px 12px' }}
                  >
                    <UserCheck size={16} style={{ color: '#16a34a' }} />
                    <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>Mark Attendance</span>
                  </button>

                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={onNavigateToCertificates}
                    style={{ justifyContent: 'flex-start', gap: '8px', padding: '10px 12px' }}
                  >
                    <Award size={16} style={{ color: '#d97706' }} />
                    <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>Certificates ({dashboardData?.total_certificates || 0})</span>
                  </button>

                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={onNavigateToReports}
                    style={{ justifyContent: 'flex-start', gap: '8px', padding: '10px 12px' }}
                  >
                    <FileText size={16} style={{ color: '#6366f1' }} />
                    <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>HR CPD Reports</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default TrainingDashboardView;
