import React, { useState, useEffect } from 'react';
import { X, Calendar, AlertCircle, Check, Loader2, Layers } from 'lucide-react';
import { hrmsApi } from '../../services/api';

export function AddEditTermModal({
  term = null,
  isOpen,
  onClose,
  onSaved,
  academicYears = [],
  activeYearId = null
}) {
  const isEditing = Boolean(term && term.id);

  const [academicYearId, setAcademicYearId] = useState('');
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    if (isOpen) {
      if (term) {
        setAcademicYearId(term.academic_year_id || activeYearId || (academicYears[0]?.id || ''));
        setName(term.name || '');
        setStartDate(term.start_date ? term.start_date.split('T')[0] : '');
        setEndDate(term.end_date ? term.end_date.split('T')[0] : '');
        setDescription(term.description || '');
        setIsActive(Boolean(term.is_active));
      } else {
        setAcademicYearId(activeYearId || (academicYears.find(y => y.is_active)?.id || academicYears[0]?.id || ''));
        setName('');
        setStartDate('');
        setEndDate('');
        setDescription('');
        setIsActive(true);
      }
      setErrorMessage('');
      setFieldErrors({});
    }
  }, [isOpen, term, activeYearId, academicYears]);

  if (!isOpen) return null;

  const validate = () => {
    const errs = {};
    if (!academicYearId) errs.academicYearId = 'Academic year is required.';
    if (!name || !name.trim()) errs.name = 'Term name is required (e.g. Term 1 - Monsoon).';
    if (!startDate) errs.startDate = 'Start date is required.';
    if (!endDate) errs.endDate = 'End date is required.';
    if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
      errs.endDate = 'End date must be on or after Start date.';
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
        academic_year_id: academicYearId,
        name: name.trim(),
        start_date: startDate,
        end_date: endDate,
        description: description ? description.trim() : null,
        is_active: isActive
      };

      let res;
      if (isEditing) {
        res = await hrmsApi.updateAcademicTerm(term.id, payload);
      } else {
        res = await hrmsApi.createAcademicTerm(payload);
      }

      if (res && res.success) {
        if (onSaved) onSaved(res.data);
        onClose();
      } else {
        setErrorMessage(res?.message || 'Failed to save academic term.');
      }
    } catch (err) {
      console.error('Error saving term:', err);
      setErrorMessage(err.message || 'An error occurred while saving the term.');
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
              <Layers size={18} />
            </div>
            <div>
              <h2 className="apply-leave-title">
                {isEditing ? 'Edit School Term' : 'Add School Term'}
              </h2>
              <p className="apply-leave-subtitle">
                Configure academic term dates, assessments, and curriculum phases
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
              <label className="apply-leave-label" htmlFor="term-academic-year">
                Academic Year <span className="required-star">*</span>
              </label>
              <select
                id="term-academic-year"
                className={`form-control apply-leave-select ${fieldErrors.academicYearId ? 'has-error' : ''}`}
                value={academicYearId}
                onChange={e => {
                  setAcademicYearId(e.target.value);
                  if (fieldErrors.academicYearId) setFieldErrors(prev => ({ ...prev, academicYearId: null }));
                }}
                disabled={isSubmitting}
              >
                {academicYears.map(y => (
                  <option key={y.id} value={y.id}>
                    {y.name} {y.is_active ? '★ (Active Session)' : `(${y.status})`}
                  </option>
                ))}
              </select>
              {fieldErrors.academicYearId && <span className="apply-leave-field-error">{fieldErrors.academicYearId}</span>}
            </div>

            <div className="apply-leave-field" style={{ marginTop: '8px' }}>
              <label className="apply-leave-label" htmlFor="term-name">
                Term Title / Name <span className="required-star">*</span>
              </label>
              <input
                id="term-name"
                type="text"
                className={`form-control apply-leave-input ${fieldErrors.name ? 'has-error' : ''}`}
                placeholder="e.g. Term 1 (Monsoon Term), Term 2 (Winter Term)..."
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
                <label className="apply-leave-label" htmlFor="term-start-date">
                  Start Date <span className="required-star">*</span>
                </label>
                <input
                  id="term-start-date"
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
                <label className="apply-leave-label" htmlFor="term-end-date">
                  End Date <span className="required-star">*</span>
                </label>
                <input
                  id="term-end-date"
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
              <label className="apply-leave-label" htmlFor="term-desc">
                Description & Curricular Focus
              </label>
              <textarea
                id="term-desc"
                className="form-control apply-leave-textarea"
                rows={2}
                placeholder="Curricular focus, major assessments, or co-curricular milestones..."
                value={description}
                onChange={e => setDescription(e.target.value)}
                disabled={isSubmitting}
              />
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
                  <span>Saving Term...</span>
                </>
              ) : (
                <>
                  <Check size={16} />
                  <span>{isEditing ? 'Update Term' : 'Save School Term'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddEditTermModal;
