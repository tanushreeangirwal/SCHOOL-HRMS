import React, { useState, useMemo } from 'react';
import { 
  Layers, 
  Plus, 
  Search, 
  Filter, 
  Building2, 
  CheckCircle2, 
  Edit3, 
  Power, 
  AlertCircle, 
  RefreshCw, 
  Eye, 
  Award,
  Users,
  Briefcase
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { TableSkeleton } from '../common/LoadingSpinner';

export function DesignationHierarchyView({
  designations = [],
  departments = [],
  isLoading = false,
  isRefreshing = false,
  error = null,
  onRefresh,
  onAddDesignation,
  onEditDesignation,
  onViewDesignation,
  onToggleStatus,
  onNavigateToDepartmentDirectory
}) {
  const { hasPermission, isSuperAdmin, isAdmin, isHR } = useAuth();
  const canManage = isSuperAdmin || isAdmin || isHR || hasPermission('designations:create');

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Confirmation modal for status toggle
  const [confirmToggleItem, setConfirmToggleItem] = useState(null);

  // Real KPIs calculation
  const totalDesignationsCount = designations.length;
  const activeDesignationsCount = designations.filter(d => d.is_active).length;
  const inactiveDesignationsCount = totalDesignationsCount - activeDesignationsCount;
  const totalAssignedStaffCount = designations.reduce((acc, d) => acc + (parseInt(d.employee_count, 10) || 0), 0);

  // Group designations by department
  const departmentGroups = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    const groups = {};

    // First index all existing departments
    departments.forEach(dept => {
      groups[dept.id] = {
        id: dept.id,
        name: dept.name,
        code: dept.code || dept.name.slice(0, 3).toUpperCase(),
        description: dept.description || `${dept.name} departmental faculty and staff`,
        is_active: dept.is_active !== undefined ? dept.is_active : true,
        designations: [],
        totalEmployees: 0
      };
    });

    // Unassigned group placeholder
    const unassignedId = 'unassigned';
    groups[unassignedId] = {
      id: unassignedId,
      name: 'General / School-Wide',
      code: 'GEN',
      description: 'Cross-functional institutional designations',
      is_active: true,
      designations: [],
      totalEmployees: 0
    };

    // Distribute designations into their departments
    designations.forEach(desig => {
      // Status filter
      if (statusFilter === 'ACTIVE' && !desig.is_active) return;
      if (statusFilter === 'INACTIVE' && desig.is_active) return;

      // Search term filter
      if (term) {
        const nameMatch = (desig.name || '').toLowerCase().includes(term);
        const codeMatch = (desig.code || '').toLowerCase().includes(term);
        const deptMatch = (desig.department_name || '').toLowerCase().includes(term);
        const descMatch = (desig.description || '').toLowerCase().includes(term);
        if (!nameMatch && !codeMatch && !deptMatch && !descMatch) return;
      }

      const targetDeptId = desig.department_id && groups[desig.department_id] ? desig.department_id : unassignedId;
      groups[targetDeptId].designations.push(desig);
      groups[targetDeptId].totalEmployees += parseInt(desig.employee_count, 10) || 0;
    });

    // Filter out unassigned if empty, or departments with 0 designations when searching
    return Object.values(groups).filter(group => {
      if (group.id === unassignedId && group.designations.length === 0) return false;
      if (term && group.designations.length === 0) return false;
      return true;
    });
  }, [departments, designations, searchTerm, statusFilter]);

  const handleConfirmToggle = async () => {
    if (!confirmToggleItem) return;
    await onToggleStatus(confirmToggleItem.id, !confirmToggleItem.is_active);
    setConfirmToggleItem(null);
  };

  return (
    <div className="dept-categories-shell">
      {/* 1. Page Header & Explanation Banner (Matching Screenshot 1) */}
      <div className="dept-categories-header-card">
        <div className="categories-header-left">
          <div className="category-header-badge">
            <Layers size={15} />
            <span>Organizational Hierarchy</span>
          </div>
          <h2 className="categories-page-title">Designations & Role Hierarchy</h2>
          <p className="categories-page-subtitle">
            Organize institutional designations into departmental faculties, administrative wings, and academic ranks.
          </p>
        </div>

        <div className="categories-header-actions">
          {canManage && (
            <button 
              type="button" 
              className="btn btn-primary"
              onClick={onAddDesignation}
            >
              <Plus size={16} />
              <span>Add Designation</span>
            </button>
          )}

          <button
            type="button"
            className="btn btn-secondary btn-icon-only"
            onClick={onRefresh}
            disabled={isRefreshing}
            title="Refresh designations"
            aria-label="Refresh designations"
          >
            <RefreshCw size={15} className={isRefreshing ? 'spin-animation' : ''} />
          </button>
        </div>
      </div>

      {/* 2. Real Data Summary KPI Cards (Matching Screenshot 1) */}
      <div className="category-kpi-grid">
        <div className="category-kpi-card">
          <div className="category-kpi-header">
            <span className="category-kpi-label">Total Designations</span>
            <div className="kpi-icon-pill indigo">
              <Award size={18} />
            </div>
          </div>
          <div className="category-kpi-value-row">
            <span className="category-kpi-number">{totalDesignationsCount}</span>
            <span className="category-kpi-subtext">Active Organizational Roles</span>
          </div>
        </div>

        <div className="category-kpi-card">
          <div className="category-kpi-header">
            <span className="category-kpi-label">Active Positions</span>
            <div className="kpi-icon-pill emerald">
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div className="category-kpi-value-row">
            <span className="category-kpi-number">{activeDesignationsCount}</span>
            <span className="category-kpi-subtext">
              {inactiveDesignationsCount > 0 ? `${inactiveDesignationsCount} Inactive Positions` : 'All Designations Active'}
            </span>
          </div>
        </div>

        <div className="category-kpi-card">
          <div className="category-kpi-header">
            <span className="category-kpi-label">Assigned Staff</span>
            <div className="kpi-icon-pill sky">
              <Users size={18} />
            </div>
          </div>
          <div className="category-kpi-value-row">
            <span className="category-kpi-number">{totalAssignedStaffCount}</span>
            <span className="category-kpi-subtext">Faculty & Staff Members</span>
          </div>
        </div>
      </div>

      {/* 3. Controls & Filter Bar */}
      <div className="category-controls-card">
        <div className="category-search-wrapper">
          <Search className="search-icon" size={16} />
          <input
            type="text"
            className="category-search-input"
            placeholder="Search designation title, code, or department..."
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
              ✕
            </button>
          )}
        </div>

        <div className="category-filter-wrapper">
          <Filter size={15} className="filter-icon" />
          <select
            className="category-status-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="ALL">All Statuses ({totalDesignationsCount})</option>
            <option value="ACTIVE">Active Only ({activeDesignationsCount})</option>
            <option value="INACTIVE">Inactive Only ({inactiveDesignationsCount})</option>
          </select>
        </div>
      </div>

      {/* 4. Error Banner */}
      {error && (
        <div className="error-banner" style={{ marginBottom: '20px' }}>
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

      {/* 5. Main Cards Grid (Matching Screenshot 1) */}
      {isLoading ? (
        <div className="category-loading-wrapper">
          <TableSkeleton rows={4} />
        </div>
      ) : departmentGroups.length === 0 ? (
        <div className="category-empty-state-card">
          <div className="empty-state-icon-box">
            <Award size={40} className="text-muted" />
          </div>
          <h3 className="empty-title">
            {searchTerm || statusFilter !== 'ALL' ? 'No Matching Designations' : 'No Designations Created Yet'}
          </h3>
          <p className="empty-subtitle">
            {searchTerm || statusFilter !== 'ALL'
              ? 'Try changing your search terms or status filter.'
              : 'Add designations such as Head of Science, Senior Teacher, and Administrator to organize your staff hierarchy.'}
          </p>
          {canManage && !searchTerm && statusFilter === 'ALL' && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={onAddDesignation}
            >
              <Plus size={16} />
              <span>Add First Designation</span>
            </button>
          )}
        </div>
      ) : (
        <div className="category-cards-grid">
          {departmentGroups.map((group) => {
            const desigCount = group.designations.length;

            return (
              <div key={group.id} className="category-card">
                <div className="category-card-header">
                  <div className="category-card-title-wrap">
                    <div className="category-icon-box">
                      <Building2 size={18} />
                    </div>
                    <div className="category-title-info">
                      <div className="category-name-row">
                        <h3 className="category-name">{group.name}</h3>
                        {group.code && (
                          <span className="category-code-tag">{group.code}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <span className={`status-pill ${group.is_active ? 'active' : 'inactive'}`}>
                    <span className="status-dot"></span>
                    {group.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <p className="category-desc">{group.description}</p>

                {/* Sub-box listing designations (Matching Screenshot 1) */}
                <div className="category-assigned-departments-box">
                  <div className="assigned-dept-header">
                    <div className="assigned-dept-count-badge">
                      <Award size={13} />
                      <span>{desigCount} {desigCount === 1 ? 'Designation' : 'Designations'}</span>
                    </div>
                    {group.totalEmployees > 0 && (
                      <span className="category-staff-meta">
                        <Users size={12} />
                        <span>{group.totalEmployees} Staff</span>
                      </span>
                    )}
                  </div>

                  <div className="category-dept-pills-list">
                    {desigCount === 0 ? (
                      <span className="no-depts-label">No designations registered for this department.</span>
                    ) : (
                      group.designations.slice(0, 4).map((desig) => (
                        <span 
                          key={desig.id} 
                          className="dept-pill-tag"
                          title={`${desig.name} (${desig.code || 'No Code'}) • ${desig.employee_count || 0} Staff`}
                          onClick={() => onViewDesignation(desig.id)}
                          style={{ cursor: 'pointer' }}
                        >
                          {desig.name}
                        </span>
                      ))
                    )}
                    {desigCount > 4 && (
                      <span className="dept-pill-more">+{desigCount - 4} more</span>
                    )}
                  </div>
                </div>

                {/* Card Footer Actions */}
                <div className="category-card-footer">
                  <button
                    type="button"
                    className="btn-view-departments"
                    onClick={() => {
                      if (onNavigateToDepartmentDirectory) {
                        onNavigateToDepartmentDirectory(group.name);
                      }
                    }}
                  >
                    <Eye size={14} />
                    <span>View Designations</span>
                  </button>

                  <div className="category-card-icon-actions">
                    {canManage && group.designations.length > 0 && (
                      <button
                        type="button"
                        className="card-action-btn edit"
                        onClick={() => onEditDesignation(group.designations[0])}
                        title={`Edit ${group.designations[0].name}`}
                      >
                        <Edit3 size={14} />
                      </button>
                    )}
                    {canManage && group.designations.length > 0 && (
                      <button
                        type="button"
                        className="card-action-btn toggle"
                        onClick={() => setConfirmToggleItem(group.designations[0])}
                        title={group.designations[0].is_active ? 'Deactivate' : 'Activate'}
                      >
                        <Power size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Confirmation Modal for Toggle Status */}
      {confirmToggleItem && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-card modal-sm">
            <div className="modal-header">
              <h3 className="modal-title">
                {confirmToggleItem.is_active ? 'Deactivate Designation?' : 'Activate Designation?'}
              </h3>
            </div>
            <div className="modal-body">
              <p style={{ color: '#475569', fontSize: '0.9rem', lineHeight: '1.5' }}>
                Are you sure you want to {confirmToggleItem.is_active ? 'deactivate' : 'activate'}{' '}
                <strong>"{confirmToggleItem.name}"</strong>?
              </p>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setConfirmToggleItem(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`btn ${confirmToggleItem.is_active ? 'btn-danger' : 'btn-primary'}`}
                onClick={handleConfirmToggle}
              >
                Confirm {confirmToggleItem.is_active ? 'Deactivation' : 'Activation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DesignationHierarchyView;
