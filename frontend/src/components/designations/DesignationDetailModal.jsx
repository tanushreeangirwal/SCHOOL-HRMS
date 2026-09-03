import React, { useState, useEffect } from 'react';
import { 
  Award, 
  Building2, 
  Users, 
  Calendar, 
  CheckCircle2, 
  XCircle, 
  X, 
  Edit, 
  ExternalLink, 
  Search, 
  Mail, 
  Phone,
  Briefcase,
  AlertCircle
} from 'lucide-react';
import { hrmsApi } from '../../services/api';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { useAuth } from '../../context/AuthContext';

export function DesignationDetailModal({
  designationId,
  onClose,
  onEdit,
  onViewEmployee
}) {
  const { hasPermission, hasRole } = useAuth();
  const [designation, setDesignation] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const [staffSearch, setStaffSearch] = useState('');

  const canEdit = hasPermission('designations:update') || hasRole('Administrator', 'HR');

  useEffect(() => {
    let isMounted = true;

    async function loadDetails() {
      if (!designationId) return;
      setIsLoading(true);
      setError(null);

      try {
        const response = await hrmsApi.getDesignationById(designationId);
        if (response && response.success && isMounted) {
          setDesignation(response.data);
        } else {
          throw new Error(response?.message || 'Failed to retrieve designation details');
        }
      } catch (err) {
        console.error('Fetch designation error:', err);
        if (isMounted) setError(err.message || 'Unable to connect to St. Vincent\'s server');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadDetails();

    return () => {
      isMounted = false;
    };
  }, [designationId]);

  const filteredStaff = (designation?.employees || []).filter(emp => {
    if (!staffSearch.trim()) return true;
    const term = staffSearch.toLowerCase();
    const fullName = `${emp.first_name || ''} ${emp.last_name || ''}`.toLowerCase();
    const code = (emp.employee_code || '').toLowerCase();
    const dept = (emp.department_name || '').toLowerCase();
    return fullName.includes(term) || code.includes(term) || dept.includes(term);
  });

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
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-container modal-lg" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div className="modal-header-icon-title">
            <div className="icon-badge-primary">
              <Award size={24} />
            </div>
            <div>
              <div className="detail-header-flex">
                <h3 className="modal-title">
                  {designation ? designation.name : 'Job Designation Profile'}
                </h3>
                {designation?.code && (
                  <span className="badge-code-pill" style={{ marginLeft: '8px' }}>
                    {designation.code}
                  </span>
                )}
              </div>
              <p className="modal-subtitle">
                St. Vincent's High School Organizational Job Position
              </p>
            </div>
          </div>
          <div className="modal-header-actions">
            {canEdit && designation && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => onEdit(designation)}
                style={{ marginRight: '8px' }}
              >
                <Edit size={14} />
                <span>Edit</span>
              </button>
            )}
            <button
              type="button"
              className="modal-close-btn"
              onClick={onClose}
              aria-label="Close modal"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="modal-body">
          {isLoading ? (
            <div className="detail-loading-state">
              <LoadingSpinner text="Retrieving position dossier..." size={32} />
            </div>
          ) : error ? (
            <div className="error-banner">
              <div className="error-banner-content">
                <AlertCircle size={20} className="error-icon" />
                <div className="error-text">
                  <strong>Failed to load designation:</strong> {error}
                </div>
              </div>
            </div>
          ) : designation ? (
            <div className="detail-content-layout">
              {/* Top Overview Cards Grid */}
              <div className="detail-cards-grid">
                {/* 1. Department */}
                <div className="overview-card">
                  <div className="overview-card-header">
                    <Building2 size={16} className="text-indigo" />
                    <span className="overview-card-title">Department</span>
                  </div>
                  <div className="overview-card-body">
                    <div className="overview-primary-val">
                      {designation.department_name || 'Institution-Wide'}
                    </div>
                    {designation.department_code && (
                      <div className="overview-secondary-val">
                        Code: {designation.department_code}
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. Status */}
                <div className="overview-card">
                  <div className="overview-card-header">
                    {designation.is_active ? (
                      <CheckCircle2 size={16} className="text-emerald" />
                    ) : (
                      <XCircle size={16} className="text-slate" />
                    )}
                    <span className="overview-card-title">Position Status</span>
                  </div>
                  <div className="overview-card-body">
                    <span className={`status-pill ${designation.is_active ? 'active' : 'inactive'}`}>
                      {designation.is_active ? 'Active' : 'Inactive'}
                    </span>
                    <div className="overview-secondary-val" style={{ marginTop: '4px' }}>
                      Created: {formatDate(designation.created_at)}
                    </div>
                  </div>
                </div>

                {/* 3. Employee Count */}
                <div className="overview-card">
                  <div className="overview-card-header">
                    <Users size={16} className="text-indigo" />
                    <span className="overview-card-title">Staff Assigned</span>
                  </div>
                  <div className="overview-card-body">
                    <div className="overview-primary-val">
                      {designation.employees?.length || designation.employee_count || 0} Faculty / Staff
                    </div>
                    <div className="overview-secondary-val">
                      Active payroll positions
                    </div>
                  </div>
                </div>
              </div>

              {/* Description & Responsibilities */}
              {designation.description && (
                <div className="detail-section-card">
                  <h4 className="detail-section-title">Job Description & Responsibilities</h4>
                  <p className="detail-description-text">{designation.description}</p>
                </div>
              )}

              {/* Roster of Assigned Employees */}
              <div className="detail-section-card">
                <div className="section-header-flex">
                  <h4 className="detail-section-title">
                    Employees with this Designation ({designation.employees?.length || 0})
                  </h4>
                  {designation.employees?.length > 3 && (
                    <div className="clean-search-box search-input-sm" style={{ maxWidth: '220px' }}>
                      <Search size={14} className="clean-search-icon" />
                      <input
                        type="text"
                        className="clean-search-input search-input-sm"
                        placeholder="Search staff..."
                        value={staffSearch}
                        onChange={(e) => setStaffSearch(e.target.value)}
                      />
                    </div>
                  )}
                </div>

                {designation.employees?.length === 0 ? (
                  <div className="clean-empty-state" style={{ padding: '24px 16px' }}>
                    <Users size={32} className="text-muted" style={{ marginBottom: '8px' }} />
                    <p style={{ margin: 0, fontSize: '0.85rem' }}>
                      No employees are currently assigned to this designation.
                    </p>
                  </div>
                ) : filteredStaff.length === 0 ? (
                  <div className="clean-empty-state" style={{ padding: '20px 16px' }}>
                    <p style={{ margin: 0, fontSize: '0.84rem' }}>
                      No staff match "{staffSearch}".
                    </p>
                  </div>
                ) : (
                  <div className="clean-table-container">
                    <table className="clean-grouped-table">
                      <thead>
                        <tr className="clean-table-header-row">
                          <th style={{ width: '110px' }}>Code</th>
                          <th>Employee Name</th>
                          <th>Department</th>
                          <th style={{ width: '110px', textAlign: 'center' }}>Status</th>
                          <th style={{ width: '120px' }}>Joining Date</th>
                          <th style={{ width: '100px', textAlign: 'center' }}>Profile</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredStaff.map((emp) => (
                          <tr key={emp.id} className="department-data-row">
                            <td className="row-code-cell">
                              <span className="badge-code-pill">{emp.employee_code}</span>
                            </td>
                            <td className="dept-name-cell">
                              <span style={{ fontWeight: 600, color: '#1e293b' }}>
                                {[emp.first_name, emp.last_name].filter(Boolean).join(' ')}
                              </span>
                              {emp.work_email && (
                                <span className="desig-subdesc">{emp.work_email}</span>
                              )}
                            </td>
                            <td className="dept-desc-cell">
                              {emp.department_name || '—'}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <span className={`status-pill ${emp.employment_status === 'ACTIVE' ? 'active' : 'inactive'}`}>
                                {emp.employment_status || 'ACTIVE'}
                              </span>
                            </td>
                            <td className="date-cell">
                              {formatDate(emp.joining_date)}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <button
                                type="button"
                                className="action-btn-view"
                                onClick={() => onViewEmployee(emp.id)}
                                title="Open Employee Profile"
                              >
                                <ExternalLink size={13} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
          >
            Close Dossier
          </button>
        </div>
      </div>
    </div>
  );
}

export default DesignationDetailModal;
