import React, { useState, useEffect } from 'react';
import { Award, Building2, AlertCircle, X, Save, Check } from 'lucide-react';
import { hrmsApi } from '../../services/api';
import { LoadingSpinner } from '../common/LoadingSpinner';

export function AddEditDesignationModal({
  designation = null,
  departments = [],
  onClose,
  onSaved
}) {
  const isEdit = Boolean(designation);

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    department_id: '',
    description: '',
    is_active: true
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState(null);

  // Initialize form data when editing or adding
  useEffect(() => {
    if (designation) {
      setFormData({
        name: designation.name || '',
        code: designation.code || '',
        department_id: designation.department_id || '',
        description: designation.description || '',
        is_active: designation.is_active !== undefined ? designation.is_active : true
      });
    } else {
      setFormData({
        name: '',
        code: '',
        department_id: '',
        description: '',
        is_active: true
      });
    }
    setErrors({});
    setApiError(null);
  }, [designation]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));

    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const validate = () => {
    const newErrors = {};

    if (!formData.name || !formData.name.trim()) {
      newErrors.name = 'Designation name is required';
    } else if (formData.name.trim().length < 2) {
      newErrors.name = 'Name must be at least 2 characters';
    }

    if (formData.code && formData.code.trim().length > 30) {
      newErrors.code = 'Code cannot exceed 30 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    setApiError(null);

    try {
      let response;
      if (isEdit) {
        response = await hrmsApi.updateDesignation(designation.id, formData);
      } else {
        response = await hrmsApi.createDesignation(formData);
      }

      if (response && response.success) {
        onSaved(response.data, isEdit);
      } else {
        throw new Error(response?.message || 'Failed to save designation.');
      }
    } catch (err) {
      console.error('Save designation error:', err);
      setApiError(err.message || 'An unexpected error occurred while saving.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-container modal-md" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div className="modal-header-icon-title">
            <div className="icon-badge-primary">
              <Award size={22} />
            </div>
            <div>
              <h3 className="modal-title">
                {isEdit ? 'Edit Designation' : 'Add New Designation'}
              </h3>
              <p className="modal-subtitle">
                {isEdit
                  ? `Update job position details for "${designation.name}"`
                  : "Define a new job role or position for St. Vincent's staff"}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {apiError && (
              <div className="error-banner" style={{ marginBottom: '16px' }}>
                <div className="error-banner-content">
                  <AlertCircle size={18} className="error-icon" />
                  <div className="error-text">{apiError}</div>
                </div>
              </div>
            )}

            <div className="form-grid">
              {/* Designation Name */}
              <div className="form-group full-width">
                <label className="form-label" htmlFor="name">
                  Designation Name <span className="required-star">*</span>
                </label>
                <input
                  id="name"
                  type="text"
                  name="name"
                  className={`form-input ${errors.name ? 'input-error' : ''}`}
                  placeholder="e.g. Senior Teacher, Headmaster, Accountant"
                  value={formData.name}
                  onChange={handleChange}
                  autoFocus
                />
                {errors.name && <span className="field-error-text">{errors.name}</span>}
              </div>

              {/* Designation Code */}
              <div className="form-group">
                <label className="form-label" htmlFor="code">
                  Designation Code
                </label>
                <input
                  id="code"
                  type="text"
                  name="code"
                  className={`form-input ${errors.code ? 'input-error' : ''}`}
                  placeholder="e.g. DESIG-TCH-SR"
                  value={formData.code}
                  onChange={handleChange}
                />
                <span className="field-helper-text">
                  Unique identifier code (e.g. DESIG-ENG-HOD).
                </span>
                {errors.code && <span className="field-error-text">{errors.code}</span>}
              </div>

              {/* Department Selection */}
              <div className="form-group">
                <label className="form-label" htmlFor="department_id">
                  Department
                </label>
                <select
                  id="department_id"
                  name="department_id"
                  className="form-select"
                  value={formData.department_id}
                  onChange={handleChange}
                >
                  <option value="">Institution-Wide / General</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name} {dept.code ? `(${dept.code})` : ''}
                    </option>
                  ))}
                </select>
                <span className="field-helper-text">
                  Department or academic wing this position reports to.
                </span>
              </div>

              {/* Description */}
              <div className="form-group full-width">
                <label className="form-label" htmlFor="description">
                  Description / Responsibilities
                </label>
                <textarea
                  id="description"
                  name="description"
                  rows="3"
                  className="form-textarea"
                  placeholder="Brief overview of duties, qualifications, and scope of this designation..."
                  value={formData.description}
                  onChange={handleChange}
                />
              </div>

              {/* Status */}
              <div className="form-group full-width">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    name="is_active"
                    checked={formData.is_active}
                    onChange={handleChange}
                  />
                  <span>Active Position (Available for employee assignments)</span>
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
                  <LoadingSpinner size={14} />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save size={15} />
                  <span>{isEdit ? 'Save Changes' : 'Create Designation'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddEditDesignationModal;
