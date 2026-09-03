import React, { useState, useEffect, useMemo } from 'react';
import { 
  Building2, 
  X, 
  Users, 
  Calendar, 
  Mail, 
  Phone, 
  Edit3, 
  Eye, 
  AlertCircle, 
  Loader2, 
  Search, 
  Filter, 
  FolderTree, 
  CheckCircle2, 
  XCircle, 
  User, 
  FileText,
  Clock
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { hrmsApi } from '../../services/api';

export function DepartmentDetailModal({
  departmentId,
  onClose,
  onEdit,
  onViewEmployee
}) {
  const { hasPermission, hasRole } = useAuth();

  const [department, setDepartment] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Search & filter within the department roster
  const [staffSearchTerm, setStaffSearchTerm] = useState('');
  const [staffStatusFilter, setStaffStatusFilter] = useState('ALL');

  const canEdit = hasPermission('departments:update') || hasRole('Administrator', 'HR');

  useEffect(() => {
    let isMounted = true;
    async function fetchDetails() {
      setIsLoading(true);
      setError(null);
      try {
        const response = await hrmsApi.getDepartmentById(departmentId);
        if (response && response.success) {
          if (isMounted) setDepartment(response.data);
        } else {
          throw new Error(response?.message || 'Failed to retrieve department dossier.');
        }
      } catch (err) {
        if (isMounted) setError(err.message || 'Error fetching department details.');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    if (departmentId) {
      fetchDetails();
    }

    return () => {
      isMounted = false;
    };
  }, [departmentId]);

  // Filter staff roster
  const filteredStaff = useMemo(() => {
    if (!department || !department.employees) return [];
    return department.employees.filter((emp) => {
      if (staffStatusFilter !== 'ALL') {
        const s = (emp.employment_status || '').toLowerCase();
        if (s !== staffStatusFilter.toLowerCase()) return false;
      }

      if (staffSearchTerm.trim() !== '') {
        const term = staffSearchTerm.toLowerCase().trim();
        const code = (emp.employee_code || '').toLowerCase();
        const first = (emp.first_name || '').toLowerCase();
        const last = (emp.last_name || '').toLowerCase();
        const email = (emp.work_email || '').toLowerCase();
        const fullName = `${first} ${last}`.trim();

        return code.includes(term) || fullName.includes(term) || email.includes(term);
      }

      return true;
    });
  }, [department, staffSearchTerm, staffStatusFilter]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div 
        className="modal-container modal-drawer-xl" 
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '850px' }}
      >
        {/* Modal Header */}
        <div className="modal-header">
          <div className="modal-header-icon-title">
            <div className="icon-badge-primary">
              <Building2 size={24} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 className="modal-title" style={{ fontSize: '1.2rem' }}>
                  {department?.name || 'Department Dossier'}
                </h2>
                {department && (
                  <span className={`status-pill ${department.is_active ? 'badge-active' : 'badge-inactive'}`}>
                    <span className="status-dot"></span>
                    <span>{department.is_active ? 'Active' : 'Inactive'}</span>
                  </span>
                )}
              </div>
              <p className="modal-subtitle">
                Code: <strong className="text-monospace">{department?.code || '—'}</strong> 
                {department?.category_name ? ` • Category: ${department.category_name}` : ''}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {canEdit && department && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => onEdit(department)}
              >
                <Edit3 size={15} />
                <span>Edit</span>
              </button>
            )}
            <button 
              type="button" 
              className="modal-close-btn" 
              onClick={onClose}
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="modal-body" style={{ padding: '24px' }}>
          {isLoading ? (
            <div style={{ padding: '60px', textAlign: 'center' }}>
              <Loader2 size={32} className="spin-animation text-primary" style={{ margin: '0 auto 12px' }} />
              <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                Loading faculty record and staff roster...
              </div>
            </div>
          ) : error ? (
            <div className="error-banner">
              <AlertCircle size={20} className="error-icon" />
              <div className="error-text">
                <strong>Error:</strong> {error}
              </div>
            </div>
          ) : department ? (
            <div className="department-dossier-content">
              {/* Information Cards Grid */}
              <div className="detail-sections-grid" style={{ marginBottom: '24px' }}>
                {/* Card 1: HOD / Leadership */}
                <div className="info-card">
                  <div className="info-card-header">
                    <User size={16} className="text-primary" />
                    <h4>Department Leadership (HOD)</h4>
                  </div>
                  <div className="info-card-body">
                    {department.head_id && department.head_name ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span className="avatar-initials avatar-md">
                          {department.head_first_name?.[0] || 'H'}
                        </span>
                        <div>
                          <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.95rem' }}>
                            {department.head_name}
                          </div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            Staff Code: <span className="text-monospace font-semibold">{department.head_code}</span>
                          </div>
                          {department.head_email && (
                            <div style={{ fontSize: '0.78rem', color: '#2563eb', marginTop: '2px' }}>
                              {department.head_email}
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="text-muted text-sm italic" style={{ padding: '8px 0' }}>
                        No Department Head is currently designated.
                      </div>
                    )}
                  </div>
                </div>

                {/* Card 2: Overview & Effective Date */}
                <div className="info-card">
                  <div className="info-card-header">
                    <FolderTree size={16} className="text-primary" />
                    <h4>Organization & Headcount</h4>
                  </div>
                  <div className="info-card-body">
                    <div className="detail-field" style={{ marginBottom: '8px' }}>
                      <span className="field-label">Category Group:</span>
                      <span className="field-value font-semibold">
                        {department.category_name || 'General / Unclassified'}
                      </span>
                    </div>

                    <div className="detail-field" style={{ marginBottom: '8px' }}>
                      <span className="field-label">Total Assigned Staff:</span>
                      <span className="field-value">
                        <strong className="text-primary" style={{ fontSize: '1rem' }}>
                          {department.employee_count || 0}
                        </strong> Active Members
                      </span>
                    </div>

                    <div className="detail-field">
                      <span className="field-label">Effective Date:</span>
                      <span className="field-value">
                        {department.effective_date 
                          ? new Date(department.effective_date).toLocaleDateString() 
                          : 'Established'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Description & Remit Section */}
              {department.description && (
                <div className="info-card" style={{ marginBottom: '24px' }}>
                  <div className="info-card-header">
                    <FileText size={16} className="text-primary" />
                    <h4>Curriculum, Laboratories & Department Scope</h4>
                  </div>
                  <div className="info-card-body">
                    <p style={{ margin: 0, fontSize: '0.88rem', lineHeight: 1.6, color: 'var(--text-main)' }}>
                      {department.description}
                    </p>
                  </div>
                </div>
              )}

              {/* Assigned Staff Table Section */}
              <div className="assigned-staff-section">
                <div className="section-header-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Users size={18} className="text-primary" />
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                      Assigned Faculty & Staff ({department.employees?.length || 0})
                    </h3>
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <div className="search-input-wrapper">
                      <Search className="search-icon" size={14} />
                      <input
                        type="text"
                        className="search-input search-input-sm"
                        placeholder="Search staff in dept..."
                        value={staffSearchTerm}
                        onChange={(e) => setStaffSearchTerm(e.target.value)}
                      />
                    </div>

                    <select
                      className="filter-select filter-select-sm"
                      value={staffStatusFilter}
                      onChange={(e) => setStaffStatusFilter(e.target.value)}
                    >
                      <option value="ALL">All Statuses</option>
                      <option value="active">Active</option>
                      <option value="probation">Probation</option>
                      <option value="notice">Notice</option>
                    </select>
                  </div>
                </div>

                {filteredStaff.length === 0 ? (
                  <div className="empty-state-card" style={{ padding: '28px', textAlign: 'center', background: '#f8fafc', borderRadius: '8px', border: '1px dashed var(--border-medium)' }}>
                    <Users size={32} className="text-muted" style={{ margin: '0 auto 8px' }} />
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                      {staffSearchTerm || staffStatusFilter !== 'ALL'
                        ? 'No faculty members match your filter.'
                        : 'No employees are currently assigned to this department.'}
                    </div>
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th style={{ width: '120px' }}>Staff Code</th>
                          <th>Faculty Member</th>
                          <th>Email Address</th>
                          <th style={{ width: '120px' }}>Joining Date</th>
                          <th style={{ width: '100px' }}>Status</th>
                          <th style={{ width: '80px', textAlign: 'right' }}>Profile</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredStaff.map((emp) => {
                          const fullName = [emp.first_name, emp.last_name].filter(Boolean).join(' ') || emp.employee_code;
                          const isHOD = department.head_id === emp.id;

                          return (
                            <tr key={emp.id}>
                              <td>
                                <span className="table-code-badge text-monospace">
                                  {emp.employee_code}
                                </span>
                              </td>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span className="avatar-initials avatar-sm">
                                    {emp.first_name?.[0] || 'E'}
                                  </span>
                                  <div>
                                    <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                                      {fullName}
                                    </div>
                                    {isHOD && (
                                      <span className="badge-hod-indicator">
                                        Department Head
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td>
                                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                                  {emp.work_email || '—'}
                                </span>
                              </td>
                              <td>
                                <span style={{ fontSize: '0.82rem', color: 'var(--text-main)' }}>
                                  {emp.joining_date ? new Date(emp.joining_date).toLocaleDateString() : '—'}
                                </span>
                              </td>
                              <td>
                                <span className={`status-pill badge-${(emp.employment_status || 'active').toLowerCase()}`}>
                                  <span className="status-dot"></span>
                                  <span style={{ textTransform: 'capitalize' }}>
                                    {emp.employment_status || 'Active'}
                                  </span>
                                </span>
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                <button
                                  type="button"
                                  className="btn-action-view"
                                  onClick={() => onViewEmployee(emp.id)}
                                  title="View Employee Profile"
                                >
                                  <Eye size={13} />
                                  <span>View</span>
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>

        {/* Modal Footer */}
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close Dossier
          </button>
        </div>
      </div>
    </div>
  );
}

export default DepartmentDetailModal;
