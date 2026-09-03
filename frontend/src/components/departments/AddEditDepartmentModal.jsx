import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Save, 
  X, 
  AlertCircle, 
  Loader2, 
  FolderTree, 
  UserCheck, 
  Calendar, 
  FileText,
  MapPin
} from 'lucide-react';
import { hrmsApi } from '../../services/api';

export function AddEditDepartmentModal({
  department = null,
  categories = [],
  employees = [],
  onClose,
  onSaved
}) {
  const isEdit = Boolean(department && department.id);

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    category_id: '',
    head_id: '',
    branch_id: '',
    effective_date: new Date().toISOString().split('T')[0],
    description: '',
    is_active: true
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  useEffect(() => {
    if (department) {
      setFormData({
        name: department.name || '',
        code: department.code || '',
        category_id: department.category_id || '',
        head_id: department.head_id || '',
        branch_id: department.branch_id || '',
        effective_date: department.effective_date 
          ? new Date(department.effective_date).toISOString().split('T')[0] 
          : new Date().toISOString().split('T')[0],
        description: department.description || '',
        is_active: department.is_active !== undefined ? Boolean(department.is_active) : true
      });
    } else {
      setFormData({
        name: '',
        code: '',
        category_id: categories.length > 0 ? categories[0].id : '',
        head_id: '',
        branch_id: '',
        effective_date: new Date().toISOString().split('T')[0],
        description: '',
        is_active: true
      });
    }
  }, [department, categories]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);

    // Validation
    if (!formData.name.trim() || formData.name.trim().length < 2) {
      setFormError('Department name is required and must be at least 2 characters.');
      return;
    }

    if (formData.name.length > 150) {
      setFormError('Department name cannot exceed 150 characters.');
      return;
    }

    if (formData.code && formData.code.length > 50) {
      setFormError('Department code cannot exceed 50 characters.');
      return;
    }

    setIsSubmitting(true);

    try {
      let res;
      if (isEdit) {
        res = await hrmsApi.updateDepartment(department.id, formData);
      } else {
        res = await hrmsApi.createDepartment(formData);
      }

      if (res && res.success) {
        onSaved(res.data, isEdit);
      } else {
        throw new Error(res?.message || 'Failed to save department.');
      }
    } catch (err) {
      console.error('Department save error:', err);
      setFormError(err.message || 'Failed to save department record.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-container modal-form" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div className="modal-header-icon-title">
            <div className="icon-badge-primary">
              <Building2 size={22} />
            </div>
            <div>
              <h2 className="modal-title">
                {isEdit ? 'Edit Department' : 'Register New Department'}
              </h2>
              <p className="modal-subtitle">
                {isEdit
                  ? `Update institutional settings for ${department.name}`
                  : 'Add a new academic faculty or administrative division to St. Vincent\'s School'}
              </p>
            </div>
          </div>
          <button 
            type="button" 
            className="modal-close-btn" 
            onClick={onClose}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {formError && (
              <div className="form-alert-error">
                <AlertCircle size={18} className="alert-icon" />
                <div className="alert-text">{formError}</div>
              </div>
            )}

            <div className="form-grid">
              {/* Department Name */}
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label" htmlFor="dept-name">
                  Department / Faculty Name <span className="required-star">*</span>
                </label>
                <input
                  type="text"
                  id="dept-name"
                  className="form-input"
                  placeholder="e.g. Science & Mathematics Faculty, Primary Wing"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  autoFocus
                />
              </div>

              {/* Department Code */}
              <div className="form-group">
                <label className="form-label" htmlFor="dept-code">
                  Department Code <span className="text-muted text-xs">(e.g. DEPT-SCI)</span>
                </label>
                <input
                  type="text"
                  id="dept-code"
                  className="form-input text-monospace"
                  placeholder="DEPT-001"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                />
              </div>

              {/* Department Category */}
              <div className="form-group">
                <label className="form-label" htmlFor="dept-category">
                  Department Category <span className="required-star">*</span>
                </label>
                <select
                  id="dept-category"
                  className="form-select"
                  value={formData.category_id}
                  onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                  required
                >
                  <option value="">— Select Category —</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name} ({cat.code || 'CAT'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Department Head (HOD) */}
              <div className="form-group">
                <label className="form-label" htmlFor="dept-head">
                  Department Head (HOD)
                </label>
                <select
                  id="dept-head"
                  className="form-select"
                  value={formData.head_id}
                  onChange={(e) => setFormData({ ...formData, head_id: e.target.value })}
                >
                  <option value="">— Select Faculty / Staff Member —</option>
                  {employees.map((emp) => {
                    const fullName = [emp.first_name, emp.last_name].filter(Boolean).join(' ') || emp.employee_code;
                    return (
                      <option key={emp.id} value={emp.id}>
                        {fullName} ({emp.employee_code})
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Effective Date */}
              <div className="form-group">
                <label className="form-label" htmlFor="dept-effective-date">
                  Effective Date <span className="required-star">*</span>
                </label>
                <input
                  type="date"
                  id="dept-effective-date"
                  className="form-input"
                  value={formData.effective_date}
                  onChange={(e) => setFormData({ ...formData, effective_date: e.target.value })}
                  required
                />
              </div>

              {/* Description */}
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label" htmlFor="dept-description">
                  Description & Faculty Remit
                </label>
                <textarea
                  id="dept-description"
                  className="form-textarea"
                  rows={3}
                  placeholder="Describe the curriculum, laboratories, faculty scope, and academic responsibilities..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              {/* Active Checkbox */}
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-main)' }}>
                    Active Department (Available for Staff Assignment & Timetable Scheduling)
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="modal-footer">
            <button 
              type="button" 
              className="btn btn-secondary" 
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="spin-animation" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save size={16} />
                  <span>{isEdit ? 'Update Department' : 'Save Department'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddEditDepartmentModal;
