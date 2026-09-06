import React, { useState, useEffect } from 'react';
import { 
  GraduationCap, 
  Search, 
  Plus, 
  Calendar, 
  Clock, 
  Users, 
  MapPin, 
  Edit3, 
  Trash2, 
  UserCheck, 
  CheckCircle2, 
  LayoutGrid, 
  Table as TableIcon,
  Filter,
  ExternalLink,
  ChevronRight,
  Award
} from 'lucide-react';
import { hrmsApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { LoadingSpinner } from '../common/LoadingSpinner';
import AddEditTrainingModal from './AddEditTrainingModal';

export function TrainingProgramsView({ 
  onSelectProgramForAttendance,
  departments = []
}) {
  const { isSuperAdmin, isAdmin, isHR, isManager } = useAuth();
  const canManage = isSuperAdmin || isAdmin || isHR;

  const [programs, setPrograms] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'table'

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState(null);

  const fetchPrograms = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = {};
      if (searchTerm) params.search = searchTerm;
      if (selectedCategory) params.category = selectedCategory;
      if (selectedStatus) params.status = selectedStatus;
      if (selectedType) params.training_type = selectedType;

      const res = await hrmsApi.getTrainingPrograms(params);
      if (res && res.success) {
        setPrograms(res.data);
      } else {
        setError(res?.message || 'Failed to load training programs.');
      }
    } catch (err) {
      console.error('Error fetching training programs:', err);
      setError(err.message || 'Error occurred while loading training programs.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPrograms();
  }, [searchTerm, selectedCategory, selectedStatus, selectedType]);

  const handleDeleteProgram = async (program) => {
    if (!window.confirm(`Are you sure you want to delete "${program.title}"? This will remove all associated participant enrollments and attendance records.`)) {
      return;
    }

    try {
      const res = await hrmsApi.deleteTrainingProgram(program.id);
      if (res && res.success) {
        setPrograms(programs.filter(p => p.id !== program.id));
      } else {
        alert(res?.message || 'Failed to delete program.');
      }
    } catch (err) {
      alert(err.message || 'Error deleting program.');
    }
  };

  const schoolCategories = [
    'Pedagogy & Classroom Management',
    'Child Safeguarding & Safety',
    'NEP & Curriculum',
    'First Aid & Health',
    'Digital Teaching Tools',
    'Leadership & Administration',
    'Examination & Assessment',
    'Inclusive Education'
  ];

  const statuses = ['Planned', 'Upcoming', 'Ongoing', 'Completed', 'Cancelled'];
  const trainingTypes = ['Workshop', 'Seminar', 'Webinar', 'Certification', 'Internal', 'External'];

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="training-programs-view" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* 1. Header Toolbar with Filters & View Switcher */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        backgroundColor: '#ffffff',
        padding: '16px 20px',
        borderRadius: '14px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
      }}>
        {/* Search Input */}
        <div style={{ position: 'relative', minWidth: '240px', flex: 1 }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input
            type="text"
            className="form-control"
            placeholder="Search programs, trainer, provider..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ paddingLeft: '36px', height: '38px', fontSize: '0.85rem' }}
          />
        </div>

        {/* Filter Dropdowns */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <select
            className="form-control"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            style={{ width: '170px', height: '38px', fontSize: '0.84rem' }}
          >
            <option value="">All Categories</option>
            {schoolCategories.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <select
            className="form-control"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            style={{ width: '130px', height: '38px', fontSize: '0.84rem' }}
          >
            <option value="">All Statuses</option>
            {statuses.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          <select
            className="form-control"
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            style={{ width: '130px', height: '38px', fontSize: '0.84rem' }}
          >
            <option value="">All Types</option>
            {trainingTypes.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>

          {/* View Mode Toggle */}
          <div style={{ display: 'flex', border: '1px solid #cbd5e1', borderRadius: '8px', overflow: 'hidden' }}>
            <button
              type="button"
              className={`btn btn-sm ${viewMode === 'grid' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setViewMode('grid')}
              style={{ padding: '6px 10px', borderRadius: 0 }}
              title="Cards View"
            >
              <LayoutGrid size={15} />
            </button>
            <button
              type="button"
              className={`btn btn-sm ${viewMode === 'table' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setViewMode('table')}
              style={{ padding: '6px 10px', borderRadius: 0 }}
              title="Table View"
            >
              <TableIcon size={15} />
            </button>
          </div>

          {canManage && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => {
                setEditingProgram(null);
                setIsModalOpen(true);
              }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Plus size={15} />
              <span>New Program</span>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', color: '#991b1b', fontSize: '0.86rem' }}>
          {error}
        </div>
      )}

      {/* 2. Content List (Cards or Table) */}
      {isLoading ? (
        <div style={{ padding: '60px 0', textAlign: 'center' }}>
          <LoadingSpinner text="Fetching training programs..." size={32} />
        </div>
      ) : programs.length === 0 ? (
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '14px',
          border: '1px solid #e2e8f0',
          padding: '60px 20px',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '12px'
        }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            backgroundColor: '#f1f5f9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#64748b'
          }}>
            <GraduationCap size={24} />
          </div>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#172033', margin: 0 }}>
            No Training Programs Found
          </h3>
          <p style={{ color: '#64748b', fontSize: '0.86rem', maxWidth: '420px', margin: 0 }}>
            {searchTerm || selectedCategory || selectedStatus
              ? 'No training sessions match your current filter parameters. Try clearing the filters.'
              : 'There are no professional development programs registered in the system.'}
          </p>
          {canManage && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => {
                setEditingProgram(null);
                setIsModalOpen(true);
              }}
              style={{ marginTop: '8px' }}
            >
              <Plus size={14} />
              <span>Schedule First Training</span>
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        /* Grid Cards View */
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
          gap: '20px'
        }}>
          {programs.map((prog) => {
            const enrolled = parseInt(prog.enrolled_count, 10) || 0;
            const completed = parseInt(prog.completed_count, 10) || 0;
            const progress = enrolled > 0 ? Math.round((completed / enrolled) * 100) : 0;

            return (
              <div
                key={prog.id}
                style={{
                  backgroundColor: '#ffffff',
                  borderRadius: '14px',
                  border: '1px solid #e2e8f0',
                  padding: '18px 20px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '14px',
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease'
                }}
              >
                <div>
                  {/* Category & Status */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', gap: '6px' }}>
                    <span style={{
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      color: '#3155D9',
                      backgroundColor: '#eef2ff',
                      padding: '3px 8px',
                      borderRadius: '6px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.02em'
                    }}>
                      {prog.training_type} • {prog.category}
                    </span>
                    <span className={`status-pill badge-${prog.status?.toLowerCase() || 'upcoming'}`} style={{ fontSize: '0.72rem', padding: '2px 8px' }}>
                      <span className="status-dot"></span>
                      <span>{prog.status}</span>
                    </span>
                  </div>

                  {/* Title */}
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', margin: '0 0 6px 0', lineHeight: 1.35 }}>
                    {prog.title}
                  </h3>

                  {/* Description preview */}
                  {prog.description && (
                    <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0 0 12px 0', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {prog.description}
                    </p>
                  )}

                  {/* Key Metadata Grid */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.8rem', color: '#475569', backgroundColor: '#f8fafc', padding: '10px 12px', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#64748b' }}>
                        <Calendar size={13} style={{ color: '#3155D9' }} />
                        <span>Dates:</span>
                      </span>
                      <span style={{ fontWeight: 600, color: '#1e293b' }}>
                        {formatDate(prog.start_date)}
                        {prog.start_date !== prog.end_date ? ` to ${formatDate(prog.end_date)}` : ''}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#64748b' }}>
                        <Clock size={13} style={{ color: '#0891b2' }} />
                        <span>Duration:</span>
                      </span>
                      <span style={{ fontWeight: 600, color: '#1e293b' }}>
                        {prog.duration_hours} Hours
                        {prog.start_time ? ` (${prog.start_time.substring(0, 5)} - ${prog.end_time?.substring(0, 5) || ''})` : ''}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#64748b' }}>
                        <Users size={13} style={{ color: '#16a34a' }} />
                        <span>Trainer:</span>
                      </span>
                      <span style={{ fontWeight: 600, color: '#1e293b', textAlign: 'right', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={prog.trainer_name}>
                        {prog.trainer_name}
                      </span>
                    </div>

                    {prog.location_venue && (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#64748b' }}>
                          <MapPin size={13} style={{ color: '#d97706' }} />
                          <span>Venue:</span>
                        </span>
                        <span style={{ fontWeight: 500, color: '#334155' }}>
                          {prog.location_venue}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Progress & Bottom Actions */}
                <div>
                  {/* Participant completion mini bar */}
                  <div style={{ marginBottom: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '4px' }}>
                      <span style={{ color: '#64748b', fontWeight: 500 }}>
                        Enrollment: <strong style={{ color: '#0f172a' }}>{enrolled} Staff</strong>
                        {prog.max_participants > 0 ? ` / Max ${prog.max_participants}` : ''}
                      </span>
                      <span style={{ color: '#16a34a', fontWeight: 600 }}>
                        {completed} Completed ({progress}%)
                      </span>
                    </div>
                    <div style={{ width: '100%', height: '5px', backgroundColor: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${progress}%`,
                          height: '100%',
                          backgroundColor: progress === 100 ? '#10b981' : '#3155D9',
                          borderRadius: '4px'
                        }}
                      />
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #f1f5f9', paddingTop: '12px' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-xs"
                      onClick={() => onSelectProgramForAttendance(prog.id)}
                      style={{ fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#3155D9', fontWeight: 600 }}
                    >
                      <UserCheck size={14} />
                      <span>Roster & Attendance</span>
                    </button>

                    {canManage && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs"
                          onClick={() => {
                            setEditingProgram(prog);
                            setIsModalOpen(true);
                          }}
                          title="Edit Program"
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs"
                          onClick={() => handleDeleteProgram(prog)}
                          title="Delete Program"
                          style={{ color: '#ef4444' }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View */
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
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>Program Title & Category</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>Trainer / Provider</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>Schedule</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>Hours</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>Participants</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>Status</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {programs.map((prog) => (
                  <tr key={prog.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.88rem' }}>{prog.title}</span>
                        <span style={{ fontSize: '0.74rem', color: '#64748b' }}>{prog.training_type} • {prog.category}</span>
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontWeight: 500, color: '#1e293b', fontSize: '0.84rem' }}>{prog.trainer_name}</span>
                        {prog.training_provider && <span style={{ fontSize: '0.74rem', color: '#64748b' }}>{prog.training_provider}</span>}
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: '0.82rem', color: '#334155' }}>
                      {formatDate(prog.start_date)}
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: '0.84rem', fontWeight: 600, color: '#0891b2' }}>
                      {prog.duration_hours} hrs
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ fontSize: '0.82rem', color: '#1e293b' }}>
                        <strong>{prog.enrolled_count || 0}</strong> Enrolled
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span className={`status-pill badge-${prog.status?.toLowerCase() || 'upcoming'}`} style={{ fontSize: '0.72rem' }}>
                        <span className="status-dot"></span>
                        <span>{prog.status}</span>
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-xs"
                          onClick={() => onSelectProgramForAttendance(prog.id)}
                          style={{ fontSize: '0.76rem' }}
                        >
                          Roster
                        </button>
                        {canManage && (
                          <>
                            <button
                              type="button"
                              className="btn btn-ghost btn-xs"
                              onClick={() => {
                                setEditingProgram(prog);
                                setIsModalOpen(true);
                              }}
                            >
                              <Edit3 size={13} />
                            </button>
                            <button
                              type="button"
                              className="btn btn-ghost btn-xs"
                              onClick={() => handleDeleteProgram(prog)}
                              style={{ color: '#ef4444' }}
                            >
                              <Trash2 size={13} />
                            </button>
                          </>
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

      {/* Program Create/Edit Modal */}
      {isModalOpen && (
        <AddEditTrainingModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setEditingProgram(null);
          }}
          onSaved={() => {
            fetchPrograms();
          }}
          initialProgram={editingProgram}
          departments={departments}
        />
      )}
    </div>
  );
}

export default TrainingProgramsView;
