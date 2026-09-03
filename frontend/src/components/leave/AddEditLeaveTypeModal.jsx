import React, { useState, useEffect } from 'react';
import { 
  X, 
  Tag, 
  Layers, 
  Calendar, 
  FileText, 
  AlertCircle, 
  CheckCircle2, 
  Loader2 
} from 'lucide-react';
import { hrmsApi } from '../../services/api';

export function AddEditLeaveTypeModal({
  isOpen,
  onClose,
  leaveType = null,
  onSuccess
}) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [annualAllocation, setAnnualAllocation] = useState(12);
  const [isPaid, setIsPaid] = useState(true);
  const [requiresApproval, setRequiresApproval] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const isEditing = Boolean(leaveType?.id);

  useEffect(() => {
    if (isOpen) {
      if (leaveType) {
        setName(leaveType.name || '');
        setCode(leaveType.code || '');
        setDescription(leaveType.description || '');
        setAnnualAllocation(parseFloat(leaveType.annual_allocation) || 0);
        setIsPaid(leaveType.is_paid !== false);
        setRequiresApproval(leaveType.requires_approval !== false);
      } else {
        setName('');
        setCode('');
        setDescription('');
        setAnnualAllocation(12);
        setIsPaid(true);
        setRequiresApproval(true);
      }
      setErrorMessage('');
    }
  }, [isOpen, leaveType]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!name || !name.trim()) {
      setErrorMessage('Please provide a leave category name.');
      return;
    }
    if (!code || !code.trim()) {
      setErrorMessage('Please specify an official short code (e.g. CL, SL, EL).');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        code: code.trim().toUpperCase(),
        description: description ? description.trim() : '',
        annual_allocation: parseFloat(annualAllocation) || 0,
        is_paid: isPaid,
        requires_approval: requiresApproval
      };

      let res;
      if (isEditing) {
        res = await hrmsApi.updateLeaveType(leaveType.id, payload);
      } else {
        res = await hrmsApi.createLeaveType(payload);
      }

      if (res && res.success) {
        if (onSuccess) onSuccess(res.data);
        onClose();
      } else {
        setErrorMessage(res?.message || 'Failed to save leave category.');
      }
    } catch (err) {
      console.error('Save leave type error:', err);
      setErrorMessage(err.message || 'An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div 
        className="modal-content-card" 
        style={{ maxWidth: '540px', width: '92%' }}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="icon-badge primary" style={{ width: '38px', height: '38px', borderRadius: '10px' }}>
              <Layers size={20} />
            </div>
            <div>
              <h2 className="modal-title" style={{ fontSize: '1.2rem', margin: 0 }}>
                {isEditing ? 'Edit Leave Category' : 'New Leave Category'}
              </h2>
              <p className="modal-subtitle" style={{ fontSize: '0.82rem', margin: 0, color: 'var(--text-muted)' }}>
                Configure institutional leave quotas and entitlement policies
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

        {errorMessage && (
          <div className="error-banner" style={{ margin: '16px 24px 0', padding: '10px 14px' }}>
            <div className="error-banner-content" style={{ gap: '8px' }}>
              <AlertCircle size={18} className="error-icon" style={{ flexShrink: 0 }} />
              <span className="error-text" style={{ fontSize: '0.84rem' }}>{errorMessage}</span>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ padding: '20px 24px' }}>
          {/* Row 1: Name and Code */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '14px', marginBottom: '16px' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontWeight: 600, fontSize: '0.86rem' }}>
                Category Name <span className="required-star">*</span>
              </label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Casual Leave"
                value={name}
                onChange={e => setName(e.target.value)}
                disabled={isSubmitting}
                required
              />
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontWeight: 600, fontSize: '0.86rem' }}>
                Code <span className="required-star">*</span>
              </label>
              <input
                type="text"
                className="form-control"
                placeholder="CL"
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase())}
                disabled={isSubmitting}
                maxLength={8}
                required
              />
            </div>
          </div>

          {/* Row 2: Annual Allocation */}
          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label className="form-label" style={{ fontWeight: 600, fontSize: '0.86rem' }}>
              Annual Quota (Days per Year) <span className="required-star">*</span>
            </label>
            <input
              type="number"
              className="form-control"
              min="0"
              max="365"
              step="0.5"
              value={annualAllocation}
              onChange={e => setAnnualAllocation(e.target.value)}
              disabled={isSubmitting}
              required
            />
            <p style={{ margin: '4px 0 0', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
              Set to 0 for unlimited / unpaid leaves.
            </p>
          </div>

          {/* Row 3: Description */}
          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label className="form-label" style={{ fontWeight: 600, fontSize: '0.86rem' }}>
              Description & Institutional Guidelines
            </label>
            <textarea
              className="form-control"
              rows={3}
              placeholder="e.g. Standard statutory casual absence for unexpected domestic or personal requirements..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              disabled={isSubmitting}
              style={{ fontSize: '0.86rem', resize: 'vertical' }}
            />
          </div>

          {/* Row 4: Checkboxes */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px', marginBottom: '20px', padding: '12px 14px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', margin: 0 }}>
              <input
                type="checkbox"
                checked={isPaid}
                onChange={e => setIsPaid(e.target.checked)}
                disabled={isSubmitting}
                style={{ width: '16px', height: '16px', accentColor: '#2563eb' }}
              />
              <span style={{ fontSize: '0.86rem', fontWeight: 600, color: '#1e293b' }}>Paid Leave</span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', margin: 0 }}>
              <input
                type="checkbox"
                checked={requiresApproval}
                onChange={e => setRequiresApproval(e.target.checked)}
                disabled={isSubmitting}
                style={{ width: '16px', height: '16px', accentColor: '#2563eb' }}
              />
              <span style={{ fontSize: '0.86rem', fontWeight: 600, color: '#1e293b' }}>Requires Approval</span>
            </label>
          </div>

          <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '16px', borderTop: '1px solid var(--border-color, #f1f5f9)' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting}
              style={{ minWidth: '120px' }}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="spin-animation" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={16} />
                  <span>{isEditing ? 'Update Category' : 'Create Category'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
