import React, { useState } from 'react';
import { 
  X, 
  Calendar, 
  Clock, 
  User, 
  Building2, 
  Award, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  FileText, 
  ShieldCheck, 
  ArrowRight,
  Loader2,
  Trash2
} from 'lucide-react';
import { hrmsApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export function LeaveDetailsModal({
  isOpen,
  onClose,
  leaveRequest,
  onStatusUpdated
}) {
  const { user, isSuperAdmin, isAdmin, isHR, isManager } = useAuth();

  const [isProcessing, setIsProcessing] = useState(false);
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionError, setActionError] = useState('');

  if (!isOpen || !leaveRequest) return null;

  const canApproveReject = isSuperAdmin || isAdmin || isHR || isManager;
  const isOwnRequest = leaveRequest.employee_id === user?.employee_id;
  const isPending = leaveRequest.status === 'Pending';

  const handleApprove = async () => {
    setActionError('');
    setIsProcessing(true);
    try {
      const res = await hrmsApi.approveLeave(leaveRequest.id);
      if (res && res.success) {
        if (onStatusUpdated) onStatusUpdated(res.data);
        onClose();
      } else {
        setActionError(res?.message || 'Failed to approve request.');
      }
    } catch (err) {
      console.error('Approve error:', err);
      setActionError(err.message || 'An unexpected error occurred while approving request.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason || !rejectionReason.trim()) {
      setActionError('Please specify a rejection reason for the record.');
      return;
    }

    setActionError('');
    setIsProcessing(true);
    try {
      const res = await hrmsApi.rejectLeave(leaveRequest.id, rejectionReason.trim());
      if (res && res.success) {
        if (onStatusUpdated) onStatusUpdated(res.data);
        onClose();
      } else {
        setActionError(res?.message || 'Failed to reject request.');
      }
    } catch (err) {
      console.error('Reject error:', err);
      setActionError(err.message || 'An unexpected error occurred while rejecting request.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancel = async () => {
    setActionError('');
    setIsProcessing(true);
    try {
      const res = await hrmsApi.cancelLeave(leaveRequest.id);
      if (res && res.success) {
        if (onStatusUpdated) onStatusUpdated(res.data);
        onClose();
      } else {
        setActionError(res?.message || 'Failed to cancel request.');
      }
    } catch (err) {
      console.error('Cancel error:', err);
      setActionError(err.message || 'An unexpected error occurred while cancelling request.');
    } finally {
      setIsProcessing(false);
    }
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

  const formatDate = (dStr) => {
    if (!dStr) return '—';
    return new Date(dStr).toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div 
        className="modal-content-card" 
        style={{ maxWidth: '600px', width: '92%' }}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="icon-badge primary" style={{ width: '38px', height: '38px', borderRadius: '10px' }}>
              <FileText size={20} />
            </div>
            <div>
              <h2 className="modal-title" style={{ fontSize: '1.2rem', margin: 0 }}>
                Leave Application Details
              </h2>
              <p className="modal-subtitle" style={{ fontSize: '0.82rem', margin: 0, color: 'var(--text-muted)' }}>
                Application Record #{leaveRequest.id.slice(0, 8)}
              </p>
            </div>
          </div>
          <button 
            type="button" 
            className="btn btn-secondary btn-icon-only modal-close-btn"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>

        {actionError && (
          <div className="error-banner" style={{ margin: '14px 24px 0', padding: '10px 14px' }}>
            <div className="error-banner-content" style={{ gap: '8px' }}>
              <AlertCircle size={18} className="error-icon" style={{ flexShrink: 0 }} />
              <span className="error-text" style={{ fontSize: '0.84rem' }}>{actionError}</span>
            </div>
          </div>
        )}

        {/* Content Body */}
        <div style={{ padding: '20px 24px' }}>
          {/* Top Info Strip */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            padding: '12px 16px', 
            backgroundColor: '#f8fafc', 
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
            marginBottom: '16px'
          }}>
            <div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b' }}>
                {leaveRequest.employee_name || `${leaveRequest.first_name} ${leaveRequest.last_name || ''}`}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                {leaveRequest.employee_code} • {leaveRequest.department_name || 'Academic Faculty'}
              </div>
            </div>
            <div>
              {getStatusBadge(leaveRequest.status)}
            </div>
          </div>

          {/* Details Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px', marginBottom: '16px' }}>
            <div style={{ padding: '10px 14px', backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: '0.74rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600, display: 'block' }}>Leave Category</span>
              <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0f172a' }}>
                {leaveRequest.leave_type_name} ({leaveRequest.leave_type_code})
              </span>
              <span style={{ fontSize: '0.74rem', color: leaveRequest.is_paid ? '#059669' : '#d97706', display: 'block' }}>
                {leaveRequest.is_paid ? 'Paid Leave' : 'Unpaid Leave'}
              </span>
            </div>

            <div style={{ padding: '10px 14px', backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: '0.74rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600, display: 'block' }}>Duration</span>
              <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#2563eb' }}>
                {leaveRequest.total_days} Working Day{leaveRequest.total_days > 1 ? 's' : ''}
              </span>
              <span style={{ fontSize: '0.74rem', color: '#64748b', display: 'block' }}>
                {formatDate(leaveRequest.start_date)}
              </span>
            </div>
          </div>

          {/* Date Range Full */}
          <div style={{ padding: '10px 14px', backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '16px' }}>
            <span style={{ fontSize: '0.74rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Date Window</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.86rem', color: '#1e293b', fontWeight: 600 }}>
              <Calendar size={15} className="text-muted" />
              <span>{formatDate(leaveRequest.start_date)}</span>
              <ArrowRight size={14} className="text-muted" />
              <span>{formatDate(leaveRequest.end_date)}</span>
            </div>
          </div>

          {/* Reason */}
          <div style={{ marginBottom: '16px' }}>
            <span style={{ fontSize: '0.78rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Official Reason</span>
            <div style={{ padding: '10px 14px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.86rem', color: '#334155', lineHeight: '1.45' }}>
              {leaveRequest.reason || 'No reason provided.'}
            </div>
          </div>

          {/* Remarks if present */}
          {leaveRequest.remarks && (
            <div style={{ marginBottom: '16px' }}>
              <span style={{ fontSize: '0.78rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Covering Faculty / Notes</span>
              <div style={{ padding: '8px 12px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.84rem', color: '#475569' }}>
                {leaveRequest.remarks}
              </div>
            </div>
          )}

          {/* Rejection Reason if rejected */}
          {leaveRequest.status === 'Rejected' && leaveRequest.rejection_reason && (
            <div style={{ marginBottom: '16px', padding: '10px 14px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px' }}>
              <span style={{ fontSize: '0.78rem', color: '#991b1b', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: '2px' }}>
                Reason for Rejection
              </span>
              <p style={{ margin: 0, fontSize: '0.86rem', color: '#b91c1c' }}>
                {leaveRequest.rejection_reason}
              </p>
            </div>
          )}

          {/* Reviewer / Applied Audit Info */}
          <div style={{ padding: '10px 14px', backgroundColor: '#f8fafc', borderRadius: '8px', fontSize: '0.78rem', color: '#64748b', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div>Applied On: <strong>{new Date(leaveRequest.applied_at || leaveRequest.created_at).toLocaleString()}</strong></div>
            {leaveRequest.approved_at && (
              <div>
                Reviewed By: <strong>{leaveRequest.reviewer_name || 'Administrator'}</strong> on <strong>{new Date(leaveRequest.approved_at).toLocaleString()}</strong>
              </div>
            )}
          </div>

          {/* Inline Rejection Input if toggled */}
          {showRejectInput && isPending && canApproveReject && (
            <div style={{ marginTop: '16px', padding: '14px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px' }}>
              <label style={{ fontSize: '0.84rem', fontWeight: 700, color: '#991b1b', display: 'block', marginBottom: '6px' }}>
                Specify Rejection Reason <span className="required-star">*</span>
              </label>
              <textarea
                className="form-control"
                rows={2}
                placeholder="Reason for administrative rejection..."
                value={rejectionReason}
                onChange={e => setRejectionReason(e.target.value)}
                disabled={isProcessing}
                style={{ fontSize: '0.84rem', marginBottom: '10px' }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowRejectInput(false)}
                  disabled={isProcessing}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={handleReject}
                  disabled={isProcessing || !rejectionReason.trim()}
                >
                  {isProcessing ? <Loader2 size={14} className="spin-animation" /> : <XCircle size={14} />}
                  <span>Confirm Rejection</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Actions */}
        <div className="modal-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderTop: '1px solid var(--border-color, #f1f5f9)' }}>
          <div>
            {isPending && (isOwnRequest || isSuperAdmin || isAdmin) && !showRejectInput && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleCancel}
                disabled={isProcessing}
                style={{ color: '#dc2626' }}
              >
                Cancel Application
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={isProcessing}
            >
              Close
            </button>

            {isPending && canApproveReject && !showRejectInput && (
              <>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={() => setShowRejectInput(true)}
                  disabled={isProcessing}
                >
                  <XCircle size={16} />
                  <span>Reject</span>
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleApprove}
                  disabled={isProcessing}
                  style={{ backgroundColor: '#059669', borderColor: '#059669' }}
                >
                  {isProcessing ? <Loader2 size={16} className="spin-animation" /> : <CheckCircle2 size={16} />}
                  <span>Approve Leave</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
