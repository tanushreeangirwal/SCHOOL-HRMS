import React, { useState, useMemo } from 'react';
import {
  Clock,
  CalendarClock,
  Plus,
  Search,
  RefreshCw,
  Edit2,
  Trash2,
  Users,
  Eye,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  X,
  UserCheck,
  UserMinus,
  Calendar,
  Filter,
  ShieldAlert
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { TableSkeleton } from '../common/LoadingSpinner';

export function ShiftListView({
  shifts = [],
  stats = {},
  isLoading = false,
  isRefreshing = false,
  error = null,
  onRefresh,
  onAddShift,
  onEditShift,
  onViewShift,
  onAssignEmployees,
  onToggleStatus,
  onDeleteShift
}) {
  const { hasPermission, hasRole } = useAuth();
  const canCreate = hasPermission('shifts:create') || hasRole('Super Admin', 'Administrator', 'HR');
  const canUpdate = hasPermission('shifts:update') || hasRole('Super Admin', 'Administrator', 'HR');
  const canDelete = hasPermission('shifts:delete') || hasRole('Super Admin', 'Administrator');
  const canAssign = hasPermission('shifts:assign') || hasRole('Super Admin', 'Administrator', 'HR');

  // Search and Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [dayFilter, setDayFilter] = useState('ALL');

  // Delete & Status Action Confirmation Modal State
  const [shiftToAction, setShiftToAction] = useState(null);
  const [actionType, setActionType] = useState(null); // 'toggle' | 'delete'
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const [actionError, setActionError] = useState(null);

  // Filtered Shifts List
  const filteredShifts = useMemo(() => {
    return shifts.filter((shift) => {
      // Status Filter
      if (statusFilter === 'ACTIVE' && !shift.is_active) return false;
      if (statusFilter === 'INACTIVE' && shift.is_active) return false;

      // Day Filter
      if (dayFilter !== 'ALL') {
        const days = shift.working_days || [];
        if (!days.includes(dayFilter)) return false;
      }

      // Search Filter
      if (searchTerm.trim() !== '') {
        const term = searchTerm.toLowerCase().trim();
        const name = (shift.name || '').toLowerCase();
        const code = (shift.code || '').toLowerCase();
        const desc = (shift.description || '').toLowerCase();
        return name.includes(term) || code.includes(term) || desc.includes(term);
      }

      return true;
    });
  }, [shifts, statusFilter, dayFilter, searchTerm]);

  const isFilterActive = searchTerm.trim() !== '' || statusFilter !== 'ALL' || dayFilter !== 'ALL';

  const handleResetFilters = () => {
    setSearchTerm('');
    setStatusFilter('ALL');
    setDayFilter('ALL');
  };

  const handleConfirmAction = async () => {
    if (!shiftToAction || !actionType) return;
    setIsProcessingAction(true);
    setActionError(null);

    try {
      if (actionType === 'toggle') {
        const nextStatus = !shiftToAction.is_active;
        await onToggleStatus(shiftToAction.id, nextStatus);
      } else if (actionType === 'delete') {
        await onDeleteShift(shiftToAction.id);
      }
      setShiftToAction(null);
      setActionType(null);
    } catch (err) {
      console.error('Action error:', err);
      setActionError(err.message || 'Action failed. Please try again.');
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Helper to format working day tags
  const renderDayBadges = (days = []) => {
    if (!days || days.length === 0) {
      return <span className="text-muted text-xs">No days set</span>;
    }

    if (days.length === 5 && days.includes('Monday') && days.includes('Friday') && !days.includes('Saturday')) {
      return <span className="code-badge" style={{ backgroundColor: '#eff6ff', color: '#1d4ed8', borderColor: '#bfdbfe' }}>Mon – Fri (5 Days)</span>;
    }

    if (days.length === 6 && days.includes('Monday') && days.includes('Saturday')) {
      return <span className="code-badge" style={{ backgroundColor: '#eff6ff', color: '#1d4ed8', borderColor: '#bfdbfe' }}>Mon – Sat (6 Days)</span>;
    }

    if (days.length === 7) {
      return <span className="code-badge" style={{ backgroundColor: '#f5f3ff', color: '#6d28d9', borderColor: '#ddd6fe' }}>All 7 Days</span>;
    }

    return (
      <span className="code-badge">
        {days.map(d => d.slice(0, 3)).join(', ')}
      </span>
    );
  };

  return (
    <div className="shifts-view-content" style={{ width: '100%', boxSizing: 'border-box' }}>
      {/* 1. Clean Page Header */}
      <div className="page-header-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 4px 0' }}>
            Shift & Work Schedule
          </h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
            Manage school work schedules, working hours, and employee shift assignments.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {canAssign && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={onAssignEmployees}
              title="Assign faculty and staff to work shifts"
            >
              <UserCheck size={15} />
              <span>Assign Staff</span>
            </button>
          )}

          {canCreate && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={onAddShift}
            >
              <Plus size={16} />
              <span>+ Add Shift</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Top Summary KPI Cards (Using the standard .stats-grid & .stat-card) */}
      <div className="stats-grid">
        {/* Total Configured Shifts */}
        <div className="stat-card stat-indigo">
          <div className="stat-content">
            <span className="stat-title">Total Shifts</span>
            <div className="stat-number-wrapper">
              <span className="stat-number">{stats.total_shifts ?? shifts.length}</span>
            </div>
            <span className="stat-subtext">Configured schedules</span>
          </div>
          <div className="stat-icon-badge">
            <CalendarClock size={24} />
          </div>
        </div>

        {/* Active Shifts */}
        <div className="stat-card stat-emerald">
          <div className="stat-content">
            <span className="stat-title">Active Shifts</span>
            <div className="stat-number-wrapper">
              <span className="stat-number text-emerald">
                {stats.active_shifts ?? shifts.filter(s => s.is_active).length}
              </span>
            </div>
            <span className="stat-subtext">Operational & in use</span>
          </div>
          <div className="stat-icon-badge">
            <CheckCircle2 size={24} />
          </div>
        </div>

        {/* Employees Assigned */}
        <div className="stat-card stat-slate">
          <div className="stat-content">
            <span className="stat-title">Staff on Shift</span>
            <div className="stat-number-wrapper">
              <span className="stat-number">{stats.assigned_employees ?? 0}</span>
            </div>
            <span className="stat-subtext">Active staff on roster</span>
          </div>
          <div className="stat-icon-badge">
            <Users size={24} />
          </div>
        </div>

        {/* Without Shift */}
        <div 
          className="stat-card stat-amber"
          onClick={() => onAssignEmployees && onAssignEmployees()}
          style={{ cursor: onAssignEmployees ? 'pointer' : 'default' }}
          title={onAssignEmployees ? 'Click to view and assign unscheduled staff' : ''}
        >
          <div className="stat-content">
            <span className="stat-title">Without Shift</span>
            <div className="stat-number-wrapper">
              <span className="stat-number text-amber">{stats.unassigned_employees ?? 0}</span>
            </div>
            <span className="stat-subtext">
              {(stats.unassigned_employees ?? 0) > 0 ? 'Pending shift placement' : 'All personnel assigned'}
            </span>
          </div>
          <div className="stat-icon-badge">
            <UserMinus size={24} />
          </div>
        </div>
      </div>

      {/* 3. Shift Table & Standard Filter Toolbar */}
      <div className="table-wrapper-card">
        {/* Standard HRMS Filters Bar */}
        <div className="filters-card">
          <div className="filters-row">
            {/* Search Input */}
            <div className="search-input-wrapper">
              <Search className="search-icon" size={18} />
              <input
                type="text"
                className="search-input"
                placeholder="Search shifts by name, code (e.g. SCH-FACULTY)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button
                  type="button"
                  className="search-clear-btn"
                  onClick={() => setSearchTerm('')}
                  title="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Status Filter */}
            <div className="filter-select-wrapper">
              <label className="filter-label">
                <Filter size={14} />
                <span>Status:</span>
              </label>
              <select
                className="filter-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="ALL">All Status</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>

            {/* Working Days Filter */}
            <div className="filter-select-wrapper">
              <label className="filter-label">
                <Calendar size={14} />
                <span>Days:</span>
              </label>
              <select
                className="filter-select"
                value={dayFilter}
                onChange={(e) => setDayFilter(e.target.value)}
              >
                <option value="ALL">All Working Days</option>
                <option value="Monday">Monday</option>
                <option value="Tuesday">Tuesday</option>
                <option value="Wednesday">Wednesday</option>
                <option value="Thursday">Thursday</option>
                <option value="Friday">Friday</option>
                <option value="Saturday">Saturday</option>
                <option value="Sunday">Sunday</option>
              </select>
            </div>

            {/* Reset Filter Button */}
            {isFilterActive && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={handleResetFilters}
                title="Reset all filters"
              >
                <RefreshCw size={14} />
                <span>Reset</span>
              </button>
            )}
          </div>

          {/* Results Subtext */}
          <div className="filters-results-info">
            <span>
              Showing <strong>{filteredShifts.length}</strong> of <strong>{shifts.length}</strong> work schedules
            </span>
            {isFilterActive && (
              <span className="filtered-indicator-badge">Filtered</span>
            )}
          </div>
        </div>

        {/* Table Content */}
        {isLoading ? (
          <TableSkeleton rows={4} columns={9} />
        ) : error ? (
          <div className="table-state-container error-state" style={{ padding: '36px', textAlign: 'center' }}>
            <AlertCircle size={32} className="text-danger" style={{ margin: '0 auto 8px' }} />
            <h4 style={{ margin: '0 0 4px', fontSize: '1rem', color: 'var(--text-main)' }}>Unable to load shifts</h4>
            <p style={{ margin: '0 0 16px', fontSize: '0.84rem', color: 'var(--text-muted)' }}>{error}</p>
            {onRefresh && (
              <button type="button" className="btn btn-secondary btn-sm" onClick={onRefresh}>
                <RefreshCw size={14} />
                <span>Retry</span>
              </button>
            )}
          </div>
        ) : filteredShifts.length === 0 ? (
          <div className="empty-state-container" style={{ padding: '48px 24px', textAlign: 'center' }}>
            <CalendarClock size={36} className="text-muted" style={{ margin: '0 auto 12px', opacity: 0.6 }} />
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', margin: '0 0 6px 0' }}>
              {isFilterActive ? 'No matching work shifts found' : 'No shifts created yet.'}
            </h3>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', margin: '0 0 16px 0', maxWidth: '420px', marginLeft: 'auto', marginRight: 'auto' }}>
              {isFilterActive
                ? 'Try adjusting your search keywords or clearing status/day filters.'
                : 'Create your first work schedule to begin assigning employees.'}
            </p>
            {isFilterActive ? (
              <button type="button" className="btn btn-secondary btn-sm" onClick={handleResetFilters}>
                Clear Filters
              </button>
            ) : (
              canCreate && (
                <button type="button" className="btn btn-primary btn-sm" onClick={onAddShift}>
                  <Plus size={15} />
                  <span>+ Add Shift</span>
                </button>
              )
            )}
          </div>
        ) : (
          <div className="table-responsive">
            <table className="employee-table">
              <thead>
                <tr>
                  <th style={{ minWidth: '220px' }}>Shift</th>
                  <th style={{ minWidth: '120px' }}>Code</th>
                  <th style={{ minWidth: '160px' }}>Working Hours</th>
                  <th style={{ minWidth: '100px' }}>Break</th>
                  <th style={{ minWidth: '140px' }}>Working Days</th>
                  <th style={{ minWidth: '130px' }}>Grace Period</th>
                  <th style={{ minWidth: '90px' }}>Staff</th>
                  <th style={{ minWidth: '100px' }}>Status</th>
                  <th className="th-actions" style={{ minWidth: '120px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredShifts.map((shift) => {
                  const isInactive = !shift.is_active;
                  const employeeCount = parseInt(shift.employee_count, 10) || 0;

                  return (
                    <tr key={shift.id} className={`employee-table-row ${isInactive ? 'row-inactive' : ''}`}>
                      {/* 1. Shift Name (Clean title + small subtle subtext, NO tall paragraphs) */}
                      <td className="cell-name">
                        <div 
                          className="shift-title-cell"
                          onClick={() => onViewShift && onViewShift(shift.id)}
                          style={{ cursor: 'pointer' }}
                          title="View shift dossier"
                        >
                          <span className="shift-main-name" style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.88rem' }}>
                            {shift.name}
                          </span>
                          {shift.description && (
                            <span 
                              className="text-muted" 
                              style={{ 
                                display: 'block', 
                                fontSize: '0.74rem', 
                                marginTop: '2px', 
                                maxWidth: '240px', 
                                whiteSpace: 'nowrap', 
                                overflow: 'hidden', 
                                textOverflow: 'ellipsis' 
                              }}
                              title={shift.description}
                            >
                              {shift.description}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 2. Code */}
                      <td className="cell-code">
                        <span className="code-badge">{shift.code}</span>
                      </td>

                      {/* 3. Working Hours */}
                      <td className="cell-hours">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Clock size={13} className="text-muted inline-icon" />
                          <span style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.84rem' }}>
                            {shift.start_time_formatted || shift.start_time?.slice(0, 5)} – {shift.end_time_formatted || shift.end_time?.slice(0, 5)}
                          </span>
                        </div>
                      </td>

                      {/* 4. Break */}
                      <td className="cell-break">
                        <span style={{ fontSize: '0.84rem', color: 'var(--text-main)' }}>
                          {shift.break_duration_minutes ? `${shift.break_duration_minutes} min` : '—'}
                        </span>
                      </td>

                      {/* 5. Working Days */}
                      <td className="cell-days">
                        {renderDayBadges(shift.working_days)}
                      </td>

                      {/* 6. Grace Period */}
                      <td className="cell-grace">
                        <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                          +{shift.late_grace_minutes || shift.grace_period_minutes || 0}m / -{shift.early_departure_grace_minutes || 0}m
                        </span>
                      </td>

                      {/* 7. Staff Count */}
                      <td className="cell-staff">
                        <span 
                          className="code-badge" 
                          style={{ 
                            display: 'inline-flex', 
                            alignItems: 'center', 
                            gap: '5px',
                            cursor: employeeCount > 0 && onViewShift ? 'pointer' : 'default',
                            backgroundColor: employeeCount > 0 ? '#eff6ff' : '#f1f5f9',
                            color: employeeCount > 0 ? '#1d4ed8' : '#64748b',
                            borderColor: employeeCount > 0 ? '#bfdbfe' : '#e2e8f0'
                          }}
                          onClick={() => employeeCount > 0 && onViewShift && onViewShift(shift.id)}
                          title={employeeCount > 0 ? 'Click to view assigned faculty roster' : 'No employees assigned'}
                        >
                          <Users size={12} />
                          <strong>{employeeCount}</strong>
                        </span>
                      </td>

                      {/* 8. Status */}
                      <td className="cell-status">
                        <span className={`status-pill ${shift.is_active ? 'badge-active' : 'badge-inactive'}`}>
                          <span className="status-dot"></span>
                          <span>{shift.is_active ? 'Active' : 'Inactive'}</span>
                        </span>
                      </td>

                      {/* 9. Actions */}
                      <td className="cell-actions">
                        <div className="employee-row-actions" style={{ justifyContent: 'flex-end' }}>
                          {/* View */}
                          <button
                            type="button"
                            className="btn-action-icon btn-view-icon"
                            onClick={() => onViewShift && onViewShift(shift.id)}
                            title={`View dossier for ${shift.name}`}
                            aria-label={`View dossier for ${shift.name}`}
                          >
                            <Eye size={15} />
                          </button>

                          {/* Edit */}
                          {canUpdate && onEditShift && (
                            <button
                              type="button"
                              className="btn-action-icon btn-edit-icon"
                              onClick={() => onEditShift(shift)}
                              title={`Edit schedule for ${shift.name}`}
                              aria-label={`Edit schedule for ${shift.name}`}
                            >
                              <Edit2 size={15} />
                            </button>
                          )}

                          {/* Assign */}
                          {canAssign && onAssignEmployees && (
                            <button
                              type="button"
                              className="btn-action-icon btn-view-icon"
                              onClick={() => onAssignEmployees()}
                              title="Assign staff to this shift"
                              aria-label="Assign staff to this shift"
                            >
                              <UserCheck size={15} />
                            </button>
                          )}

                          {/* Toggle Status */}
                          {canUpdate && onToggleStatus && (
                            <button
                              type="button"
                              className={`btn-action-icon ${isInactive ? 'btn-reactivate-icon' : 'btn-deactivate-icon'}`}
                              onClick={() => { setShiftToAction(shift); setActionType('toggle'); }}
                              title={isInactive ? `Activate ${shift.name}` : `Deactivate ${shift.name}`}
                              aria-label={isInactive ? `Activate ${shift.name}` : `Deactivate ${shift.name}`}
                            >
                              {isInactive ? <UserCheck size={15} /> : <XCircle size={15} />}
                            </button>
                          )}

                          {/* Delete */}
                          {canDelete && onDeleteShift && (
                            <button
                              type="button"
                              className="btn-action-icon btn-delete-icon"
                              onClick={() => { setShiftToAction(shift); setActionType('delete'); }}
                              title={`Permanently delete ${shift.name}`}
                              aria-label={`Permanently delete ${shift.name}`}
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 4. Action Confirmation Dialog (Toggle Status / Safe Delete) */}
      {shiftToAction && actionType && (
        <div className="modal-backdrop" onClick={() => !isProcessingAction && setShiftToAction(null)}>
          <div className="modal-container modal-dialog-confirm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-header-icon-title">
                <div className={`icon-badge-${actionType === 'delete' ? 'danger' : shiftToAction.is_active ? 'amber' : 'emerald'}`}>
                  {actionType === 'delete' ? (
                    <Trash2 size={20} className="text-danger" />
                  ) : shiftToAction.is_active ? (
                    <XCircle size={20} className="text-amber" />
                  ) : (
                    <CheckCircle2 size={20} className="text-emerald" />
                  )}
                </div>
                <div>
                  <h3 className="modal-title">
                    {actionType === 'delete'
                      ? `Delete "${shiftToAction.name}"?`
                      : shiftToAction.is_active
                      ? `Deactivate "${shiftToAction.name}"?`
                      : `Activate "${shiftToAction.name}"?`}
                  </h3>
                  <p className="modal-subtitle">
                    Shift Code: <code>{shiftToAction.code}</code>
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShiftToAction(null)}
                disabled={isProcessingAction}
              >
                <X size={20} />
              </button>
            </div>

            <div className="modal-body-dialog">
              {actionError && (
                <div className="assign-alert-error" style={{ marginBottom: '14px' }}>
                  <AlertCircle size={16} />
                  <span>{actionError}</span>
                </div>
              )}

              <p className="dialog-explanation">
                {actionType === 'delete' ? (
                  <>
                    Are you sure you want to permanently delete <strong>{shiftToAction.name}</strong>?
                    This action cannot be undone. Shifts with currently assigned staff or historical records cannot be deleted.
                  </>
                ) : shiftToAction.is_active ? (
                  <>
                    Deactivating this shift removes it from new employee assignment options.
                    Active staff assigned to this shift will retain their schedule until reassigned.
                  </>
                ) : (
                  <>
                    Activating this shift makes it operational and available for employee scheduling.
                  </>
                )}
              </p>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShiftToAction(null)}
                disabled={isProcessingAction}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`btn ${actionType === 'delete' ? 'btn-danger' : shiftToAction.is_active ? 'btn-warning' : 'btn-success'}`}
                onClick={handleConfirmAction}
                disabled={isProcessingAction}
              >
                {isProcessingAction ? (
                  <>
                    <Loader2 size={16} className="spin-animation" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <span>
                    {actionType === 'delete'
                      ? 'Delete Shift'
                      : shiftToAction.is_active
                      ? 'Deactivate Shift'
                      : 'Activate Shift'}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ShiftListView;
