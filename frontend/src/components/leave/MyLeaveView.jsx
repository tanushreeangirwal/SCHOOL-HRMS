import React, { useState, useEffect } from 'react';
import { 
  CalendarRange, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Plus, 
  FileText, 
  AlertCircle, 
  Loader2, 
  Calendar, 
  Award,
  Layers,
  ArrowRight,
  UserCheck,
  TrendingUp
} from 'lucide-react';
import { hrmsApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { ApplyLeaveModal } from './ApplyLeaveModal';
import { LeaveDetailsModal } from './LeaveDetailsModal';

export function MyLeaveView() {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [leaveData, setLeaveData] = useState(null);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [error, setError] = useState(null);

  // Modals state
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [selectedRequestForDetail, setSelectedRequestForDetail] = useState(null);

  const fetchMyLeaves = async () => {
    setLoading(true);
    setError(null);
    try {
      const [summaryRes, typesRes] = await Promise.all([
        hrmsApi.getMyLeaveSummary(),
        hrmsApi.getLeaveTypes(false)
      ]);

      if (summaryRes && summaryRes.success) {
        setLeaveData(summaryRes.data);
      } else {
        setError(summaryRes?.message || 'Unable to load personal leave quota.');
      }

      if (typesRes && typesRes.success) {
        setLeaveTypes(typesRes.data || []);
      }
    } catch (err) {
      console.error('Failed to load personal leaves:', err);
      setError('An error occurred while fetching your personal leave record.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyLeaves();
  }, []);

  const formatDate = (dStr) => {
    if (!dStr) return '—';
    return new Date(dStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Approved':
        return <span className="status-badge active" style={{ backgroundColor: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0' }}>Approved</span>;
      case 'Pending':
        return <span className="status-badge pending" style={{ backgroundColor: '#fffbeb', color: '#d97706', border: '1px solid #fde68a' }}>Pending Review</span>;
      case 'Rejected':
        return <span className="status-badge inactive" style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>Rejected</span>;
      case 'Cancelled':
        return <span className="status-badge" style={{ backgroundColor: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0' }}>Cancelled</span>;
      default:
        return <span className="status-badge">{status}</span>;
    }
  };

  if (loading) {
    return (
      <div className="tab-loading-state" style={{ minHeight: '400px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
        <Loader2 size={32} className="spin-animation text-primary" />
        <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Loading personal leave quota & balance...</span>
      </div>
    );
  }

  const summary = leaveData?.summary || {
    total_allocated: 0,
    total_used: 0,
    total_pending: 0,
    total_available: 0
  };

  const balances = leaveData?.balances || [];
  const requests = leaveData?.requests || [];

  return (
    <div className="my-leave-view" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Banner */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        flexWrap: 'wrap', 
        gap: '16px',
        backgroundColor: '#ffffff',
        padding: '20px 24px',
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
      }}>
        <div>
          <h1 style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <CalendarRange size={24} className="text-primary" />
            My Leave Quota & History
          </h1>
          <p style={{ fontSize: '0.86rem', color: '#64748b', margin: '4px 0 0' }}>
            Staff Record: <strong>{user?.full_name || 'Staff Member'}</strong> • Annual Balance & Absence History ({new Date().getFullYear()})
          </p>
        </div>

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

      {error && (
        <div className="error-banner">
          <div className="error-banner-content">
            <AlertCircle size={18} className="error-icon" />
            <span className="error-text">{error}</span>
          </div>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        {/* Available Days */}
        <div style={{ 
          backgroundColor: '#ffffff', 
          borderRadius: '12px', 
          padding: '18px 20px', 
          border: '1px solid #bbf7d0',
          borderLeft: '5px solid #10b981',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
        }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#047857', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Available Leave Quota
          </span>
          <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#065f46', marginTop: '4px' }}>
            {summary.total_available} <span style={{ fontSize: '0.95rem', fontWeight: 500 }}>Days</span>
          </div>
          <div style={{ fontSize: '0.76rem', color: '#065f46', marginTop: '6px' }}>
            Remaining balance for {new Date().getFullYear()}
          </div>
        </div>

        {/* Total Allocated */}
        <div style={{ 
          backgroundColor: '#ffffff', 
          borderRadius: '12px', 
          padding: '18px 20px', 
          border: '1px solid #bfdbfe',
          borderLeft: '5px solid #3b82f6',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
        }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Annual Entitlement
          </span>
          <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#1e40af', marginTop: '4px' }}>
            {summary.total_allocated} <span style={{ fontSize: '0.95rem', fontWeight: 500 }}>Days</span>
          </div>
          <div style={{ fontSize: '0.76rem', color: '#1e40af', marginTop: '6px' }}>
            Total annual allocation
          </div>
        </div>

        {/* Used Days */}
        <div style={{ 
          backgroundColor: '#ffffff', 
          borderRadius: '12px', 
          padding: '18px 20px', 
          border: '1px solid #e2e8f0',
          borderLeft: '5px solid #64748b',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
        }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Used / Taken
          </span>
          <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#1e293b', marginTop: '4px' }}>
            {summary.total_used} <span style={{ fontSize: '0.95rem', fontWeight: 500 }}>Days</span>
          </div>
          <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: '6px' }}>
            Approved leaves taken
          </div>
        </div>

        {/* Pending Days */}
        <div style={{ 
          backgroundColor: '#ffffff', 
          borderRadius: '12px', 
          padding: '18px 20px', 
          border: '1px solid #fed7aa',
          borderLeft: '5px solid #f97316',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
        }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#c2410c', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Pending Approval
          </span>
          <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#9a3412', marginTop: '4px' }}>
            {summary.total_pending} <span style={{ fontSize: '0.95rem', fontWeight: 500 }}>Days</span>
          </div>
          <div style={{ fontSize: '0.76rem', color: '#9a3412', marginTop: '6px' }}>
            Awaiting manager sign-off
          </div>
        </div>
      </div>

      {/* Leave Category Quota Cards Grid */}
      <div>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Layers size={18} className="text-primary" />
          Leave Category Balances ({balances.length})
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '16px' }}>
          {balances.map(bal => {
            const alloc = parseFloat(bal.allocated_days) || 0;
            const used = parseFloat(bal.used_days) || 0;
            const pending = parseFloat(bal.pending_days) || 0;
            const avail = parseFloat(bal.available_days) || 0;
            const pct = alloc > 0 ? Math.min(100, Math.round(((used + pending) / alloc) * 100)) : 0;

            return (
              <div 
                key={bal.id || bal.leave_type_id}
                style={{ 
                  backgroundColor: '#ffffff', 
                  borderRadius: '12px', 
                  padding: '18px', 
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#2563eb', backgroundColor: '#eff6ff', padding: '2px 8px', borderRadius: '10px' }}>
                      {bal.leave_type_code}
                    </span>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a', margin: '6px 0 0' }}>
                      {bal.leave_type_name}
                    </h3>
                  </div>

                  <span style={{ fontSize: '0.74rem', color: bal.is_paid ? '#059669' : '#d97706', fontWeight: 600 }}>
                    {bal.is_paid ? 'Paid' : 'Unpaid'}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '4px' }}>
                  <div>
                    <span style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a' }}>{avail}</span>
                    <span style={{ fontSize: '0.8rem', color: '#64748b' }}> / {alloc} avail</span>
                  </div>
                  <div style={{ fontSize: '0.76rem', color: '#64748b' }}>
                    {used} used {pending > 0 ? `• ${pending} pend` : ''}
                  </div>
                </div>

                {/* Progress bar */}
                {alloc > 0 && (
                  <div style={{ height: '6px', backgroundColor: '#f1f5f9', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ 
                      height: '100%', 
                      width: `${pct}%`,
                      backgroundColor: pct > 80 ? '#ef4444' : pct > 50 ? '#f59e0b' : '#10b981',
                      borderRadius: '3px'
                    }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Personal Leave Requests Table */}
      <div style={{ 
        backgroundColor: '#ffffff', 
        borderRadius: '12px', 
        border: '1px solid #e2e8f0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        overflow: 'hidden'
      }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText size={18} className="text-primary" />
              My Absence History ({requests.length})
            </h2>
            <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '2px 0 0' }}>
              All submitted applications for this academic session
            </p>
          </div>
        </div>

        {requests.length === 0 ? (
          <div style={{ padding: '50px 20px', textAlign: 'center', color: '#64748b' }}>
            <FileText size={36} style={{ color: '#cbd5e1', margin: '0 auto 10px', display: 'block' }} />
            <div style={{ fontWeight: 600, fontSize: '0.95rem', color: '#1e293b' }}>No Leave Applications Filed</div>
            <div style={{ fontSize: '0.82rem', marginTop: '4px' }}>You haven't submitted any leave applications this session.</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="clean-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#64748b' }}>
                  <th style={{ padding: '12px 18px', textAlign: 'left' }}>Category</th>
                  <th style={{ padding: '12px 18px', textAlign: 'left' }}>Date Window</th>
                  <th style={{ padding: '12px 18px', textAlign: 'center' }}>Days</th>
                  <th style={{ padding: '12px 18px', textAlign: 'left' }}>Reason Excerpt</th>
                  <th style={{ padding: '12px 18px', textAlign: 'center' }}>Status</th>
                  <th style={{ padding: '12px 18px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {requests.map(req => (
                  <tr 
                    key={req.id}
                    onClick={() => setSelectedRequestForDetail(req)}
                    style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer', transition: 'background-color 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f8fafc'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = '#ffffff'}
                  >
                    <td style={{ padding: '14px 18px' }}>
                      <span style={{ 
                        fontSize: '0.82rem', 
                        fontWeight: 700, 
                        padding: '3px 8px', 
                        borderRadius: '12px',
                        backgroundColor: '#eff6ff',
                        color: '#2563eb'
                      }}>
                        {req.leave_type_code} • {req.leave_type_name}
                      </span>
                    </td>

                    <td style={{ padding: '14px 18px', fontSize: '0.86rem', color: '#334155' }}>
                      {formatDate(req.start_date)} – {formatDate(req.end_date)}
                    </td>

                    <td style={{ padding: '14px 18px', textAlign: 'center' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.86rem', color: '#0f172a' }}>
                        {req.total_days}d
                      </span>
                    </td>

                    <td style={{ padding: '14px 18px', fontSize: '0.84rem', color: '#475569', maxWidth: '240px' }}>
                      <span style={{ display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {req.reason}
                      </span>
                    </td>

                    <td style={{ padding: '14px 18px', textAlign: 'center' }}>
                      {getStatusBadge(req.status)}
                    </td>

                    <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => setSelectedRequestForDetail(req)}
                        style={{ fontSize: '0.78rem', padding: '4px 10px' }}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      <ApplyLeaveModal
        isOpen={isApplyModalOpen}
        onClose={() => setIsApplyModalOpen(false)}
        onSuccess={() => {
          fetchMyLeaves();
        }}
        employees={user?.employee_id ? [{ id: user.employee_id, first_name: user.first_name, last_name: user.last_name, employee_code: user.employee_code }] : []}
        leaveTypes={leaveTypes}
        initialEmployeeId={user?.employee_id}
      />

      <LeaveDetailsModal
        isOpen={Boolean(selectedRequestForDetail)}
        onClose={() => setSelectedRequestForDetail(null)}
        leaveRequest={selectedRequestForDetail}
        onStatusUpdated={() => {
          fetchMyLeaves();
        }}
      />
    </div>
  );
}
