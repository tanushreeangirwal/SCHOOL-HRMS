import React, { useState, useMemo } from 'react';
import { 
  Award, 
  Building2, 
  Users, 
  Search, 
  RotateCcw, 
  Edit, 
  Plus, 
  Eye, 
  Power, 
  Trash2, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  RefreshCw,
  Briefcase
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { TableSkeleton } from '../common/LoadingSpinner';

export function DesignationListView({
  designations = [],
  departments = [],
  isLoading = false,
  isRefreshing = false,
  error = null,
  onRefresh,
  onAddDesignation,
  onEditDesignation,
  onViewDesignation,
  onToggleStatus
}) {
  const { hasPermission, hasRole } = useAuth();

  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Deactivation confirmation modal state
  const [confirmToggleDesig, setConfirmToggleDesig] = useState(null);

  const canCreate = hasPermission('designations:create') || hasRole('Administrator', 'HR');
  const canUpdate = hasPermission('designations:update') || hasRole('Administrator', 'HR');
  const canDelete = hasPermission('designations:delete') || hasRole('Administrator', 'HR');

  const handleResetFilters = () => {
    setSearchTerm('');
    setDepartmentFilter('ALL');
    setStatusFilter('ALL');
  };

  // KPIs
  const stats = useMemo(() => {
    const total = designations.length;
    const active = designations.filter(d => d.is_active).length;
    const inactive = total - active;
    const totalAssignedStaff = designations.reduce((acc, d) => acc + (parseInt(d.employee_count, 10) || 0), 0);
    return { total, active, inactive, totalAssignedStaff };
  }, [designations]);

  // Filtered designations list
  const filteredDesignations = useMemo(() => {
    return designations.filter(desig => {
      // Filter by status
      if (statusFilter !== 'ALL') {
        const isActiveFilter = statusFilter === 'ACTIVE';
        if (desig.is_active !== isActiveFilter) return false;
      }

      // Filter by department
      if (departmentFilter !== 'ALL') {
        if (desig.department_id !== departmentFilter) return false;
      }

      // Filter by search term (name, code, description, department_name)
      if (searchTerm.trim() !== '') {
        const term = searchTerm.toLowerCase().trim();
        const name = (desig.name || '').toLowerCase();
        const code = (desig.code || '').toLowerCase();
        const desc = (desig.description || '').toLowerCase();
        const dept = (desig.department_name || '').toLowerCase();

        return name.includes(term) || code.includes(term) || desc.includes(term) || dept.includes(term);
      }

      return true;
    });
  }, [designations, searchTerm, departmentFilter, statusFilter]);

  const handleConfirmToggle = async () => {
    if (!confirmToggleDesig) return;
    const targetStatus = !confirmToggleDesig.is_active;
    await onToggleStatus(confirmToggleDesig.id, targetStatus);
    setConfirmToggleDesig(null);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    try {
      const d = new Date(dateString);
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="designations-module-container">
      {/* 1. Page Header & Brief Description */}
      <div className="module-title-banner">
        <div>
          <h1 className="module-page-heading">Designations</h1>
          <p className="module-page-description">
            Manage job positions and designations across St. Vincent's School.
          </p>
        </div>

        {canCreate && (
          <button
            type="button"
            className="btn-clean-primary"
            onClick={onAddDesignation}
          >
            <Plus size={16} />
            <span>Add Designation</span>
          </button>
        )}
      </div>

      {/* 2. Simple KPI Summary Cards */}
      <div className="kpi-metrics-row">
        <div className="kpi-metric-card">
          <div className="kpi-metric-icon bg-indigo-subtle">
            <Award size={20} className="text-indigo" />
          </div>
          <div className="kpi-metric-data">
            <span className="kpi-metric-label">Total Designations</span>
            <span className="kpi-metric-value">{stats.total}</span>
          </div>
        </div>

        <div className="kpi-metric-card">
          <div className="kpi-metric-icon bg-emerald-subtle">
            <CheckCircle2 size={20} className="text-emerald" />
          </div>
          <div className="kpi-metric-data">
            <span className="kpi-metric-label">Active Positions</span>
            <span className="kpi-metric-value text-emerald">{stats.active}</span>
          </div>
        </div>

        <div className="kpi-metric-card">
          <div className="kpi-metric-icon bg-slate-subtle">
            <XCircle size={20} className="text-slate" />
          </div>
          <div className="kpi-metric-data">
            <span className="kpi-metric-label">Inactive Positions</span>
            <span className="kpi-metric-value">{stats.inactive}</span>
          </div>
        </div>
      </div>

      {/* 3. Filter & Search Bar */}
      <div className="clean-filter-bar-card">
        <div className="filter-inputs-group">
          {/* Search Box */}
          <div className="clean-search-box" style={{ maxWidth: '320px' }}>
            <Search size={16} className="clean-search-icon" />
            <input
              type="text"
              className="clean-search-input"
              placeholder="Search designation or code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button
                type="button"
                className="clean-search-clear"
                onClick={() => setSearchTerm('')}
              >
                ✕
              </button>
            )}
          </div>

          {/* Department Filter */}
          <select
            className="clean-select-filter"
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
          >
            <option value="ALL">All Departments</option>
            {departments.map((dept) => (
              <option key={dept.id} value={dept.id}>
                {dept.name}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            className="clean-select-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active Only</option>
            <option value="INACTIVE">Inactive Only</option>
          </select>

          {/* Reset Filters */}
          <button
            type="button"
            className="clean-reset-btn"
            onClick={handleResetFilters}
          >
            <RotateCcw size={14} />
            <span>Reset</span>
          </button>
        </div>

        <div className="filter-actions-group">
          <button
            type="button"
            className="clean-icon-btn"
            onClick={onRefresh}
            disabled={isRefreshing}
            title="Refresh designations"
          >
            <RefreshCw size={15} className={isRefreshing ? 'spin-animation' : ''} />
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="error-banner">
          <div className="error-banner-content">
            <AlertCircle size={20} className="error-icon" />
            <div className="error-text">
              <strong>Error loading designations:</strong> {error}
            </div>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onRefresh}
          >
            <RefreshCw size={14} />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* 4. Table with Separated Light-Color Lines */}
      <div className="clean-table-container">
        {isLoading ? (
          <TableSkeleton rows={5} />
        ) : filteredDesignations.length === 0 ? (
          <div className="clean-empty-state">
            <Award size={44} className="text-muted" style={{ marginBottom: '12px' }} />
            <h3>No Designations Found</h3>
            <p>
              {searchTerm || departmentFilter !== 'ALL' || statusFilter !== 'ALL'
                ? 'No job positions match your filter criteria.'
                : 'No job designations have been registered yet.'}
            </p>
            {canCreate && (
              <button
                type="button"
                className="btn-clean-primary"
                onClick={onAddDesignation}
                style={{ marginTop: '14px' }}
              >
                <Plus size={15} />
                <span>Add First Designation</span>
              </button>
            )}
          </div>
        ) : (
          <table className="clean-grouped-table">
            <thead>
              <tr className="clean-table-header-row">
                <th style={{ width: '120px' }}>Code</th>
                <th style={{ width: '250px' }}>Designation Name</th>
                <th>Department</th>
                <th style={{ width: '130px', textAlign: 'center' }}>Employees</th>
                <th style={{ width: '110px', textAlign: 'center' }}>Status</th>
                <th style={{ width: '130px' }}>Created Date</th>
                <th style={{ width: '130px', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredDesignations.map((desig) => {
                const empCount = parseInt(desig.employee_count, 10) || 0;

                return (
                  <tr 
                    key={desig.id} 
                    className={`department-data-row ${!desig.is_active ? 'row-deactivated' : ''}`}
                  >
                    {/* Code */}
                    <td className="row-code-cell">
                      <span className="badge-code-pill">{desig.code || '—'}</span>
                    </td>

                    {/* Designation Name & Description */}
                    <td className="dept-name-cell">
                      <button
                        type="button"
                        className="dept-link-btn"
                        onClick={() => onViewDesignation(desig.id)}
                        title="Click to view designation details"
                      >
                        {desig.name}
                      </button>
                      {desig.description && (
                        <span className="desig-subdesc">{desig.description}</span>
                      )}
                    </td>

                    {/* Department */}
                    <td className="dept-desc-cell">
                      {desig.department_name ? (
                        <span className="dept-badge-tag">
                          <Building2 size={12} />
                          <span>{desig.department_name}</span>
                        </span>
                      ) : (
                        <span className="text-muted text-xs italic">Institution-Wide / All</span>
                      )}
                    </td>

                    {/* Employees Count */}
                    <td style={{ textAlign: 'center' }}>
                      {empCount > 0 ? (
                        <span className="green-employee-pill">
                          <Users size={12} />
                          <span>{empCount}</span>
                        </span>
                      ) : (
                        <span className="gray-no-employee-text">
                          <Users size={12} style={{ opacity: 0.7 }} />
                          <span>No Employee</span>
                        </span>
                      )}
                    </td>

                    {/* Status */}
                    <td style={{ textAlign: 'center' }}>
                      <span className={`status-pill ${desig.is_active ? 'active' : 'inactive'}`}>
                        {desig.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>

                    {/* Created Date */}
                    <td className="date-cell">
                      {formatDate(desig.created_at)}
                    </td>

                    {/* Actions */}
                    <td style={{ textAlign: 'center' }}>
                      <div className="clean-actions-wrapper">
                        <button
                          type="button"
                          className="action-btn-view"
                          onClick={() => onViewDesignation(desig.id)}
                          title="View Designation Details"
                        >
                          <Eye size={13} />
                        </button>

                        {canUpdate && (
                          <button
                            type="button"
                            className="action-btn-edit-sm"
                            onClick={() => onEditDesignation(desig)}
                            title="Edit Designation"
                          >
                            <Edit size={13} />
                          </button>
                        )}

                        {canDelete && (
                          <button
                            type="button"
                            className={`action-btn-toggle-sm ${!desig.is_active ? 'btn-is-deactivated' : ''}`}
                            onClick={() => setConfirmToggleDesig(desig)}
                            title={desig.is_active ? 'Deactivate Position' : 'Reactivate Position'}
                          >
                            {desig.is_active ? <Trash2 size={13} /> : <Power size={13} />}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* 5. Soft Status Toggle / Deactivation Confirmation Dialog */}
      {confirmToggleDesig && (
        <div className="modal-backdrop" onClick={() => setConfirmToggleDesig(null)}>
          <div className="modal-container modal-confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-header-icon-title">
                <div className={`icon-badge-primary ${confirmToggleDesig.is_active ? 'badge-danger-glow' : 'badge-success-glow'}`}>
                  <Power size={22} />
                </div>
                <div>
                  <h3 className="modal-title">
                    {confirmToggleDesig.is_active ? 'Deactivate Designation?' : 'Activate Designation?'}
                  </h3>
                  <p className="modal-subtitle">{confirmToggleDesig.name} ({confirmToggleDesig.code})</p>
                </div>
              </div>
            </div>
            <div className="modal-body">
              <p className="confirm-text">
                {confirmToggleDesig.is_active ? (
                  <>
                    Are you sure you want to mark <strong>{confirmToggleDesig.name}</strong> as Inactive?
                    {parseInt(confirmToggleDesig.employee_count, 10) > 0 && (
                      <span className="deactivate-warning-note">
                        <br />
                        <AlertCircle size={14} className="inline-icon text-amber" />
                        <strong>Notice:</strong> {confirmToggleDesig.employee_count} current employee(s) currently hold this designation. Their records will remain safe and historical links will be preserved.
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    Are you sure you want to re-activate <strong>{confirmToggleDesig.name}</strong>? 
                    It will become immediately selectable for employee assignments.
                  </>
                )}
              </p>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setConfirmToggleDesig(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`btn ${confirmToggleDesig.is_active ? 'btn-danger' : 'btn-primary'}`}
                onClick={handleConfirmToggle}
              >
                {confirmToggleDesig.is_active ? 'Deactivate Position' : 'Activate Position'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DesignationListView;
