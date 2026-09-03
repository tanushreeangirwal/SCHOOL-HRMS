import React, { useState, useEffect } from 'react';
import { 
  X, 
  User, 
  Mail, 
  Briefcase, 
  MapPin, 
  Calendar, 
  Check, 
  AlertCircle, 
  Sparkles,
  Loader2,
  Building2,
  Shield
} from 'lucide-react';
import { hrmsApi } from '../../services/api';

export function AddEmployeeModal({ 
  onClose, 
  onEmployeeCreated,
  onEmployeeUpdated,
  employeeToEdit = null,
  nextCodeSuggestion = '',
  departments: initialDepartments = [],
  employeesList: initialEmployeesList = []
}) {
  const isEditMode = Boolean(employeeToEdit && employeeToEdit.id);

  const [activeTab, setActiveTab] = useState('basic'); // 'basic' | 'contact' | 'employment'
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  const [departments, setDepartments] = useState(initialDepartments);
  const [designations, setDesignations] = useState([]);
  const [employmentTypes, setEmploymentTypes] = useState([]);
  const [managers, setManagers] = useState(initialEmployeesList);

  const [formData, setFormData] = useState({
    // Basic / Personal
    employee_code: employeeToEdit?.employee_code || nextCodeSuggestion || '',
    first_name: employeeToEdit?.first_name || '',
    middle_name: employeeToEdit?.middle_name || '',
    last_name: employeeToEdit?.last_name || '',
    date_of_birth: employeeToEdit?.date_of_birth ? employeeToEdit.date_of_birth.slice(0, 10) : '',
    gender: employeeToEdit?.gender || 'Male',
    profile_photo_url: employeeToEdit?.profile_photo_url || '',
    
    // Contact & Address
    work_email: employeeToEdit?.work_email || '',
    personal_email: employeeToEdit?.personal_email || '',
    phone: employeeToEdit?.phone || '',
    address: employeeToEdit?.address || '',
    city: employeeToEdit?.city || 'Pune',
    state: employeeToEdit?.state || 'Maharashtra',
    postal_code: employeeToEdit?.postal_code || '',

    // Employment details
    joining_date: employeeToEdit?.joining_date ? employeeToEdit.joining_date.slice(0, 10) : new Date().toISOString().split('T')[0],
    employment_status: employeeToEdit?.employment_status || 'Active',
    branch_id: employeeToEdit?.branch_id || '',
    department_id: employeeToEdit?.department_id || '',
    designation_id: employeeToEdit?.designation_id || '',
    employment_type_id: employeeToEdit?.employment_type_id || '',
    reporting_manager_id: employeeToEdit?.reporting_manager_id || '',
    send_account_invitation: true
  });

  // Load dropdown resources
  useEffect(() => {
    async function loadResources() {
      try {
        const [deptRes, desigRes, empRes] = await Promise.all([
          departments.length === 0 ? hrmsApi.getDepartments() : Promise.resolve({ data: departments }),
          hrmsApi.getDesignations(),
          managers.length === 0 ? hrmsApi.getEmployees({ status: 'all' }) : Promise.resolve({ data: managers })
        ]);

        if (deptRes && deptRes.data) setDepartments(deptRes.data);
        if (desigRes && desigRes.data) setDesignations(desigRes.data);
        if (empRes && empRes.data) {
          // Exclude self from manager list in edit mode
          const potentialManagers = isEditMode 
            ? empRes.data.filter(e => e.id !== employeeToEdit.id)
            : empRes.data;
          setManagers(potentialManagers);
        }
      } catch (err) {
        console.warn('Could not load lookup resources for employee form', err);
      }
    }
    loadResources();
  }, [isEditMode, employeeToEdit]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value
    }));

    // Clear validation error on change
    if (fieldErrors[name]) {
      setFieldErrors((prev) => {
        const updated = { ...prev };
        delete updated[name];
        return updated;
      });
    }
  };

  const validate = () => {
    const errors = {};

    if (!formData.first_name.trim()) {
      errors.first_name = 'First name is required.';
    }

    if (!formData.employment_status) {
      errors.employment_status = 'Employment status is required.';
    }

    // Email format checks if provided
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (formData.work_email && !emailRegex.test(formData.work_email)) {
      errors.work_email = 'Please enter a valid work email address.';
    }
    if (formData.personal_email && !emailRegex.test(formData.personal_email)) {
      errors.personal_email = 'Please enter a valid personal email address.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError(null);

    if (!validate()) {
      // Switch to tab with error
      if (fieldErrors.first_name || fieldErrors.employee_code) {
        setActiveTab('basic');
      } else if (fieldErrors.work_email || fieldErrors.personal_email) {
        setActiveTab('contact');
      } else if (fieldErrors.employment_status) {
        setActiveTab('employment');
      }
      return;
    }

    setIsSubmitting(true);

    try {
      if (isEditMode) {
        const response = await hrmsApi.updateEmployee(employeeToEdit.id, formData);
        if (response && response.success) {
          if (onEmployeeUpdated) onEmployeeUpdated(response.data);
          onClose();
        } else {
          throw new Error(response?.message || 'Failed to update employee profile.');
        }
      } else {
        const response = await hrmsApi.createEmployee(formData);
        if (response && response.success) {
          if (onEmployeeCreated) onEmployeeCreated(response.data);
          onClose();
        } else {
          throw new Error(response?.message || 'Failed to create employee record.');
        }
      }
    } catch (err) {
      console.error('Employee save failed:', err);
      setServerError(err.message || 'An error occurred while saving the employee record.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter designations by selected department if applicable
  const availableDesignations = formData.department_id
    ? designations.filter(d => !d.department_id || d.department_id === formData.department_id)
    : designations;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div 
        className="modal-container modal-form" 
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header">
          <div className="modal-header-icon-title">
            <div className="icon-badge-primary">
              <User size={20} />
            </div>
            <div>
              <h2 className="modal-title">
                {isEditMode ? `Edit Profile: ${employeeToEdit?.first_name} ${employeeToEdit?.last_name}` : "Register St. Vincent's Staff Member"}
              </h2>
              <p className="modal-subtitle">
                {isEditMode 
                  ? `Update employee credentials, department, and reporting manager.` 
                  : "Fill in the faculty credentials to add them to the HRMS roster."}
              </p>
            </div>
          </div>
          <button 
            type="button" 
            className="modal-close-btn" 
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Server Error Alert */}
        {serverError && (
          <div className="form-alert-error">
            <AlertCircle size={18} className="alert-icon" />
            <div className="alert-text">
              <strong>Error:</strong> {serverError}
            </div>
          </div>
        )}

        {/* Form Tabs */}
        <div className="modal-tabs">
          <button
            type="button"
            className={`modal-tab-btn ${activeTab === 'basic' ? 'active' : ''}`}
            onClick={() => setActiveTab('basic')}
          >
            <User size={16} />
            <span>1. Personal Details</span>
            {fieldErrors.first_name || fieldErrors.employee_code ? (
              <span className="tab-error-dot"></span>
            ) : null}
          </button>

          <button
            type="button"
            className={`modal-tab-btn ${activeTab === 'contact' ? 'active' : ''}`}
            onClick={() => setActiveTab('contact')}
          >
            <Mail size={16} />
            <span>2. Contact & Location</span>
            {fieldErrors.work_email || fieldErrors.personal_email ? (
              <span className="tab-error-dot"></span>
            ) : null}
          </button>

          <button
            type="button"
            className={`modal-tab-btn ${activeTab === 'employment' ? 'active' : ''}`}
            onClick={() => setActiveTab('employment')}
          >
            <Briefcase size={16} />
            <span>3. Institutional Profile</span>
            {fieldErrors.employment_status ? (
              <span className="tab-error-dot"></span>
            ) : null}
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="modal-form-content">
          {/* TAB 1: BASIC / PERSONAL */}
          {activeTab === 'basic' && (
            <div className="form-section-body">
              <div className="form-row-2">
                <div className="form-group">
                  <label className="form-label" htmlFor="employee_code">
                    Employee Code <span className="text-muted text-xs">(Standard: EMP-####)</span>
                  </label>
                  <input
                    type="text"
                    id="employee_code"
                    name="employee_code"
                    className="form-input text-monospace"
                    placeholder="Auto-assigned (e.g. EMP-1025)"
                    value={formData.employee_code}
                    onChange={handleChange}
                  />
                  <span className="form-hint-text">Leave blank to auto-generate the next sequential EMP-#### code.</span>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="gender">
                    Gender
                  </label>
                  <select
                    id="gender"
                    name="gender"
                    className="form-select"
                    value={formData.gender}
                    onChange={handleChange}
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                    <option value="Prefer not to say">Prefer not to say</option>
                  </select>
                </div>
              </div>

              <div className="form-row-3">
                <div className="form-group">
                  <label className="form-label" htmlFor="first_name">
                    First Name <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    id="first_name"
                    name="first_name"
                    className={`form-input ${fieldErrors.first_name ? 'input-error' : ''}`}
                    placeholder="e.g. Amit"
                    value={formData.first_name}
                    onChange={handleChange}
                    required
                  />
                  {fieldErrors.first_name && (
                    <span className="form-error-text">{fieldErrors.first_name}</span>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="middle_name">
                    Middle Name
                  </label>
                  <input
                    type="text"
                    id="middle_name"
                    name="middle_name"
                    className="form-input"
                    placeholder="Optional"
                    value={formData.middle_name}
                    onChange={handleChange}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="last_name">
                    Last Name
                  </label>
                  <input
                    type="text"
                    id="last_name"
                    name="last_name"
                    className="form-input"
                    placeholder="e.g. Sharma"
                    value={formData.last_name}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label className="form-label" htmlFor="date_of_birth">
                    Date of Birth
                  </label>
                  <input
                    type="date"
                    id="date_of_birth"
                    name="date_of_birth"
                    className="form-input"
                    value={formData.date_of_birth}
                    onChange={handleChange}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="profile_photo_url">
                    Profile Photo URL <span className="text-muted text-xs">(Optional)</span>
                  </label>
                  <input
                    type="url"
                    id="profile_photo_url"
                    name="profile_photo_url"
                    className="form-input"
                    placeholder="https://... (Leave blank for initials avatar)"
                    value={formData.profile_photo_url}
                    onChange={handleChange}
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CONTACT & LOCATION */}
          {activeTab === 'contact' && (
            <div className="form-section-body">
              <div className="form-row-2">
                <div className="form-group">
                  <label className="form-label" htmlFor="work_email">
                    St. Vincent's Work Email
                  </label>
                  <input
                    type="email"
                    id="work_email"
                    name="work_email"
                    className={`form-input ${fieldErrors.work_email ? 'input-error' : ''}`}
                    placeholder="amit.sharma@school.edu"
                    value={formData.work_email}
                    onChange={handleChange}
                  />
                  {fieldErrors.work_email && (
                    <span className="form-error-text">{fieldErrors.work_email}</span>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="personal_email">
                    Personal Email
                  </label>
                  <input
                    type="email"
                    id="personal_email"
                    name="personal_email"
                    className={`form-input ${fieldErrors.personal_email ? 'input-error' : ''}`}
                    placeholder="amit.sharma@gmail.com"
                    value={formData.personal_email}
                    onChange={handleChange}
                  />
                  {fieldErrors.personal_email && (
                    <span className="form-error-text">{fieldErrors.personal_email}</span>
                  )}
                </div>
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label className="form-label" htmlFor="phone">
                    Phone / Mobile Number
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    className="form-input"
                    placeholder="+91 98220 12345"
                    value={formData.phone}
                    onChange={handleChange}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="postal_code">
                    Postal / PIN Code
                  </label>
                  <input
                    type="text"
                    id="postal_code"
                    name="postal_code"
                    className="form-input"
                    placeholder="e.g. 411001"
                    value={formData.postal_code}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="address">
                  Residential Address
                </label>
                <input
                  type="text"
                  id="address"
                  name="address"
                  className="form-input"
                  placeholder="e.g. Plot 45, Gulmohar Park, Aundh"
                  value={formData.address}
                  onChange={handleChange}
                />
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label className="form-label" htmlFor="city">
                    City
                  </label>
                  <input
                    type="text"
                    id="city"
                    name="city"
                    className="form-input"
                    placeholder="e.g. Pune"
                    value={formData.city}
                    onChange={handleChange}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="state">
                    State
                  </label>
                  <input
                    type="text"
                    id="state"
                    name="state"
                    className="form-input"
                    placeholder="e.g. Maharashtra"
                    value={formData.state}
                    onChange={handleChange}
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: INSTITUTIONAL PROFILE */}
          {activeTab === 'employment' && (
            <div className="form-section-body">
              <div className="form-row-2">
                <div className="form-group">
                  <label className="form-label" htmlFor="department_id">
                    Assigned Department
                  </label>
                  <select
                    id="department_id"
                    name="department_id"
                    className="form-select"
                    value={formData.department_id}
                    onChange={handleChange}
                  >
                    <option value="">-- Select Department --</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} {d.code ? `(${d.code})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="designation_id">
                    Designation / Job Position
                  </label>
                  <select
                    id="designation_id"
                    name="designation_id"
                    className="form-select"
                    value={formData.designation_id}
                    onChange={handleChange}
                  >
                    <option value="">-- Select Designation --</option>
                    {availableDesignations.map((des) => (
                      <option key={des.id} value={des.id}>
                        {des.name} {des.code ? `(${des.code})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label className="form-label" htmlFor="reporting_manager_id">
                    Reporting Manager
                  </label>
                  <select
                    id="reporting_manager_id"
                    name="reporting_manager_id"
                    className="form-select"
                    value={formData.reporting_manager_id}
                    onChange={handleChange}
                  >
                    <option value="">-- Principal / Top Level (No Manager) --</option>
                    {managers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.first_name} {m.last_name} ({m.employee_code} - {m.designation_name || 'Staff'})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="employment_status">
                    Employment Status <span className="text-danger">*</span>
                  </label>
                  <select
                    id="employment_status"
                    name="employment_status"
                    className="form-select"
                    value={formData.employment_status}
                    onChange={handleChange}
                    required
                  >
                    <option value="Active">Active</option>
                    <option value="Probation">Probation</option>
                    <option value="Inactive">Inactive</option>
                    <option value="On Leave">On Leave</option>
                  </select>
                </div>
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label className="form-label" htmlFor="joining_date">
                    Joining Date
                  </label>
                  <input
                    type="date"
                    id="joining_date"
                    name="joining_date"
                    className="form-input"
                    value={formData.joining_date}
                    onChange={handleChange}
                  />
                </div>
              </div>

              {!isEditMode && (
                <div style={{ padding: '14px 16px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', marginTop: '14px' }}>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer', margin: 0 }}>
                    <input
                      type="checkbox"
                      name="send_account_invitation"
                      checked={formData.send_account_invitation !== false}
                      onChange={(e) => setFormData(prev => ({ ...prev, send_account_invitation: e.target.checked }))}
                      style={{ marginTop: '3px', width: '16px', height: '16px', accentColor: '#3155D9' }}
                    />
                    <div>
                      <span style={{ fontWeight: 700, fontSize: '0.86rem', color: '#166534', display: 'block' }}>
                        Send Account Onboarding Invitation
                      </span>
                      <span style={{ fontSize: '0.76rem', color: '#15803d', lineHeight: 1.4, display: 'block', marginTop: '2px' }}>
                        Dispatches a secure activation link to the employee's email. They will verify their email & phone number and create their own password.
                      </span>
                    </div>
                  </label>
                </div>
              )}
            </div>
          )}

          {/* Modal Actions Footer */}
          <div className="modal-footer">
            <div className="footer-left">
              {activeTab !== 'basic' && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    if (activeTab === 'employment') setActiveTab('contact');
                    else if (activeTab === 'contact') setActiveTab('basic');
                  }}
                  disabled={isSubmitting}
                >
                  Previous Step
                </button>
              )}
            </div>

            <div className="footer-right">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Cancel
              </button>

              {activeTab !== 'employment' ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    if (activeTab === 'basic') setActiveTab('contact');
                    else if (activeTab === 'contact') setActiveTab('employment');
                  }}
                >
                  Next Step
                </button>
              ) : (
                <button
                  type="submit"
                  className="btn btn-primary btn-submit"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={16} className="spin-animation" />
                      <span>{isEditMode ? 'Saving Changes...' : 'Creating Record...'}</span>
                    </>
                  ) : (
                    <>
                      <Check size={16} />
                      <span>{isEditMode ? 'Save Changes' : 'Register Staff Member'}</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddEmployeeModal;
