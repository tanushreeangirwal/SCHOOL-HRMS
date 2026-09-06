import React, { useState, useEffect } from 'react';
import { 
  UserCheck, 
  Users, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  UserPlus, 
  Trash2, 
  Award, 
  RefreshCw,
  Search,
  Filter,
  Check
} from 'lucide-react';
import { hrmsApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { StaffAvatar } from '../common/StaffAvatar';
import { LoadingSpinner } from '../common/LoadingSpinner';
import AssignTrainingModal from './AssignTrainingModal';
import AddCertificateModal from './AddCertificateModal';

export function TrainingAttendanceView({ 
  selectedProgramId = null,
  departments = []
}) {
  const { isSuperAdmin, isAdmin, isHR, isManager } = useAuth();
  const canManageAttendance = isSuperAdmin || isAdmin || isHR;

  const [programs, setPrograms] = useState([]);
  const [activeProgramId, setActiveProgramId] = useState(selectedProgramId || '');
  const [activeProgram, setActiveProgram] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modals
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isCertModalOpen, setIsCertModalOpen] = useState(false);
  const [certTargetParticipant, setCertTargetParticipant] = useState(null);

  // Load programs list for dropdown
  useEffect(() => {
    async function loadPrograms() {
      try {
        const res = await hrmsApi.getTrainingPrograms();
        if (res && res.success && res.data) {
          setPrograms(res.data);
          if (!activeProgramId && res.data.length > 0) {
            setActiveProgramId(res.data[0].id);
          }
        }
      } catch (err) {
        console.error('Error fetching programs list:', err);
      }
    }
    loadPrograms();
  }, []);

  // When activeProgramId or selectedProgramId changes
  useEffect(() => {
    if (selectedProgramId) {
      setActiveProgramId(selectedProgramId);
    }
  }, [selectedProgramId]);

  const fetchParticipants = async () => {
    if (!activeProgramId) return;
    setIsLoading(true);
    try {
      const [progRes, partRes] = await Promise.all([
        hrmsApi.getTrainingProgramById(activeProgramId),
        hrmsApi.getTrainingParticipants(activeProgramId)
      ]);

      if (progRes && progRes.success) {
        setActiveProgram(progRes.data);
      }
      if (partRes && partRes.success) {
        setParticipants(partRes.data || []);
      }
    } catch (err) {
      console.error('Error loading training roster:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchParticipants();
  }, [activeProgramId]);

  // Inline attendance updater
  const handleUpdateParticipant = async (employeeId, field, value) => {
    if (!canManageAttendance) return;
    setIsUpdating(true);
    try {
      const current = participants.find(p => p.employee_id === employeeId);
      const payload = {
        [field]: value
      };

      // Auto-set complementary fields
      if (field === 'attendance_status' && value === 'Present') {
        payload.enrollment_status = 'Attended';
        payload.attendance_date = activeProgram?.start_date || new Date().toISOString().split('T')[0];
      } else if (field === 'completion_status' && value === 'Completed') {
        payload.attendance_status = 'Present';
        payload.enrollment_status = 'Completed';
        payload.hours_completed = activeProgram?.duration_hours || 1.0;
        payload.completion_date = new Date().toISOString().split('T')[0];
      }

      const res = await hrmsApi.updateTrainingParticipantAttendance(activeProgramId, employeeId, payload);
      if (res && res.success) {
        setParticipants(prev => prev.map(p => {
          if (p.employee_id === employeeId) {
            return { ...p, ...res.data };
          }
          return p;
        }));
      }
    } catch (err) {
      console.error('Error updating participant:', err);
      alert(err.message || 'Failed to update attendance status.');
    } finally {
      setIsUpdating(false);
    }
  };

  // Remove participant from roster
  const handleRemoveParticipant = async (employeeId, employeeName) => {
    if (!canManageAttendance) return;
    if (!window.confirm(`Remove ${employeeName} from this training program?`)) return;

    try {
      const res = await hrmsApi.removeTrainingParticipant(activeProgramId, employeeId);
      if (res && res.success) {
        setParticipants(prev => prev.filter(p => p.employee_id !== employeeId));
      }
    } catch (err) {
      alert(err.message || 'Failed to remove participant.');
    }
  };

  // Bulk actions
  const handleMarkAll = async (type) => {
    if (!canManageAttendance) return;
    const confirmMsg = type === 'present' 
      ? 'Mark all enrolled participants as Present?' 
      : 'Mark all enrolled participants as Completed with credited hours?';
    if (!window.confirm(confirmMsg)) return;

    setIsUpdating(true);
    try {
      const payload = type === 'present' ? { mark_all_present: true } : { mark_all_completed: true };
      const res = await hrmsApi.bulkUpdateTrainingAttendance(activeProgramId, payload);
      if (res && res.success) {
        fetchParticipants();
      }
    } catch (err) {
      alert(err.message || 'Error processing batch update.');
    } finally {
      setIsUpdating(false);
    }
  };

  // Filter participants
  const filteredParticipants = participants.filter(p => {
    if (searchFilter) {
      const term = searchFilter.toLowerCase();
      const name = `${p.first_name || ''} ${p.last_name || ''}`.toLowerCase();
      const code = (p.employee_code || '').toLowerCase();
      const dept = (p.department_name || '').toLowerCase();
      if (!name.includes(term) && !code.includes(term) && !dept.includes(term)) return false;
    }
    if (statusFilter) {
      if (statusFilter === 'Present' && p.attendance_status !== 'Present') return false;
      if (statusFilter === 'Completed' && p.completion_status !== 'Completed') return false;
      if (statusFilter === 'Pending' && p.completion_status !== 'Pending') return false;
    }
    return true;
  });

  const enrolledCount = participants.length;
  const completedCount = participants.filter(p => p.completion_status === 'Completed').length;
  const presentCount = participants.filter(p => p.attendance_status === 'Present').length;
  const completionPercent = enrolledCount > 0 ? Math.round((completedCount / enrolledCount) * 100) : 0;

  return (
    <div className="training-attendance-view" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* 1. Program Selector Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '14px',
        backgroundColor: '#ffffff',
        padding: '16px 20px',
        borderRadius: '14px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <label style={{ fontSize: '0.86rem', fontWeight: 700, color: '#172033', margin: 0 }}>
            Active Training Session:
          </label>
          <select
            className="form-control"
            value={activeProgramId}
            onChange={(e) => setActiveProgramId(e.target.value)}
            style={{ minWidth: '280px', maxWidth: '420px', height: '38px', fontSize: '0.85rem' }}
          >
            {programs.map((prog) => (
              <option key={prog.id} value={prog.id}>
                {prog.title} ({prog.status})
              </option>
            ))}
          </select>
        </div>

        {canManageAttendance && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => setIsAssignModalOpen(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <UserPlus size={15} />
              <span>Enroll Staff</span>
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => handleMarkAll('present')}
              disabled={isUpdating || participants.length === 0}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Check size={14} />
              <span>Mark All Present</span>
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => handleMarkAll('completed')}
              disabled={isUpdating || participants.length === 0}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#16a34a', fontWeight: 600 }}
            >
              <CheckCircle2 size={14} />
              <span>Mark All Completed</span>
            </button>
          </div>
        )}
      </div>

      {/* 2. Program Details Hero Summary Card */}
      {activeProgram && (
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '14px',
          border: '1px solid #e2e8f0',
          padding: '20px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px'
        }}>
          <div>
            <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Program Info</span>
            <h3 style={{ fontSize: '1.02rem', fontWeight: 700, color: '#0f172a', margin: '4px 0 2px 0' }}>
              {activeProgram.title}
            </h3>
            <span style={{ fontSize: '0.8rem', color: '#475569' }}>
              Trainer: <strong style={{ color: '#1e293b' }}>{activeProgram.trainer_name}</strong>
              {activeProgram.training_provider ? ` (${activeProgram.training_provider})` : ''}
            </span>
          </div>

          <div>
            <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Schedule & Venue</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.84rem', fontWeight: 600, color: '#1e293b', marginTop: '4px' }}>
              <Calendar size={14} style={{ color: '#3155D9' }} />
              <span>{activeProgram.start_date} • {activeProgram.duration_hours} hrs</span>
            </div>
            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
              Venue: {activeProgram.location_venue || 'On-Campus'}
            </span>
          </div>

          <div>
            <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Participation Status</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
              <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#3155D9' }}>
                {enrolledCount}
              </span>
              <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                Enrolled ({presentCount} Present, {completedCount} Completed)
              </span>
            </div>
            <div style={{ width: '100%', height: '6px', backgroundColor: '#e2e8f0', borderRadius: '4px', overflow: 'hidden', marginTop: '6px' }}>
              <div
                style={{
                  width: `${completionPercent}%`,
                  height: '100%',
                  backgroundColor: '#10b981',
                  borderRadius: '4px'
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* 3. Participant Roster Filter Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ position: 'relative', width: '280px' }}>
          <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input
            type="text"
            className="form-control"
            placeholder="Search participant by name, code..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            style={{ paddingLeft: '32px', height: '36px', fontSize: '0.84rem' }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <select
            className="form-control"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ width: '150px', height: '36px', fontSize: '0.84rem' }}
          >
            <option value="">All Statuses</option>
            <option value="Present">Present Only</option>
            <option value="Completed">Completed Only</option>
            <option value="Pending">Pending Only</option>
          </select>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={fetchParticipants}
            title="Reload Roster"
          >
            <RefreshCw size={14} className={isLoading ? 'spin-animation' : ''} />
          </button>
        </div>
      </div>

      {/* 4. Roster Table */}
      {isLoading ? (
        <div style={{ padding: '50px 0', textAlign: 'center' }}>
          <LoadingSpinner text="Loading participant attendance roster..." size={28} />
        </div>
      ) : filteredParticipants.length === 0 ? (
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '14px',
          border: '1px solid #e2e8f0',
          padding: '50px 20px',
          textAlign: 'center',
          color: '#64748b'
        }}>
          No participants enrolled in this training session yet.
          {canManageAttendance && (
            <div style={{ marginTop: '12px' }}>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => setIsAssignModalOpen(true)}
              >
                <UserPlus size={14} />
                <span>Enroll Faculty Members</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '14px',
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
        }}>
          <div className="table-responsive">
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>Faculty / Staff Member</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>Department & Role</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>Attendance Status</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>Hours Credited</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>Completion Status</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>Certification</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredParticipants.map((p) => (
                  <tr key={p.enrollment_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    {/* Faculty Profile */}
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <StaffAvatar
                          firstName={p.first_name}
                          lastName={p.last_name}
                          photoUrl={p.profile_photo_url}
                          size="sm"
                        />
                        <div>
                          <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.86rem' }}>
                            {p.first_name} {p.last_name}
                          </div>
                          <span className="text-monospace font-bold text-muted" style={{ fontSize: '0.74rem' }}>
                            {p.employee_code}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Department & Designation */}
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontSize: '0.84rem', fontWeight: 500, color: '#1e293b' }}>
                          {p.department_name || 'General Faculty'}
                        </span>
                        <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
                          {p.designation_name || 'Staff'}
                        </span>
                      </div>
                    </td>

                    {/* Attendance Status Selector */}
                    <td style={{ padding: '12px 16px' }}>
                      {canManageAttendance ? (
                        <select
                          className="form-control"
                          value={p.attendance_status || 'Pending'}
                          onChange={(e) => handleUpdateParticipant(p.employee_id, 'attendance_status', e.target.value)}
                          style={{
                            height: '32px',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            color: p.attendance_status === 'Present' ? '#166534' : p.attendance_status === 'Absent' ? '#991b1b' : '#334155',
                            backgroundColor: p.attendance_status === 'Present' ? '#f0fdf4' : p.attendance_status === 'Absent' ? '#fef2f2' : '#ffffff'
                          }}
                        >
                          <option value="Pending">Pending</option>
                          <option value="Present">Present</option>
                          <option value="Absent">Absent</option>
                          <option value="Late">Late</option>
                          <option value="Excused">Excused</option>
                        </select>
                      ) : (
                        <span className={`status-pill badge-${p.attendance_status?.toLowerCase() || 'pending'}`} style={{ fontSize: '0.74rem' }}>
                          <span className="status-dot"></span>
                          <span>{p.attendance_status || 'Pending'}</span>
                        </span>
                      )}
                    </td>

                    {/* Hours Credited */}
                    <td style={{ padding: '12px 16px' }}>
                      {canManageAttendance ? (
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          max="100"
                          className="form-control"
                          value={p.hours_completed || 0}
                          onChange={(e) => handleUpdateParticipant(p.employee_id, 'hours_completed', e.target.value)}
                          style={{ width: '80px', height: '32px', fontSize: '0.82rem', fontWeight: 700, color: '#0891b2' }}
                        />
                      ) : (
                        <span style={{ fontSize: '0.84rem', fontWeight: 700, color: '#0891b2' }}>
                          {p.hours_completed || 0} hrs
                        </span>
                      )}
                    </td>

                    {/* Completion Status Selector */}
                    <td style={{ padding: '12px 16px' }}>
                      {canManageAttendance ? (
                        <select
                          className="form-control"
                          value={p.completion_status || 'Pending'}
                          onChange={(e) => handleUpdateParticipant(p.employee_id, 'completion_status', e.target.value)}
                          style={{
                            height: '32px',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            color: p.completion_status === 'Completed' ? '#166534' : p.completion_status === 'Incomplete' ? '#991b1b' : '#d97706',
                            backgroundColor: p.completion_status === 'Completed' ? '#f0fdf4' : p.completion_status === 'Incomplete' ? '#fef2f2' : '#fffbeb'
                          }}
                        >
                          <option value="Pending">Pending</option>
                          <option value="Completed">Completed</option>
                          <option value="Incomplete">Incomplete</option>
                          <option value="Exempt">Exempt</option>
                        </select>
                      ) : (
                        <span className={`status-pill badge-${p.completion_status?.toLowerCase() || 'pending'}`} style={{ fontSize: '0.74rem' }}>
                          <span className="status-dot"></span>
                          <span>{p.completion_status || 'Pending'}</span>
                        </span>
                      )}
                    </td>

                    {/* Certificate Status */}
                    <td style={{ padding: '12px 16px' }}>
                      {p.certificate_id ? (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '0.75rem',
                          color: '#15803d',
                          backgroundColor: '#dcfce7',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontWeight: 600
                        }}>
                          <Award size={12} />
                          <span>Awarded</span>
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.76rem', color: '#94a3b8' }}>
                          None
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                        {canManageAttendance && !p.certificate_id && p.completion_status === 'Completed' && (
                          <button
                            type="button"
                            className="btn btn-ghost btn-xs"
                            onClick={() => {
                              setCertTargetParticipant(p);
                              setIsCertModalOpen(true);
                            }}
                            title="Record Certificate for Staff"
                            style={{ color: '#d97706', fontWeight: 600 }}
                          >
                            <Award size={14} />
                          </button>
                        )}
                        {canManageAttendance && (
                          <button
                            type="button"
                            className="btn btn-ghost btn-xs"
                            onClick={() => handleRemoveParticipant(p.employee_id, `${p.first_name} ${p.last_name}`)}
                            title="Remove from roster"
                            style={{ color: '#ef4444' }}
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Enroll Staff Modal */}
      {isAssignModalOpen && activeProgram && (
        <AssignTrainingModal
          isOpen={isAssignModalOpen}
          onClose={() => setIsAssignModalOpen(false)}
          onAssigned={() => {
            fetchParticipants();
          }}
          trainingProgram={activeProgram}
          departments={departments}
        />
      )}

      {/* Record Certificate Modal */}
      {isCertModalOpen && certTargetParticipant && (
        <AddCertificateModal
          isOpen={isCertModalOpen}
          onClose={() => {
            setIsCertModalOpen(false);
            setCertTargetParticipant(null);
          }}
          onSaved={() => {
            fetchParticipants();
          }}
          initialEmployee={certTargetParticipant}
          initialProgram={activeProgram}
        />
      )}
    </div>
  );
}

export default TrainingAttendanceView;
