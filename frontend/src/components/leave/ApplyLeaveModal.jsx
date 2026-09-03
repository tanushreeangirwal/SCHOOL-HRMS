import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Calendar, 
  Clock, 
  FileText, 
  AlertCircle, 
  CheckCircle2, 
  Loader2, 
  User, 
  Info,
  CalendarRange,
  ChevronDown,
  ChevronUp,
  Search,
  Check
} from 'lucide-react';
import { hrmsApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { StaffAvatar } from '../common/StaffAvatar';

export function ApplyLeaveModal({
  isOpen,
  onClose,
  onSuccess,
  employees = [],
  leaveTypes = [],
  initialEmployeeId = null
}) {
  const { user, isSuperAdmin, isAdmin, isHR, isManager } = useAuth();
  const canSelectStaff = isSuperAdmin || isAdmin || isHR || isManager;

  const defaultEmpId = initialEmployeeId || user?.employee_id || (employees.length > 0 ? employees[0].id : '');

  const [selectedEmployeeId, setSelectedEmployeeId] = useState(defaultEmpId);
  const [selectedLeaveTypeId, setSelectedLeaveTypeId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [coveringFaculty, setCoveringFaculty] = useState('');
  const [remarks, setRemarks] = useState('');
  
  // UI states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [balances, setBalances] = useState([]);
  const [isLoadingBalances, setIsLoadingBalances] = useState(false);
  const [showOptionalSection, setShowOptionalSection] = useState(false);
  const [staffSearchQuery, setStaffSearchQuery] = useState('');

  // Sync selected employee on open or prop change
  useEffect(() => {
    if (isOpen) {
      const initialId = initialEmployeeId || user?.employee_id || (employees[0]?.id || '');
      setSelectedEmployeeId(initialId);
      if (leaveTypes.length > 0) {
        setSelectedLeaveTypeId(leaveTypes[0].id);
      }
      setErrorMessage('');
      setFieldErrors({});
      setReason('');
      setCoveringFaculty('');
      setRemarks('');
      setShowOptionalSection(false);
      setStaffSearchQuery('');
      
      // Default dates to tomorrow
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];
      setStartDate(tomorrowStr);
      setEndDate(tomorrowStr);
    }
  }, [isOpen, initialEmployeeId, user?.employee_id, leaveTypes]);

  // Fetch balances for selected employee
  useEffect(() => {
    async function loadEmployeeBalances() {
      if (!selectedEmployeeId || !isOpen) return;
      setIsLoadingBalances(true);
      try {
        if (selectedEmployeeId === user?.employee_id) {
          const res = await hrmsApi.getMyLeaveSummary();
          if (res && res.success) {
            setBalances(res.data.balances || []);
          }
        } else {
          // For other employees, we could retrieve their summary if needed
          setBalances([]);
        }
      } catch (err) {
        console.error('Failed to load leave balances:', err);
      } finally {
        setIsLoadingBalances(false);
      }
    }
    loadEmployeeBalances();
  }, [selectedEmployeeId, isOpen, user?.employee_id]);

  // Calculate days automatically
  const calculatedDays = useMemo(() => {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return 0;
    const diffTime = end.getTime() - start.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  }, [startDate, endDate]);

  // Find active leave type details & balance
  const activeLeaveType = useMemo(() => {
    return leaveTypes.find(lt => lt.id === selectedLeaveTypeId);
  }, [leaveTypes, selectedLeaveTypeId]);

  const activeBalance = useMemo(() => {
    return balances.find(b => b.leave_type_id === selectedLeaveTypeId);
  }, [balances, selectedLeaveTypeId]);

  const selectedEmployeeObj = useMemo(() => {
    return employees.find(e => e.id === selectedEmployeeId);
  }, [employees, selectedEmployeeId]);

  const isSelf = selectedEmployeeId === user?.employee_id;

  // Filtered employees for admin staff selector
  const filteredStaffList = useMemo(() => {
    if (!staffSearchQuery.trim()) return employees;
    const q = staffSearchQuery.toLowerCase();
    return employees.filter(e => 
      `${e.first_name} ${e.last_name}`.toLowerCase().includes(q) ||
      (e.employee_code || '').toLowerCase().includes(q) ||
      (e.department_name || '').toLowerCase().includes(q)
    );
  }, [employees, staffSearchQuery]);

  if (!isOpen) return null;

  const validateForm = () => {
    const errors = {};
    if (!selectedEmployeeId) {
      errors.employee = 'Please select a valid staff member.';
    }
    if (!selectedLeaveTypeId) {
      errors.leaveType = 'Please select a leave category.';
    }
    if (!startDate) {
      errors.startDate = 'Start date is required.';
    }
    if (!endDate) {
      errors.endDate = 'End date is required.';
    }
    if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
      errors.endDate = 'End date must be on or after start date.';
    }
    if (!reason || !reason.trim()) {
      errors.reason = 'Please briefly explain the reason for your leave.';
    }

    // Check balance if available
    if (activeBalance && activeLeaveType?.is_paid && parseFloat(activeLeaveType.annual_allocation) > 0) {
      const avail = parseFloat(activeBalance.available_days || 0);
      if (avail < calculatedDays) {
        errors.balance = `Insufficient quota: requested ${calculatedDays} day(s), but only ${avail} day(s) available.`;
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      // Build combined remarks if covering faculty provided
      let combinedRemarks = '';
      if (coveringFaculty.trim() && remarks.trim()) {
        combinedRemarks = `Covering Faculty: ${coveringFaculty.trim()} | Remarks: ${remarks.trim()}`;
      } else if (coveringFaculty.trim()) {
        combinedRemarks = `Covering Faculty: ${coveringFaculty.trim()}`;
      } else if (remarks.trim()) {
        combinedRemarks = remarks.trim();
      }

      const payload = {
        employee_id: selectedEmployeeId,
        leave_type_id: selectedLeaveTypeId,
        start_date: startDate,
        end_date: endDate,
        reason: reason.trim(),
        remarks: combinedRemarks || null
      };

      const res = await hrmsApi.applyLeave(payload);
      if (res && res.success) {
        if (onSuccess) onSuccess(res.data);
        onClose();
      } else {
        setErrorMessage(res?.message || 'Failed to submit leave request.');
      }
    } catch (err) {
      console.error('Apply leave submission error:', err);
      setErrorMessage(err.message || 'An unexpected error occurred while submitting your leave application.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Format clean balance numbers
  const formatDays = (val) => {
    if (val === undefined || val === null) return '0';
    const num = parseFloat(val);
    return Number.isInteger(num) ? num.toString() : num.toFixed(1);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div 
        className="apply-leave-modal-card" 
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="apply-leave-title"
      >
        {/* Modal Header */}
        <div className="apply-leave-header">
          <div className="apply-leave-header-left">
            <div className="apply-leave-icon-circle">
              <Calendar size={18} />
            </div>
            <div>
              <h2 id="apply-leave-title" className="apply-leave-title">
                Apply for Leave
              </h2>
              <p className="apply-leave-subtitle">
                Request time off from work
              </p>
            </div>
          </div>
          <button 
            type="button" 
            className="apply-leave-close-btn"
            onClick={onClose}
            aria-label="Close modal"
          >
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
          {/* =============================================================== */}
          {/* SECTION 1: REQUEST DETAILS                                      */}
          {/* =============================================================== */}
          <div className="apply-leave-section">
            <div className="apply-leave-section-label">Request Details</div>

            {/* Employee Card / Selector */}
            <div className="apply-leave-field">
              <label className="apply-leave-label">
                Staff Member
              </label>

              {/* If Self / Employee: Show Elegant Compact Identity Card */}
              {(!canSelectStaff || isSelf) ? (
                <div className="staff-identity-card">
                  <div className="staff-identity-avatar-area">
                    <StaffAvatar 
                      name={selectedEmployeeObj ? `${selectedEmployeeObj.first_name} ${selectedEmployeeObj.last_name}` : user?.full_name || 'Staff'}
                      firstName={selectedEmployeeObj?.first_name || user?.first_name}
                      lastName={selectedEmployeeObj?.last_name || user?.last_name}
                      size="sm"
                    />
                  </div>
                  <div className="staff-identity-info">
                    <div className="staff-identity-name">
                      {selectedEmployeeObj ? `${selectedEmployeeObj.first_name} ${selectedEmployeeObj.last_name}` : user?.full_name || 'Current Staff'}
                    </div>
                    <div className="staff-identity-dept">
                      {selectedEmployeeObj?.employee_code || user?.employee_code || 'EMP-1001'} • {selectedEmployeeObj?.department_name || user?.department_name || 'Academic Faculty'}
                    </div>
                  </div>
                  <div className="staff-identity-badge">
                    Self
                  </div>
                </div>
              ) : (
                /* Admin / HR Selector for other employees */
                <div className="staff-select-wrapper">
                  <select
                    className={`form-control apply-leave-select ${fieldErrors.employee ? 'has-error' : ''}`}
                    value={selectedEmployeeId}
                    onChange={e => setSelectedEmployeeId(e.target.value)}
                    disabled={isSubmitting}
                  >
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>
                        {emp.first_name} {emp.last_name} ({emp.employee_code}) — {emp.department_name || 'Academic Faculty'}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {fieldErrors.employee && (
                <span className="apply-leave-field-error">{fieldErrors.employee}</span>
              )}
            </div>

            {/* Leave Type Selector with Small Clean Balance Indicator */}
            <div className="apply-leave-field" style={{ marginTop: '14px' }}>
              <div className="apply-leave-label-row">
                <label className="apply-leave-label" htmlFor="leave-type-select">
                  Leave Type <span className="required-star">*</span>
                </label>
                {activeBalance && (
                  <span className="clean-balance-pill">
                    {formatDays(activeBalance.available_days)} days available
                  </span>
                )}
              </div>

              <select
                id="leave-type-select"
                className={`form-control apply-leave-select ${fieldErrors.leaveType ? 'has-error' : ''}`}
                value={selectedLeaveTypeId}
                onChange={e => setSelectedLeaveTypeId(e.target.value)}
                disabled={isSubmitting}
              >
                {leaveTypes.map(lt => (
                  <option key={lt.id} value={lt.id}>
                    {lt.name} ({lt.code}) {lt.is_paid ? '— Paid' : '— Unpaid'}
                  </option>
                ))}
              </select>
              {fieldErrors.leaveType && (
                <span className="apply-leave-field-error">{fieldErrors.leaveType}</span>
              )}
              {fieldErrors.balance && (
                <span className="apply-leave-field-error">{fieldErrors.balance}</span>
              )}

              {/* Subtle breakdown text */}
              {activeBalance && activeLeaveType?.is_paid && parseFloat(activeLeaveType.annual_allocation) > 0 && (
                <div className="apply-leave-subtle-stats">
                  Annual allocation: {formatDays(activeBalance.allocated_days)} days • Used: {formatDays(activeBalance.used_days)} days • Available: {formatDays(activeBalance.available_days)} days
                </div>
              )}
            </div>
          </div>

          {/* =============================================================== */}
          {/* SECTION 2: LEAVE DURATION                                       */}
          {/* =============================================================== */}
          <div className="apply-leave-section">
            <div className="apply-leave-section-label">Leave Duration</div>

            <div className="apply-leave-dates-row">
              {/* Start Date */}
              <div className="apply-leave-date-col">
                <label className="apply-leave-label" htmlFor="leave-start-date">
                  Start Date <span className="required-star">*</span>
                </label>
                <div className="date-input-container">
                  <input
                    id="leave-start-date"
                    type="date"
                    className={`form-control apply-leave-date-input ${fieldErrors.startDate ? 'has-error' : ''}`}
                    value={startDate}
                    onChange={e => {
                      setStartDate(e.target.value);
                      if (!endDate || new Date(endDate) < new Date(e.target.value)) {
                        setEndDate(e.target.value);
                      }
                      if (fieldErrors.startDate || fieldErrors.endDate) {
                        setFieldErrors(prev => ({ ...prev, startDate: null, endDate: null }));
                      }
                    }}
                    disabled={isSubmitting}
                  />
                </div>
                {fieldErrors.startDate && (
                  <span className="apply-leave-field-error">{fieldErrors.startDate}</span>
                )}
              </div>

              {/* End Date */}
              <div className="apply-leave-date-col">
                <label className="apply-leave-label" htmlFor="leave-end-date">
                  End Date <span className="required-star">*</span>
                </label>
                <div className="date-input-container">
                  <input
                    id="leave-end-date"
                    type="date"
                    className={`form-control apply-leave-date-input ${fieldErrors.endDate ? 'has-error' : ''}`}
                    value={endDate}
                    min={startDate}
                    onChange={e => {
                      setEndDate(e.target.value);
                      if (fieldErrors.endDate) {
                        setFieldErrors(prev => ({ ...prev, endDate: null }));
                      }
                    }}
                    disabled={isSubmitting}
                  />
                </div>
                {fieldErrors.endDate && (
                  <span className="apply-leave-field-error">{fieldErrors.endDate}</span>
                )}
              </div>

              {/* Prominent Highlighted Duration Card */}
              <div className="apply-leave-duration-col">
                <div className="duration-highlight-card">
                  <div className="duration-card-header">
                    <Clock size={13} className="duration-card-clock" />
                    <span>Duration</span>
                  </div>
                  <div className="duration-card-value">
                    {calculatedDays > 0 ? `${calculatedDays} Day${calculatedDays > 1 ? 's' : ''}` : '0 Days'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* =============================================================== */}
          {/* SECTION 3: REASON                                               */}
          {/* =============================================================== */}
          <div className="apply-leave-section">
            <div className="apply-leave-section-label">Reason</div>

            <div className="apply-leave-field">
              <label className="apply-leave-label" htmlFor="leave-reason-input">
                Reason for Leave <span className="required-star">*</span>
              </label>
              <textarea
                id="leave-reason-input"
                className={`form-control apply-leave-textarea ${fieldErrors.reason ? 'has-error' : ''}`}
                rows={3}
                placeholder="Briefly explain the reason for your leave..."
                value={reason}
                onChange={e => {
                  setReason(e.target.value);
                  if (fieldErrors.reason) {
                    setFieldErrors(prev => ({ ...prev, reason: null }));
                  }
                }}
                disabled={isSubmitting}
              />
              {fieldErrors.reason && (
                <span className="apply-leave-field-error">{fieldErrors.reason}</span>
              )}
            </div>
          </div>

          {/* =============================================================== */}
          {/* SECTION 4: OPTIONAL / ADDITIONAL INFORMATION                    */}
          {/* =============================================================== */}
          <div className="apply-leave-optional-section">
            <button
              type="button"
              className="apply-leave-optional-toggle"
              onClick={() => setShowOptionalSection(!showOptionalSection)}
            >
              <span>{showOptionalSection ? '−' : '+'} Additional information (optional)</span>
            </button>

            {showOptionalSection && (
              <div className="apply-leave-optional-content">
                <div className="apply-leave-field" style={{ marginBottom: '12px' }}>
                  <label className="apply-leave-label" style={{ fontSize: '0.8rem' }}>
                    Covering Faculty / Substitute
                  </label>
                  <input
                    type="text"
                    className="form-control apply-leave-input"
                    placeholder="e.g. Mr. Rajesh Sharma"
                    value={coveringFaculty}
                    onChange={e => setCoveringFaculty(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>

                <div className="apply-leave-field">
                  <label className="apply-leave-label" style={{ fontSize: '0.8rem' }}>
                    Additional Remarks / Emergency Contact
                  </label>
                  <input
                    type="text"
                    className="form-control apply-leave-input"
                    placeholder="e.g. Accessible via email or phone: +91 9876543210"
                    value={remarks}
                    onChange={e => setRemarks(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>
              </div>
            )}
          </div>

          {/* =============================================================== */}
          {/* MODAL FOOTER                                                    */}
          {/* =============================================================== */}
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
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <Check size={16} />
                  <span>Submit Leave Request</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ApplyLeaveModal;
