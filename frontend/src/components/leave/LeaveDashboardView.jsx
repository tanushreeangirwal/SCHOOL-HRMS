import React, { useState, useEffect } from 'react';
import { 
  CalendarRange, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Users, 
  Plus, 
  ArrowRight, 
  AlertCircle, 
  Layers, 
  FileText, 
  Filter, 
  Search,
  Calendar,
  ChevronRight,
  TrendingUp,
  Loader2
} from 'lucide-react';
import { hrmsApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { ApplyLeaveModal } from './ApplyLeaveModal';
import { LeaveDetailsModal } from './LeaveDetailsModal';

export function LeaveDashboardView({ onNavigateTab }) {
  const { user, isSuperAdmin, isAdmin, isHR, isManager } = useAuth();

  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [error, setError] = useState(null);

  // Modals state
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [selectedRequestForDetail, setSelectedRequestForDetail] = useState(null);

  const fetchDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const [dashRes, empRes, typesRes] = await Promise.all([
        hrmsApi.getLeaveDashboard(),
        hrmsApi.getEmployees({ limit: 100 }),
        hrmsApi.getLeaveTypes(false)
      ]);

      if (dashRes && dashRes.success) {
        setDashboardData(dashRes.data);
      }
      if (empRes && empRes.success) {
        setEmployees(empRes.data.employees || empRes.data || []);
      }
      if (typesRes && typesRes.success) {
        setLeaveTypes(typesRes.data || []);
      }
    } catch (err) {
      console.error('Failed to load leave dashboard:', err);
      setError('Unable to load leave management metrics. Please refresh the page.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const handleQuickApprove = async (e, reqId) => {
    e.stopPropagation();
    try {
      const res = await hrmsApi.approveLeave(reqId);
      if (res && res.success) {
        fetchDashboard();
      }
    } catch (err) {
      console.error('Quick approve error:', err);
    }
  };

  const formatDate = (dStr) => {
    if (!dStr) return '—';
    return new Date(dStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (loading) {
    return (
      <div className="tab-loading-state" style={{ minHeight: '400px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
        <Loader2 size={32} className="spin-animation text-primary" />
        <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Loading institutional leave metrics...</span>
      </div>
    );
  }

  const kpis = dashboardData?.kpis || {
    total_requests: 0,
    pending_requests: 0,
    approved_requests: 0,
    rejected_requests: 0,
    on_leave_today: 0
  };

  const pendingRequests = dashboardData?.pending_requests || [];
  const breakdown = dashboardData?.type_breakdown || [];
  const onLeaveStaff = dashboardData?.on_leave_staff || [];

  return (
    <div className="leave-dashboard-view" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Banner & Quick Actions */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        flexWrap: 'wrap', 
        gap: '16px',
        backgroundColor: '#ffffff',
        padding: '20px 24px',
        borderRadius: '16px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
      }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.65rem', fontWeight: 700, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '10px', letterSpacing: '-0.015em' }}>
            <CalendarRange size={24} className="text-primary" />
            Institutional Leave Management
          </h1>
          <p style={{ fontSize: '0.86rem', color: '#64748b', margin: '4px 0 0' }}>
            St. Vincent's School • Faculty & Staff Absence Monitoring, Approvals & Leave Allocations
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => onNavigateTab ? onNavigateTab('calendar') : null}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Calendar size={16} />
            <span>Absence Calendar</span>
          </button>
          
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setIsApplyModalOpen(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Plus size={16} />
            <span>Apply For Leave</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="error-banner">
          <div className="error-banner-content">
            <AlertCircle size={18} className="error-icon" />
            <span className="error-text">{error}</span>
          </div>
        </div>
      )}

      {/* 5 V1 KPI Cards Grid */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
        gap: '16px' 
      }}>
        {/* KPI 1: Pending */}
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Pending Review</span>
            <div className="kpi-icon-pill amber">
              <Clock size={18} />
            </div>
          </div>
          <div className="kpi-body">
            <span className="kpi-value">{kpis.pending_requests}</span>
            <div className="kpi-trend" style={{ color: '#d97706', fontWeight: 600 }}>
              <span>Requires admin review</span>
            </div>
          </div>
        </div>

        {/* KPI 2: On Leave Today */}
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">On Leave Today</span>
            <div className="kpi-icon-pill indigo">
              <Users size={18} />
            </div>
          </div>
          <div className="kpi-body">
            <span className="kpi-value">{kpis.on_leave_today}</span>
            <div className="kpi-trend">
              <span>Staff away today</span>
            </div>
          </div>
        </div>

        {/* KPI 3: Approved */}
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Approved</span>
            <div className="kpi-icon-pill emerald">
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div className="kpi-body">
            <span className="kpi-value">{kpis.approved_requests}</span>
            <div className="kpi-trend trend-positive">
              <span>Granted applications</span>
            </div>
          </div>
        </div>

        {/* KPI 4: Rejected */}
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Rejected</span>
            <div className="kpi-icon-pill" style={{ backgroundColor: '#fef2f2', color: '#ef4444' }}>
              <XCircle size={18} />
            </div>
          </div>
          <div className="kpi-body">
            <span className="kpi-value">{kpis.rejected_requests}</span>
            <div className="kpi-trend" style={{ color: '#94a3b8' }}>
              <span>Denied or revoked</span>
            </div>
          </div>
        </div>

        {/* KPI 5: Total Requests */}
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Total Submissions</span>
            <div className="kpi-icon-pill sky">
              <FileText size={18} />
            </div>
          </div>
          <div className="kpi-body">
            <span className="kpi-value">{kpis.total_requests}</span>
            <div className="kpi-trend">
              <span>Overall requests</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Layout: Pending Table & Side Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1.1fr)', gap: '24px' }}>
        {/* Left Column: Pending Requests Table */}
        <div style={{ 
          backgroundColor: '#ffffff', 
          borderRadius: '12px', 
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{ 
            padding: '16px 20px', 
            borderBottom: '1px solid #f1f5f9',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock size={18} className="text-warning" />
                Pending Leave Applications ({pendingRequests.length})
              </h2>
              <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '2px 0 0' }}>
                Applications awaiting administrative authorization
              </p>
            </div>

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => onNavigateTab ? onNavigateTab('requests') : null}
              style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem' }}
            >
              <span>View All Requests</span>
              <ChevronRight size={14} />
            </button>
          </div>

          {/* Table */}
          <div style={{ overflowX: 'auto' }}>
            {pendingRequests.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: '#64748b' }}>
                <CheckCircle2 size={36} style={{ color: '#10b981', margin: '0 auto 10px', display: 'block' }} />
                <div style={{ fontWeight: 600, fontSize: '0.95rem', color: '#1e293b' }}>No Pending Applications</div>
                <div style={{ fontSize: '0.82rem', marginTop: '4px' }}>All faculty leave applications have been reviewed.</div>
              </div>
            ) : (
              <table className="clean-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#64748b' }}>
                    <th style={{ padding: '10px 16px', textAlign: 'left' }}>Staff Member</th>
                    <th style={{ padding: '10px 16px', textAlign: 'left' }}>Category</th>
                    <th style={{ padding: '10px 16px', textAlign: 'left' }}>Dates</th>
                    <th style={{ padding: '10px 16px', textAlign: 'center' }}>Days</th>
                    <th style={{ padding: '10px 16px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingRequests.map(req => (
                    <tr 
                      key={req.id}
                      onClick={() => setSelectedRequestForDetail(req)}
                      style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer', transition: 'background-color 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f8fafc'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = '#ffffff'}
                    >
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#1e293b' }}>
                          {req.employee_name || `${req.first_name} ${req.last_name}`}
                        </div>
                        <div style={{ fontSize: '0.76rem', color: '#64748b' }}>
                          {req.employee_code} • {req.department_name || 'Academic'}
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ 
                          fontSize: '0.78rem', 
                          fontWeight: 600, 
                          padding: '3px 8px', 
                          borderRadius: '12px',
                          backgroundColor: '#eff6ff',
                          color: '#2563eb'
                        }}>
                          {req.leave_type_code || req.leave_type_name}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '0.84rem', color: '#334155' }}>
                        {formatDate(req.start_date)} – {formatDate(req.end_date)}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <span style={{ 
                          fontSize: '0.82rem', 
                          fontWeight: 700, 
                          backgroundColor: '#fef3c7', 
                          color: '#b45309', 
                          padding: '2px 8px', 
                          borderRadius: '12px' 
                        }}>
                          {req.total_days}d
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }} onClick={e => e.stopPropagation()}>
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={(e) => handleQuickApprove(e, req.id)}
                            style={{ backgroundColor: '#059669', borderColor: '#059669', padding: '4px 10px', fontSize: '0.78rem' }}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => setSelectedRequestForDetail(req)}
                            style={{ padding: '4px 8px', fontSize: '0.78rem' }}
                          >
                            View
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Right Column: Breakdown & Active Absences */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Card 1: Leave Categories Breakdown */}
          <div style={{ 
            backgroundColor: '#ffffff', 
            borderRadius: '12px', 
            padding: '20px', 
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '0.98rem', fontWeight: 700, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Layers size={17} className="text-primary" />
                Category Distribution
              </h3>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => onNavigateTab ? onNavigateTab('types') : null}
                style={{ fontSize: '0.76rem', padding: '2px 8px' }}
              >
                Manage
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {breakdown.length === 0 ? (
                <div style={{ fontSize: '0.82rem', color: '#64748b', textAlign: 'center', padding: '16px 0' }}>
                  No leave requests filed yet this year.
                </div>
              ) : (
                breakdown.map((item, idx) => (
                  <div key={idx}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 600, color: '#334155' }}>{item.name} ({item.code})</span>
                      <span style={{ fontWeight: 700, color: '#0f172a' }}>{item.count} req ({item.total_days}d)</span>
                    </div>
                    <div style={{ height: '6px', backgroundColor: '#f1f5f9', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ 
                        height: '100%', 
                        width: `${Math.min(100, Math.max(8, (parseFloat(item.count) / Math.max(1, kpis.total_requests)) * 100))}%`,
                        backgroundColor: '#2563eb',
                        borderRadius: '3px'
                      }} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Card 2: Staff Currently on Leave */}
          <div style={{ 
            backgroundColor: '#ffffff', 
            borderRadius: '12px', 
            padding: '20px', 
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
          }}>
            <h3 style={{ fontSize: '0.98rem', fontWeight: 700, color: '#0f172a', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Users size={17} className="text-primary" />
              Away Today ({onLeaveStaff.length})
            </h3>

            {onLeaveStaff.length === 0 ? (
              <div style={{ fontSize: '0.82rem', color: '#64748b', padding: '12px 0' }}>
                All staff members are actively present on campus today.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {onLeaveStaff.map((staff, idx) => (
                  <div 
                    key={idx}
                    style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      padding: '8px 12px',
                      backgroundColor: '#f8fafc',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0'
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '0.86rem', fontWeight: 700, color: '#1e293b' }}>
                        {staff.employee_name || `${staff.first_name} ${staff.last_name}`}
                      </div>
                      <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                        {staff.employee_code} • {staff.department_name}
                      </div>
                    </div>
                    <span style={{ fontSize: '0.76rem', fontWeight: 600, color: '#2563eb', backgroundColor: '#eff6ff', padding: '2px 8px', borderRadius: '10px' }}>
                      {staff.leave_type_code}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      <ApplyLeaveModal
        isOpen={isApplyModalOpen}
        onClose={() => setIsApplyModalOpen(false)}
        onSuccess={() => {
          fetchDashboard();
        }}
        employees={employees}
        leaveTypes={leaveTypes}
      />

      <LeaveDetailsModal
        isOpen={Boolean(selectedRequestForDetail)}
        onClose={() => setSelectedRequestForDetail(null)}
        leaveRequest={selectedRequestForDetail}
        onStatusUpdated={() => {
          fetchDashboard();
        }}
      />
    </div>
  );
}
