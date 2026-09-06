import React, { useState, useEffect } from 'react';
import { 
  GraduationCap, 
  Calendar, 
  Clock, 
  Award, 
  CheckCircle2, 
  AlertCircle, 
  MapPin, 
  Users, 
  ExternalLink,
  BookOpen,
  RefreshCw
} from 'lucide-react';
import { hrmsApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { LoadingSpinner } from '../common/LoadingSpinner';

export function MyTrainingView() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('upcoming'); // 'upcoming' | 'completed' | 'certificates'

  const fetchMyTrainings = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await hrmsApi.getMyTrainings();
      if (res && res.success) {
        setData(res.data);
      } else {
        setError(res?.message || 'Failed to load personal training records.');
      }
    } catch (err) {
      console.error('Error fetching my trainings:', err);
      setError(err.message || 'Error occurred while loading training history.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMyTrainings();
  }, []);

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const summary = data?.summary || {
    total_enrolled: 0,
    completed_count: 0,
    upcoming_count: 0,
    total_hours_completed: 0,
    total_certificates: 0
  };

  return (
    <div className="my-training-view" style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {/* 1. Header Banner */}
      <div style={{
        backgroundColor: '#ffffff',
        padding: '20px 24px',
        borderRadius: '14px',
        border: '1px solid #e2e8f0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '14px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '46px',
            height: '46px',
            borderRadius: '12px',
            backgroundColor: '#eef2ff',
            color: '#3155D9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <GraduationCap size={24} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#172033', margin: 0 }}>
              My Professional Development & Training
            </h2>
            <span className="text-muted text-xs">
              View your assigned workshops, credited development hours, and official certificates.
            </span>
          </div>
        </div>

        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={fetchMyTrainings}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          <RefreshCw size={14} className={isLoading ? 'spin-animation' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* 2. Personal KPI Metric Cards (.stats-grid) */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <div className="stat-card">
          <div className="stat-content">
            <span className="stat-title">Completed Modules</span>
            <div className="stat-number-wrapper">
              <span className="stat-number" style={{ color: '#16a34a' }}>
                {summary.completed_count}
              </span>
            </div>
            <span className="stat-subtext">Successfully concluded</span>
          </div>
          <div className="stat-icon-badge" style={{ backgroundColor: '#ecfdf5', color: '#16a34a' }}>
            <CheckCircle2 size={20} />
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-content">
            <span className="stat-title">CPD Hours Earned</span>
            <div className="stat-number-wrapper">
              <span className="stat-number" style={{ color: '#0891b2' }}>
                {summary.total_hours_completed} hrs
              </span>
            </div>
            <span className="stat-subtext">Credited training duration</span>
          </div>
          <div className="stat-icon-badge" style={{ backgroundColor: '#ecfeff', color: '#0891b2' }}>
            <Clock size={20} />
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-content">
            <span className="stat-title">Upcoming Sessions</span>
            <div className="stat-number-wrapper">
              <span className="stat-number" style={{ color: '#3155D9' }}>
                {summary.upcoming_count}
              </span>
            </div>
            <span className="stat-subtext">Scheduled modules</span>
          </div>
          <div className="stat-icon-badge" style={{ backgroundColor: '#eef2ff', color: '#3155D9' }}>
            <Calendar size={20} />
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-content">
            <span className="stat-title">My Certificates</span>
            <div className="stat-number-wrapper">
              <span className="stat-number" style={{ color: '#d97706' }}>
                {summary.total_certificates}
              </span>
            </div>
            <span className="stat-subtext">Verified credentials</span>
          </div>
          <div className="stat-icon-badge" style={{ backgroundColor: '#fef3c7', color: '#d97706' }}>
            <Award size={20} />
          </div>
        </div>
      </div>

      {/* 3. Sub-Tab Switcher */}
      <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', gap: '8px' }}>
        <button
          type="button"
          className={`btn btn-sm ${activeTab === 'upcoming' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('upcoming')}
          style={{ gap: '6px' }}
        >
          <Calendar size={15} />
          <span>Assigned & Upcoming ({data?.upcoming_trainings?.length || 0})</span>
        </button>

        <button
          type="button"
          className={`btn btn-sm ${activeTab === 'completed' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('completed')}
          style={{ gap: '6px' }}
        >
          <CheckCircle2 size={15} />
          <span>Completed History ({data?.completed_trainings?.length || 0})</span>
        </button>

        <button
          type="button"
          className={`btn btn-sm ${activeTab === 'certificates' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('certificates')}
          style={{ gap: '6px' }}
        >
          <Award size={15} />
          <span>My Certificates ({data?.certificates?.length || 0})</span>
        </button>
      </div>

      {/* 4. Tab Content */}
      {isLoading ? (
        <div style={{ padding: '60px 0', textAlign: 'center' }}>
          <LoadingSpinner text="Fetching your professional development dossier..." size={32} />
        </div>
      ) : error ? (
        <div style={{ padding: '16px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', color: '#991b1b' }}>
          {error}
        </div>
      ) : activeTab === 'upcoming' ? (
        /* Upcoming Trainings Tab */
        data?.upcoming_trainings?.length === 0 ? (
          <div style={{ backgroundColor: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '50px 20px', textAlign: 'center', color: '#64748b' }}>
            You have no upcoming or pending training sessions assigned right now.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
            {data.upcoming_trainings.map((t) => (
              <div
                key={t.enrollment_id}
                style={{
                  backgroundColor: '#ffffff',
                  borderRadius: '14px',
                  border: '1px solid #e2e8f0',
                  padding: '18px 20px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#3155D9', backgroundColor: '#eef2ff', padding: '2px 8px', borderRadius: '6px' }}>
                    {t.training_type} • {t.category}
                  </span>
                  <span className={`status-pill badge-${t.enrollment_status?.toLowerCase() || 'assigned'}`} style={{ fontSize: '0.72rem' }}>
                    <span className="status-dot"></span>
                    <span>{t.enrollment_status}</span>
                  </span>
                </div>

                <h3 style={{ fontSize: '0.98rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                  {t.title}
                </h3>

                {t.description && (
                  <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {t.description}
                  </p>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.8rem', color: '#475569', backgroundColor: '#f8fafc', padding: '10px 12px', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Calendar size={13} style={{ color: '#3155D9' }} />
                    <span style={{ fontWeight: 600 }}>{formatDate(t.start_date)}</span>
                    {t.start_time && <span>({t.start_time.substring(0, 5)} - {t.end_time?.substring(0, 5) || ''})</span>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Clock size={13} style={{ color: '#0891b2' }} />
                    <span>Duration: {t.duration_hours} hrs</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Users size={13} style={{ color: '#16a34a' }} />
                    <span>Trainer: <strong>{t.trainer_name}</strong></span>
                  </div>
                  {t.location_venue && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <MapPin size={13} style={{ color: '#d97706' }} />
                      <span>Venue: {t.location_venue}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      ) : activeTab === 'completed' ? (
        /* Completed History Tab */
        data?.completed_trainings?.length === 0 ? (
          <div style={{ backgroundColor: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '50px 20px', textAlign: 'center', color: '#64748b' }}>
            No completed training records found.
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
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>Training Attended</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>Provider / Trainer</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>Date</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>Hours Credited</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>Status</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>Certificate</th>
                  </tr>
                </thead>
                <tbody>
                  {data.completed_trainings.map((t) => (
                    <tr key={t.enrollment_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.86rem' }}>{t.title}</span>
                          <span style={{ fontSize: '0.74rem', color: '#64748b' }}>{t.category}</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '0.82rem', color: '#334155' }}>
                        {t.trainer_name}
                        {t.training_provider && <span style={{ color: '#64748b' }}> ({t.training_provider})</span>}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '0.82rem', color: '#334155' }}>
                        {formatDate(t.completion_date || t.start_date)}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '0.84rem', fontWeight: 700, color: '#0891b2' }}>
                        {t.hours_completed} hrs
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span className="status-pill badge-active" style={{ fontSize: '0.72rem' }}>
                          <span className="status-dot"></span>
                          <span>Completed</span>
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        {t.certificate_id ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#15803d', fontSize: '0.76rem', fontWeight: 600 }}>
                            <Award size={13} />
                            <span>Awarded ({t.certificate_number || 'ID Valid'})</span>
                          </span>
                        ) : (
                          <span style={{ color: '#94a3b8', fontSize: '0.76rem' }}>Not Certified</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : (
        /* Certificates Tab */
        data?.certificates?.length === 0 ? (
          <div style={{ backgroundColor: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '50px 20px', textAlign: 'center', color: '#64748b' }}>
            No certificates recorded on your profile yet.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
            {data.certificates.map((cert) => (
              <div
                key={cert.id}
                style={{
                  backgroundColor: '#ffffff',
                  borderRadius: '14px',
                  border: '1px solid #e2e8f0',
                  padding: '20px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    backgroundColor: '#fef3c7',
                    color: '#d97706',
                    padding: '3px 10px',
                    borderRadius: '20px',
                    fontSize: '0.74rem',
                    fontWeight: 700
                  }}>
                    <Award size={13} />
                    <span>Official Credential</span>
                  </div>
                  <span className="status-pill badge-active" style={{ fontSize: '0.72rem' }}>
                    <span className="status-dot"></span>
                    <span>{cert.status || 'Active'}</span>
                  </span>
                </div>

                <div>
                  <h3 style={{ fontSize: '0.98rem', fontWeight: 700, color: '#0f172a', margin: '0 0 4px 0' }}>
                    {cert.certificate_name}
                  </h3>
                  <span className="text-monospace font-bold" style={{ fontSize: '0.78rem', color: '#3155D9' }}>
                    {cert.certificate_number || 'Certificate ID Recorded'}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.8rem', color: '#475569', backgroundColor: '#f8fafc', padding: '10px 12px', borderRadius: '8px' }}>
                  <div>Provider: <strong>{cert.training_provider || 'School Institutional CPD'}</strong></div>
                  <div>Issued Date: <strong>{formatDate(cert.issue_date)}</strong></div>
                  {cert.expiry_date && <div>Expires: <strong>{formatDate(cert.expiry_date)}</strong></div>}
                  {cert.document_reference && (
                    <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '4px' }}>
                      Ref: {cert.document_reference}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}

export default MyTrainingView;
