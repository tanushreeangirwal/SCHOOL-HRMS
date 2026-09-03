import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Clock,
  Calendar,
  AlertCircle,
  Loader2,
  CheckCircle2,
  User,
  Info,
  CalendarClock
} from 'lucide-react';
import { hrmsApi } from '../../services/api';

export function MarkAttendanceModal({
  isOpen = false,
  onClose,
  onSaved,
  editingRecord = null,
  initialDate = null,
  initialEmployee = null,
  employees = [],
  shifts = []
}) {
  const isEditing = Boolean(editingRecord && editingRecord.attendance_id);

  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [attendanceDate, setAttendanceDate] = useState(() => initialDate || new Date().toISOString().split('T')[0]);
  const [status, setStatus] = useState('Present');
  const [checkInTime, setCheckInTime] = useState('');
  const [checkOutTime, setCheckOutTime] = useState('');
  const [remarks, setRemarks] = useState('');
  const [correctionReason, setCorrectionReason] = useState('');

  const [fieldErrors, setFieldErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [globalError, setGlobalError] = useState(null);

  // Selected Employee object & assigned shift
  const selectedEmployee = useMemo(() => {
    return employees.find(e => e.id === selectedEmployeeId) || null;
  }, [employees, selectedEmployeeId]);

  const assignedShift = useMemo(() => {
    if (!selectedEmployee || !selectedEmployee.current_shift_id) return null;
    return shifts.find(s => s.id === selectedEmployee.current_shift_id) || null;
  }, [selectedEmployee, shifts]);

  // Pre-fill / reset form
  useEffect(() => {
    if (editingRecord) {
      setSelectedEmployeeId(editingRecord.employee_id || '');
      setAttendanceDate(editingRecord.attendance_date || initialDate || new Date().toISOString().split('T')[0]);
      setStatus(editingRecord.status || 'Present');
      
      const inTime = editingRecord.check_in 
        ? new Date(editingRecord.check_in).toTimeString().slice(0, 5)
        : '';
      const outTime = editingRecord.check_out
        ? new Date(editingRecord.check_out).toTimeString().slice(0, 5)
        : '';
      
      setCheckInTime(inTime);
      setCheckOutTime(outTime);
      setRemarks(editingRecord.remarks || '');
      setCorrectionReason('');
    } else {
      setSelectedEmployeeId(initialEmployee?.id || (employees.length > 0 ? employees[0].id : ''));
      setAttendanceDate(initialDate || new Date().toISOString().split('T')[0]);
      setStatus('Present');
      setCheckInTime('');
      setCheckOutTime('');
      setRemarks('');
      setCorrectionReason('');
    }
    setFieldErrors({});
    setGlobalError(null);
  }, [editingRecord, initialDate, initialEmployee, employees, isOpen]);

  if (!isOpen) return null;

  // Auto pre-fill with shift standard hours
  const handlePrefillShiftTimings = () => {
    if (assignedShift) {
      setCheckInTime(assignedShift.start_time ? assignedShift.start_time.slice(0, 5) : '07:30');
      setCheckOutTime(assignedShift.end_time ? assignedShift.end_time.slice(0, 5) : '14:00');
    }
  };

  const validateForm = () => {
    const errors = {};
    if (!selectedEmployeeId) {
      errors.employee = 'Please select an employee.';
    }
    if (!attendanceDate) {
      errors.date = 'Attendance date is required.';
    }
    if (isEditing && !correctionReason.trim()) {
      errors.reason = 'Please provide a reason for correcting this historical record.';
    }
    if (checkInTime && checkOutTime && checkInTime >= checkOutTime) {
      errors.time = 'Check-out time must be later than check-in time.';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setGlobalError(null);

    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      if (isEditing) {
        const payload = {
          status,
          check_in: checkInTime || null,
          check_out: checkOutTime || null,
          remarks: remarks.trim() || null,
          reason: correctionReason.trim()
        };
        const res = await hrmsApi.updateAttendance(editingRecord.attendance_id, payload);
        if (res && res.success) {
          if (onSaved) onSaved(res.data, true);
          onClose();
        } else {
          throw new Error(res?.message || 'Failed to update attendance record.');
        }
      } else {
        const payload = {
          employee_id: selectedEmployeeId,
          attendance_date: attendanceDate,
          status,
          check_in: checkInTime || null,
          check_out: checkOutTime || null,
          remarks: remarks.trim() || null
        };
        const res = await hrmsApi.markAttendance(payload);
        if (res && res.success) {
          if (onSaved) onSaved(res.data, false);
          onClose();
        } else {
          throw new Error(res?.message || 'Failed to record attendance.');
        }
      }
    } catch (err) {
      console.error('Submit attendance error:', err);
      setGlobalError(err.message || 'Failed to save attendance record.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={() => !isSubmitting && onClose()}>
      <div 
        className="modal-container" 
        style={{ maxWidth: '620px', width: '92%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header" style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-light)', flexShrink: 0 }}>
          <div className="modal-header-icon-title" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div className="stat-icon-badge stat-emerald" style={{ width: '40px', height: '40px', borderRadius: '8px' }}>
              <Clock size={20} />
            </div>
            <div>
              <h3 className="modal-title" style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                {isEditing ? 'Correct Attendance Record' : 'Mark Staff Attendance'}
              </h3>
              <p className="modal-subtitle" style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                {isEditing ? 'Modify time card and record audit reason' : 'Record check-in, check-out, and shift presence'}
              </p>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} disabled={isSubmitting}>
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} style={{ overflowY: 'auto', flex: 1, padding: '24px' }}>
          {globalError && (
            <div className="assign-alert-error" style={{ marginBottom: '18px' }}>
              <AlertCircle size={18} className="alert-icon" />
              <div className="alert-text">{globalError}</div>
            </div>
          )}

          {/* Section 1: Employee Information */}
          <div style={{ marginBottom: '20px' }}>
            <h4 style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', margin: '0 0 12px 0', borderBottom: '1px solid var(--border-light)', paddingBottom: '6px' }}>
              1. Staff Information
            </h4>

            {isEditing ? (
              <div style={{ padding: '10px 14px', borderRadius: '6px', backgroundColor: '#f8fafc', border: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <span style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-main)', display: 'block' }}>
                    {editingRecord.employee_name}
                  </span>
                  <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                    Code: <code>{editingRecord.employee_code}</code> • {editingRecord.department_name || 'Faculty'}
                  </span>
                </div>
                <span className="code-badge" style={{ backgroundColor: '#eff6ff', color: '#1d4ed8' }}>
                  {editingRecord.shift_name || 'Teaching Shift'}
                </span>
              </div>
            ) : (
              <div>
                <label className="form-label" htmlFor="mark-emp-picker">
                  Select Employee <span className="text-danger">*</span>
                </label>
                <select
                  id="mark-emp-picker"
                  className={`form-input ${fieldErrors.employee ? 'input-error' : ''}`}
                  value={selectedEmployeeId}
                  onChange={(e) => setSelectedEmployeeId(e.target.value)}
                  disabled={isSubmitting}
                  required
                >
                  <option value="">-- Choose Employee --</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.first_name} {emp.last_name || ''} ({emp.employee_code}) - {emp.department_name || 'Academic'}
                    </option>
                  ))}
                </select>
                {fieldErrors.employee && (
                  <span className="form-field-error text-danger text-xs" style={{ display: 'block', marginTop: '4px' }}>
                    {fieldErrors.employee}
                  </span>
                )}

                {assignedShift && (
                  <div style={{ marginTop: '8px', padding: '6px 10px', borderRadius: '4px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.76rem', color: '#166534' }}>
                      <strong>Schedule:</strong> {assignedShift.name} ({assignedShift.start_time?.slice(0, 5)} – {assignedShift.end_time?.slice(0, 5)})
                    </span>
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs"
                      onClick={handlePrefillShiftTimings}
                      style={{ fontSize: '0.72rem', color: '#166534', textDecoration: 'underline', padding: 0 }}
                    >
                      Use Default Hours
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Section 2: Date & Status */}
          <div style={{ marginBottom: '20px' }}>
            <h4 style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', margin: '0 0 12px 0', borderBottom: '1px solid var(--border-light)', paddingBottom: '6px' }}>
              2. Date & Attendance Status
            </h4>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px' }}>
              {/* Date */}
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" htmlFor="mark-date">
                  Attendance Date <span className="text-danger">*</span>
                </label>
                <input
                  type="date"
                  id="mark-date"
                  className={`form-input ${fieldErrors.date ? 'input-error' : ''}`}
                  value={attendanceDate}
                  onChange={(e) => setAttendanceDate(e.target.value)}
                  disabled={isSubmitting || isEditing}
                  required
                />
                {fieldErrors.date && (
                  <span className="form-field-error text-danger text-xs" style={{ display: 'block', marginTop: '4px' }}>
                    {fieldErrors.date}
                  </span>
                )}
              </div>

              {/* Status */}
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" htmlFor="mark-status">
                  Attendance Status <span className="text-danger">*</span>
                </label>
                <select
                  id="mark-status"
                  className="form-input"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  disabled={isSubmitting}
                  required
                >
                  <option value="Present">Present (On Time)</option>
                  <option value="Late">Late Arrival</option>
                  <option value="Half Day">Half Day</option>
                  <option value="On Leave">On Leave</option>
                  <option value="Absent">Absent</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 3: Time Details */}
          {(status === 'Present' || status === 'Late' || status === 'Half Day') && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', borderBottom: '1px solid var(--border-light)', paddingBottom: '6px' }}>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', margin: 0 }}>
                  3. Time Details
                </h4>
                {assignedShift && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs"
                    onClick={handlePrefillShiftTimings}
                    style={{ fontSize: '0.74rem' }}
                  >
                    Auto-Fill Shift Timings
                  </button>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" htmlFor="check-in-input">
                    Check-In Time
                  </label>
                  <input
                    type="time"
                    id="check-in-input"
                    className="form-input"
                    value={checkInTime}
                    onChange={(e) => setCheckInTime(e.target.value)}
                    disabled={isSubmitting}
                  />
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                    Late threshold: {assignedShift ? `${assignedShift.late_grace_minutes || 15}m grace` : '+15m'}
                  </span>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" htmlFor="check-out-input">
                    Check-Out Time
                  </label>
                  <input
                    type="time"
                    id="check-out-input"
                    className="form-input"
                    value={checkOutTime}
                    onChange={(e) => setCheckOutTime(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              {fieldErrors.time && (
                <span className="form-field-error text-danger text-xs" style={{ display: 'block', marginTop: '6px' }}>
                  {fieldErrors.time}
                </span>
              )}
            </div>
          )}

          {/* Section 4: Remarks / Audit Reason */}
          <div>
            <h4 style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', margin: '0 0 10px 0', borderBottom: '1px solid var(--border-light)', paddingBottom: '6px' }}>
              {isEditing ? '4. Correction Reason & Remarks' : '4. Remarks (Optional)'}
            </h4>

            {isEditing && (
              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label className="form-label" htmlFor="correction-reason">
                  Reason for Correction <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  id="correction-reason"
                  className={`form-input ${fieldErrors.reason ? 'input-error' : ''}`}
                  placeholder="e.g. Bio-metric sync failure, approved timecard adjustment"
                  value={correctionReason}
                  onChange={(e) => {
                    setCorrectionReason(e.target.value);
                    setFieldErrors(prev => ({ ...prev, reason: undefined }));
                  }}
                  disabled={isSubmitting}
                  required
                />
                {fieldErrors.reason && (
                  <span className="form-field-error text-danger text-xs" style={{ display: 'block', marginTop: '4px' }}>
                    {fieldErrors.reason}
                  </span>
                )}
              </div>
            )}

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" htmlFor="mark-remarks">
                General Remarks / Notes
              </label>
              <textarea
                id="mark-remarks"
                className="form-textarea"
                rows="2"
                placeholder="Optional notes regarding this attendance record..."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
          </div>
        </form>

        {/* Sticky Footer */}
        <div className="modal-footer" style={{ padding: '16px 24px', borderTop: '1px solid var(--border-light)', backgroundColor: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isSubmitting}>
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
                <Loader2 size={15} className="spin-animation" />
                <span>Saving...</span>
              </>
            ) : (
              <span>{isEditing ? 'Save Changes' : 'Save Attendance'}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default MarkAttendanceModal;
