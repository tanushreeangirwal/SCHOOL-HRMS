import React, { useState, useEffect, useMemo } from 'react';
import { 
  UserCheck, 
  Building2, 
  Calendar, 
  ArrowDown, 
  ArrowRight, 
  History, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Search, 
  RefreshCw, 
  User, 
  Clock, 
  Filter, 
  Check, 
  X, 
  Briefcase, 
  Users, 
  UserMinus,
  HelpCircle,
  FileText
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { hrmsApi } from '../../services/api';
import { StaffAvatar } from '../common/StaffAvatar';

export function AssignEmployeeView({
  employees = [],
  departments = [],
  designations = [],
  onAssignmentCompleted,
  onNavigateToEmployee
}) {
  const { hasPermission, hasRole } = useAuth();
  const canAssignStaff = hasPermission('departments:assign') || hasRole('Super Admin', 'Administrator', 'HR');

  // Selection & Form State
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [targetDepartmentId, setTargetDepartmentId] = useState('');
  const [effectiveDate, setEffectiveDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [reason, setReason] = useState('');

  // Confirmation Modal State
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [successBanner, setSuccessBanner] = useState(null);

  // Filters for Employee List
  const [searchTerm, setSearchTerm] = useState('');
  const [assignmentFilter, setAssignmentFilter] = useState('ALL'); // 'ALL' | 'ASSIGNED' | 'UNASSIGNED'
  const [departmentFilter, setDepartmentFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [designationFilter, setDesignationFilter] = useState('ALL');

  // History State
  const [historyRecords, setHistoryRecords] = useState([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const [historySearchTerm, setHistorySearchTerm] = useState('');
  const [activeHistoryTab, setActiveHistoryTab] = useState('all'); // 'all' | 'selected'

  // Load audit history from backend
  const fetchHistory = async () => {
    setIsHistoryLoading(true);
    try {
      const res = await hrmsApi.getDepartmentAssignmentHistory();
      if (res && res.success) {
        setHistoryRecords(res.data || []);
      }
    } catch (err) {
      console.warn('Failed to load assignment history:', err);
    } finally {
      setIsHistoryLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  // Summary KPIs (Calculated dynamically from real database records)
  const stats = useMemo(() => {
    const total = employees.length;
    const assigned = employees.filter(e => Boolean(e.department_id)).length;
    const unassigned = employees.filter(e => !e.department_id).length;
    const transfersCount = historyRecords.length;
    return { total, assigned, unassigned, transfersCount };
  }, [employees, historyRecords]);

  // Find currently selected employee object
  const selectedEmployee = useMemo(() => {
    return employees.find(e => e.id === selectedEmployeeId) || null;
  }, [employees, selectedEmployeeId]);

  // Find target department object
  const targetDepartment = useMemo(() => {
    return departments.find(d => d.id === targetDepartmentId) || null;
  }, [departments, targetDepartmentId]);

  // Filtered employee list
  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      // 1. Assignment Filter
      if (assignmentFilter === 'ASSIGNED' && !emp.department_id) return false;
      if (assignmentFilter === 'UNASSIGNED' && Boolean(emp.department_id)) return false;

      // 2. Department Filter
      if (departmentFilter !== 'ALL') {
        if (departmentFilter === 'UNASSIGNED') {
          if (Boolean(emp.department_id)) return false;
        } else if (emp.department_id !== departmentFilter) {
          return false;
        }
      }

      // 3. Status Filter
      if (statusFilter !== 'ALL') {
        const empStatus = (emp.employment_status || '').toLowerCase();
        if (empStatus !== statusFilter.toLowerCase()) return false;
      }

      // 4. Designation Filter
      if (designationFilter !== 'ALL') {
        if (emp.designation_id !== designationFilter && emp.designation_name !== designationFilter) {
          return false;
        }
      }

      // 5. Search Term
      if (searchTerm.trim() !== '') {
        const term = searchTerm.toLowerCase().trim();
        const code = (emp.employee_code || '').toLowerCase();
        const first = (emp.first_name || '').toLowerCase();
        const last = (emp.last_name || '').toLowerCase();
        const full = `${first} ${last}`.trim();
        const email = (emp.work_email || emp.personal_email || '').toLowerCase();
        const dept = (emp.department_name || emp.department || '').toLowerCase();
        const desig = (emp.designation_name || emp.designation || '').toLowerCase();

        return code.includes(term) || full.includes(term) || email.includes(term) || dept.includes(term) || desig.includes(term);
      }

      return true;
    });
  }, [employees, assignmentFilter, departmentFilter, statusFilter, designationFilter, searchTerm]);

  // Selected Employee's Specific History
  const selectedEmployeeHistory = useMemo(() => {
    if (!selectedEmployeeId) return [];
    return historyRecords.filter(h => h.employee_id === selectedEmployeeId);
  }, [historyRecords, selectedEmployeeId]);

  // School-wide Filtered History
  const filteredHistory = useMemo(() => {
    let records = historyRecords;
    if (activeHistoryTab === 'selected' && selectedEmployeeId) {
      records = selectedEmployeeHistory;
    }
    if (!historySearchTerm.trim()) return records;
    const term = historySearchTerm.toLowerCase().trim();
    return records.filter(h => {
      const emp = (h.employee_name || '').toLowerCase();
      const code = (h.employee_code || '').toLowerCase();
      const dept = (h.department_name || '').toLowerCase();
      const prev = (h.previous_department_name || '').toLowerCase();
      const r = (h.reason || '').toLowerCase();
      return emp.includes(term) || code.includes(term) || dept.includes(term) || prev.includes(term) || r.includes(term);
    });
  }, [historyRecords, historySearchTerm, activeHistoryTab, selectedEmployeeId, selectedEmployeeHistory]);

  const isFilterActive = searchTerm.trim() !== '' || assignmentFilter !== 'ALL' || departmentFilter !== 'ALL' || statusFilter !== 'ALL' || designationFilter !== 'ALL';

  const handleResetFilters = () => {
    setSearchTerm('');
    setAssignmentFilter('ALL');
    setDepartmentFilter('ALL');
    setStatusFilter('ALL');
    setDesignationFilter('ALL');
  };

  const handleSelectEmployee = (emp) => {
    setSelectedEmployeeId(emp.id);
    setTargetDepartmentId('');
    setFormError(null);
    setSuccessBanner(null);
  };

  const handleInitiateAssignment = (e) => {
    e.preventDefault();
    setFormError(null);
    setSuccessBanner(null);

    if (!selectedEmployeeId) {
      setFormError('Please select a faculty/staff member from the list.');
      return;
    }

    if (!targetDepartmentId) {
      setFormError('Please select a target department to assign this employee to.');
      return;
    }

    // Validation: Prevent duplicate assignment to same department
    if (selectedEmployee && selectedEmployee.department_id === targetDepartmentId) {
      setFormError(`This employee is already assigned to this department.`);
      return;
    }

    // Open confirmation dialog
    setShowConfirmModal(true);
  };

  const handleExecuteAssignment = async () => {
    setIsSubmitting(true);
    setFormError(null);

    try {
      const payload = {
        employee_id: selectedEmployeeId,
        department_id: targetDepartmentId,
        effective_date: effectiveDate,
        reason: reason.trim() || 'Department assignment transfer'
      };

      const res = await hrmsApi.assignEmployeeToDepartment(payload);

      if (res && res.success) {
        const empName = `${selectedEmployee?.first_name} ${selectedEmployee?.last_name || ''}`.trim();
        const targetDeptName = targetDepartment?.name || 'the new department';

        setSuccessBanner(`${empName} has been assigned to ${targetDeptName}.`);
        setShowConfirmModal(false);
        setReason('');
        
        // Refresh local history and trigger app-wide data refresh
        fetchHistory();
        if (onAssignmentCompleted) {
          onAssignmentCompleted();
        }
      } else {
        throw new Error(res?.message || 'Failed to complete department assignment.');
      }
    } catch (err) {
      console.error('Assignment error:', err);
      setFormError(err.message || 'Failed to complete department assignment.');
      setShowConfirmModal(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="assign-page-wrapper">
      {/* 1. PAGE HEADER */}
      <div className="assign-header-card">
        <div className="assign-header-main">
          <div className="assign-header-icon-box">
            <UserCheck size={26} />
          </div>
          <div>
            <h1 className="assign-page-title">Assign Employees</h1>
            <p className="assign-page-subtitle">
              Assign employees to departments and manage their current assignments.
            </p>
          </div>
        </div>
        <div className="assign-header-actions">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={fetchHistory}
            title="Refresh assignment history and counts"
          >
            <RefreshCw size={14} className={isHistoryLoading ? 'spin-animation' : ''} />
            <span>Sync Records</span>
          </button>
        </div>
      </div>

      {/* 2. SUMMARY KPI CARDS */}
      <div className="assign-kpi-grid">
        {/* Total Workforce */}
        <div className="assign-kpi-card">
          <div className="kpi-icon-wrapper bg-blue-light">
            <Users size={20} className="text-blue" />
          </div>
          <div className="kpi-details">
            <span className="kpi-label">Total Employees</span>
            <span className="kpi-value">{stats.total}</span>
            <span className="kpi-subtext">Active school personnel</span>
          </div>
        </div>

        {/* Assigned Employees */}
        <div className="assign-kpi-card">
          <div className="kpi-icon-wrapper bg-emerald-light">
            <CheckCircle2 size={20} className="text-emerald" />
          </div>
          <div className="kpi-details">
            <span className="kpi-label">Assigned Employees</span>
            <span className="kpi-value text-emerald">{stats.assigned}</span>
            <span className="kpi-subtext">Placed in active departments</span>
          </div>
        </div>

        {/* Unassigned Employees */}
        <div className="assign-kpi-card">
          <div className="kpi-icon-wrapper bg-amber-light">
            <UserMinus size={20} className="text-amber" />
          </div>
          <div className="kpi-details">
            <span className="kpi-label">Unassigned Employees</span>
            <span className="kpi-value text-amber">{stats.unassigned}</span>
            <span className="kpi-subtext">
              {stats.unassigned > 0 ? 'Pending departmental assignment' : 'All employees assigned'}
            </span>
          </div>
        </div>

        {/* Total Transfers / Audit Entries */}
        <div className="assign-kpi-card">
          <div className="kpi-icon-wrapper bg-purple-light">
            <History size={20} className="text-purple" />
          </div>
          <div className="kpi-details">
            <span className="kpi-label">Recently Assigned</span>
            <span className="kpi-value text-purple">{stats.transfersCount}</span>
            <span className="kpi-subtext">Logged in audit history</span>
          </div>
        </div>
      </div>

      {/* Success Notification Banner */}
      {successBanner && (
        <div className="assign-alert-banner success-banner">
          <CheckCircle2 size={20} className="alert-banner-icon" />
          <div className="alert-banner-content">
            <strong>Assignment Successful:</strong> {successBanner}
          </div>
          <button 
            type="button" 
            className="alert-banner-close" 
            onClick={() => setSuccessBanner(null)}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* 3. MAIN ASSIGNMENT WORKSPACE (Split Grid) */}
      <div className="assign-workspace-grid">
        {/* LEFT COLUMN: EMPLOYEE SELECTION ROSTER */}
        <div className="assign-roster-column">
          <div className="roster-card">
            {/* Roster Controls & Filters */}
            <div className="roster-card-header">
              <div className="roster-header-title-row">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <User size={18} className="text-primary" />
                  <h2 className="roster-title">Select Faculty / Staff</h2>
                </div>
                <span className="roster-count-badge">
                  {filteredEmployees.length} of {employees.length} Staff
                </span>
              </div>

              {/* Search Bar */}
              <div className="search-input-wrapper" style={{ marginTop: '12px' }}>
                <Search className="search-icon" size={16} />
                <input
                  type="text"
                  className="search-input"
                  placeholder="Search staff by name, code, email, or department..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                {searchTerm && (
                  <button
                    type="button"
                    className="search-clear-btn"
                    onClick={() => setSearchTerm('')}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Filter Row */}
              <div className="assign-filters-bar">
                {/* 1. Assignment Filter */}
                <div className="filter-pill-group">
                  <button
                    type="button"
                    className={`filter-pill ${assignmentFilter === 'ALL' ? 'active' : ''}`}
                    onClick={() => setAssignmentFilter('ALL')}
                  >
                    All Staff
                  </button>
                  <button
                    type="button"
                    className={`filter-pill ${assignmentFilter === 'ASSIGNED' ? 'active' : ''}`}
                    onClick={() => setAssignmentFilter('ASSIGNED')}
                  >
                    Assigned ({stats.assigned})
                  </button>
                  <button
                    type="button"
                    className={`filter-pill ${assignmentFilter === 'UNASSIGNED' ? 'active' : ''} ${stats.unassigned > 0 ? 'pill-warning' : ''}`}
                    onClick={() => setAssignmentFilter('UNASSIGNED')}
                  >
                    Unassigned ({stats.unassigned})
                  </button>
                </div>

                {/* 2. Department Dropdown Filter */}
                <select
                  className="assign-select-filter"
                  value={departmentFilter}
                  onChange={(e) => setDepartmentFilter(e.target.value)}
                >
                  <option value="ALL">All Departments</option>
                  <option value="UNASSIGNED">-- Unassigned Only --</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>

                {/* 3. Status Dropdown Filter */}
                <select
                  className="assign-select-filter"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="ALL">All Statuses</option>
                  <option value="Active">Active</option>
                  <option value="Probation">Probation</option>
                  <option value="Inactive">Inactive</option>
                </select>

                {isFilterActive && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs"
                    onClick={handleResetFilters}
                    title="Reset all filters"
                  >
                    <X size={13} />
                    <span>Reset</span>
                  </button>
                )}
              </div>
            </div>

            {/* Employee List Items */}
            <div className="roster-list-body">
              {filteredEmployees.length === 0 ? (
                <div className="roster-empty-state">
                  <UserMinus size={32} className="text-muted" style={{ marginBottom: '8px' }} />
                  <p className="empty-title">No employees matching criteria</p>
                  <p className="empty-desc">Try clearing your search query or adjusting your department and status filters.</p>
                  {isFilterActive && (
                    <button type="button" className="btn btn-secondary btn-sm" onClick={handleResetFilters} style={{ marginTop: '10px' }}>
                      Reset Filters
                    </button>
                  )}
                </div>
              ) : (
                filteredEmployees.map((emp) => {
                  const isSelected = emp.id === selectedEmployeeId;
                  const isUnassigned = !emp.department_id;
                  const fullName = [emp.first_name, emp.middle_name, emp.last_name].filter(Boolean).join(' ') || 'Unnamed Staff';
                  const primaryEmail = emp.work_email || emp.personal_email;

                  return (
                    <div
                      key={emp.id}
                      className={`roster-employee-item ${isSelected ? 'selected' : ''} ${isUnassigned ? 'unassigned-item' : ''}`}
                      onClick={() => handleSelectEmployee(emp)}
                    >
                      <div className="employee-item-left">
                        <StaffAvatar
                          firstName={emp.first_name}
                          lastName={emp.last_name}
                          photoUrl={emp.profile_photo_url}
                          size="md"
                        />
                        <div className="employee-item-info">
                          <div className="employee-item-header">
                            <span className="employee-name">{fullName}</span>
                            <span className="code-badge text-monospace">{emp.employee_code}</span>
                            <span className={`status-pill badge-${(emp.employment_status || 'active').toLowerCase()}`}>
                              <span className="status-dot"></span>
                              <span>{emp.employment_status || 'Active'}</span>
                            </span>
                          </div>

                          <div className="employee-item-meta">
                            <span className="meta-designation">
                              <Briefcase size={13} className="inline-icon text-muted" />
                              {emp.designation_name || 'Staff Member'}
                            </span>
                            <span className="meta-separator">•</span>
                            <span className={`meta-department ${isUnassigned ? 'text-amber-bold' : ''}`}>
                              <Building2 size={13} className="inline-icon text-muted" />
                              {emp.department_name ? emp.department_name : (
                                <span className="unassigned-badge">Unassigned</span>
                              )}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="employee-item-right">
                        <button
                          type="button"
                          className={`btn-select-roster ${isSelected ? 'btn-select-active' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectEmployee(emp);
                          }}
                          aria-label={`Select ${fullName} for assignment`}
                        >
                          {isSelected ? (
                            <>
                              <Check size={14} />
                              <span>Selected</span>
                            </>
                          ) : (
                            <span>Select</span>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: DEDICATED ASSIGNMENT PANEL */}
        <div className="assign-panel-column">
          {!selectedEmployee ? (
            /* No Selection Placeholder */
            <div className="assignment-panel-card empty-panel">
              <div className="empty-panel-content">
                <div className="empty-panel-icon">
                  <UserCheck size={36} />
                </div>
                <h3 className="empty-panel-title">Select an Employee to Assign</h3>
                <p className="empty-panel-desc">
                  Choose a faculty or staff member from the roster on the left to review their current placement and assign them to an academic or operational department.
                </p>
                <div className="empty-panel-tips">
                  <div className="tip-item">
                    <span className="tip-dot"></span>
                    <span>Directly transfers faculty between school departments</span>
                  </div>
                  <div className="tip-item">
                    <span className="tip-dot"></span>
                    <span>Maintains immutable audit records for compliance</span>
                  </div>
                  <div className="tip-item">
                    <span className="tip-dot"></span>
                    <span>Updates departmental employee headcounts in real-time</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Active Assignment Action Panel */
            <div className="assignment-panel-card">
              {/* Panel Header */}
              <div className="panel-header">
                <div className="panel-header-user">
                  <StaffAvatar
                    firstName={selectedEmployee.first_name}
                    lastName={selectedEmployee.last_name}
                    photoUrl={selectedEmployee.profile_photo_url}
                    size="lg"
                  />
                  <div className="panel-user-details">
                    <div className="panel-title-row">
                      <h3 className="panel-user-name">
                        {selectedEmployee.first_name} {selectedEmployee.last_name || ''}
                      </h3>
                      <span className="code-badge text-monospace">{selectedEmployee.employee_code}</span>
                      <span className={`status-pill badge-${(selectedEmployee.employment_status || 'active').toLowerCase()}`}>
                        <span className="status-dot"></span>
                        <span>{selectedEmployee.employment_status || 'Active'}</span>
                      </span>
                    </div>
                    <p className="panel-user-sub">
                      {selectedEmployee.designation_name || 'Staff Member'} • {selectedEmployee.work_email || selectedEmployee.personal_email || 'No email registered'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setSelectedEmployeeId('')}
                  title="Deselect employee"
                >
                  <X size={16} />
                  <span>Deselect</span>
                </button>
              </div>

              {/* Form Body */}
              <form onSubmit={handleInitiateAssignment} className="panel-form-body">
                {formError && (
                  <div className="assign-alert-error">
                    <AlertCircle size={18} className="alert-icon" />
                    <div className="alert-text">{formError}</div>
                  </div>
                )}

                {/* VISUAL FLOW: CURRENT DEPARTMENT -> NEW TARGET */}
                <div className="assignment-flow-container">
                  {/* BOX A: CURRENT DEPARTMENT */}
                  <div className="flow-step-box current-box">
                    <span className="flow-box-label">CURRENT DEPARTMENT</span>
                    <div className="flow-box-content">
                      <Building2 size={18} className={selectedEmployee.department_id ? 'text-primary' : 'text-amber'} />
                      <div className="flow-dept-info">
                        <span className="flow-dept-name">
                          {selectedEmployee.department_name || (
                            <span className="text-amber-bold">Not Assigned (Unassigned)</span>
                          )}
                        </span>
                        {selectedEmployee.department_code && (
                          <span className="flow-dept-code text-monospace">
                            Code: {selectedEmployee.department_code}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* TRANSITION ARROW */}
                  <div className="flow-arrow-divider">
                    <div className="flow-arrow-circle">
                      <ArrowDown size={18} />
                    </div>
                    <span className="flow-arrow-text">ASSIGN TO</span>
                  </div>

                  {/* BOX B: TARGET DEPARTMENT SELECTOR */}
                  <div className="flow-step-box target-box">
                    <label className="flow-box-label" htmlFor="target-department-select">
                      NEW TARGET DEPARTMENT <span className="text-danger">*</span>
                    </label>
                    <select
                      id="target-department-select"
                      className="form-select flow-select"
                      value={targetDepartmentId}
                      onChange={(e) => {
                        setTargetDepartmentId(e.target.value);
                        setFormError(null);
                      }}
                      disabled={!canAssignStaff || isSubmitting}
                      required
                    >
                      <option value="">— Select Target Department —</option>
                      {departments
                        .filter((d) => d.is_active)
                        .map((dept) => {
                          const isCurrent = dept.id === selectedEmployee.department_id;
                          return (
                            <option key={dept.id} value={dept.id}>
                              {dept.name} ({dept.code || 'NO-CODE'}) {dept.category_name ? `• ${dept.category_name}` : ''} {isCurrent ? '(Current)' : ''}
                            </option>
                          );
                        })}
                    </select>

                    {targetDepartment && (
                      <div className="target-preview-badge">
                        <Building2 size={13} className="text-muted" />
                        <span>Category: <strong>{targetDepartment.category_name || 'General'}</strong> | Head: <strong>{targetDepartment.head_name || 'Unassigned'}</strong></span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Additional Assignment Fields */}
                <div className="panel-form-fields-grid">
                  {/* Effective Date */}
                  <div className="form-group">
                    <label className="form-label" htmlFor="assign-effective-date">
                      Effective Date <span className="text-danger">*</span>
                    </label>
                    <input
                      type="date"
                      id="assign-effective-date"
                      className="form-input"
                      value={effectiveDate}
                      onChange={(e) => setEffectiveDate(e.target.value)}
                      disabled={!canAssignStaff || isSubmitting}
                      required
                    />
                  </div>

                  {/* Reason / Remarks */}
                  <div className="form-group">
                    <label className="form-label" htmlFor="assign-remarks">
                      Transfer Reason / Remarks
                    </label>
                    <input
                      type="text"
                      id="assign-remarks"
                      className="form-input"
                      placeholder="e.g. Annual rotation, term load adjustment, new appointment"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      disabled={!canAssignStaff || isSubmitting}
                    />
                  </div>
                </div>

                {/* Same department warning */}
                {selectedEmployee && targetDepartmentId && selectedEmployee.department_id === targetDepartmentId && (
                  <div className="assign-same-warning">
                    <AlertCircle size={16} />
                    <span>This employee is already assigned to this department.</span>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="panel-footer-actions">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setSelectedEmployeeId('');
                      setTargetDepartmentId('');
                      setFormError(null);
                    }}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={
                      !canAssignStaff || 
                      isSubmitting || 
                      !targetDepartmentId || 
                      selectedEmployee.department_id === targetDepartmentId
                    }
                  >
                    <UserCheck size={16} />
                    <span>Review & Assign Employee</span>
                  </button>
                </div>
              </form>

              {/* Selected Employee's Past Department History */}
              {selectedEmployeeHistory.length > 0 && (
                <div className="employee-history-mini-section">
                  <div className="mini-history-header">
                    <History size={15} className="text-primary" />
                    <h4>Assignment History for {selectedEmployee.first_name}</h4>
                  </div>
                  <div className="mini-history-list">
                    {selectedEmployeeHistory.map((rec) => (
                      <div key={rec.id} className="mini-history-item">
                        <div className="history-item-dot"></div>
                        <div className="history-item-body">
                          <div className="history-item-main">
                            <span className="history-dept-name">{rec.department_name}</span>
                            <span className="history-date">
                              {rec.effective_date ? new Date(rec.effective_date).toLocaleDateString() : '—'}
                            </span>
                          </div>
                          <div className="history-item-sub">
                            <span>From: {rec.previous_department_name || 'Initial Placement'}</span>
                            {rec.reason && <span> • Reason: {rec.reason}</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 4. SCHOOL-WIDE DEPARTMENT ASSIGNMENT AUDIT LOG TABLE */}
      <div className="table-wrapper-card assign-audit-card" style={{ marginTop: '32px' }}>
        <div className="table-controls-bar">
          <div className="filters-left">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <History size={18} className="text-primary" />
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                Department Assignment & Transfer Audit Trail
              </h3>
            </div>
          </div>

          <div className="filters-right">
            {/* Tab switch: All transfers vs Selected Employee only */}
            {selectedEmployee && (
              <div className="filter-pill-group">
                <button
                  type="button"
                  className={`filter-pill ${activeHistoryTab === 'all' ? 'active' : ''}`}
                  onClick={() => setActiveHistoryTab('all')}
                >
                  All School Transfers
                </button>
                <button
                  type="button"
                  className={`filter-pill ${activeHistoryTab === 'selected' ? 'active' : ''}`}
                  onClick={() => setActiveHistoryTab('selected')}
                >
                  {selectedEmployee.first_name}'s History ({selectedEmployeeHistory.length})
                </button>
              </div>
            )}

            {/* Search audit log */}
            <div className="search-input-wrapper">
              <Search className="search-icon" size={14} />
              <input
                type="text"
                className="search-input search-input-sm"
                placeholder="Search audit trail..."
                value={historySearchTerm}
                onChange={(e) => setHistorySearchTerm(e.target.value)}
              />
              {historySearchTerm && (
                <button
                  type="button"
                  className="search-clear-btn"
                  onClick={() => setHistorySearchTerm('')}
                >
                  ✕
                </button>
              )}
            </div>

            <button
              type="button"
              className="btn btn-secondary btn-icon btn-sm"
              onClick={fetchHistory}
              disabled={isHistoryLoading}
              title="Refresh audit history"
            >
              <RefreshCw size={14} className={isHistoryLoading ? 'spin-animation' : ''} />
            </button>
          </div>
        </div>

        {isHistoryLoading ? (
          <div style={{ padding: '36px', textAlign: 'center' }}>
            <Loader2 size={26} className="spin-animation text-primary" style={{ margin: '0 auto' }} />
            <p style={{ marginTop: '8px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Loading transfer logs from database...</p>
          </div>
        ) : filteredHistory.length === 0 ? (
          <div className="empty-state-container" style={{ padding: '36px' }}>
            <Clock size={32} className="text-muted" style={{ marginBottom: '8px' }} />
            <div style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--text-main)' }}>
              No department assignment records found.
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              When faculty members are assigned or transferred between departments, historical audit records will appear here.
            </p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '130px' }}>Staff Code</th>
                  <th>Faculty Member</th>
                  <th>New Assigned Department</th>
                  <th>Previous Department</th>
                  <th style={{ width: '130px' }}>Effective Date</th>
                  <th>Reason / Remarks</th>
                </tr>
              </thead>
              <tbody>
                {filteredHistory.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <span className="table-code-badge text-monospace">
                        {item.employee_code}
                      </span>
                    </td>
                    <td>
                      <div 
                        className="clickable-cell"
                        onClick={() => onNavigateToEmployee && onNavigateToEmployee(item.employee_id)}
                        title="View employee profile"
                        style={{ cursor: 'pointer', fontWeight: 600, color: 'var(--text-main)' }}
                      >
                        {item.employee_name}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Building2 size={14} className="text-primary" />
                        <span style={{ fontWeight: 600, color: '#1e40af' }}>
                          {item.department_name}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className="text-muted" style={{ fontSize: '0.84rem' }}>
                        {item.previous_department_name ? (
                          item.previous_department_name
                        ) : (
                          <span className="italic" style={{ color: '#059669', fontSize: '0.78rem' }}>
                            Initial Placement
                          </span>
                        )}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.82rem', color: 'var(--text-main)' }}>
                        {item.effective_date ? new Date(item.effective_date).toLocaleDateString() : '—'}
                      </span>
                    </td>
                    <td>
                      <span className="text-muted text-xs" title={item.reason}>
                        {item.reason || '—'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 5. CONFIRMATION MODAL BEFORE REASSIGNMENT */}
      {showConfirmModal && selectedEmployee && targetDepartment && (
        <div className="modal-backdrop" onClick={() => !isSubmitting && setShowConfirmModal(false)}>
          <div className="modal-container modal-dialog-confirm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-header-icon-title">
                <div className="icon-badge-primary">
                  <UserCheck size={20} />
                </div>
                <div>
                  <h3 className="modal-title">
                    Confirm Department Assignment
                  </h3>
                  <p className="modal-subtitle">
                    Staff Code: <code>{selectedEmployee.employee_code}</code>
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
                {selectedEmployee.department_name ? (
                  <>
                    Reassign <strong>{selectedEmployee.first_name} {selectedEmployee.last_name || ''}</strong> from <strong>{selectedEmployee.department_name}</strong> to <strong>{targetDepartment.name}</strong>?
                  </>
                ) : (
                  <>
                    Assign <strong>{selectedEmployee.first_name} {selectedEmployee.last_name || ''}</strong> to <strong>{targetDepartment.name}</strong>?
                  </>
                )}
              </p>

              <div className="confirm-details-box">
                <div className="confirm-detail-row">
                  <span className="confirm-label">Effective Date:</span>
                  <span className="confirm-value">{new Date(effectiveDate).toLocaleDateString()}</span>
                </div>
                {reason && (
                  <div className="confirm-detail-row">
                    <span className="confirm-label">Remarks:</span>
                    <span className="confirm-value">{reason}</span>
                  </div>
                )}
              </div>

              <div className="confirm-warning-box">
                <CheckCircle2 size={16} className="text-blue" />
                <span>
                  This transfer will update active departmental rosters and record an official institutional transfer log.
                </span>
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
                    <span>Updating Department...</span>
                  </>
                ) : (
                  <>
                    <Check size={16} />
                    <span>Confirm Reassignment</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AssignEmployeeView;
