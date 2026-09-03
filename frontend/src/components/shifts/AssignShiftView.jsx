import React, { useState, useEffect, useMemo } from 'react';
import {
  CalendarClock,
  Clock,
  UserCheck,
  Building2,
  Calendar,
  History,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Search,
  RefreshCw,
  User,
  Filter,
  Check,
  X,
  Users,
  UserMinus,
  Eye,
  Info,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { hrmsApi } from '../../services/api';
import { StaffAvatar } from '../common/StaffAvatar';

export function AssignShiftView({
  employees = [],
  shifts = [],
  departments = [],
  onAssignmentCompleted,
  onNavigateToEmployee
}) {
  const { hasPermission, hasRole } = useAuth();
  const canAssign = hasPermission('shifts:assign') || hasRole('Super Admin', 'Administrator', 'HR');

  // Active Target Shift State (defaults to first active shift)
  const activeShifts = useMemo(() => shifts.filter(s => s.is_active), [shifts]);
  const [selectedShiftId, setSelectedShiftId] = useState('');

  // When shifts load, pick first active shift if none selected
  useEffect(() => {
    if (activeShifts.length > 0 && !selectedShiftId) {
      setSelectedShiftId(activeShifts[0].id);
    }
  }, [activeShifts, selectedShiftId]);

  // Selected Shift Object
  const currentShift = useMemo(() => {
    return shifts.find(s => s.id === selectedShiftId) || activeShifts[0] || null;
  }, [shifts, activeShifts, selectedShiftId]);

  // Selected Employee IDs for batch assignment
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState([]);

  // Assignment Form State
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');

  // Modals & Status States
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [successBanner, setSuccessBanner] = useState(null);

  // Available Employees Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('ALL');
  const [scopeFilter, setScopeFilter] = useState('ALL'); // 'ALL' | 'UNASSIGNED' | 'OTHER_SHIFTS'

  // Audit History State
  const [historyRecords, setHistoryRecords] = useState([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const [historySearchTerm, setHistorySearchTerm] = useState('');
  const [historyShiftFilter, setHistoryShiftFilter] = useState('ALL');
  const [selectedAuditRecord, setSelectedAuditRecord] = useState(null);

  // Right Panel Tab State: 'assigned' (current roster) | 'selected' (batch queue)
  const [rightPanelTab, setRightPanelTab] = useState('assigned');

  // Load audit history
  const fetchHistory = async () => {
    setIsHistoryLoading(true);
    try {
      const res = await hrmsApi.getShiftAssignmentHistory();
      if (res && res.success) {
        setHistoryRecords(res.data || []);
      }
    } catch (err) {
      console.warn('Failed to load shift history:', err);
    } finally {
      setIsHistoryLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  // Employees currently assigned to this target shift
  const currentShiftRoster = useMemo(() => {
    if (!currentShift) return [];
    return employees.filter(e => e.current_shift_id === currentShift.id);
  }, [employees, currentShift]);

  // Filtered available employees on left
  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      // 1. Scope filter
      if (scopeFilter === 'UNASSIGNED' && Boolean(emp.current_shift_id)) return false;
      if (scopeFilter === 'OTHER_SHIFTS' && (!emp.current_shift_id || emp.current_shift_id === currentShift?.id)) return false;

      // 2. Department filter
      if (departmentFilter !== 'ALL' && emp.department_id !== departmentFilter && emp.department_name !== departmentFilter) {
        return false;
      }

      // 3. Search query
      if (searchTerm.trim() !== '') {
        const term = searchTerm.toLowerCase().trim();
        const code = (emp.employee_code || '').toLowerCase();
        const first = (emp.first_name || '').toLowerCase();
        const last = (emp.last_name || '').toLowerCase();
        const full = `${first} ${last}`.trim();
        const dept = (emp.department_name || '').toLowerCase();
        const shiftName = (emp.shift_name || '').toLowerCase();
        return code.includes(term) || full.includes(term) || dept.includes(term) || shiftName.includes(term);
      }

      return true;
    });
  }, [employees, scopeFilter, departmentFilter, searchTerm, currentShift]);

  // Handle employee toggle in batch
  const handleToggleEmployee = (empId) => {
    setFormError(null);
    setSelectedEmployeeIds(prev => {
      if (prev.includes(empId)) {
        return prev.filter(id => id !== empId);
      } else {
        return [...prev, empId];
      }
    });
  };

  // Select all / deselect all
  const handleSelectAllFiltered = () => {
    const selectableIds = filteredEmployees
      .filter(e => e.current_shift_id !== currentShift?.id)
      .map(e => e.id);
    setSelectedEmployeeIds(selectableIds);
  };

  const handleDeselectAll = () => {
    setSelectedEmployeeIds([]);
  };

  // Check if any selected employee is being reassigned from another shift
  const reassignedEmployees = useMemo(() => {
    return employees.filter(
      e => selectedEmployeeIds.includes(e.id) && e.current_shift_id && e.current_shift_id !== currentShift?.id
    );
  }, [employees, selectedEmployeeIds, currentShift]);

  // Initiate Assignment
  const handleInitiateAssignment = () => {
    setFormError(null);
    if (!currentShift) {
      setFormError('Please select a target work shift.');
      return;
    }
    if (selectedEmployeeIds.length === 0) {
      setFormError('Please select at least one employee from the list.');
      return;
    }
    setShowConfirmModal(true);
  };

  // Execute Assignment
  const handleExecuteAssignment = async () => {
    setIsSubmitting(true);
    setFormError(null);

    try {
      // Execute assignments sequentially or via Promise.all
      const promises = selectedEmployeeIds.map(empId =>
        hrmsApi.assignEmployeeShift({
          employee_id: empId,
          shift_id: currentShift.id,
          start_date: startDate,
          end_date: endDate || null,
          reason: reason.trim() || 'Work schedule assignment'
        })
      );

      await Promise.all(promises);

      const count = selectedEmployeeIds.length;
      setSuccessBanner(`${count} employee${count > 1 ? 's have' : ' has'} been assigned to '${currentShift.name}'.`);
      setSelectedEmployeeIds([]);
      setShowConfirmModal(false);
      setReason('');
      setEndDate('');

      fetchHistory();
      if (onAssignmentCompleted) {
        onAssignmentCompleted();
      }
    } catch (err) {
      console.error('Shift assignment error:', err);
      setFormError(err.message || 'Failed to complete assignment.');
      setShowConfirmModal(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtered Audit History
  const filteredHistory = useMemo(() => {
    return historyRecords.filter(item => {
      if (historyShiftFilter !== 'ALL' && item.shift_id !== historyShiftFilter && item.shift_name !== historyShiftFilter) {
        return false;
      }
      if (historySearchTerm.trim() !== '') {
        const term = historySearchTerm.toLowerCase().trim();
        const emp = (item.employee_name || '').toLowerCase();
        const code = (item.employee_code || '').toLowerCase();
        const shift = (item.shift_name || '').toLowerCase();
        const r = (item.reason || '').toLowerCase();
        return emp.includes(term) || code.includes(term) || shift.includes(term) || r.includes(term);
      }
      return true;
    });
  }, [historyRecords, historyShiftFilter, historySearchTerm]);

  return (
    <div className="assign-page-wrapper" style={{ width: '100%', boxSizing: 'border-box' }}>
      {/* 1. Page Header */}
      <div className="page-header-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 4px 0' }}>
            Assign Employees
          </h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
            Assign staff members to their appropriate work schedule.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={fetchHistory}
            title="Refresh shift assignments and audit logs"
          >
            <RefreshCw size={14} className={isHistoryLoading ? 'spin-animation' : ''} />
            <span>Sync Records</span>
          </button>
        </div>
      </div>

      {/* 2. Target Shift Selection & Compact Summary Card */}
      <div className="table-wrapper-card" style={{ padding: '16px 20px', marginBottom: '20px', backgroundColor: '#ffffff' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, minWidth: '280px' }}>
            <label htmlFor="target-shift-picker" style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
              Target Work Shift:
            </label>
            <select
              id="target-shift-picker"
              className="filter-select"
              style={{ flex: 1, maxWidth: '380px', fontWeight: 600 }}
              value={selectedShiftId}
              onChange={(e) => {
                setSelectedShiftId(e.target.value);
                setSelectedEmployeeIds([]);
                setFormError(null);
              }}
            >
              {activeShifts.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.code})
                </option>
              ))}
            </select>
          </div>

          {currentShift && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                <Clock size={14} className="text-primary" />
                <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                  {currentShift.start_time_formatted || currentShift.start_time?.slice(0, 5)} – {currentShift.end_time_formatted || currentShift.end_time?.slice(0, 5)}
                </span>
              </div>
              <span className="code-badge" style={{ backgroundColor: '#eff6ff', color: '#1d4ed8', borderColor: '#bfdbfe' }}>
                {Array.isArray(currentShift.working_days) ? `${currentShift.working_days.length} Days / Week` : 'Mon–Fri'}
              </span>
              <span className="code-badge" style={{ backgroundColor: '#ecfdf5', color: '#047857', borderColor: '#a7f3d0' }}>
                <Users size={12} style={{ display: 'inline', marginRight: '4px' }} />
                {currentShiftRoster.length} Assigned
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Success Notification Banner */}
      {successBanner && (
        <div className="assign-alert-banner success-banner" style={{ marginBottom: '20px' }}>
          <CheckCircle2 size={18} className="alert-banner-icon" />
          <div className="alert-banner-content" style={{ fontSize: '0.86rem' }}>
            <strong>Schedule Updated:</strong> {successBanner}
          </div>
          <button
            type="button"
            className="alert-banner-close"
            onClick={() => setSuccessBanner(null)}
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* 3. Main Two-Column Assignment Workspace */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)', gap: '20px', marginBottom: '28px' }}>
        
        {/* LEFT COLUMN: Available Employees */}
        <div className="table-wrapper-card" style={{ display: 'flex', flexDirection: 'column', height: '620px' }}>
          {/* Header & Controls */}
          <div className="filters-card" style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-light)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <User size={16} className="text-primary" />
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                  Available Employees
                </h3>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-ghost btn-xs"
                  onClick={handleSelectAllFiltered}
                  style={{ fontSize: '0.74rem' }}
                >
                  Select All
                </button>
                {selectedEmployeeIds.length > 0 && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs"
                    onClick={handleDeselectAll}
                    style={{ fontSize: '0.74rem' }}
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Search Input */}
            <div className="search-input-wrapper" style={{ marginBottom: '10px' }}>
              <Search className="search-icon" size={16} />
              <input
                type="text"
                className="search-input"
                style={{ padding: '7px 32px 7px 34px', fontSize: '0.82rem' }}
                placeholder="Search staff by name, code, dept..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button
                  type="button"
                  className="search-clear-btn"
                  onClick={() => setSearchTerm('')}
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Filter Row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              {/* Department Filter */}
              <select
                className="filter-select"
                style={{ padding: '5px 10px', fontSize: '0.76rem', flex: 1 }}
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
              >
                <option value="ALL">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>

              {/* Scope Pills */}
              <div className="filter-pill-group">
                <button
                  type="button"
                  className={`filter-pill ${scopeFilter === 'ALL' ? 'active' : ''}`}
                  style={{ padding: '4px 8px', fontSize: '0.72rem' }}
                  onClick={() => setScopeFilter('ALL')}
                >
                  All Staff
                </button>
                <button
                  type="button"
                  className={`filter-pill ${scopeFilter === 'UNASSIGNED' ? 'active' : ''}`}
                  style={{ padding: '4px 8px', fontSize: '0.72rem' }}
                  onClick={() => setScopeFilter('UNASSIGNED')}
                >
                  Unassigned
                </button>
                <button
                  type="button"
                  className={`filter-pill ${scopeFilter === 'OTHER_SHIFTS' ? 'active' : ''}`}
                  style={{ padding: '4px 8px', fontSize: '0.72rem' }}
                  onClick={() => setScopeFilter('OTHER_SHIFTS')}
                >
                  Other Shifts
                </button>
              </div>
            </div>
          </div>

          {/* Scrollable Employee Selection List */}
          <div style={{ overflowY: 'auto', flex: 1, padding: '8px' }}>
            {filteredEmployees.length === 0 ? (
              <div style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <UserMinus size={28} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
                <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600 }}>No employees match criteria</p>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.76rem' }}>Try clearing search or filters.</p>
              </div>
            ) : (
              filteredEmployees.map((emp) => {
                const isSelected = selectedEmployeeIds.includes(emp.id);
                const isAlreadyOnCurrentShift = emp.current_shift_id === currentShift?.id;
                const isAssignedToOther = emp.current_shift_id && !isAlreadyOnCurrentShift;
                const fullName = [emp.first_name, emp.middle_name, emp.last_name].filter(Boolean).join(' ');

                return (
                  <div
                    key={emp.id}
                    onClick={() => !isAlreadyOnCurrentShift && handleToggleEmployee(emp.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 12px',
                      borderRadius: '6px',
                      marginBottom: '6px',
                      cursor: isAlreadyOnCurrentShift ? 'default' : 'pointer',
                      border: isSelected ? '1.5px solid var(--color-primary)' : '1px solid var(--border-light)',
                      backgroundColor: isSelected ? '#f5f7ff' : isAlreadyOnCurrentShift ? '#f8fafc' : '#ffffff',
                      opacity: isAlreadyOnCurrentShift ? 0.75 : 1,
                      transition: 'all 0.12s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                      <input
                        type="checkbox"
                        checked={isSelected || isAlreadyOnCurrentShift}
                        disabled={isAlreadyOnCurrentShift}
                        onChange={() => handleToggleEmployee(emp.id)}
                        onClick={(e) => e.stopPropagation()}
                        style={{ width: '16px', height: '16px', accentColor: 'var(--color-primary)', cursor: isAlreadyOnCurrentShift ? 'default' : 'pointer' }}
                      />
                      <StaffAvatar
                        firstName={emp.first_name}
                        lastName={emp.last_name}
                        photoUrl={emp.profile_photo_url}
                        size="sm"
                      />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.84rem', color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {fullName}
                          </span>
                          <span className="code-badge" style={{ fontSize: '0.68rem', padding: '1px 5px' }}>
                            {emp.employee_code}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          <span>{emp.department_name || 'Academic Faculty'}</span>
                          {isAlreadyOnCurrentShift ? (
                            <span style={{ color: '#059669', fontWeight: 600 }}>• Assigned to this Shift</span>
                          ) : isAssignedToOther ? (
                            <span style={{ color: '#d97706', fontWeight: 600 }}>• Currently: {emp.shift_name}</span>
                          ) : (
                            <span style={{ color: '#64748b' }}>• Unassigned</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div style={{ flexShrink: 0 }}>
                      {isAlreadyOnCurrentShift ? (
                        <span className="status-pill badge-active" style={{ fontSize: '0.68rem', padding: '2px 6px' }}>
                          Current
                        </span>
                      ) : (
                        <button
                          type="button"
                          className={`btn ${isSelected ? 'btn-primary' : 'btn-secondary'} btn-xs`}
                          style={{ fontSize: '0.72rem', padding: '3px 8px' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleEmployee(emp.id);
                          }}
                        >
                          {isSelected ? 'Selected' : 'Select'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Assigned Roster & Selected Batch Queue */}
        <div className="table-wrapper-card" style={{ display: 'flex', flexDirection: 'column', height: '620px' }}>
          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border-light)', backgroundColor: '#f8fafc' }}>
            <button
              type="button"
              onClick={() => setRightPanelTab('assigned')}
              style={{
                flex: 1,
                padding: '12px 16px',
                fontSize: '0.84rem',
                fontWeight: rightPanelTab === 'assigned' ? 700 : 500,
                color: rightPanelTab === 'assigned' ? 'var(--color-primary)' : 'var(--text-muted)',
                borderBottom: rightPanelTab === 'assigned' ? '2px solid var(--color-primary)' : 'none',
                backgroundColor: rightPanelTab === 'assigned' ? '#ffffff' : 'transparent',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              Assigned to this Shift ({currentShiftRoster.length})
            </button>
            <button
              type="button"
              onClick={() => setRightPanelTab('selected')}
              style={{
                flex: 1,
                padding: '12px 16px',
                fontSize: '0.84rem',
                fontWeight: rightPanelTab === 'selected' ? 700 : 500,
                color: rightPanelTab === 'selected' ? 'var(--color-primary)' : 'var(--text-muted)',
                borderBottom: rightPanelTab === 'selected' ? '2px solid var(--color-primary)' : 'none',
                backgroundColor: rightPanelTab === 'selected' ? '#ffffff' : 'transparent',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              Selected Queue ({selectedEmployeeIds.length})
            </button>
          </div>

          {/* TAB 1: Assigned to this Shift */}
          {rightPanelTab === 'assigned' && (
            <div style={{ overflowY: 'auto', flex: 1, padding: '12px' }}>
              {currentShiftRoster.length === 0 ? (
                <div style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <Users size={28} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
                  <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600 }}>No employees currently assigned</p>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.76rem' }}>Select employees on the left to assign them to this schedule.</p>
                </div>
              ) : (
                currentShiftRoster.map((emp) => {
                  const fullName = [emp.first_name, emp.middle_name, emp.last_name].filter(Boolean).join(' ');
                  return (
                    <div
                      key={emp.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 12px',
                        borderRadius: '6px',
                        marginBottom: '6px',
                        border: '1px solid var(--border-light)',
                        backgroundColor: '#ffffff'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <StaffAvatar
                          firstName={emp.first_name}
                          lastName={emp.last_name}
                          photoUrl={emp.profile_photo_url}
                          size="sm"
                        />
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontWeight: 700, fontSize: '0.84rem', color: 'var(--text-main)' }}>
                              {fullName}
                            </span>
                            <span className="code-badge" style={{ fontSize: '0.68rem', padding: '1px 5px' }}>
                              {emp.employee_code}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                            {emp.designation_name || 'Staff Member'} • {emp.department_name || 'Academic'}
                          </div>
                        </div>
                      </div>

                      <span className="status-pill badge-active" style={{ fontSize: '0.72rem' }}>
                        <span className="status-dot"></span>
                        <span>Active</span>
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* TAB 2: Selected Queue & Assignment Options */}
          {rightPanelTab === 'selected' && (
            <div style={{ overflowY: 'auto', flex: 1, padding: '16px', display: 'flex', flexDirection: 'column' }}>
              {selectedEmployeeIds.length === 0 ? (
                <div style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)', flex: 1 }}>
                  <UserCheck size={28} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
                  <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600 }}>No employees selected yet</p>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.76rem' }}>Select employees from the left panel to configure assignment.</p>
                </div>
              ) : (
                <div style={{ flex: 1 }}>
                  {/* Reassignment Warning */}
                  {reassignedEmployees.length > 0 && (
                    <div className="assign-same-warning" style={{ marginBottom: '14px' }}>
                      <AlertCircle size={16} />
                      <span>
                        <strong>Note:</strong> {reassignedEmployees.length} selected employee(s) will be transferred from their existing work shift.
                      </span>
                    </div>
                  )}

                  {/* Selected Chips */}
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>
                      Selected Staff ({selectedEmployeeIds.length}):
                    </label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxHeight: '120px', overflowY: 'auto', padding: '4px' }}>
                      {selectedEmployeeIds.map(id => {
                        const emp = employees.find(e => e.id === id);
                        if (!emp) return null;
                        return (
                          <span
                            key={id}
                            className="code-badge"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: '#eef2ff', color: '#3730a3', borderColor: '#c7d2fe', padding: '3px 8px' }}
                          >
                            <span>{emp.first_name} {emp.last_name || ''} ({emp.employee_code})</span>
                            <X
                              size={12}
                              style={{ cursor: 'pointer' }}
                              onClick={() => handleToggleEmployee(id)}
                            />
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  {/* Form Parameters */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '12px' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" htmlFor="assign-start-date">
                        Effective From Date <span className="text-danger">*</span>
                      </label>
                      <input
                        type="date"
                        id="assign-start-date"
                        className="form-input"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        disabled={isSubmitting}
                        required
                      />
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" htmlFor="assign-end-date">
                        Effective Until Date
                      </label>
                      <input
                        type="date"
                        id="assign-end-date"
                        className="form-input"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" htmlFor="assign-reason">
                      Assignment Remarks / Reason
                    </label>
                    <input
                      type="text"
                      id="assign-reason"
                      className="form-input"
                      placeholder="e.g. Academic term rotation, workload reallocation"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      disabled={isSubmitting}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Sticky Assignment Action Footer */}
          <div style={{ padding: '14px 18px', borderTop: '1px solid var(--border-light)', backgroundColor: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-main)' }}>
              {selectedEmployeeIds.length} employee{selectedEmployeeIds.length !== 1 ? 's' : ''} selected
            </span>

            <div style={{ display: 'flex', gap: '8px' }}>
              {selectedEmployeeIds.length > 0 && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleDeselectAll}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
              )}
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleInitiateAssignment}
                disabled={!canAssign || isSubmitting || selectedEmployeeIds.length === 0}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={14} className="spin-animation" />
                    <span>Assigning...</span>
                  </>
                ) : (
                  <span>Assign to {currentShift?.code || 'Shift'}</span>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Assignment Audit Trail (Part 3) */}
      <div className="table-wrapper-card" style={{ marginTop: '32px' }}>
        <div className="filters-card" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-light)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0 0 2px 0', color: 'var(--text-main)' }}>
                Work Schedule Assignment History
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                Track employee shift assignments and historical schedule transitions.
              </p>
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={fetchHistory}
              disabled={isHistoryLoading}
            >
              <RefreshCw size={13} className={isHistoryLoading ? 'spin-animation' : ''} />
              <span>Refresh History</span>
            </button>
          </div>

          {/* Audit Search Toolbar */}
          <div className="filters-row">
            <div className="search-input-wrapper" style={{ flex: 1, minWidth: '260px' }}>
              <Search className="search-icon" size={16} />
              <input
                type="text"
                className="search-input"
                style={{ padding: '7px 32px 7px 34px', fontSize: '0.82rem' }}
                placeholder="Search employee name, code, shift, remarks..."
                value={historySearchTerm}
                onChange={(e) => setHistorySearchTerm(e.target.value)}
              />
              {historySearchTerm && (
                <button
                  type="button"
                  className="search-clear-btn"
                  onClick={() => setHistorySearchTerm('')}
                >
                  <X size={13} />
                </button>
              )}
            </div>

            <div className="filter-select-wrapper">
              <label className="filter-label">
                <Filter size={13} />
                <span>Shift:</span>
              </label>
              <select
                className="filter-select"
                style={{ padding: '6px 10px', fontSize: '0.8rem' }}
                value={historyShiftFilter}
                onChange={(e) => setHistoryShiftFilter(e.target.value)}
              >
                <option value="ALL">All Shifts</option>
                {shifts.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Audit Table */}
        {isHistoryLoading ? (
          <div style={{ padding: '36px', textAlign: 'center' }}>
            <Loader2 size={24} className="spin-animation text-primary" style={{ margin: '0 auto 8px' }} />
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>Loading assignment records...</p>
          </div>
        ) : filteredHistory.length === 0 ? (
          <div style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <History size={28} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
            <p style={{ margin: 0, fontSize: '0.88rem', fontWeight: 600 }}>No assignment history records found</p>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.78rem' }}>When shifts are assigned, audit logs will be preserved here.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="employee-table">
              <thead>
                <tr>
                  <th style={{ minWidth: '180px' }}>Employee</th>
                  <th style={{ minWidth: '110px' }}>Employee Code</th>
                  <th style={{ minWidth: '180px' }}>Work Shift</th>
                  <th style={{ minWidth: '140px' }}>Working Hours</th>
                  <th style={{ minWidth: '120px' }}>Effective Date</th>
                  <th style={{ minWidth: '180px' }}>Reason / Remarks</th>
                  <th style={{ minWidth: '100px' }}>Changed By</th>
                  <th className="th-actions" style={{ minWidth: '80px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredHistory.map((item) => (
                  <tr key={item.id} className="employee-table-row">
                    <td className="cell-name">
                      <span style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.86rem' }}>
                        {item.employee_name}
                      </span>
                    </td>
                    <td className="cell-code">
                      <span className="code-badge">{item.employee_code}</span>
                    </td>
                    <td className="cell-dept">
                      <span style={{ fontWeight: 600, color: '#1e40af', fontSize: '0.84rem' }}>
                        {item.shift_name}
                      </span>
                    </td>
                    <td className="cell-hours">
                      <span style={{ fontSize: '0.82rem', color: 'var(--text-main)' }}>
                        {item.start_time_formatted || item.start_time?.slice(0, 5)} – {item.end_time_formatted || item.end_time?.slice(0, 5)}
                      </span>
                    </td>
                    <td className="cell-date">
                      <span style={{ fontSize: '0.82rem', color: 'var(--text-main)' }}>
                        {item.start_date ? new Date(item.start_date).toLocaleDateString() : '—'}
                      </span>
                    </td>
                    <td>
                      <span
                        className="text-muted text-xs"
                        style={{ display: 'block', maxWidth: '180px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                        title={item.reason}
                      >
                        {item.reason || 'Work schedule assignment'}
                      </span>
                    </td>
                    <td>
                      <span className="code-badge" style={{ fontSize: '0.72rem' }}>
                        Admin
                      </span>
                    </td>
                    <td className="cell-actions" style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className="btn-action-icon btn-view-icon"
                        onClick={() => setSelectedAuditRecord(item)}
                        title="View audit record details"
                        aria-label="View audit record details"
                      >
                        <Eye size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 5. Confirmation Modal Before Batch Assignment */}
      {showConfirmModal && currentShift && (
        <div className="modal-backdrop" onClick={() => !isSubmitting && setShowConfirmModal(false)}>
          <div className="modal-container modal-dialog-confirm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-header-icon-title">
                <div className="icon-badge-primary">
                  <CalendarClock size={20} />
                </div>
                <div>
                  <h3 className="modal-title">Confirm Shift Assignment</h3>
                  <p className="modal-subtitle">
                    Target: {currentShift.name} (<code>{currentShift.code}</code>)
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowConfirmModal(false)}
                disabled={isSubmitting}
              >
                <X size={20} />
              </button>
            </div>

            <div className="modal-body-dialog">
              <p className="dialog-explanation">
                Assign <strong>{selectedEmployeeIds.length} staff member{selectedEmployeeIds.length > 1 ? 's' : ''}</strong> to <strong>{currentShift.name}</strong> ({currentShift.start_time_formatted || currentShift.start_time?.slice(0, 5)} – {currentShift.end_time_formatted || currentShift.end_time?.slice(0, 5)})?
              </p>

              {reassignedEmployees.length > 0 && (
                <div className="assign-same-warning" style={{ marginBottom: '14px' }}>
                  <AlertCircle size={16} />
                  <span>
                    <strong>Warning:</strong> {reassignedEmployees.length} staff member(s) will be transferred from their current work schedule.
                  </span>
                </div>
              )}

              <div className="confirm-details-box">
                <div className="confirm-detail-row">
                  <span className="confirm-label">Effective From:</span>
                  <span className="confirm-value">{new Date(startDate).toLocaleDateString()}</span>
                </div>
                {endDate && (
                  <div className="confirm-detail-row">
                    <span className="confirm-label">Effective Until:</span>
                    <span className="confirm-value">{new Date(endDate).toLocaleDateString()}</span>
                  </div>
                )}
                {reason && (
                  <div className="confirm-detail-row">
                    <span className="confirm-label">Remarks:</span>
                    <span className="confirm-value">{reason}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowConfirmModal(false)}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleExecuteAssignment}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={16} className="spin-animation" />
                    <span>Assigning...</span>
                  </>
                ) : (
                  <span>Confirm Assignment</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Audit Record Details Modal (Part 3.D) */}
      {selectedAuditRecord && (
        <div className="modal-backdrop" onClick={() => setSelectedAuditRecord(null)}>
          <div className="modal-container" style={{ maxWidth: '520px', width: '90%' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-header-icon-title">
                <div className="stat-icon-badge stat-slate" style={{ width: '36px', height: '36px' }}>
                  <History size={18} />
                </div>
                <div>
                  <h3 className="modal-title" style={{ fontSize: '1.05rem', margin: 0 }}>
                    Assignment Audit Record
                  </h3>
                  <p className="modal-subtitle" style={{ fontSize: '0.78rem', margin: '2px 0 0 0' }}>
                    Staff Code: <code>{selectedAuditRecord.employee_code}</code>
                  </p>
                </div>
              </div>
              <button type="button" className="modal-close-btn" onClick={() => setSelectedAuditRecord(null)}>
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '20px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid var(--border-light)' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Staff Member</span>
                  <span style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-main)' }}>{selectedAuditRecord.employee_name}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid var(--border-light)' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Assigned Shift</span>
                  <span style={{ fontSize: '0.84rem', fontWeight: 700, color: '#1e40af' }}>{selectedAuditRecord.shift_name} ({selectedAuditRecord.shift_code})</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid var(--border-light)' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Working Hours</span>
                  <span style={{ fontSize: '0.84rem', color: 'var(--text-main)' }}>
                    {selectedAuditRecord.start_time_formatted || selectedAuditRecord.start_time?.slice(0, 5)} – {selectedAuditRecord.end_time_formatted || selectedAuditRecord.end_time?.slice(0, 5)}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid var(--border-light)' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Effective Date</span>
                  <span style={{ fontSize: '0.84rem', color: 'var(--text-main)' }}>
                    {selectedAuditRecord.start_date ? new Date(selectedAuditRecord.start_date).toLocaleDateString() : '—'}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid var(--border-light)' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Reason / Remarks</span>
                  <span style={{ fontSize: '0.84rem', color: 'var(--text-main)', textAlign: 'right', maxWidth: '260px' }}>
                    {selectedAuditRecord.reason || 'Work schedule assignment'}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Changed By</span>
                  <span style={{ fontSize: '0.84rem', color: 'var(--text-main)' }}>Administrator (HRMS)</span>
                </div>
              </div>
            </div>

            <div className="modal-footer" style={{ padding: '12px 20px' }}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSelectedAuditRecord(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AssignShiftView;
