import React, { useState, useEffect } from 'react';
import { X, Calendar, AlertCircle, Check, Loader2, Info } from 'lucide-react';
import { hrmsApi } from '../../services/api';

export function AddEditYearModal({
  year = null,
  isOpen,
  onClose,
  onSaved
}) {
  const isEditing = Boolean(year && year.id);

  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(false);
  const [status, setStatus] = useState('Upcoming');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    if (isOpen) {
      if (year) {
        setName(year.name || '');
        setStartDate(year.start_date ? year.start_date.split('T')[0] : '');
        setEndDate(year.end_date ? year.end_date.split('T')[0] : '');
        setDescription(year.description || '');
        setIsActive(Boolean(year.is_active));
        setStatus(year.status || 'Upcoming');
      } else {
        setName('');
        setStartDate('');
        setEndDate('');
        setDescription('');
        setIsActive(false);
        setStatus('Upcoming');
      }
      setErrorMessage('');
      setFieldErrors({});
    }
  }, [isOpen, year]);

  if (!isOpen) return null;

  const validate = () => {
    const errs = {};
    if (!name || !name.trim()) errs.name = 'Academic year name is required (e.g. 2027–2028).';
    if (!startDate) errs.startDate = 'Start date is required.';
    if (!endDate) errs.endDate = 'End date is required.';
    if (startDate && endDate && new Date(endDate) <= new Date(startDate)) {
      errs.endDate = 'End date must be strictly after Start date.';
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        start_date: startDate,
        end_date: endDate,
        description: description ? description.trim() : null,
        is_active: isActive,
        status: isActive ? 'Active' : status
      };

      let res;
      if (isEditing) {
        res = await hrmsApi.updateAcademicYear(year.id, payload);
      } else {
        res = await hrmsApi.createAcademicYear(payload);
      }

      if (res && res.success) {
        if (onSaved) onSaved(res.data);
        onClose();
      } else {
        setErrorMessage(res?.message || 'Failed to save academic year.');
      }
    } catch (err) {
      console.error('Error saving academic year:', err);
      setErrorMessage(err.message || 'An error occurred while saving the academic year.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div 
        className="apply-leave-modal-card" 
        style={{ maxWidth: '580px' }}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="apply-leave-header">
          <div className="apply-leave-header-left">
            <div className="apply-leave-icon-circle" style={{ backgroundColor: '#eff6ff', color: '#2563eb' }}>
              <Calendar size={18} />
            </div>
            <div>
              <h2 className="apply-leave-title">
                {isEditing ? 'Edit Academic Year' : 'Create Academic Year'}
              </h2>
              <p className="apply-leave-subtitle">
                Define school session boundaries and institutional schedule
              </p>
            </div>
          </div>
          <button type="button" className="apply-leave-close-btn" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        {errorMessage && (
          <div className="apply-leave-error-strip">
            <AlertCircle size={16} className="error-icon" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="apply-leave-body">
          <div className="apply-leave-section">
            <div className="apply-leave-field">
              <label className="apply-leave-label" htmlFor="year-name">
                Academic Session Name <span className="required-star">*</span>
              </label>
              <input
                id="year-name"
                type="text"
                className={`form-control apply-leave-input ${fieldErrors.name ? 'has-error' : ''}`}
                placeholder="e.g. 2027–2028"
                value={name}
                onChange={e => {
                  setName(e.target.value);
                  if (fieldErrors.name) setFieldErrors(prev => ({ ...prev, name: null }));
                }}
                disabled={isSubmitting}
              />
              {fieldErrors.name && <span className="apply-leave-field-error">{fieldErrors.name}</span>}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '8px' }}>
              <div className="apply-leave-field">
                <label className="apply-leave-label" htmlFor="year-start-date">
                  Start Date <span className="required-star">*</span>
                </label>
                <input
                  id="year-start-date"
                  type="date"
                  className={`form-control apply-leave-date-input ${fieldErrors.startDate ? 'has-error' : ''}`}
                  value={startDate}
                  onChange={e => {
                    setStartDate(e.target.value);
                    if (fieldErrors.startDate) setFieldErrors(prev => ({ ...prev, startDate: null }));
                  }}
                  disabled={isSubmitting}
                />
                {fieldErrors.startDate && <span className="apply-leave-field-error">{fieldErrors.startDate}</span>}
              </div>

              <div className="apply-leave-field">
                <label className="apply-leave-label" htmlFor="year-end-date">
                  End Date <span className="required-star">*</span>
                </label>
                <input
                  id="year-end-date"
                  type="date"
                  className={`form-control apply-leave-date-input ${fieldErrors.endDate ? 'has-error' : ''}`}
                  value={endDate}
                  min={startDate}
                  onChange={e => {
                    setEndDate(e.target.value);
                    if (fieldErrors.endDate) setFieldErrors(prev => ({ ...prev, endDate: null }));
                  }}
                  disabled={isSubmitting}
                />
                {fieldErrors.endDate && <span className="apply-leave-field-error">{fieldErrors.endDate}</span>}
              </div>
            </div>

            <div className="apply-leave-field" style={{ marginTop: '8px' }}>
              <label className="apply-leave-label" htmlFor="year-desc">
                Description / Notes
              </label>
              <textarea
                id="year-desc"
                className="form-control apply-leave-textarea"
                rows={2}
                placeholder="Institutional notes or curriculum framework for this session..."
                value={description}
                onChange={e => setDescription(e.target.value)}
                disabled={isSubmitting}
              />
            </div>

            {/* Set as Active Session Checkbox */}
            <div style={{ marginTop: '10px', padding: '12px 14px', backgroundColor: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <input
                type="checkbox"
                id="year-active-cb"
                checked={isActive}
                onChange={e => setIsActive(e.target.checked)}
                disabled={isSubmitting}
                style={{ width: '16px', height: '16px', marginTop: '2px', cursor: 'pointer' }}
              />
              <div>
                <label htmlFor="year-active-cb" style={{ fontSize: '0.84rem', fontWeight: 700, color: '#166534', cursor: 'pointer', margin: 0 }}>
                  Set as Active Academic Session
                </label>
                <p style={{ fontSize: '0.76rem', color: '#15803d', margin: '2px 0 0' }}>
                  Setting this session active will automatically mark the current active session as Completed.
                </p>
              </div>
            </div>
          </div>

          <div className="apply-leave-footer">
            <button
              type="button"
              className="btn btn-secondary apply-leave-cancel-btn"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary apply-leave-submit-btn"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="spin-animation" />
                  <span>Saving Session...</span>
                </>
              ) : (
                <>
                  <Check size={16} />
                  <span>{isEditing ? 'Update Session' : 'Save Academic Year'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddEditYearModal;
