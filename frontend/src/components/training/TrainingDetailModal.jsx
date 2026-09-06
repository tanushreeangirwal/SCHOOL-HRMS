import React, { useState, useEffect, useMemo } from 'react';
import { 
  GraduationCap, 
  X, 
  Users, 
  Calendar, 
  Clock, 
  MapPin, 
  User, 
  Award, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Loader2, 
  Search, 
  Edit3, 
  Plus, 
  Trash2, 
  Check, 
  BookOpen, 
  Building2,
  ExternalLink
} from 'lucide-react';
import { hrmsApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { StaffAvatar } from '../common/StaffAvatar';

export function TrainingDetailModal({
  trainingId,
  onClose,
  onEditTraining,
  onAssignStaff,
  onRecordCertificate,
  onTrainingUpdated
}) {
  const { hasPermission, isSuperAdmin, isAdmin, isHR } = useAuth();
  const canManage = isSuperAdmin || isAdmin || isHR || hasPermission('training:manage');
  const canAssign = isSuperAdmin || isAdmin || isHR || hasPermission('training:assign');
  const canMarkAttendance = isSuperAdmin || isAdmin || isHR || hasPermission('training:attendance');
  const canCertify = isSuperAdmin || isAdmin || isHR || hasPermission('training:certificates');

  const [training, setTraining] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const fetchTrainingDetails = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [progRes, partRes] = await Promise.all([
        hrmsApi.getTrainingProgramById(trainingId),
        hrmsApi.getTrainingParticipants(trainingId)
      ]);

      if (progRes && progRes.success) {
        setTraining(progRes.data);
      } else {
        throw new Error(progRes?.message || 'Failed to load training details.');
      }

      if (partRes && partRes.success) {
        setParticipants(partRes.data || []);
      }
    } catch (err) {
      console.error('Error fetching training details:', err);
      setError(err.message || 'Error occurred while loading training dossier.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (trainingId) {
      fetchTrainingDetails();
    }
  }, [trainingId]);

  // Format dates & timings
  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return '';
    try {
      const [hours, minutes] = timeStr.split(':');
      const h = parseInt(hours, 10);
      const ampm = h >= 12 ? 'PM' : 'AM';
      const formattedH = h % 12 || 12;
      return `${formattedH}:${minutes} ${ampm}`;
    } catch {
      return timeStr;
    }
  };

  // Quick Inline Attendance Update
  const handleUpdateParticipantAttendance = async (employeeId, newStatus) => {
    try {
      setActionLoading(true);
      const res = await hrmsApi.updateParticipantAttendance(trainingId, employeeId, {
        attendance_status: newStatus,
        enrollment_status: newStatus === 'Present' ? 'Attended' : 'Assigned'
      });
      if (res && res.success) {
        setParticipants(prev => prev.map(p => 
          p.employee_id === employeeId 
            ? { ...p, attendance_status: newStatus, enrollment_status: newStatus === 'Present' ? 'Attended' : 'Assigned' } 
            : p
        ));
        if (onTrainingUpdated) onTrainingUpdated();
      }
    } catch (err) {
      console.error('Failed to update participant attendance:', err);
      alert('Error updating attendance: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Quick Bulk Actions
  const handleMarkAllPresent = async () => {
    if (!window.confirm('Mark all enrolled participants as Present for this training?')) return;
    try {
      setActionLoading(true);
      const res = await hrmsApi.bulkUpdateAttendance(trainingId, { mark_all_present: true });
      if (res && res.success) {
        await fetchTrainingDetails();
        if (onTrainingUpdated) onTrainingUpdated();
      }
    } catch (err) {
      console.error('Failed to mark all present:', err);
      alert('Error: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleMarkAllCompleted = async () => {
    if (!window.confirm('Mark all enrolled participants as Completed and credit training hours?')) return;
    try {
      setActionLoading(true);
      const res = await hrmsApi.bulkUpdateAttendance(trainingId, { mark_all_completed: true });
      if (res && res.success) {
        await fetchTrainingDetails();
        if (onTrainingUpdated) onTrainingUpdated();
      }
    } catch (err) {
      console.error('Failed to mark all completed:', err);
      alert('Error: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Remove participant
  const handleRemoveParticipant = async (employeeId, employeeName) => {
    if (!window.confirm(`Are you sure you want to remove ${employeeName || 'this employee'} from this training?`)) return;
    try {
      setActionLoading(true);
      const res = await hrmsApi.removeParticipant(trainingId, employeeId);
      if (res && res.success) {
        setParticipants(prev => prev.filter(p => p.employee_id !== employeeId));
        if (onTrainingUpdated) onTrainingUpdated();
      }
    } catch (err) {
      console.error('Failed to remove participant:', err);
      alert('Error removing participant: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Filtered participants list
  const filteredParticipants = useMemo(() => {
    return participants.filter(p => {
      if (statusFilter !== 'ALL') {
        if (statusFilter === 'Present' && p.attendance_status !== 'Present') return false;
        if (statusFilter === 'Completed' && p.completion_status !== 'Completed') return false;
        if (statusFilter === 'Pending' && p.completion_status === 'Completed') return false;
      }
      if (searchTerm.trim() !== '') {
        const term = searchTerm.toLowerCase().trim();
        const code = (p.employee_code || '').toLowerCase();
        const name = `${p.first_name || ''} ${p.last_name || ''}`.toLowerCase();
        const dept = (p.department_name || '').toLowerCase();
        return code.includes(term) || name.includes(term) || dept.includes(term);
      }
      return true;
    });
  }, [participants, searchTerm, statusFilter]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div 
        className="modal-container modal-drawer-xl" 
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '920px', width: '95%' }}
      >
        {/* Modal Header */}
        <div className="modal-header">
          <div className="modal-header-icon-title">
            <div className="icon-badge-primary" style={{ backgroundColor: '#eff6ff', color: 'var(--color-primary)' }}>
              <GraduationCap size={24} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h2 className="modal-title" style={{ margin: 0 }}>
                  {training?.title || 'Training Program Dossier'}
                </h2>
                {training && (
                  <span className={`status-pill ${training.status === 'Completed' ? 'badge-active' : training.status === 'Ongoing' ? 'badge-blue' : 'badge-warning'}`}>
                    <span className="status-dot"></span>
                    <span>{training.status || 'Upcoming'}</span>
                  </span>
                )}
              </div>
              <p className="modal-subtitle" style={{ margin: '3px 0 0', fontSize: '0.82rem', color: '#64748b' }}>
                Audience: <strong>{training?.target_audience || 'All Staff'}</strong> • Category: {training?.category || 'General CPD'}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {canManage && training && onEditTraining && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => onEditTraining(training)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
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
                Loading training program dossier and participant roster...
              </div>
            </div>
          ) : error ? (
            <div className="error-banner">
              <AlertCircle size={20} className="error-icon" />
              <span>{error}</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Program Overview Card */}
              <div style={{ 
                backgroundColor: '#f8fafc', 
                border: '1px solid #e2e8f0', 
                borderRadius: '10px', 
                padding: '16px 20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                <div>
                  <span style={{ fontSize: '0.74rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.04em' }}>
                    Program Purpose
                  </span>
                  <p style={{ fontSize: '0.92rem', color: '#1e293b', margin: '4px 0 0', lineHeight: 1.5 }}>
                    {training?.description || 'Practical continuous professional development workshop.'}
                  </p>
                </div>

                {/* Specs Grid */}
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', 
                  gap: '14px',
                  paddingTop: '8px',
                  borderTop: '1px solid #e2e8f0'
                }}>
                  <div>
                    <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>SCHEDULE & DATE</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px', fontSize: '0.86rem', fontWeight: 600, color: '#0f172a' }}>
                      <Calendar size={15} className="text-primary" />
                      <span>{formatDate(training?.start_date)}</span>
                    </div>
                    {training?.start_time && (
                      <div style={{ fontSize: '0.76rem', color: '#64748b', marginLeft: '21px' }}>
                        {formatTime(training.start_time)} - {formatTime(training.end_time)}
                      </div>
                    )}
                  </div>

                  <div>
                    <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>TYPE & DURATION</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px', fontSize: '0.86rem', fontWeight: 600, color: '#0f172a' }}>
                      <Clock size={15} className="text-primary" />
                      <span>{training?.training_type} • {parseFloat(training?.duration_hours) || 0} Hours</span>
                    </div>
                  </div>

                  <div>
                    <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>VENUE & LOCATION</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px', fontSize: '0.86rem', fontWeight: 600, color: '#0f172a' }}>
                      <MapPin size={15} className="text-primary" />
                      <span>{training?.location_venue || 'School Campus'}</span>
                    </div>
                  </div>

                  <div>
                    <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>TRAINER / PROVIDER</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px', fontSize: '0.86rem', fontWeight: 600, color: '#0f172a' }}>
                      <User size={15} className="text-primary" />
                      <span title={training?.trainer_name}>{training?.trainer_name}</span>
                    </div>
                    {training?.training_provider && (
                      <div style={{ fontSize: '0.76rem', color: '#64748b', marginLeft: '21px' }}>
                        {training.training_provider}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Toolbar & Filters */}
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between', 
                flexWrap: 'wrap', 
                gap: '12px' 
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: '1 1 280px' }}>
                  <div className="clean-search-box" style={{ flex: 1, minWidth: '180px' }}>
                    <Search size={16} className="clean-search-icon" />
                    <input 
                      type="text" 
                      className="clean-search-input" 
                      placeholder="Search participant by name or code..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>

                  <select 
                    className="form-select"
                    style={{ width: 'auto', padding: '7px 12px', fontSize: '0.84rem' }}
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                  >
                    <option value="ALL">All Participants ({participants.length})</option>
                    <option value="Present">Present</option>
                    <option value="Completed">Completed</option>
                    <option value="Pending">Pending</option>
                  </select>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  {canAssign && (
                    <button
                      type="button"
                      className="btn-clean-primary"
                      onClick={() => onAssignStaff(training)}
                      style={{ padding: '7px 14px', fontSize: '0.82rem' }}
                    >
                      <Plus size={15} />
                      <span>Assign Staff</span>
                    </button>
                  )}

                  {canMarkAttendance && participants.length > 0 && (
                    <>
                      <button
                        type="button"
                        className="btn-clean-outline"
                        onClick={handleMarkAllPresent}
                        disabled={actionLoading}
                        style={{ padding: '7px 12px', fontSize: '0.82rem' }}
                        title="Quickly mark all enrolled participants as Present"
                      >
                        <Check size={14} />
                        <span>Mark All Present</span>
                      </button>

                      <button
                        type="button"
                        className="btn-clean-outline"
                        onClick={handleMarkAllCompleted}
                        disabled={actionLoading}
                        style={{ padding: '7px 12px', fontSize: '0.82rem', borderColor: '#86efac', color: '#15803d' }}
                        title="Mark all participants as Completed and credit hours"
                      >
                        <CheckCircle2 size={14} />
                        <span>Mark All Completed</span>
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Enrolled Participants Roster Table */}
              <div className="clean-table-container">
                <table className="clean-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.86rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '0.76rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      <th style={{ padding: '12px 16px', fontWeight: 700 }}>Staff Member</th>
                      <th style={{ padding: '12px 16px', fontWeight: 700 }}>Department</th>
                      <th style={{ padding: '12px 16px', fontWeight: 700 }}>Attendance</th>
                      <th style={{ padding: '12px 16px', fontWeight: 700 }}>Status</th>
                      <th style={{ padding: '12px 16px', fontWeight: 700 }}>Hours</th>
                      <th style={{ padding: '12px 16px', fontWeight: 700 }}>Certificate</th>
                      {canAssign && <th style={{ padding: '12px 16px', fontWeight: 700, textAlign: 'right' }}>Action</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredParticipants.length === 0 ? (
                      <tr>
                        <td colSpan={canAssign ? 7 : 6} style={{ padding: '36px', textAlign: 'center', color: '#64748b' }}>
                          <Users size={28} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
                          <div>No participants found matching current filters.</div>
                        </td>
                      </tr>
                    ) : (
                      filteredParticipants.map(participant => (
                        <tr key={participant.employee_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          {/* Staff Member */}
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <StaffAvatar 
                                firstName={participant.first_name}
                                lastName={participant.last_name}
                                photoUrl={participant.profile_photo_url}
                                size="sm"
                              />
                              <div>
                                <div style={{ fontWeight: 700, color: '#0f172a' }}>
                                  {participant.first_name} {participant.last_name}
                                </div>
                                <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                                  {participant.employee_code} • {participant.designation_name || 'Staff'}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Department */}
                          <td style={{ padding: '12px 16px', color: '#334155' }}>
                            {participant.department_name || 'General'}
                          </td>

                          {/* Attendance Status */}
                          <td style={{ padding: '12px 16px' }}>
                            {canMarkAttendance ? (
                              <select 
                                className="form-select"
                                style={{ 
                                  padding: '3px 8px', 
                                  fontSize: '0.78rem',
                                  borderRadius: '6px',
                                  fontWeight: 600,
                                  border: '1px solid #cbd5e1',
                                  backgroundColor: participant.attendance_status === 'Present' ? '#ecfdf5' : '#ffffff',
                                  color: participant.attendance_status === 'Present' ? '#047857' : '#334155'
                                }}
                                value={participant.attendance_status || 'Pending'}
                                onChange={(e) => handleUpdateParticipantAttendance(participant.employee_id, e.target.value)}
                              >
                                <option value="Pending">Pending</option>
                                <option value="Present">Present</option>
                                <option value="Absent">Absent</option>
                                <option value="Excused">Excused</option>
                              </select>
                            ) : (
                              <span className={`status-pill ${participant.attendance_status === 'Present' ? 'badge-active' : 'badge-warning'}`}>
                                <span>{participant.attendance_status || 'Pending'}</span>
                              </span>
                            )}
                          </td>

                          {/* Completion Status */}
                          <td style={{ padding: '12px 16px' }}>
                            <span className={`badge badge-${participant.completion_status === 'Completed' ? 'success' : participant.completion_status === 'In Progress' ? 'info' : 'secondary'}`} style={{ fontSize: '0.72rem', padding: '2px 7px' }}>
                              {participant.completion_status || 'Pending'}
                            </span>
                          </td>

                          {/* Hours Credited */}
                          <td style={{ padding: '12px 16px', fontWeight: 600, color: '#0f172a' }}>
                            {parseFloat(participant.hours_completed) > 0 ? `${parseFloat(participant.hours_completed)} hrs` : '—'}
                          </td>

                          {/* Certificate */}
                          <td style={{ padding: '12px 16px' }}>
                            {participant.certificate_number ? (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.76rem', color: '#15803d', fontWeight: 600 }}>
                                <Award size={14} />
                                <span>{participant.certificate_number}</span>
                              </span>
                            ) : canCertify ? (
                              <button
                                type="button"
                                className="btn btn-ghost btn-xs"
                                onClick={() => onRecordCertificate({
                                  employee_id: participant.employee_id,
                                  training_id: training.id,
                                  employee_name: `${participant.first_name} ${participant.last_name}`,
                                  training_title: training.title,
                                  duration_hours: training.duration_hours,
                                  training_provider: training.training_provider
                                })}
                                style={{ fontSize: '0.75rem', color: '#3155D9', padding: '2px 6px' }}
                                title="Record accredited certificate"
                              >
                                <Award size={13} style={{ marginRight: '3px' }} />
                                <span>Record</span>
                              </button>
                            ) : (
                              <span style={{ color: '#94a3b8', fontSize: '0.78rem' }}>—</span>
                            )}
                          </td>

                          {/* Action (Unenroll) */}
                          {canAssign && (
                            <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                              <button
                                type="button"
                                className="clean-icon-btn"
                                onClick={() => handleRemoveParticipant(participant.employee_id, `${participant.first_name} ${participant.last_name}`)}
                                title="Remove participant from training roster"
                                style={{ width: '28px', height: '28px', border: 'none', color: '#ef4444' }}
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default TrainingDetailModal;
