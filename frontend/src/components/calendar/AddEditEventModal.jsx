import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Calendar, 
  Clock, 
  AlertCircle, 
  Check, 
  Loader2, 
  Tag, 
  Layers, 
  FileText,
  Info
} from 'lucide-react';
import { hrmsApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export function AddEditEventModal({
  event = null,
  isOpen,
  onClose,
  onSaved,
  academicYears = [],
  terms = [],
  activeYearId = null
}) {
  const { user } = useAuth();
  const isEditing = Boolean(event && event.id);

  const [title, setTitle] = useState('');
  const [eventType, setEventType] = useState('Holiday');
  const [category, setCategory] = useState('Public Holiday');
  const [academicYearId, setAcademicYearId] = useState('');
  const [termId, setTermId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [description, setDescription] = useState('');
  const [isWorkingDay, setIsWorkingDay] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    if (isOpen) {
      if (event) {
        setTitle(event.title || '');
        setEventType(event.event_type || 'Holiday');
        setCategory(event.category || 'Public Holiday');
        setAcademicYearId(event.academic_year_id || activeYearId || (academicYears[0]?.id || ''));
        setTermId(event.term_id || '');
        setStartDate(event.start_date ? event.start_date.split('T')[0] : '');
        setEndDate(event.end_date ? event.end_date.split('T')[0] : '');
        const rawDesc = event.description || '';
        setIncludeSaturday(rawDesc.includes('[INCLUDE_SATURDAY]') || rawDesc.includes('[INCLUDES_SATURDAY]'));
        setIncludeSunday(rawDesc.includes('[INCLUDE_SUNDAY]') || rawDesc.includes('[INCLUDES_SUNDAY]'));
        setDescription(rawDesc.replace(/\[INCLUDE_SATURDAY\]|\[INCLUDES_SATURDAY\]|\[INCLUDE_SUNDAY\]|\[INCLUDES_SUNDAY\]/g, '').trim());
        setIsWorkingDay(Boolean(event.is_working_day));
      } else {
        setTitle('');
        setEventType('Holiday');
        setCategory('Public Holiday');
        setAcademicYearId(activeYearId || (academicYears.find(y => y.is_active)?.id || academicYears[0]?.id || ''));
        setTermId('');
        const todayStr = new Date().toISOString().split('T')[0];
        setStartDate(todayStr);
        setEndDate(todayStr);
        setDescription('');
        setIncludeSaturday(false);
        setIncludeSunday(false);
        setIsWorkingDay(false);
      }
      setErrorMessage('');
      setFieldErrors({});
    }
  }, [isOpen, event, activeYearId, academicYears]);

  const [includeSaturday, setIncludeSaturday] = useState(false);
  const [includeSunday, setIncludeSunday] = useState(false);

  // Check whether this event represents an examination or assessment
  const isExamCategory = useMemo(() => {
    return (category && (category.toLowerCase().includes('exam') || category.toLowerCase().includes('test'))) ||
           (title && (title.toLowerCase().includes('exam') || title.toLowerCase().includes('test')));
  }, [category, title]);

  // Adjust category choices when eventType changes
  const categoryOptions = useMemo(() => {
    switch (eventType) {
      case 'Holiday':
        return [
          'Public Holiday',
          'Festival Holiday',
          'National Holiday',
          'School Vacation (Summer/Winter)',
          'Local / Regional Holiday',
          'Special Holiday'
        ];
      case 'Non-Instructional':
        return [
          'Exam Period / Term Tests',
          'Mid-Term Examination',
          'Final Annual Examination',
          'Unit Test Assessment',
          'Board Practical Exam',
          'Staff Training & Workshop',
          'School Event / Annual Day',
          'Sports Day / Athletic Meet',
          'Parent-Teacher Meeting (PTM)',
          'Administrative Planning Day'
        ];
      case 'School Closure':
        return [
          'Weather / Monsoon Closure',
          'Emergency Closure',
          'Government Directive',
          'Sanitation / Maintenance'
        ];
      case 'Working Day Override':
        return [
          'Compensatory Working Day',
          'Special Instruction Day',
          'Weekend School Session'
        ];
      default:
        return ['General'];
    }
  }, [eventType]);

  const handleApplyPreset = (type, defaultCat) => {
    setEventType(type);
    setCategory(defaultCat);
    if (type === 'Working Day Override') {
      setIsWorkingDay(true);
    } else if (type === 'Holiday' || type === 'School Closure') {
      setIsWorkingDay(false);
    }
  };

  // Filter terms by selected academic year
  const availableTerms = useMemo(() => {
    if (!academicYearId) return terms;
    return terms.filter(t => t.academic_year_id === academicYearId);
  }, [terms, academicYearId]);

  // Calculated duration (skipping Sat/Sun for examinations unless explicitly checked)
  const calculatedDays = useMemo(() => {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return 0;

    let daysCount = 0;
    for (let cur = new Date(start); cur <= end; cur.setDate(cur.getDate() + 1)) {
      const dow = cur.getDay(); // 0 = Sun, 6 = Sat
      if (isExamCategory) {
        if (dow === 0 && !includeSunday) continue; // Skip Sunday by default
        if (dow === 6 && !includeSaturday) continue; // Skip Saturday by default
      }
      daysCount++;
    }
    return daysCount;
  }, [startDate, endDate, isExamCategory, includeSaturday, includeSunday]);

  if (!isOpen) return null;

  const validate = () => {
    const errs = {};
    if (!title || !title.trim()) errs.title = 'Event title is required.';
    if (!eventType) errs.eventType = 'Event type is required.';
    if (!startDate) errs.startDate = 'Start date is required.';
    if (!endDate) errs.endDate = 'End date is required.';
    if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
      errs.endDate = 'End date cannot be before start date.';
    }
    if (!academicYearId) errs.academicYearId = 'Academic year is required.';

    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      let finalDescription = (description || '').trim();
      if (isExamCategory) {
        if (includeSaturday) finalDescription += ' [INCLUDE_SATURDAY]';
        if (includeSunday) finalDescription += ' [INCLUDE_SUNDAY]';
      }

      const payload = {
        title: title.trim(),
        event_type: eventType,
        category,
        academic_year_id: academicYearId,
        term_id: termId || null,
        start_date: startDate,
        end_date: endDate,
        description: finalDescription ? finalDescription.trim() : null,
        is_working_day: eventType === 'Working Day Override' ? true : (eventType === 'Non-Instructional' ? isWorkingDay : false)
      };

      let res;
      if (isEditing) {
        res = await hrmsApi.updateCalendarEvent(event.id, payload);
      } else {
        res = await hrmsApi.createCalendarEvent(payload);
      }

      if (res && res.success) {
        if (onSaved) onSaved(res.data);
        onClose();
      } else {
        setErrorMessage(res?.message || 'Failed to save calendar event.');
      }
    } catch (err) {
      console.error('Error saving calendar event:', err);
      setErrorMessage(err.message || 'An error occurred while saving the event.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div 
        className="apply-leave-modal-card" 
        style={{ maxWidth: '680px' }}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="apply-leave-header">
          <div className="apply-leave-header-left">
            <div className="apply-leave-icon-circle" style={{ backgroundColor: '#eff6ff', color: '#2563eb' }}>
              <Calendar size={18} />
            </div>
            <div>
              <h2 className="apply-leave-title">
                {isEditing ? 'Edit Calendar Event' : 'Add Calendar Event / Holiday'}
              </h2>
              <p className="apply-leave-subtitle">
                Configure school holidays, closures, non-instructional days, and schedule overrides
              </p>
            </div>
          </div>
          <button type="button" className="apply-leave-close-btn" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        {/* Global Error Banner */}
        {errorMessage && (
          <div className="apply-leave-error-strip">
            <AlertCircle size={16} className="error-icon" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="apply-leave-body">
          {/* 1. Basic Event Details */}
          <div className="apply-leave-section">
            <div className="apply-leave-section-label">Event Information</div>

            {/* Quick Category Presets */}
            <div style={{ marginBottom: '14px', backgroundColor: '#f8fafc', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '8px' }}>
                Quick Category Presets
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                <button
                  type="button"
                  className={`btn btn-xs ${eventType === 'Holiday' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => handleApplyPreset('Holiday', 'Public Holiday')}
                  style={{ fontSize: '0.76rem', padding: '4px 10px' }}
                >
                  🏖️ Public / School Holiday
                </button>
                <button
                  type="button"
                  className={`btn btn-xs ${category.includes('Exam') ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => handleApplyPreset('Non-Instructional', 'Mid-Term Examination')}
                  style={{ fontSize: '0.76rem', padding: '4px 10px' }}
                >
                  📝 Exam / Assessment
                </button>
                <button
                  type="button"
                  className={`btn btn-xs ${category.includes('Sports') || category.includes('Annual') ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => handleApplyPreset('Non-Instructional', 'School Event / Annual Day')}
                  style={{ fontSize: '0.76rem', padding: '4px 10px' }}
                >
                  🏆 School Event
                </button>
                <button
                  type="button"
                  className={`btn btn-xs ${category.includes('Training') ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => handleApplyPreset('Non-Instructional', 'Staff Training & Workshop')}
                  style={{ fontSize: '0.76rem', padding: '4px 10px' }}
                >
                  👥 Staff Training
                </button>
                <button
                  type="button"
                  className={`btn btn-xs ${eventType === 'School Closure' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => handleApplyPreset('School Closure', 'Weather / Monsoon Closure')}
                  style={{ fontSize: '0.76rem', padding: '4px 10px' }}
                >
                  ⚠️ School Closure
                </button>
                <button
                  type="button"
                  className={`btn btn-xs ${eventType === 'Working Day Override' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => handleApplyPreset('Working Day Override', 'Compensatory Working Day')}
                  style={{ fontSize: '0.76rem', padding: '4px 10px' }}
                >
                  🔄 Working Override
                </button>
              </div>
            </div>

            <div className="apply-leave-field">
              <label className="apply-leave-label" htmlFor="event-title">
                Event Title <span className="required-star">*</span>
              </label>
              <input
                id="event-title"
                type="text"
                className={`form-control apply-leave-input ${fieldErrors.title ? 'has-error' : ''}`}
                placeholder="e.g. Independence Day, Diwali Break, Staff Training..."
                value={title}
                onChange={e => {
                  setTitle(e.target.value);
                  if (fieldErrors.title) setFieldErrors(prev => ({ ...prev, title: null }));
                }}
                disabled={isSubmitting}
              />
              {fieldErrors.title && <span className="apply-leave-field-error">{fieldErrors.title}</span>}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '6px' }}>
              {/* Event Type */}
              <div className="apply-leave-field">
                <label className="apply-leave-label" htmlFor="event-type">
                  Event Type <span className="required-star">*</span>
                </label>
                <select
                  id="event-type"
                  className="form-control apply-leave-select"
                  value={eventType}
                  onChange={e => {
                    setEventType(e.target.value);
                    setCategory(e.target.value === 'Holiday' ? 'Public Holiday' : 'Staff Training');
                  }}
                  disabled={isSubmitting}
                >
                  <option value="Holiday">Holiday (School Closed)</option>
                  <option value="Non-Instructional">Non-Instructional (No Classes / Staff Active)</option>
                  <option value="School Closure">School Closure (Emergency / Weather)</option>
                  <option value="Working Day Override">Working Day Override (Make Working)</option>
                </select>
              </div>

              {/* Category */}
              <div className="apply-leave-field">
                <label className="apply-leave-label" htmlFor="event-category">
                  Classification / Category
                </label>
                <select
                  id="event-category"
                  className="form-control apply-leave-select"
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  disabled={isSubmitting}
                >
                  {categoryOptions.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* 2. Schedule & Duration */}
          <div className="apply-leave-section">
            <div className="apply-leave-section-label">Schedule & Duration</div>

            <div className="apply-leave-dates-row">
              <div className="apply-leave-date-col">
                <label className="apply-leave-label" htmlFor="event-start-date">
                  Start Date <span className="required-star">*</span>
                </label>
                <input
                  id="event-start-date"
                  type="date"
                  className={`form-control apply-leave-date-input ${fieldErrors.startDate ? 'has-error' : ''}`}
                  value={startDate}
                  onChange={e => {
                    setStartDate(e.target.value);
                    if (!endDate || new Date(endDate) < new Date(e.target.value)) {
                      setEndDate(e.target.value);
                    }
                    if (fieldErrors.startDate) setFieldErrors(prev => ({ ...prev, startDate: null, endDate: null }));
                  }}
                  disabled={isSubmitting}
                />
                {fieldErrors.startDate && <span className="apply-leave-field-error">{fieldErrors.startDate}</span>}
              </div>

              <div className="apply-leave-date-col">
                <label className="apply-leave-label" htmlFor="event-end-date">
                  End Date <span className="required-star">*</span>
                </label>
                <input
                  id="event-end-date"
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

              <div className="apply-leave-duration-col">
                <div className="duration-highlight-card">
                  <div className="duration-card-header">
                    <Clock size={12} className="duration-card-clock" />
                    <span>Duration</span>
                  </div>
                  <div className="duration-card-value">
                    {calculatedDays > 0 ? `${calculatedDays} ${isExamCategory ? 'Exam ' : ''}Day${calculatedDays > 1 ? 's' : ''}` : '0 Days'}
                  </div>
                  {isExamCategory && (
                    <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: '3px', fontWeight: 600 }}>
                      {includeSaturday && includeSunday ? 'All 7 Days' : (includeSaturday ? 'Mon–Sat (Excl. Sun)' : (includeSunday ? 'Mon–Fri + Sun' : 'Mon–Fri Only (No Weekends)'))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Weekend Scheduling Control for Examinations & Assessments */}
            {isExamCategory && (
              <div style={{
                marginTop: '14px',
                padding: '12px 14px',
                borderRadius: '10px',
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <Calendar size={14} style={{ color: '#3155D9' }} />
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#172033' }}>
                    Weekend Examination Scheduling (Saturday & Sunday Exclusions)
                  </span>
                </div>
                <p style={{ fontSize: '0.76rem', color: '#64748b', margin: '0 0 10px', lineHeight: 1.4 }}>
                  By default, examinations and tests are strictly scheduled on instructional weekdays (Monday through Friday). The system will <strong>never</strong> place exams on Saturday or Sunday unless explicitly checked below.
                </p>

                <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, color: '#334155' }}>
                    <input
                      type="checkbox"
                      checked={includeSaturday}
                      onChange={e => setIncludeSaturday(e.target.checked)}
                      style={{ width: '16px', height: '16px', accentColor: '#3155D9' }}
                    />
                    <span>Schedule Exams on Saturday</span>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, color: '#334155' }}>
                    <input
                      type="checkbox"
                      checked={includeSunday}
                      onChange={e => setIncludeSunday(e.target.checked)}
                      style={{ width: '16px', height: '16px', accentColor: '#3155D9' }}
                    />
                    <span>Schedule Exams on Sunday</span>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* 3. Academic Year & Term Mapping */}
          <div className="apply-leave-section">
            <div className="apply-leave-section-label">Academic Mapping & Context</div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="apply-leave-field">
                <label className="apply-leave-label" htmlFor="event-academic-year">
                  Academic Year <span className="required-star">*</span>
                </label>
                <select
                  id="event-academic-year"
                  className={`form-control apply-leave-select ${fieldErrors.academicYearId ? 'has-error' : ''}`}
                  value={academicYearId}
                  onChange={e => {
                    setAcademicYearId(e.target.value);
                    setTermId('');
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

              <div className="apply-leave-field">
                <label className="apply-leave-label" htmlFor="event-term">
                  School Term <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: '0.78rem' }}>(Optional)</span>
                </label>
                <select
                  id="event-term"
                  className="form-control apply-leave-select"
                  value={termId}
                  onChange={e => setTermId(e.target.value)}
                  disabled={isSubmitting}
                >
                  <option value="">— Auto / Institutional Holiday —</option>
                  {availableTerms.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Non-Instructional Staff Attendance Option */}
            {eventType === 'Non-Instructional' && (
              <div style={{ marginTop: '8px', padding: '10px 12px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input
                  type="checkbox"
                  id="is-working-day-cb"
                  checked={isWorkingDay}
                  onChange={e => setIsWorkingDay(e.target.checked)}
                  disabled={isSubmitting}
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                />
                <label htmlFor="is-working-day-cb" style={{ fontSize: '0.82rem', color: '#334155', cursor: 'pointer', margin: 0 }}>
                  <strong>Staff working day</strong> (Students off, but faculty/staff attend training, exam invigilation, or meetings)
                </label>
              </div>
            )}
          </div>

          {/* 4. Description */}
          <div className="apply-leave-section">
            <div className="apply-leave-section-label">Description & Circular Notes</div>
            <div className="apply-leave-field">
              <textarea
                className="form-control apply-leave-textarea"
                rows={2}
                placeholder="Institutional circular details or instructions for faculty, students and parents..."
                value={description}
                onChange={e => setDescription(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Footer */}
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
              disabled={isSubmitting || calculatedDays <= 0}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="spin-animation" />
                  <span>Saving Event...</span>
                </>
              ) : (
                <>
                  <Check size={16} />
                  <span>{isEditing ? 'Update Event' : 'Create Calendar Event'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddEditEventModal;
