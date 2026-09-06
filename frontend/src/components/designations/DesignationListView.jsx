import React, { useState, useMemo } from 'react';
import { 
  Folder, 
  Building2, 
  Users, 
  Search, 
  RotateCcw, 
  Edit, 
  Plus, 
  ChevronUp, 
  ChevronDown, 
  Eye, 
  Power, 
  Trash2, 
  AlertCircle, 
  RefreshCw,
  Award
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { TableSkeleton } from '../common/LoadingSpinner';

export function DesignationListView({
  designations = [],
  departments = [],
  isLoading = false,
  isRefreshing = false,
  error = null,
  initialDepartmentSearch = '',
  onRefresh,
  onAddDesignation,
  onEditDesignation,
  onViewDesignation,
  onToggleStatus
}) {
  const { hasPermission, isSuperAdmin, isAdmin, isHR } = useAuth();
  const canManage = isSuperAdmin || isAdmin || isHR || hasPermission('designations:create');

  // Search filters (matching Screenshot 2: department search & designation search)
  const [departmentSearch, setDepartmentSearch] = useState(initialDepartmentSearch || '');
  const [designationSearch, setDesignationSearch] = useState('');
  
  // Track collapsed department groups (dictionary: deptId -> boolean)
  const [collapsedDepts, setCollapsedDepts] = useState({});

  // Deactivation confirmation modal state
  const [confirmToggleDesig, setConfirmToggleDesig] = useState(null);

  const handleResetFilters = () => {
    setDepartmentSearch('');
    setDesignationSearch('');
  };

  const toggleDeptCollapse = (deptKey) => {
    setCollapsedDepts(prev => ({
      ...prev,
      [deptKey]: !prev[deptKey]
    }));
  };

  // Group designations by Department (matching Screenshot 2)
  const groupedData = useMemo(() => {
    const deptTerm = departmentSearch.toLowerCase().trim();
    const desigTerm = designationSearch.toLowerCase().trim();

    const groups = {};

    // First populate from departments list
    departments.forEach(dept => {
      groups[dept.id] = {
        id: dept.id,
        name: dept.name,
        code: dept.code || dept.name.slice(0, 3).toUpperCase(),
        designations: [],
        totalEmployees: 0
      };
    });

    // Unassigned department placeholder
    const unassignedKey = 'unassigned';
    groups[unassignedKey] = {
      id: unassignedKey,
      name: 'General / Institutional',
      code: 'GEN',
      designations: [],
      totalEmployees: 0
    };

    // Assign designations into their departments
    designations.forEach(desig => {
      // Filter by designation search
      if (desigTerm !== '') {
        const name = (desig.name || '').toLowerCase();
        const code = (desig.code || '').toLowerCase();
        const desc = (desig.description || '').toLowerCase();
        if (!name.includes(desigTerm) && !code.includes(desigTerm) && !desc.includes(desigTerm)) {
          return;
        }
      }

      const deptId = desig.department_id && groups[desig.department_id] ? desig.department_id : unassignedKey;
      groups[deptId].designations.push(desig);
      groups[deptId].totalEmployees += parseInt(desig.employee_count, 10) || 0;
    });

    // Filter by department search and remove empty groups
    return Object.values(groups).filter(g => {
      if (deptTerm !== '') {
        if (!g.name.toLowerCase().includes(deptTerm) && !(g.code || '').toLowerCase().includes(deptTerm)) {
          return false;
        }
      }
      // Hide unassigned group if it has 0 designations
      if (g.id === unassignedKey && g.designations.length === 0) {
        return false;
      }
      // If filtering by designation and department has 0 matching, hide
      if (desigTerm && g.designations.length === 0) {
        return false;
      }
      return true;
    });
  }, [departments, designations, departmentSearch, designationSearch]);

  const handleConfirmToggle = async () => {
    if (!confirmToggleDesig) return;
    const targetStatus = !confirmToggleDesig.is_active;
    await onToggleStatus(confirmToggleDesig.id, targetStatus);
    setConfirmToggleDesig(null);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '10 Jan 2026';
    try {
      const d = new Date(dateString);
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="clean-departments-wrapper">
      {/* 1. Top Clean Filter & Action Bar (Matching Screenshot 2) */}
      <div className="clean-filter-bar-card">
        <div className="filter-inputs-group">
          {/* Search Department */}
          <div className="clean-search-box">
            <Building2 size={17} className="clean-search-icon text-indigo" />
            <input
              type="text"
              className="clean-search-input"
              placeholder="Search department..."
              value={departmentSearch}
              onChange={(e) => setDepartmentSearch(e.target.value)}
            />
            {departmentSearch && (
              <button
                type="button"
                className="clean-search-clear"
                onClick={() => setDepartmentSearch('')}
              >
                ✕
              </button>
            )}
          </div>

          {/* Search Designation */}
          <div className="clean-search-box">
            <Award size={17} className="clean-search-icon text-indigo" />
            <input
              type="text"
              className="clean-search-input"
              placeholder="Search designation..."
              value={designationSearch}
              onChange={(e) => setDesignationSearch(e.target.value)}
            />
            {designationSearch && (
              <button
                type="button"
                className="clean-search-clear"
                onClick={() => setDesignationSearch('')}
              >
                ✕
              </button>
            )}
          </div>

          {/* Reset Filters */}
          <button
            type="button"
            className="clean-reset-btn"
            onClick={handleResetFilters}
          >
            <RotateCcw size={14} />
            <span>Reset Filters</span>
          </button>
        </div>

        {/* Action Buttons (Matching Screenshot 2) */}
        <div className="filter-actions-group">
          {canManage && (
            <button
              type="button"
              className="btn-clean-primary"
              onClick={onAddDesignation}
            >
              <Plus size={15} />
              <span>Add Designation</span>
            </button>
          )}

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
        <div className="error-banner" style={{ marginBottom: '16px' }}>
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

      {/* 2. Department-Grouped Accordion Table (Matching Screenshot 2) */}
      <div className="clean-table-container">
        {isLoading ? (
          <TableSkeleton rows={6} />
        ) : groupedData.length === 0 ? (
          <div className="clean-empty-state">
            <Award size={44} className="text-muted" style={{ marginBottom: '12px' }} />
            <h3>No Designations Found</h3>
            <p>Try adjusting your department or designation search terms.</p>
            <button
              type="button"
              className="clean-reset-btn"
              onClick={handleResetFilters}
              style={{ marginTop: '12px' }}
            >
              Reset Search Filters
            </button>
          </div>
        ) : (
          <table className="clean-grouped-table">
            <thead>
              <tr className="clean-table-header-row">
                <th style={{ width: '60px', textAlign: 'center' }}>#</th>
                <th style={{ width: '280px' }}>Department / Designation</th>
                <th>Description</th>
                <th style={{ width: '160px', textAlign: 'center' }}>Employees</th>
                <th style={{ width: '150px' }}>Created Date</th>
                <th style={{ width: '140px', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {groupedData.map((deptGroup) => {
                const isCollapsed = Boolean(collapsedDepts[deptGroup.id]);
                const desigCount = deptGroup.designations.length;
                const totalStaff = deptGroup.totalEmployees;

                return (
                  <React.Fragment key={deptGroup.id}>
                    {/* Department Header Row (Matching Screenshot 2 Accordion Header) */}
                    <tr className="category-header-row">
                      <td colSpan={3}>
                        <div className="category-title-cell">
                          <Folder size={18} className="category-folder-icon" />
                          <span className="category-title-text">{deptGroup.name}</span>
                        </div>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className="category-staff-pill">
                          <Users size={13} />
                          <span>{totalStaff} Employees</span>
                        </span>
                      </td>
                      <td colSpan={2}>
                        <div className="category-meta-actions">
                          <span className="category-count-badge">
                            {desigCount} {desigCount === 1 ? 'Designation' : 'Designations'}
                          </span>
                          <button
                            type="button"
                            className="category-toggle-btn"
                            onClick={() => toggleDeptCollapse(deptGroup.id)}
                            title={isCollapsed ? 'Expand Department' : 'Collapse Department'}
                            aria-label="Toggle department"
                          >
                            {isCollapsed ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Designation Rows under this Department */}
                    {!isCollapsed && deptGroup.designations.length === 0 && (
                      <tr className="empty-subrow">
                        <td></td>
                        <td colSpan={5} className="no-depts-text">
                          No designations currently registered in this department.
                        </td>
                      </tr>
                    )}

                    {!isCollapsed && deptGroup.designations.map((desig, index) => {
                      const empCount = parseInt(desig.employee_count, 10) || 0;

                      return (
                        <tr 
                          key={desig.id} 
                          className={`department-data-row ${!desig.is_active ? 'row-deactivated' : ''}`}
                        >
                          {/* Row Index */}
                          <td style={{ textAlign: 'center' }} className="row-index-cell">
                            {index + 1}
                          </td>

                          {/* Designation Name & Code */}
                          <td className="dept-name-cell">
                            <button
                              type="button"
                              className="dept-link-btn"
                              onClick={() => onViewDesignation(desig.id)}
                              title="Click to view details"
                            >
                              {desig.name}
                            </button>
                            {desig.code && (
                              <span className="dept-code-subtext">({desig.code})</span>
                            )}
                          </td>

                          {/* Description */}
                          <td className="dept-desc-cell">
                            <span title={desig.description || 'No description'}>
                              {desig.description || <span className="text-muted text-xs italic">Faculty position and duties</span>}
                            </span>
                          </td>

                          {/* Employees Count Pill (Matching Screenshot 2 Green Pill) */}
                          <td style={{ textAlign: 'center' }}>
                            {empCount > 0 ? (
                              <span className="green-employee-pill">
                                <Users size={12} />
                                <span>{empCount}</span>
                              </span>
                            ) : (
                              <span className="green-employee-pill" style={{ opacity: 0.7 }}>
                                <Users size={12} />
                                <span>0</span>
                              </span>
                            )}
                          </td>

                          {/* Created Date */}
                          <td className="row-date-cell">
                            {formatDate(desig.created_at)}
                          </td>

                          {/* Actions (Matching Screenshot 2 Square Outline Buttons) */}
                          <td style={{ textAlign: 'center' }}>
                            <div className="clean-table-actions-cell">
                              {canManage && (
                                <button
                                  type="button"
                                  className="clean-table-action-btn edit"
                                  onClick={() => onEditDesignation(desig)}
                                  title="Edit Designation"
                                  aria-label="Edit Designation"
                                >
                                  <Edit size={14} />
                                </button>
                              )}

                              {canManage && (
                                <button
                                  type="button"
                                  className={`clean-table-action-btn ${desig.is_active ? 'toggle' : 'activate'}`}
                                  onClick={() => setConfirmToggleDesig(desig)}
                                  title={desig.is_active ? 'Deactivate Designation' : 'Activate Designation'}
                                  aria-label={desig.is_active ? 'Deactivate' : 'Activate'}
                                >
                                  {desig.is_active ? <Trash2 size={14} /> : <Power size={14} />}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Confirmation Dialog for Deactivation */}
      {confirmToggleDesig && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-card modal-sm">
            <div className="modal-header">
              <h3 className="modal-title">
                {confirmToggleDesig.is_active ? 'Deactivate Designation?' : 'Activate Designation?'}
              </h3>
            </div>
            <div className="modal-body">
              <p style={{ color: '#475569', fontSize: '0.9rem', lineHeight: '1.5' }}>
                Are you sure you want to {confirmToggleDesig.is_active ? 'deactivate' : 'activate'}{' '}
                <strong>"{confirmToggleDesig.name}"</strong>?
              </p>
            </div>
            <div className="modal-actions">
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
                Confirm {confirmToggleDesig.is_active ? 'Deactivation' : 'Activation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DesignationListView;
