import React, { useState, useEffect } from 'react';
import {
  X,
  CalendarClock,
  Clock,
  Coffee,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Calendar,
  Check,
  Info
} from 'lucide-react';
import { hrmsApi } from '../../services/api';

const ALL_DAYS = [
  { key: 'Monday', short: 'Mon' },
  { key: 'Tuesday', short: 'Tue' },
  { key: 'Wednesday', short: 'Wed' },
  { key: 'Thursday', short: 'Thu' },
  { key: 'Friday', short: 'Fri' },
  { key: 'Saturday', short: 'Sat' },
  { key: 'Sunday', short: 'Sun' }
];

export function AddEditShiftModal({
  shift = null,
  isOpen = false,
  onClose,
  onShiftSaved
}) {
  const isEditing = Boolean(shift && shift.id);

  // Form State
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [startTime, setStartTime] = useState('07:30');
  const [endTime, setEndTime] = useState('14:00');
  const [breakStartTime, setBreakStartTime] = useState('10:30');
  const [breakEndTime, setBreakEndTime] = useState('11:00');
  const [breakDurationMinutes, setBreakDurationMinutes] = useState(30);
  const [lateGraceMinutes, setLateGraceMinutes] = useState(15);
  const [earlyDepartureGraceMinutes, setEarlyDepartureGraceMinutes] = useState(10);
  const [workingDays, setWorkingDays] = useState(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']);
  const [isActive, setIsActive] = useState(true);

  // Validation & Submission State
  const [fieldErrors, setFieldErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [globalError, setGlobalError] = useState(null);

  // Initialize form when opened or shift prop changes
  useEffect(() => {
    if (shift) {
      setName(shift.name || '');
      setCode(shift.code || '');
      setDescription(shift.description || '');
      setStartTime(shift.start_time ? shift.start_time.slice(0, 5) : '07:30');
      setEndTime(shift.end_time ? shift.end_time.slice(0, 5) : '14:00');
      setBreakStartTime(shift.break_start_time ? shift.break_start_time.slice(0, 5) : '');
      setBreakEndTime(shift.break_end_time ? shift.break_end_time.slice(0, 5) : '');
      setBreakDurationMinutes(shift.break_duration_minutes ?? 30);
      setLateGraceMinutes(shift.late_grace_minutes ?? shift.grace_period_minutes ?? 15);
      setEarlyDepartureGraceMinutes(shift.early_departure_grace_minutes ?? 10);
      setWorkingDays(
        Array.isArray(shift.working_days) && shift.working_days.length > 0
          ? shift.working_days
          : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
      );
      setIsActive(shift.is_active !== false);
    } else {
      setName('');
      setCode('');
      setDescription('');
      setStartTime('07:30');
      setEndTime('14:00');
      setBreakStartTime('10:30');
      setBreakEndTime('11:00');
      setBreakDurationMinutes(30);
      setLateGraceMinutes(15);
      setEarlyDepartureGraceMinutes(10);
      setWorkingDays(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']);
      setIsActive(true);
    }
    setFieldErrors({});
    setGlobalError(null);
  }, [shift, isOpen]);

  if (!isOpen) return null;

  // Toggle individual day
  const handleToggleDay = (dayKey) => {
    setFieldErrors(prev => ({ ...prev, workingDays: undefined }));
    if (workingDays.includes(dayKey)) {
      if (workingDays.length === 1) {
        setFieldErrors(prev => ({ ...prev, workingDays: 'At least one working day must be selected.' }));
        return;
      }
      setWorkingDays(workingDays.filter(d => d !== dayKey));
    } else {
      setWorkingDays([...workingDays, dayKey]);
    }
  };

  // Day Presets
  const applyPreset = (presetType) => {
    setFieldErrors(prev => ({ ...prev, workingDays: undefined }));
    if (presetType === 'mon-fri') {
      setWorkingDays(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']);
    } else if (presetType === 'mon-sat') {
      setWorkingDays(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']);
    } else if (presetType === 'all') {
      setWorkingDays(ALL_DAYS.map(d => d.key));
    }
  };

  // Auto-generate code from name for new shifts
  const handleNameChange = (val) => {
    setName(val);
    setFieldErrors(prev => ({ ...prev, name: undefined }));
    if (!isEditing && !code) {
      const generated = 'SCH-' + val.replace(/[^a-zA-Z0-9]/g, '').slice(0, 7).toUpperCase();
      setCode(generated);
    }
  };

  // Form Validation
  const validateForm = () => {
    const errors = {};
    if (!name.trim()) {
      errors.name = 'Shift name is required.';
    }
    if (!code.trim()) {
      errors.code = 'Shift code is required.';
    }
    if (!startTime) {
      errors.startTime = 'Start time is required.';
    }
    if (!endTime) {
      errors.endTime = 'End time is required.';
    }
    if (startTime && endTime && startTime >= endTime) {
      errors.endTime = 'End time must be later than start time.';
    }
    if (breakStartTime && breakEndTime && breakStartTime >= breakEndTime) {
      errors.breakEndTime = 'Break end time must be later than break start time.';
    }
    if (workingDays.length === 0) {
      errors.workingDays = 'Please select at least one working day.';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setGlobalError(null);

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        name: name.trim(),
        code: code.trim().toUpperCase(),
        description: description.trim() || null,
        start_time: startTime.length === 5 ? `${startTime}:00` : startTime,
        end_time: endTime.length === 5 ? `${endTime}:00` : endTime,
        break_start_time: breakStartTime ? (breakStartTime.length === 5 ? `${breakStartTime}:00` : breakStartTime) : null,
        break_end_time: breakEndTime ? (breakEndTime.length === 5 ? `${breakEndTime}:00` : breakEndTime) : null,
        break_duration_minutes: parseInt(breakDurationMinutes, 10) || 0,
        late_grace_minutes: parseInt(lateGraceMinutes, 10) || 0,
        early_departure_grace_minutes: parseInt(earlyDepartureGraceMinutes, 10) || 0,
        working_days: workingDays,
        is_overnight: false,
        is_active: Boolean(isActive)
      };

      let res;
      if (isEditing) {
        res = await hrmsApi.updateShift(shift.id, payload);
      } else {
        res = await hrmsApi.createShift(payload);
      }

      if (res && res.success) {
        if (onShiftSaved) {
          onShiftSaved(res.data, isEditing);
        }
        onClose();
      } else {
        throw new Error(res?.message || 'Failed to save shift.');
      }
    } catch (err) {
      console.error('Error saving shift:', err);
      setGlobalError(err.message || 'Failed to save shift. Please check the form and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={() => !isSubmitting && onClose()}>
      <div 
        className="modal-container"
        style={{ maxWidth: '750px', width: '92%', maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="modal-header" style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-light)', flexShrink: 0 }}>
          <div className="modal-header-icon-title" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div className="stat-icon-badge stat-indigo" style={{ width: '40px', height: '40px', borderRadius: '8px' }}>
              <CalendarClock size={20} />
            </div>
            <div>
              <h3 className="modal-title" style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                {isEditing ? 'Edit Work Shift & Schedule' : 'Create New Work Shift'}
              </h3>
              <p className="modal-subtitle" style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                {isEditing ? `Modifying ${shift.name} (${shift.code})` : 'Define school working hours, break periods, and attendance rules.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <form onSubmit={handleSubmit} style={{ overflowY: 'auto', flex: 1, padding: '24px' }}>
          {globalError && (
            <div className="assign-alert-error" style={{ marginBottom: '18px' }}>
              <AlertCircle size={18} className="alert-icon" />
              <div className="alert-text">{globalError}</div>
            </div>
          )}

          {isEditing && (shift.employee_count > 0 || shift.assigned_count > 0) && (
            <div className="assign-same-warning" style={{ marginBottom: '18px' }}>
              <Info size={16} />
              <span>
                <strong>Note:</strong> {shift.employee_count || shift.assigned_count} active employees are assigned to this shift. Timings will apply to their daily schedule.
              </span>
            </div>
          )}

          {/* SECTION 1: BASIC INFORMATION */}
          <div style={{ marginBottom: '22px' }}>
            <h4 style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', margin: '0 0 12px 0', borderBottom: '1px solid var(--border-light)', paddingBottom: '6px' }}>
              1. Basic Information
            </h4>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px', marginBottom: '12px' }}>
              {/* Shift Name */}
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" htmlFor="shift-name">
                  Shift Name <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  id="shift-name"
                  className={`form-input ${fieldErrors.name ? 'input-error' : ''}`}
                  placeholder="e.g. Regular School Teaching Shift"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  disabled={isSubmitting}
                  required
                />
                {fieldErrors.name && (
                  <span className="form-field-error text-danger text-xs" style={{ display: 'block', marginTop: '4px' }}>
                    {fieldErrors.name}
                  </span>
                )}
              </div>

              {/* Shift Code */}
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" htmlFor="shift-code">
                  Shift Code <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  id="shift-code"
                  className={`form-input text-monospace ${fieldErrors.code ? 'input-error' : ''}`}
                  placeholder="e.g. SCH-FACULTY"
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value.toUpperCase());
                    setFieldErrors(prev => ({ ...prev, code: undefined }));
                  }}
                  disabled={isSubmitting}
                  required
                />
                {fieldErrors.code && (
                  <span className="form-field-error text-danger text-xs" style={{ display: 'block', marginTop: '4px' }}>
                    {fieldErrors.code}
                  </span>
                )}
              </div>
            </div>

            {/* Description (Full Width) */}
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" htmlFor="shift-desc">
                Description / Purpose
              </label>
              <textarea
                id="shift-desc"
                className="form-textarea"
                rows="2"
                placeholder="Describe departments or roles assigned to this work schedule..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* SECTION 2: WORKING SCHEDULE */}
          <div style={{ marginBottom: '22px' }}>
            <h4 style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', margin: '0 0 12px 0', borderBottom: '1px solid var(--border-light)', paddingBottom: '6px' }}>
              2. Working Schedule
            </h4>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px', marginBottom: '12px' }}>
              {/* Start Time */}
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" htmlFor="start-time">
                  Shift Start Time <span className="text-danger">*</span>
                </label>
                <div className="input-with-icon" style={{ position: 'relative' }}>
                  <Clock size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="time"
                    id="start-time"
                    className="form-input"
                    style={{ paddingLeft: '34px' }}
                    value={startTime}
                    onChange={(e) => {
                      setStartTime(e.target.value);
                      setFieldErrors(prev => ({ ...prev, startTime: undefined, endTime: undefined }));
                    }}
                    disabled={isSubmitting}
                    required
                  />
                </div>
                {fieldErrors.startTime && (
                  <span className="form-field-error text-danger text-xs" style={{ display: 'block', marginTop: '4px' }}>
                    {fieldErrors.startTime}
                  </span>
                )}
              </div>

              {/* End Time */}
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" htmlFor="end-time">
                  Shift End Time <span className="text-danger">*</span>
                </label>
                <div className="input-with-icon" style={{ position: 'relative' }}>
                  <Clock size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="time"
                    id="end-time"
                    className={`form-input ${fieldErrors.endTime ? 'input-error' : ''}`}
                    style={{ paddingLeft: '34px' }}
                    value={endTime}
                    onChange={(e) => {
                      setEndTime(e.target.value);
                      setFieldErrors(prev => ({ ...prev, endTime: undefined }));
                    }}
                    disabled={isSubmitting}
                    required
                  />
                </div>
                {fieldErrors.endTime && (
                  <span className="form-field-error text-danger text-xs" style={{ display: 'block', marginTop: '4px' }}>
                    {fieldErrors.endTime}
                  </span>
                )}
              </div>
            </div>

            {/* Break Times */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" htmlFor="break-start">
                  Break Start Time
                </label>
                <input
                  type="time"
                  id="break-start"
                  className="form-input"
                  value={breakStartTime}
                  onChange={(e) => setBreakStartTime(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" htmlFor="break-end">
                  Break End Time
                </label>
                <input
                  type="time"
                  id="break-end"
                  className={`form-input ${fieldErrors.breakEndTime ? 'input-error' : ''}`}
                  value={breakEndTime}
                  onChange={(e) => {
                    setBreakEndTime(e.target.value);
                    setFieldErrors(prev => ({ ...prev, breakEndTime: undefined }));
                  }}
                  disabled={isSubmitting}
                />
                {fieldErrors.breakEndTime && (
                  <span className="form-field-error text-danger text-xs" style={{ display: 'block', marginTop: '4px' }}>
                    {fieldErrors.breakEndTime}
                  </span>
                )}
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" htmlFor="break-duration">
                  Break Duration (Minutes)
                </label>
                <input
                  type="number"
                  id="break-duration"
                  className="form-input"
                  min="0"
                  max="180"
                  value={breakDurationMinutes}
                  onChange={(e) => setBreakDurationMinutes(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>
            </div>
          </div>

          {/* SECTION 3: WORKING DAYS */}
          <div style={{ marginBottom: '22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', borderBottom: '1px solid var(--border-light)', paddingBottom: '6px' }}>
              <h4 style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', margin: 0 }}>
                3. Working Days <span className="text-danger">*</span>
              </h4>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  className="btn btn-ghost btn-xs"
                  onClick={() => applyPreset('mon-fri')}
                  style={{ fontSize: '0.74rem' }}
                >
                  Mon–Fri
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-xs"
                  onClick={() => applyPreset('mon-sat')}
                  style={{ fontSize: '0.74rem' }}
                >
                  Mon–Sat
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-xs"
                  onClick={() => applyPreset('all')}
                  style={{ fontSize: '0.74rem' }}
                >
                  All Days
                </button>
              </div>
            </div>

            {/* Selectable Day Pills */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {ALL_DAYS.map((d) => {
                const isSelected = workingDays.includes(d.key);
                return (
                  <button
                    key={d.key}
                    type="button"
                    onClick={() => handleToggleDay(d.key)}
                    disabled={isSubmitting}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '7px 14px',
                      borderRadius: '6px',
                      fontSize: '0.84rem',
                      fontWeight: isSelected ? 700 : 500,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      border: isSelected ? '1.5px solid var(--color-primary)' : '1px solid var(--border-medium)',
                      backgroundColor: isSelected ? '#eef2ff' : '#ffffff',
                      color: isSelected ? '#3730a3' : 'var(--text-main)'
                    }}
                  >
                    {isSelected ? <Check size={14} className="text-primary" /> : <span style={{ width: '14px' }}></span>}
                    <span>{d.short}</span>
                  </button>
                );
              })}
            </div>
            {fieldErrors.workingDays && (
              <span className="form-field-error text-danger text-xs" style={{ display: 'block', marginTop: '6px' }}>
                {fieldErrors.workingDays}
              </span>
            )}
          </div>

          {/* SECTION 4: ATTENDANCE RULES */}
          <div style={{ marginBottom: '22px' }}>
            <h4 style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', margin: '0 0 12px 0', borderBottom: '1px solid var(--border-light)', paddingBottom: '6px' }}>
              4. Attendance Rules
            </h4>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" htmlFor="late-grace">
                  Late Arrival Grace (Minutes)
                </label>
                <input
                  type="number"
                  id="late-grace"
                  className="form-input"
                  min="0"
                  max="120"
                  value={lateGraceMinutes}
                  onChange={(e) => setLateGraceMinutes(e.target.value)}
                  disabled={isSubmitting}
                />
                <span className="form-help-text" style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                  Grace period allowed before attendance is marked as late.
                </span>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" htmlFor="early-grace">
                  Early Departure Grace (Minutes)
                </label>
                <input
                  type="number"
                  id="early-grace"
                  className="form-input"
                  min="0"
                  max="120"
                  value={earlyDepartureGraceMinutes}
                  onChange={(e) => setEarlyDepartureGraceMinutes(e.target.value)}
                  disabled={isSubmitting}
                />
                <span className="form-help-text" style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                  Grace period allowed before shift end without early departure penalty.
                </span>
              </div>
            </div>
          </div>

          {/* SECTION 5: STATUS */}
          <div>
            <h4 style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', margin: '0 0 10px 0', borderBottom: '1px solid var(--border-light)', paddingBottom: '6px' }}>
              5. Status
            </h4>

            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                disabled={isSubmitting}
                style={{ width: '16px', height: '16px', accentColor: 'var(--color-primary)' }}
              />
              <span className={`status-pill ${isActive ? 'badge-active' : 'badge-inactive'}`}>
                <span className="status-dot"></span>
                <span>{isActive ? 'Active' : 'Inactive'}</span>
              </span>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                {isActive ? 'Available for employee assignment and attendance tracking.' : 'Archived / not assigned to new staff.'}
              </span>
            </label>
          </div>
        </form>

        {/* Modal Sticky Footer */}
        <div className="modal-footer" style={{ padding: '16px 24px', borderTop: '1px solid var(--border-light)', backgroundColor: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={isSubmitting}
            style={{ minWidth: '140px' }}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={16} className="spin-animation" />
                <span>Saving...</span>
              </>
            ) : (
              <span>{isEditing ? 'Save Changes' : 'Create Shift'}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default AddEditShiftModal;
