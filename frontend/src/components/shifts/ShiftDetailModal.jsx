import React, { useState, useEffect } from 'react';
import {
  X,
  CalendarClock,
  Clock,
  Coffee,
  Users,
  Calendar,
  Building2,
  Briefcase,
  AlertCircle,
  Loader2,
  Edit2,
  UserCheck,
  CheckCircle2,
  XCircle,
  User
} from 'lucide-react';
import { hrmsApi } from '../../services/api';
import { StaffAvatar } from '../common/StaffAvatar';

export function ShiftDetailModal({
  shiftId = null,
  isOpen = false,
  onClose,
  onEditShift,
  onAssignEmployees,
  onNavigateToEmployee
}) {
  const [shift, setShift] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen || !shiftId) return;

    let isMounted = true;
    setIsLoading(true);
    setError(null);

    hrmsApi.getShiftById(shiftId)
      .then((res) => {
        if (isMounted) {
          if (res && res.success) {
            setShift(res.data);
          } else {
            setError(res?.message || 'Failed to load shift details.');
          }
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.error('Failed to fetch shift details:', err);
          setError(err.message || 'Error fetching shift details.');
        }
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [shiftId, isOpen]);

  if (!isOpen) return null;

  // Helper to calculate duration in hours & minutes
  const calculateDuration = (startTime, endTime) => {
    if (!startTime || !endTime) return '—';
    const [h1, m1] = startTime.split(':').map(Number);
    const [h2, m2] = endTime.split(':').map(Number);
    let diff = (h2 * 60 + m2) - (h1 * 60 + m1);
    if (diff < 0) diff += 24 * 60; // overnight
    const hrs = Math.floor(diff / 60);
    const mins = diff % 60;
    return mins > 0 ? `${hrs}h ${mins}m` : `${hrs} hrs`;
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-container modal-lg shift-detail-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div className="modal-header-icon-title">
            <div className="icon-badge-primary">
              <CalendarClock size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 className="modal-title">{shift?.name || 'Shift Dossier'}</h3>
                {shift && (
                  <span className={`status-pill ${shift.is_active ? 'badge-active' : 'badge-inactive'}`}>
                    <span className="status-dot"></span>
                    <span>{shift.is_active ? 'Active' : 'Inactive'}</span>
                  </span>
                )}
              </div>
              <p className="modal-subtitle">
                Shift Code: <code className="text-monospace">{shift?.code || '—'}</code>
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {shift && onEditShift && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  onClose();
                  onEditShift(shift);
                }}
              >
                <Edit2 size={14} />
                <span>Edit Shift</span>
              </button>
            )}
            <button type="button" className="modal-close-btn" onClick={onClose}>
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="modal-body-detail">
          {isLoading ? (
            <div className="table-state-container" style={{ padding: '48px 0' }}>
              <Loader2 size={32} className="spin-animation text-primary" />
              <p className="state-message">Loading shift schedule and roster...</p>
            </div>
          ) : error ? (
            <div className="table-state-container error-state" style={{ padding: '32px 0' }}>
              <AlertCircle size={32} className="text-danger" />
              <h4 className="state-title">Error Loading Details</h4>
              <p className="state-message">{error}</p>
            </div>
          ) : shift ? (
            <div>
              {/* Description */}
              {shift.description && (
                <div className="detail-description-card" style={{ marginBottom: '20px' }}>
                  <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-main)', lineHeight: 1.5 }}>
                    {shift.description}
                  </p>
                </div>
              )}

              {/* 4 Summary Mini Cards */}
              <div className="detail-overview-grid" style={{ marginBottom: '24px' }}>
                {/* 1. Working Hours */}
                <div className="overview-card">
                  <div className="overview-icon bg-blue-light">
                    <Clock size={18} className="text-blue" />
                  </div>
                  <div className="overview-data">
                    <span className="overview-label">Working Hours</span>
                    <span className="overview-value">
                      {shift.start_time_formatted || shift.start_time} – {shift.end_time_formatted || shift.end_time}
                    </span>
                    <span className="overview-subtext">
                      Duration: {calculateDuration(shift.start_time, shift.end_time)}
                    </span>
                  </div>
                </div>

                {/* 2. Break */}
                <div className="overview-card">
                  <div className="overview-icon bg-amber-light">
                    <Coffee size={18} className="text-amber" />
                  </div>
                  <div className="overview-data">
                    <span className="overview-label">Break Period</span>
                    <span className="overview-value">
                      {shift.break_duration_minutes || 0} Minutes
                    </span>
                    <span className="overview-subtext">
                      {shift.break_start_formatted ? `${shift.break_start_formatted} – ${shift.break_end_formatted}` : 'Recess / Lunch break'}
                    </span>
                  </div>
                </div>

                {/* 3. Grace Periods */}
                <div className="overview-card">
                  <div className="overview-icon bg-purple-light">
                    <CalendarClock size={18} className="text-purple" />
                  </div>
                  <div className="overview-data">
                    <span className="overview-label">Grace Allowed</span>
                    <span className="overview-value">
                      +{shift.late_grace_minutes || shift.grace_period_minutes || 0}m Late
                    </span>
                    <span className="overview-subtext">
                      Early departure: -{shift.early_departure_grace_minutes || 0}m
                    </span>
                  </div>
                </div>

                {/* 4. Assigned Personnel */}
                <div className="overview-card">
                  <div className="overview-icon bg-emerald-light">
                    <Users size={18} className="text-emerald" />
                  </div>
                  <div className="overview-data">
                    <span className="overview-label">Staff Assigned</span>
                    <span className="overview-value text-emerald">
                      {shift.employees?.length || 0} Personnel
                    </span>
                    <span className="overview-subtext">Active on this roster</span>
                  </div>
                </div>
              </div>

              {/* Working Days Pill Strip */}
              <div className="working-days-strip-card" style={{ marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <Calendar size={16} className="text-primary" />
                  <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)', textTransform: 'uppercase' }}>
                    Scheduled Working Days
                  </span>
                </div>
                <div className="day-badges-list">
                  {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => {
                    const isWorking = (shift.working_days || []).includes(day);
                    return (
                      <span key={day} className={`day-status-pill ${isWorking ? 'day-active' : 'day-inactive'}`}>
                        {isWorking ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                        <span>{day}</span>
                      </span>
                    );
                  })}
                </div>
              </div>

              {/* Assigned Staff Roster Section */}
              <div className="assigned-roster-section">
                <div className="roster-section-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Users size={18} className="text-primary" />
                    <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>
                      Assigned Personnel Roster ({shift.employees?.length || 0})
                    </h4>
                  </div>
                  {onAssignEmployees && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-xs"
                      onClick={() => {
                        onClose();
                        onAssignEmployees();
                      }}
                    >
                      <UserCheck size={13} />
                      <span>Manage Assignments</span>
                    </button>
                  )}
                </div>

                {!shift.employees || shift.employees.length === 0 ? (
                  <div className="table-state-container empty-state" style={{ padding: '32px 0' }}>
                    <Users size={32} className="text-muted" style={{ marginBottom: '8px' }} />
                    <p className="state-message">No employees are currently assigned to this work shift.</p>
                  </div>
                ) : (
                  <div className="table-responsive" style={{ maxHeight: '320px', overflowY: 'auto' }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Staff Member</th>
                          <th>Code</th>
                          <th>Department</th>
                          <th>Designation</th>
                          <th>Assignment Start</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {shift.employees.map((emp) => {
                          const fullName = [emp.first_name, emp.middle_name, emp.last_name].filter(Boolean).join(' ');
                          return (
                            <tr key={emp.id}>
                              <td>
                                <div className="staff-table-cell">
                                  <StaffAvatar
                                    firstName={emp.first_name}
                                    lastName={emp.last_name}
                                    photoUrl={emp.profile_photo_url}
                                    size="sm"
                                  />
                                  <div 
                                    className="staff-name-col"
                                    onClick={() => {
                                      if (onNavigateToEmployee) {
                                        onClose();
                                        onNavigateToEmployee(emp.id);
                                      }
                                    }}
                                    style={{ cursor: onNavigateToEmployee ? 'pointer' : 'default' }}
                                    title="View employee profile"
                                  >
                                    <span className="staff-name-text">{fullName}</span>
                                    <span className="staff-email-text">{emp.work_email || emp.personal_email || '—'}</span>
                                  </div>
                                </div>
                              </td>
                              <td>
                                <span className="table-code-badge text-monospace">{emp.employee_code}</span>
                              </td>
                              <td>
                                <span style={{ fontSize: '0.82rem', color: 'var(--text-main)' }}>
                                  {emp.department_name || 'Unassigned'}
                                </span>
                              </td>
                              <td>
                                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                                  {emp.designation_name || 'Staff Member'}
                                </span>
                              </td>
                              <td>
                                <span style={{ fontSize: '0.82rem', color: 'var(--text-main)' }}>
                                  {emp.assignment_start ? new Date(emp.assignment_start).toLocaleDateString() : '—'}
                                </span>
                              </td>
                              <td>
                                <span className={`status-pill badge-${(emp.employment_status || 'active').toLowerCase()}`}>
                                  <span className="status-dot"></span>
                                  <span>{emp.employment_status || 'Active'}</span>
                                </span>
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

        {/* Footer */}
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default ShiftDetailModal;
