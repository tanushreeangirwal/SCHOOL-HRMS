import React, { useState, useMemo } from 'react';
import { 
  Folder, 
  Building2, 
  Users, 
  Search, 
  RotateCcw, 
  Edit, 
  Trash2, 
  Plus, 
  ChevronUp, 
  ChevronDown, 
  Eye, 
  UserCheck, 
  AlertCircle, 
  RefreshCw,
  Power
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { TableSkeleton } from '../common/LoadingSpinner';

export function DepartmentListView({
  departments = [],
  categories = [],
  isLoading = false,
  isRefreshing = false,
  error = null,
  onRefresh,
  onAddDepartment,
  onAddCategory,
  onAssignEmployees,
  onEditDepartment,
  onViewDepartment,
  onToggleStatus
}) {
  const { hasPermission, hasRole } = useAuth();

  const [categorySearch, setCategorySearch] = useState('');
  const [departmentSearch, setDepartmentSearch] = useState('');
  
  // Track collapsed categories (set of category IDs/names)
  const [collapsedCategories, setCollapsedCategories] = useState({});

  // Confirm Status Toggle Modal State
  const [confirmToggleDept, setConfirmToggleDept] = useState(null);

  const canManageDepartments = hasPermission('departments:create') || hasRole('Administrator', 'HR');
  const canUpdateDepartments = hasPermission('departments:update') || hasRole('Administrator', 'HR');
  const canDeleteDepartments = hasPermission('departments:delete') || hasRole('Administrator', 'HR');

  const handleResetFilters = () => {
    setCategorySearch('');
    setDepartmentSearch('');
  };

  const toggleCategoryCollapse = (categoryKey) => {
    setCollapsedCategories(prev => ({
      ...prev,
      [categoryKey]: !prev[categoryKey]
    }));
  };

  // Group departments by Category
  const groupedData = useMemo(() => {
    // 1. Filter categories and departments
    const catTerm = categorySearch.toLowerCase().trim();
    const deptTerm = departmentSearch.toLowerCase().trim();

    // Map categories into an indexed lookup
    const groups = {};

    // First populate from active categories list
    categories.forEach(cat => {
      groups[cat.id] = {
        id: cat.id,
        name: cat.name,
        code: cat.code,
        departments: []
      };
    });

    // Unassigned group placeholder
    const unassignedKey = 'unassigned';
    groups[unassignedKey] = {
      id: unassignedKey,
      name: 'General / Unclassified',
      code: 'GEN',
      departments: []
    };

    // Assign departments into their categories
    departments.forEach(dept => {
      // Filter by department search
      if (deptTerm !== '') {
        const name = (dept.name || '').toLowerCase();
        const code = (dept.code || '').toLowerCase();
        const desc = (dept.description || '').toLowerCase();
        const head = (dept.head_name || '').toLowerCase();
        if (!name.includes(deptTerm) && !code.includes(deptTerm) && !desc.includes(deptTerm) && !head.includes(deptTerm)) {
          return;
        }
      }

      const catId = dept.category_id && groups[dept.category_id] ? dept.category_id : unassignedKey;
      groups[catId].departments.push(dept);
    });

    // Filter by category search and remove empty unassigned group
    const result = Object.values(groups).filter(g => {
      if (catTerm !== '') {
        if (!g.name.toLowerCase().includes(catTerm) && !(g.code || '').toLowerCase().includes(catTerm)) {
          return false;
        }
      }
      // Hide unassigned group if it has 0 departments
      if (g.id === unassignedKey && g.departments.length === 0) {
        return false;
      }
      return true;
    });

    return result;
  }, [categories, departments, categorySearch, departmentSearch]);

  const handleConfirmToggle = async () => {
    if (!confirmToggleDept) return;
    const targetStatus = !confirmToggleDept.is_active;
    await onToggleStatus(confirmToggleDept.id, targetStatus);
    setConfirmToggleDept(null);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '24 Nov 2025';
    try {
      const d = new Date(dateString);
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="clean-departments-wrapper">
      {/* 1. Top Clean Filter & Action Bar */}
      <div className="clean-filter-bar-card">
        <div className="filter-inputs-group">
          {/* Search Category */}
          <div className="clean-search-box">
            <Folder size={17} className="clean-search-icon text-indigo" />
            <input
              type="text"
              className="clean-search-input"
              placeholder="Search category..."
              value={categorySearch}
              onChange={(e) => setCategorySearch(e.target.value)}
            />
            {categorySearch && (
              <button
                type="button"
                className="clean-search-clear"
                onClick={() => setCategorySearch('')}
              >
                ✕
              </button>
            )}
          </div>

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

        {/* Action Buttons */}
        <div className="filter-actions-group">
          {canManageDepartments && (
            <>
              <button
                type="button"
                className="btn-clean-primary"
                onClick={onAddDepartment}
              >
                <Plus size={15} />
                <span>Add Department</span>
              </button>

              <button
                type="button"
                className="btn-clean-outline"
                onClick={onAssignEmployees}
              >
                <UserCheck size={15} />
                <span>Assign Staff</span>
              </button>
            </>
          )}

          <button
            type="button"
            className="clean-icon-btn"
            onClick={onRefresh}
            disabled={isRefreshing}
            title="Refresh departments"
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
              <strong>Error loading departments:</strong> {error}
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

      {/* 2. Category-Grouped Table */}
      <div className="clean-table-container">
        {isLoading ? (
          <TableSkeleton rows={6} />
        ) : groupedData.length === 0 ? (
          <div className="clean-empty-state">
            <Building2 size={44} className="text-muted" style={{ marginBottom: '12px' }} />
            <h3>No Departments Found</h3>
            <p>Try adjusting your category or department search terms.</p>
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
                <th style={{ width: '260px' }}>Category / Department</th>
                <th>Description</th>
                <th style={{ width: '160px', textAlign: 'center' }}>Employees</th>
                <th style={{ width: '150px' }}>Created Date</th>
                <th style={{ width: '140px', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {groupedData.map((categoryGroup) => {
                const isCollapsed = Boolean(collapsedCategories[categoryGroup.id]);
                const totalCategoryStaff = categoryGroup.departments.reduce(
                  (acc, d) => acc + (parseInt(d.employee_count, 10) || 0), 
                  0
                );
                const deptCount = categoryGroup.departments.length;

                return (
                  <React.Fragment key={categoryGroup.id}>
                    {/* Category Header Row */}
                    <tr className="category-header-row">
                      <td colSpan={3}>
                        <div className="category-title-cell">
                          <Folder size={18} className="category-folder-icon" />
                          <span className="category-title-text">{categoryGroup.name}</span>
                        </div>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className="category-staff-pill">
                          <Users size={13} />
                          <span>{totalCategoryStaff} Employees</span>
                        </span>
                      </td>
                      <td colSpan={2}>
                        <div className="category-meta-actions">
                          <span className="category-count-badge">
                            {deptCount} {deptCount === 1 ? 'Department' : 'Departments'}
                          </span>
                          <button
                            type="button"
                            className="category-toggle-btn"
                            onClick={() => toggleCategoryCollapse(categoryGroup.id)}
                            title={isCollapsed ? 'Expand Category' : 'Collapse Category'}
                            aria-label="Toggle category"
                          >
                            {isCollapsed ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Department Rows under this Category */}
                    {!isCollapsed && categoryGroup.departments.length === 0 && (
                      <tr className="empty-subrow">
                        <td></td>
                        <td colSpan={5} className="no-depts-text">
                          No departments currently in this category.
                        </td>
                      </tr>
                    )}

                    {!isCollapsed && categoryGroup.departments.map((dept, index) => {
                      const empCount = parseInt(dept.employee_count, 10) || 0;

                      return (
                        <tr key={dept.id} className={`department-data-row ${!dept.is_active ? 'row-deactivated' : ''}`}>
                          {/* Row Number */}
                          <td style={{ textAlign: 'center' }} className="row-index-cell">
                            {index + 1}
                          </td>

                          {/* Department Name */}
                          <td className="dept-name-cell">
                            <button
                              type="button"
                              className="dept-link-btn"
                              onClick={() => onViewDepartment(dept.id)}
                              title="Click to view details"
                            >
                              {dept.name}
                            </button>
                            {dept.code && (
                              <span className="dept-code-subtext">({dept.code})</span>
                            )}
                          </td>

                          {/* Description */}
                          <td className="dept-desc-cell">
                            <span title={dept.description || 'No description'}>
                              {dept.description || <span className="text-muted text-xs italic">No description</span>}
                            </span>
                          </td>

                          {/* Employees Count Badge */}
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

                          {/* Created Date */}
                          <td className="date-cell">
                            {formatDate(dept.created_at || dept.effective_date)}
                          </td>

                          {/* Actions (Edit & Delete / Deactivate) */}
                          <td style={{ textAlign: 'center' }}>
                            <div className="clean-actions-wrapper">
                              {canUpdateDepartments && (
                                <button
                                  type="button"
                                  className="action-btn-edit"
                                  onClick={() => onEditDepartment(dept)}
                                  title="Edit Department"
                                >
                                  <Edit size={13} />
                                  <span>Edit</span>
                                </button>
                              )}

                              {canDeleteDepartments && (
                                <button
                                  type="button"
                                  className={`action-btn-delete ${!dept.is_active ? 'btn-is-deactivated' : ''}`}
                                  onClick={() => setConfirmToggleDept(dept)}
                                  title={dept.is_active ? 'Deactivate / Delete' : 'Reactivate Department'}
                                >
                                  {dept.is_active ? <Trash2 size={13} /> : <Power size={13} />}
                                  <span>{dept.is_active ? 'Delete' : 'Active'}</span>
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

      {/* 3. Confirm Deactivation Modal */}
      {confirmToggleDept && (
        <div className="modal-backdrop" onClick={() => setConfirmToggleDept(null)}>
          <div className="modal-container modal-confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-header-icon-title">
                <div className={`icon-badge-primary ${confirmToggleDept.is_active ? 'badge-danger-glow' : 'badge-success-glow'}`}>
                  <Power size={22} />
                </div>
                <div>
                  <h3 className="modal-title">
                    {confirmToggleDept.is_active ? 'Deactivate Department?' : 'Activate Department?'}
                  </h3>
                  <p className="modal-subtitle">{confirmToggleDept.name}</p>
                </div>
              </div>
            </div>
            <div className="modal-body">
              <p className="confirm-text">
                {confirmToggleDept.is_active ? (
                  <>
                    Are you sure you want to deactivate <strong>{confirmToggleDept.name}</strong>? 
                    Assigned employees and historical records will remain safe and intact.
                  </>
                ) : (
                  <>
                    Are you sure you want to re-activate <strong>{confirmToggleDept.name}</strong>? 
                    It will become immediately available for staff assignments.
                  </>
                )}
              </p>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setConfirmToggleDept(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`btn ${confirmToggleDept.is_active ? 'btn-danger' : 'btn-primary'}`}
                onClick={handleConfirmToggle}
              >
                {confirmToggleDept.is_active ? 'Deactivate Department' : 'Activate Department'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DepartmentListView;
