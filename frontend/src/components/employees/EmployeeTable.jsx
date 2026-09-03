import React from 'react';
import { Eye, Edit3, Trash2, UserX, UserCheck, Mail, Calendar } from 'lucide-react';
import { StaffAvatar } from '../common/StaffAvatar';

export function EmployeeTable({ 
  employees = [], 
  onViewEmployee,
  onEditEmployee,
  onToggleStatus,
  onDeleteEmployee,
  canEdit = false,
  canDelete = false,
  canToggleStatus = false
}) {
  // Helper to format full name
  const getFullName = (emp) => {
    const parts = [emp.first_name, emp.middle_name, emp.last_name].filter(Boolean);
    return parts.length > 0 ? parts.join(' ') : 'Unnamed Staff';
  };

  // Helper to format date
  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  // Helper to get status badge class
  const getStatusBadgeClass = (status) => {
    const s = (status || '').toLowerCase();
    switch (s) {
      case 'active':
        return 'badge-active';
      case 'probation':
        return 'badge-probation';
      case 'inactive':
        return 'badge-inactive';
      case 'on leave':
        return 'badge-on-leave';
      default:
        return 'badge-default';
    }
  };

  return (
    <div className="table-responsive">
      <table className="employee-table">
        <thead>
          <tr>
            <th>Employee Code</th>
            <th>Staff Name</th>
            <th>Department</th>
            <th>Designation</th>
            <th>Employment Type</th>
            <th>Joining Date</th>
            <th>Status</th>
            <th className="th-actions">Actions</th>
          </tr>
        </thead>
        <tbody>
          {employees.map((emp) => {
            const fullName = getFullName(emp);
            const statusClass = getStatusBadgeClass(emp.employment_status);
            const primaryEmail = emp.work_email || emp.personal_email;
            const isInactive = (emp.employment_status || '').toLowerCase() === 'inactive';

            return (
              <tr key={emp.id} className={`employee-table-row ${isInactive ? 'row-inactive' : ''}`}>
                {/* Employee Code */}
                <td className="cell-code">
                  <span className="code-badge">{emp.employee_code || 'N/A'}</span>
                </td>

                {/* Staff Name & Contact */}
                <td className="cell-name">
                  <div className="staff-profile-cell">
                    <StaffAvatar
                      firstName={emp.first_name}
                      lastName={emp.last_name}
                      photoUrl={emp.profile_photo_url}
                      size="md"
                    />
                    <div className="staff-details">
                      <span className="staff-fullname">{fullName}</span>
                      {primaryEmail && (
                        <span className="staff-email" title={primaryEmail}>
                          <Mail size={12} className="inline-icon" />
                          {primaryEmail}
                        </span>
                      )}
                    </div>
                  </div>
                </td>

                {/* Department */}
                <td className="cell-dept">
                  <span className="dept-tag">
                    {emp.department_name || emp.department || 'General Staff'}
                  </span>
                </td>

                {/* Designation */}
                <td className="cell-designation">
                  <span className="designation-text">
                    {emp.designation_name || emp.designation || 'Staff Member'}
                  </span>
                </td>

                {/* Employment Type */}
                <td className="cell-type">
                  <span className="type-badge">
                    {emp.employment_type_name || emp.employment_type || 'Full Time'}
                  </span>
                </td>

                {/* Joining Date */}
                <td className="cell-date">
                  <div className="date-wrapper">
                    <Calendar size={13} className="inline-icon text-muted" />
                    <span>{formatDate(emp.joining_date)}</span>
                  </div>
                </td>

                {/* Status */}
                <td className="cell-status">
                  <span className={`status-pill ${statusClass}`}>
                    <span className="status-dot"></span>
                    <span>{emp.employment_status || 'Active'}</span>
                  </span>
                </td>

                {/* Actions */}
                <td className="cell-actions">
                  <div className="employee-row-actions">
                    {/* View Button */}
                    <button
                      type="button"
                      className="btn-action-icon btn-view-icon"
                      onClick={() => onViewEmployee && onViewEmployee(emp)}
                      title={`View dossier for ${fullName}`}
                      aria-label={`View dossier for ${fullName}`}
                    >
                      <Eye size={15} />
                    </button>

                    {/* Edit Button */}
                    {canEdit && onEditEmployee && (
                      <button
                        type="button"
                        className="btn-action-icon btn-edit-icon"
                        onClick={() => onEditEmployee(emp)}
                        title={`Edit profile for ${fullName}`}
                        aria-label={`Edit profile for ${fullName}`}
                      >
                        <Edit3 size={15} />
                      </button>
                    )}

                    {/* Deactivate / Reactivate Button */}
                    {canToggleStatus && onToggleStatus && (
                      <button
                        type="button"
                        className={`btn-action-icon ${isInactive ? 'btn-reactivate-icon' : 'btn-deactivate-icon'}`}
                        onClick={() => onToggleStatus(emp)}
                        title={isInactive ? `Reactivate ${fullName}` : `Deactivate ${fullName}`}
                        aria-label={isInactive ? `Reactivate ${fullName}` : `Deactivate ${fullName}`}
                      >
                        {isInactive ? <UserCheck size={15} /> : <UserX size={15} />}
                      </button>
                    )}

                    {/* Delete Permanently Button */}
                    {canDelete && onDeleteEmployee && (
                      <button
                        type="button"
                        className="btn-action-icon btn-delete-icon"
                        onClick={() => onDeleteEmployee(emp)}
                        title={`Permanently delete ${fullName}`}
                        aria-label={`Permanently delete ${fullName}`}
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default EmployeeTable;
