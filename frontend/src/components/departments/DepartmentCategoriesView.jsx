import React, { useState, useMemo } from 'react';
import { 
  FolderTree, 
  Plus, 
  Search, 
  Filter, 
  Building2, 
  CheckCircle2, 
  Edit3, 
  Power, 
  AlertCircle, 
  RefreshCw, 
  Save, 
  X, 
  Loader2, 
  Eye, 
  Trash2, 
  Calendar, 
  ArrowRight, 
  Layers,
  ChevronRight,
  Info,
  Sparkles,
  UserCheck
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { TableSkeleton } from '../common/LoadingSpinner';
import { hrmsApi } from '../../services/api';

export function DepartmentCategoriesView({ 
  categories = [], 
  departments = [],
  isLoading = false, 
  isRefreshing = false, 
  error = null, 
  onRefresh, 
  onCategorySaved, 
  onToggleStatus,
  onDepartmentsChanged,
  showToast
}) {
  const { hasPermission, hasRole, isSuperAdmin, isAdmin, isHR, isManager, isEmployee } = useAuth();

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Active Selected Category (Side-Panel / Details View)
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [deptSearchTerm, setDeptSearchTerm] = useState('');

  // Add / Edit Category Modal State
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [categoryFormData, setCategoryFormData] = useState({ name: '', code: '', description: '', is_active: true });
  const [isSubmittingCategory, setIsSubmittingCategory] = useState(false);
  const [categoryFormError, setCategoryFormError] = useState(null);

  // Assign Department Modal State
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedDeptIdToAssign, setSelectedDeptIdToAssign] = useState('');
  const [isSubmittingAssign, setIsSubmittingAssign] = useState(false);
  const [assignError, setAssignError] = useState(null);

  // Remove Department Confirmation Dialog
  const [deptToRemove, setDeptToRemove] = useState(null);
  const [isSubmittingRemove, setIsSubmittingRemove] = useState(false);

  // Toggle Category Status Confirmation Dialog
  const [confirmToggleCategory, setConfirmToggleCategory] = useState(null);
  const [isSubmittingToggle, setIsSubmittingToggle] = useState(false);

  // RBAC permissions
  const canManageCategories = hasPermission('department_categories:create') || isSuperAdmin || isAdmin || isHR;
  const canUpdateCategories = hasPermission('department_categories:update') || isSuperAdmin || isAdmin || isHR;
  const canDeleteCategories = hasPermission('department_categories:delete') || isSuperAdmin || isAdmin || isHR;
  const canAssignDepartment = hasPermission('departments:update') || isSuperAdmin || isAdmin || isHR;

  // Compute Real KPI Counts
  const totalCategoriesCount = categories.length;
  const activeCategoriesCount = categories.filter(c => c.is_active).length;
  const inactiveCategoriesCount = categories.filter(c => !c.is_active).length;
  const totalDepartmentsCount = departments.length;

  // Filter Categories by search and status
  const filteredCategories = useMemo(() => {
    return categories.filter(c => {
      if (statusFilter === 'ACTIVE' && !c.is_active) return false;
      if (statusFilter === 'INACTIVE' && c.is_active) return false;

      if (searchTerm.trim() !== '') {
        const term = searchTerm.toLowerCase().trim();
        const name = (c.name || '').toLowerCase();
        const code = (c.code || '').toLowerCase();
        const desc = (c.description || '').toLowerCase();
        return name.includes(term) || code.includes(term) || desc.includes(term);
      }

      return true;
    });
  }, [categories, searchTerm, statusFilter]);

  // If a category is selected in the side-panel, get its assigned departments
  const currentCategoryDepartments = useMemo(() => {
    if (!selectedCategory) return [];
    return departments.filter(d => d.category_id === selectedCategory.id);
  }, [departments, selectedCategory]);

  // Filter departments inside the active category side-panel
  const filteredCategoryDepartments = useMemo(() => {
    if (!deptSearchTerm.trim()) return currentCategoryDepartments;
    const term = deptSearchTerm.toLowerCase().trim();
    return currentCategoryDepartments.filter(d => {
      const name = (d.name || '').toLowerCase();
      const code = (d.code || '').toLowerCase();
      const head = (d.head_name || '').toLowerCase();
      return name.includes(term) || code.includes(term) || head.includes(term);
    });
  }, [currentCategoryDepartments, deptSearchTerm]);

  // Departments available to be assigned to the selected category
  const assignableDepartments = useMemo(() => {
    if (!selectedCategory) return [];
    // Show departments not currently in this category
    return departments.filter(d => d.category_id !== selectedCategory.id);
  }, [departments, selectedCategory]);

  // -------------------------------------------------------------------------
  // Handlers: Add / Edit Category
  // -------------------------------------------------------------------------
  const handleOpenAddCategory = () => {
    setEditingCategory(null);
    setCategoryFormData({ name: '', code: '', description: '', is_active: true });
    setCategoryFormError(null);
    setIsCategoryModalOpen(true);
  };

  const handleOpenEditCategory = (category, e) => {
    if (e) e.stopPropagation();
    setEditingCategory(category);
    setCategoryFormData({
      name: category.name || '',
      code: category.code || '',
      description: category.description || '',
      is_active: category.is_active !== undefined ? Boolean(category.is_active) : true
    });
    setCategoryFormError(null);
    setIsCategoryModalOpen(true);
  };

  const handleSaveCategory = async (e) => {
    e.preventDefault();
    setCategoryFormError(null);

    const cleanName = categoryFormData.name.trim();
    if (!cleanName || cleanName.length < 2) {
      setCategoryFormError('Category name is required and must be at least 2 characters.');
      return;
    }

    // Check duplicate name client-side
    const duplicate = categories.find(
      c => c.name.toLowerCase().trim() === cleanName.toLowerCase() && (!editingCategory || c.id !== editingCategory.id)
    );
    if (duplicate) {
      setCategoryFormError(`A category named "${cleanName}" already exists.`);
      return;
    }

    setIsSubmittingCategory(true);

    try {
      let res;
      if (editingCategory) {
        res = await hrmsApi.updateDepartmentCategory(editingCategory.id, categoryFormData);
      } else {
        res = await hrmsApi.createDepartmentCategory(categoryFormData);
      }

      if (res && res.success) {
        setIsCategoryModalOpen(false);
        if (onCategorySaved) {
          onCategorySaved(res.data, Boolean(editingCategory));
        }
        if (showToast) {
          showToast(
            'success',
            editingCategory ? 'Category Updated' : 'Category Created',
            `Category "${res.data.name}" has been successfully saved.`
          );
        }
        // If updating the currently viewed category, update selection
        if (selectedCategory && editingCategory && selectedCategory.id === editingCategory.id) {
          setSelectedCategory({ ...selectedCategory, ...res.data });
        }
      } else {
        throw new Error(res?.message || 'Failed to save category.');
      }
    } catch (err) {
      console.error('Category save error:', err);
      setCategoryFormError(err.message || 'Failed to save category.');
    } finally {
      setIsSubmittingCategory(false);
    }
  };

  // -------------------------------------------------------------------------
  // Handlers: Toggle Status
  // -------------------------------------------------------------------------
  const handleConfirmToggleStatus = async () => {
    if (!confirmToggleCategory) return;
    setIsSubmittingToggle(true);

    try {
      const targetStatus = !confirmToggleCategory.is_active;
      await onToggleStatus(confirmToggleCategory.id, targetStatus);
      if (showToast) {
        showToast(
          'success',
          targetStatus ? 'Category Activated' : 'Category Deactivated',
          `"${confirmToggleCategory.name}" is now ${targetStatus ? 'active' : 'inactive'}.`
        );
      }
      if (selectedCategory && selectedCategory.id === confirmToggleCategory.id) {
        setSelectedCategory({ ...selectedCategory, is_active: targetStatus });
      }
      setConfirmToggleCategory(null);
    } catch (err) {
      console.error('Status toggle error:', err);
      if (showToast) {
        showToast('error', 'Status Update Failed', err.message || 'Could not update category status.');
      }
    } finally {
      setIsSubmittingToggle(false);
    }
  };

  // -------------------------------------------------------------------------
  // Handlers: Assign Department to Category
  // -------------------------------------------------------------------------
  const handleOpenAssignModal = () => {
    if (!selectedCategory) return;
    setSelectedDeptIdToAssign('');
    setAssignError(null);
    setIsAssignModalOpen(true);
  };

  const handleAssignDepartment = async (e) => {
    e.preventDefault();
    setAssignError(null);

    if (!selectedDeptIdToAssign) {
      setAssignError('Please select a department to assign.');
      return;
    }

    setIsSubmittingAssign(true);

    try {
      const res = await hrmsApi.updateDepartmentCategory(selectedDeptIdToAssign, selectedCategory.id);
      if (res && res.success) {
        const assignedDept = departments.find(d => d.id === selectedDeptIdToAssign);
        setIsAssignModalOpen(false);
        if (onDepartmentsChanged) {
          onDepartmentsChanged();
        }
        if (showToast) {
          showToast(
            'success',
            'Department Assigned',
            `"${assignedDept?.name || 'Department'}" has been assigned to ${selectedCategory.name}.`
          );
        }
      } else {
        throw new Error(res?.message || 'Failed to assign department.');
      }
    } catch (err) {
      console.error('Assign department error:', err);
      setAssignError(err.message || 'Failed to assign department to category.');
    } finally {
      setIsSubmittingAssign(false);
    }
  };

  // -------------------------------------------------------------------------
  // Handlers: Remove Department from Category
  // -------------------------------------------------------------------------
  const handleConfirmRemoveDepartment = async () => {
    if (!deptToRemove || !selectedCategory) return;
    setIsSubmittingRemove(true);

    try {
      const res = await hrmsApi.updateDepartmentCategory(deptToRemove.id, null);
      if (res && res.success) {
        if (onDepartmentsChanged) {
          onDepartmentsChanged();
        }
        if (showToast) {
          showToast(
            'success',
            'Department Removed',
            `"${deptToRemove.name}" was removed from ${selectedCategory.name}. The department itself remains intact.`
          );
        }
        setDeptToRemove(null);
      } else {
        throw new Error(res?.message || 'Failed to remove department.');
      }
    } catch (err) {
      console.error('Remove department error:', err);
      if (showToast) {
        showToast('error', 'Removal Failed', err.message || 'Failed to remove department from category.');
      }
    } finally {
      setIsSubmittingRemove(false);
    }
  };

  return (
    <div className="dept-categories-shell">
      {/* 1. Page Header & Explanation Banner */}
      <div className="dept-categories-header-card">
        <div className="categories-header-left">
          <div className="category-header-badge">
            <Layers size={15} />
            <span>Organizational Hierarchy</span>
          </div>
          <h2 className="categories-page-title">Department Categories</h2>
          <p className="categories-page-subtitle">
            Organize departments into clear organizational groups. Classify academic faculties, administrative units, and support services.
          </p>
        </div>

        <div className="categories-header-actions">
          {canManageCategories && (
            <button 
              type="button" 
              className="btn btn-primary"
              onClick={handleOpenAddCategory}
            >
              <Plus size={16} />
              <span>Add Category</span>
            </button>
          )}

          <button
            type="button"
            className="btn btn-secondary btn-icon-only"
            onClick={onRefresh}
            disabled={isRefreshing}
            title="Refresh categories"
            aria-label="Refresh categories"
          >
            <RefreshCw size={15} className={isRefreshing ? 'spin-animation' : ''} />
          </button>
        </div>
      </div>

      {/* 2. Real Data Summary KPI Cards */}
      <div className="category-kpi-grid">
        <div className="category-kpi-card">
          <div className="category-kpi-header">
            <span className="category-kpi-label">Total Categories</span>
            <div className="kpi-icon-pill indigo">
              <FolderTree size={18} />
            </div>
          </div>
          <div className="category-kpi-value-row">
            <span className="category-kpi-number">{totalCategoriesCount}</span>
            <span className="category-kpi-subtext">Active Organizational Groups</span>
          </div>
        </div>

        <div className="category-kpi-card">
          <div className="category-kpi-header">
            <span className="category-kpi-label">Active Categories</span>
            <div className="kpi-icon-pill emerald">
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div className="category-kpi-value-row">
            <span className="category-kpi-number">{activeCategoriesCount}</span>
            <span className="category-kpi-subtext">
              {inactiveCategoriesCount > 0 ? `${inactiveCategoriesCount} Inactive` : 'All Categories Active'}
            </span>
          </div>
        </div>

        <div className="category-kpi-card">
          <div className="category-kpi-header">
            <span className="category-kpi-label">Total Departments</span>
            <div className="kpi-icon-pill sky">
              <Building2 size={18} />
            </div>
          </div>
          <div className="category-kpi-value-row">
            <span className="category-kpi-number">{totalDepartmentsCount}</span>
            <span className="category-kpi-subtext">Faculties & Institutional Wings</span>
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
            placeholder="Search category name, code, or description..."
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
            <option value="ALL">All Statuses ({totalCategoriesCount})</option>
            <option value="ACTIVE">Active Only ({activeCategoriesCount})</option>
            <option value="INACTIVE">Inactive Only ({inactiveCategoriesCount})</option>
          </select>
        </div>
      </div>

      {/* 4. Error Banner */}
      {error && (
        <div className="error-banner" style={{ marginBottom: '20px' }}>
          <div className="error-banner-content">
            <AlertCircle size={20} className="error-icon" />
            <div className="error-text">
              <strong>Error loading categories:</strong> {error}
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

      {/* 5. Main Categories Grid / Empty / Loading State */}
      {isLoading ? (
        <div className="category-loading-wrapper">
          <TableSkeleton rows={4} />
        </div>
      ) : filteredCategories.length === 0 ? (
        <div className="category-empty-state-card">
          <div className="empty-state-icon-box">
            <FolderTree size={40} className="text-muted" />
          </div>
          <h3 className="empty-title">
            {searchTerm || statusFilter !== 'ALL' ? 'No Matching Categories' : 'No Department Categories Created Yet'}
          </h3>
          <p className="empty-subtitle">
            {searchTerm || statusFilter !== 'ALL'
              ? 'Try changing your search terms or status filter.'
              : 'Create categories such as Academic Faculties, Administration, and Support Services to organize school departments.'}
          </p>
          {canManageCategories && !searchTerm && statusFilter === 'ALL' && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleOpenAddCategory}
            >
              <Plus size={16} />
              <span>Create First Category</span>
            </button>
          )}
          {(searchTerm || statusFilter !== 'ALL') && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => { setSearchTerm(''); setStatusFilter('ALL'); }}
            >
              <span>Reset Search & Filters</span>
            </button>
          )}
        </div>
      ) : (
        <div className="category-cards-grid">
          {filteredCategories.map((category) => {
            // Count departments in this category from departments array (real-time)
            const deptCount = departments.filter(d => d.category_id === category.id).length || parseInt(category.department_count, 10) || 0;
            const categoryDepts = departments.filter(d => d.category_id === category.id);
            const isSelected = selectedCategory?.id === category.id;

            return (
              <div 
                key={category.id} 
                className={`category-item-card ${!category.is_active ? 'category-inactive' : ''} ${isSelected ? 'category-selected' : ''}`}
                onClick={() => setSelectedCategory(category)}
              >
                {/* Card Header */}
                <div className="category-card-top">
                  <div className="category-title-wrap">
                    <div className="category-icon-avatar">
                      <FolderTree size={18} />
                    </div>
                    <div>
                      <div className="category-name-row">
                        <h3 className="category-name">{category.name}</h3>
                        {category.code && (
                          <span className="category-code-tag text-monospace">{category.code}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <span className={`status-pill ${category.is_active ? 'badge-active' : 'badge-inactive'}`}>
                    <span className="status-dot"></span>
                    <span>{category.is_active ? 'Active' : 'Inactive'}</span>
                  </span>
                </div>

                {/* Card Description */}
                <p className="category-desc">
                  {category.description || <span className="text-muted text-xs italic">No description provided</span>}
                </p>

                {/* Department Preview / Count Badge */}
                <div className="category-dept-summary">
                  <span className={`category-dept-count-badge ${deptCount > 0 ? 'has-depts' : 'no-depts'}`}>
                    <Building2 size={13} />
                    <span>{deptCount} {deptCount === 1 ? 'Department' : 'Departments'}</span>
                  </span>

                  {categoryDepts.length > 0 && (
                    <div className="category-dept-pills-preview">
                      {categoryDepts.slice(0, 3).map(d => (
                        <span key={d.id} className="dept-mini-pill" title={d.name}>
                          {d.name}
                        </span>
                      ))}
                      {categoryDepts.length > 3 && (
                        <span className="dept-mini-pill more-pill">
                          +{categoryDepts.length - 3} more
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Card Actions Footer */}
                <div className="category-card-actions" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    className="btn-category-action view-btn"
                    onClick={() => setSelectedCategory(category)}
                    title="View Departments in Category"
                  >
                    <Eye size={14} />
                    <span>View Departments</span>
                  </button>

                  <div className="category-actions-right">
                    {canUpdateCategories && (
                      <button
                        type="button"
                        className="btn-action-icon edit"
                        onClick={(e) => handleOpenEditCategory(category, e)}
                        title="Edit Category"
                      >
                        <Edit3 size={14} />
                      </button>
                    )}

                    {canDeleteCategories && (
                      <button
                        type="button"
                        className={`btn-action-icon ${category.is_active ? 'deactivate' : 'activate'}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmToggleCategory(category);
                        }}
                        title={category.is_active ? 'Deactivate Category' : 'Activate Category'}
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

      {/* =====================================================================
          6. VIEW CATEGORY DETAILS & DEPARTMENTS SIDE PANEL (DRAWER)
          ===================================================================== */}
      {selectedCategory && (
        <div className="category-drawer-backdrop" onClick={() => setSelectedCategory(null)}>
          <div className="category-drawer-panel" onClick={(e) => e.stopPropagation()}>
            {/* Drawer Header */}
            <div className="category-drawer-header">
              <div className="drawer-header-left">
                <div className="drawer-icon-box">
                  <FolderTree size={22} />
                </div>
                <div>
                  <div className="drawer-title-row">
                    <h2 className="drawer-title">{selectedCategory.name}</h2>
                    <span className={`status-pill ${selectedCategory.is_active ? 'badge-active' : 'badge-inactive'}`}>
                      <span className="status-dot"></span>
                      <span>{selectedCategory.is_active ? 'Active' : 'Inactive'}</span>
                    </span>
                  </div>
                  <p className="drawer-code text-monospace">
                    {selectedCategory.code ? `Code: ${selectedCategory.code}` : 'Category Details & Department Allocation'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                className="drawer-close-btn"
                onClick={() => setSelectedCategory(null)}
                aria-label="Close Details Panel"
              >
                <X size={20} />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="category-drawer-body">
              {/* Category Info Box */}
              <div className="category-meta-box">
                <div className="category-meta-section">
                  <span className="meta-label">Description</span>
                  <p className="meta-value">
                    {selectedCategory.description || 'No description provided for this category.'}
                  </p>
                </div>

                <div className="category-meta-row">
                  <div className="meta-col">
                    <span className="meta-label">Total Departments</span>
                    <span className="meta-badge-count">{currentCategoryDepartments.length}</span>
                  </div>
                  <div className="meta-col">
                    <span className="meta-label">Total Staff</span>
                    <span className="meta-badge-count">
                      {currentCategoryDepartments.reduce((acc, d) => acc + (parseInt(d.employee_count, 10) || 0), 0)} Faculty & Staff
                    </span>
                  </div>
                </div>
              </div>

              {/* Departments In Category Section */}
              <div className="drawer-departments-section">
                <div className="section-header-row">
                  <div>
                    <h3 className="section-heading">
                      Departments in this Category ({currentCategoryDepartments.length})
                    </h3>
                    <p className="section-subheading">
                      Faculties and academic wings classified under {selectedCategory.name}
                    </p>
                  </div>

                  {canAssignDepartment && (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={handleOpenAssignModal}
                    >
                      <Plus size={15} />
                      <span>Assign Department</span>
                    </button>
                  )}
                </div>

                {/* In-category department search filter if multiple depts */}
                {currentCategoryDepartments.length > 2 && (
                  <div className="drawer-dept-search-box">
                    <Search size={14} className="search-icon" />
                    <input
                      type="text"
                      className="drawer-dept-input"
                      placeholder="Filter departments in this category..."
                      value={deptSearchTerm}
                      onChange={(e) => setDeptSearchTerm(e.target.value)}
                    />
                    {deptSearchTerm && (
                      <button
                        type="button"
                        className="search-clear-btn"
                        onClick={() => setDeptSearchTerm('')}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                )}

                {/* Departments List in Category */}
                {filteredCategoryDepartments.length === 0 ? (
                  <div className="drawer-empty-depts">
                    <Building2 size={32} className="text-muted" style={{ margin: '0 auto 10px' }} />
                    <h4 className="drawer-empty-title">
                      {deptSearchTerm ? 'No matching departments' : 'No Departments in this Category'}
                    </h4>
                    <p className="drawer-empty-desc">
                      {deptSearchTerm
                        ? 'Try adjusting your search query.'
                        : `Assign existing departments to "${selectedCategory.name}" to organize your school structure.`}
                    </p>
                    {canAssignDepartment && !deptSearchTerm && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={handleOpenAssignModal}
                        style={{ marginTop: '10px' }}
                      >
                        <Plus size={14} />
                        <span>Assign Existing Department</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="drawer-dept-list">
                    {filteredCategoryDepartments.map((dept) => (
                      <div key={dept.id} className="drawer-dept-card">
                        <div className="drawer-dept-left">
                          <div className="drawer-dept-icon">
                            <Building2 size={16} />
                          </div>
                          <div className="drawer-dept-info">
                            <div className="drawer-dept-name-row">
                              <h4 className="drawer-dept-name">{dept.name}</h4>
                              {dept.code && (
                                <span className="dept-code-pill text-monospace">{dept.code}</span>
                              )}
                            </div>
                            <div className="drawer-dept-meta-row">
                              <span className="drawer-dept-head">
                                {dept.head_name ? `HOD: ${dept.head_name}` : 'HOD: Pending Appointment'}
                              </span>
                              <span className="drawer-dept-dot">•</span>
                              <span className="drawer-dept-staff">
                                {dept.employee_count || 0} Faculty / Staff
                              </span>
                            </div>
                          </div>
                        </div>

                        {canAssignDepartment && (
                          <div className="drawer-dept-actions">
                            <button
                              type="button"
                              className="btn-remove-dept"
                              onClick={() => setDeptToRemove(dept)}
                              title={`Remove ${dept.name} from ${selectedCategory.name}`}
                            >
                              <X size={14} />
                              <span>Remove</span>
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="category-drawer-footer">
              <div className="drawer-footer-actions">
                {canUpdateCategories && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={(e) => handleOpenEditCategory(selectedCategory, e)}
                  >
                    <Edit3 size={14} />
                    <span>Edit Category Details</span>
                  </button>
                )}

                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setSelectedCategory(null)}
                >
                  <span>Close</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          7. ASSIGN DEPARTMENT TO CATEGORY MODAL
          ===================================================================== */}
      {isAssignModalOpen && selectedCategory && (
        <div className="modal-backdrop" onClick={() => setIsAssignModalOpen(false)}>
          <div className="modal-container modal-form" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-header-icon-title">
                <div className="icon-badge-primary">
                  <Building2 size={22} />
                </div>
                <div>
                  <h2 className="modal-title">Assign Department</h2>
                  <p className="modal-subtitle">
                    Select an existing department to classify under <strong>{selectedCategory.name}</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setIsAssignModalOpen(false)}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAssignDepartment}>
              <div className="modal-body">
                {assignError && (
                  <div className="form-alert-error">
                    <AlertCircle size={18} className="alert-icon" />
                    <div className="alert-text">{assignError}</div>
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label" htmlFor="select-dept-assign">
                    Select Department <span className="required-star">*</span>
                  </label>
                  <select
                    id="select-dept-assign"
                    className="form-select"
                    value={selectedDeptIdToAssign}
                    onChange={(e) => setSelectedDeptIdToAssign(e.target.value)}
                    required
                  >
                    <option value="">-- Choose a Department --</option>
                    {assignableDepartments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} {d.code ? `(${d.code})` : ''} {d.category_name ? `• Currently: ${d.category_name}` : '• (Unassigned)'}
                      </option>
                    ))}
                  </select>
                  <span className="form-field-hint">
                    {assignableDepartments.length} available department(s) found in St. Vincent's HRMS database.
                  </span>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsAssignModalOpen(false)}
                  disabled={isSubmittingAssign}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmittingAssign || !selectedDeptIdToAssign}
                >
                  {isSubmittingAssign ? (
                    <>
                      <Loader2 size={16} className="spin-animation" />
                      <span>Assigning...</span>
                    </>
                  ) : (
                    <>
                      <Plus size={16} />
                      <span>Assign to Category</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          8. REMOVE DEPARTMENT CONFIRMATION MODAL
          ===================================================================== */}
      {deptToRemove && selectedCategory && (
        <div className="modal-backdrop" onClick={() => setDeptToRemove(null)}>
          <div className="modal-container modal-confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-header-icon-title">
                <div className="icon-badge-primary badge-danger-glow">
                  <Trash2 size={22} />
                </div>
                <div>
                  <h3 className="modal-title">Remove Department from Category?</h3>
                  <p className="modal-subtitle">{deptToRemove.name} → {selectedCategory.name}</p>
                </div>
              </div>
            </div>
            <div className="modal-body">
              <p className="confirm-text">
                Are you sure you want to remove <strong>{deptToRemove.name}</strong> from <strong>{selectedCategory.name}</strong>?
              </p>
              <div className="confirm-warning-box">
                <Info size={16} />
                <span>
                  This will only remove the category classification. The department itself, its faculty members, and operational records will <strong>NOT</strong> be deleted.
                </span>
              </div>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setDeptToRemove(null)}
                disabled={isSubmittingRemove}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleConfirmRemoveDepartment}
                disabled={isSubmittingRemove}
              >
                {isSubmittingRemove ? (
                  <>
                    <Loader2 size={16} className="spin-animation" />
                    <span>Removing...</span>
                  </>
                ) : (
                  <>
                    <X size={16} />
                    <span>Remove from Category</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          9. ADD / EDIT CATEGORY MODAL
          ===================================================================== */}
      {isCategoryModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsCategoryModalOpen(false)}>
          <div className="modal-container modal-form" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-header-icon-title">
                <div className="icon-badge-primary">
                  <FolderTree size={22} />
                </div>
                <div>
                  <h2 className="modal-title">
                    {editingCategory ? 'Edit Department Category' : 'Add Department Category'}
                  </h2>
                  <p className="modal-subtitle">
                    {editingCategory ? `Update settings for ${editingCategory.name}` : 'Create a category to group related faculties and school wings'}
                  </p>
                </div>
              </div>
              <button 
                type="button" 
                className="modal-close-btn" 
                onClick={() => setIsCategoryModalOpen(false)}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveCategory}>
              <div className="modal-body">
                {categoryFormError && (
                  <div className="form-alert-error">
                    <AlertCircle size={18} className="alert-icon" />
                    <div className="alert-text">{categoryFormError}</div>
                  </div>
                )}

                <div className="form-grid">
                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label className="form-label" htmlFor="cat-name-input">
                      Category Name <span className="required-star">*</span>
                    </label>
                    <input
                      type="text"
                      id="cat-name-input"
                      className="form-input"
                      placeholder="e.g. Academic Faculties, Administration, Student Services"
                      value={categoryFormData.name}
                      onChange={(e) => setCategoryFormData({ ...categoryFormData, name: e.target.value })}
                      required
                      autoFocus
                    />
                  </div>

                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label className="form-label" htmlFor="cat-code-input">
                      Category Code <span className="text-muted text-xs">(e.g. CAT-ACAD)</span>
                    </label>
                    <input
                      type="text"
                      id="cat-code-input"
                      className="form-input text-monospace"
                      placeholder="CAT-ACAD"
                      value={categoryFormData.code}
                      onChange={(e) => setCategoryFormData({ ...categoryFormData, code: e.target.value })}
                    />
                  </div>

                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label className="form-label" htmlFor="cat-desc-input">
                      Description
                    </label>
                    <textarea
                      id="cat-desc-input"
                      className="form-textarea"
                      rows={3}
                      placeholder="Describe the scope and purpose of departments in this category..."
                      value={categoryFormData.description}
                      onChange={(e) => setCategoryFormData({ ...categoryFormData, description: e.target.value })}
                    />
                  </div>

                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label className="form-checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={categoryFormData.is_active}
                        onChange={(e) => setCategoryFormData({ ...categoryFormData, is_active: e.target.checked })}
                        style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                      />
                      <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-main)' }}>
                        Active Category (Available for Department Grouping)
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setIsCategoryModalOpen(false)}
                  disabled={isSubmittingCategory}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={isSubmittingCategory}
                >
                  {isSubmittingCategory ? (
                    <>
                      <Loader2 size={16} className="spin-animation" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Save size={16} />
                      <span>{editingCategory ? 'Update Category' : 'Create Category'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          10. TOGGLE CATEGORY STATUS CONFIRMATION MODAL
          ===================================================================== */}
      {confirmToggleCategory && (
        <div className="modal-backdrop" onClick={() => setConfirmToggleCategory(null)}>
          <div className="modal-container modal-confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-header-icon-title">
                <div className={`icon-badge-primary ${confirmToggleCategory.is_active ? 'badge-danger-glow' : 'badge-success-glow'}`}>
                  <Power size={22} />
                </div>
                <div>
                  <h3 className="modal-title">
                    {confirmToggleCategory.is_active ? 'Deactivate Category?' : 'Activate Category?'}
                  </h3>
                  <p className="modal-subtitle">{confirmToggleCategory.name}</p>
                </div>
              </div>
            </div>
            <div className="modal-body">
              <p className="confirm-text">
                {confirmToggleCategory.is_active ? (
                  <>
                    Are you sure you want to deactivate <strong>{confirmToggleCategory.name}</strong>? 
                    Existing departments categorized under this group will remain categorized, but this category will not be selectable for new department creation.
                  </>
                ) : (
                  <>
                    Are you sure you want to re-activate <strong>{confirmToggleCategory.name}</strong>? 
                    It will become immediately available for department grouping.
                  </>
                )}
              </p>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setConfirmToggleCategory(null)}
                disabled={isSubmittingToggle}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`btn ${confirmToggleCategory.is_active ? 'btn-danger' : 'btn-primary'}`}
                onClick={handleConfirmToggleStatus}
                disabled={isSubmittingToggle}
              >
                {isSubmittingToggle ? (
                  <>
                    <Loader2 size={16} className="spin-animation" />
                    <span>Updating...</span>
                  </>
                ) : (
                  <span>{confirmToggleCategory.is_active ? 'Deactivate Category' : 'Activate Category'}</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DepartmentCategoriesView;
