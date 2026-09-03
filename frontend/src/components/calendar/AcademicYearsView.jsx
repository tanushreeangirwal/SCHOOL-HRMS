import React, { useState } from 'react';
import { 
  CalendarRange, 
  Plus, 
  Edit, 
  CheckCircle2, 
  AlertCircle, 
  Archive, 
  Layers, 
  Calendar,
  Sparkles,
  RefreshCw,
  Power
} from 'lucide-react';
import { hrmsApi } from '../../services/api';
import { TableSkeleton } from '../common/LoadingSpinner';
import AddEditYearModal from './AddEditYearModal';

export function AcademicYearsView({
  academicYears = [],
  isLoading = false,
  isRefreshing = false,
  onRefresh,
  canManage = false
}) {
  const [editingYear, setEditingYear] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [feedback, setFeedback] = useState(null);

  const handleActivate = async (year) => {
    if (year.is_active) return;
    if (!window.confirm(`Activate ${year.name} as the official academic session? This will complete the previous active session.`)) {
      return;
    }

    setActionLoading(year.id);
    try {
      const res = await hrmsApi.activateAcademicYear(year.id);
      if (res && res.success) {
        setFeedback({ type: 'success', message: `Academic Session ${year.name} is now Active.` });
        if (onRefresh) onRefresh();
      }
    } catch (err) {
      console.error('Error activating year:', err);
      setFeedback({ type: 'error', message: err.message || 'Failed to activate academic session.' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeactivate = async (year) => {
    if (!window.confirm(`Deactivate/Archive academic session ${year.name}?`)) return;

    setActionLoading(year.id);
    try {
      const res = await hrmsApi.deleteAcademicYear(year.id);
      if (res && res.success) {
        setFeedback({ type: 'success', message: res.message || 'Academic year archived.' });
        if (onRefresh) onRefresh();
      }
    } catch (err) {
      console.error('Error archiving year:', err);
      setFeedback({ type: 'error', message: err.message || 'Failed to archive year.' });
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="academic-years-view">
      {/* Top Banner / Actions */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '16px',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
            Academic Sessions & Years
          </h3>
          <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '2px 0 0' }}>
            Configure institutional academic calendar sessions. Only one session is active at a time.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw size={14} className={isRefreshing ? 'spin-animation' : ''} />
            <span>Refresh</span>
          </button>

          {canManage && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => {
                setEditingYear(null);
                setIsModalOpen(true);
              }}
            >
              <Plus size={15} />
              <span>Create Academic Session</span>
            </button>
          )}
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div 
          className={feedback.type === 'error' ? 'apply-leave-error-strip' : 'clean-badge-pill'}
          style={{
            marginBottom: '16px',
            padding: '10px 14px',
            borderRadius: '8px',
            backgroundColor: feedback.type === 'error' ? '#fef2f2' : '#f0fdf4',
            border: `1px solid ${feedback.type === 'error' ? '#fecaca' : '#bbf7d0'}`,
            color: feedback.type === 'error' ? '#b91c1c' : '#15803d',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <span>{feedback.message}</span>
          <button type="button" onClick={() => setFeedback(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>✕</button>
        </div>
      )}

      {/* Academic Years Table */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '14px',
        border: '1px solid #e2e8f0',
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
      }}>
        {isLoading ? (
          <TableSkeleton rows={4} />
        ) : academicYears.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
            No academic sessions configured yet. Click "Create Academic Session" to add one.
          </div>
        ) : (
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                <th style={{ padding: '12px 16px', fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>SESSION NAME</th>
                <th style={{ padding: '12px 16px', fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>START DATE</th>
                <th style={{ padding: '12px 16px', fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>END DATE</th>
                <th style={{ padding: '12px 16px', fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>TERMS</th>
                <th style={{ padding: '12px 16px', fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>EVENTS</th>
                <th style={{ padding: '12px 16px', fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>STATUS</th>
                {canManage && <th style={{ padding: '12px 16px', fontSize: '0.78rem', fontWeight: 700, color: '#475569', textAlign: 'right' }}>ACTIONS</th>}
              </tr>
            </thead>
            <tbody>
              {academicYears.map((yr) => {
                const isActive = yr.is_active;
                return (
                  <tr 
                    key={yr.id}
                    style={{ 
                      borderBottom: '1px solid #f1f5f9',
                      backgroundColor: isActive ? '#f0f9ff' : '#ffffff'
                    }}
                  >
                    <td style={{ padding: '14px 16px', fontWeight: 700, fontSize: '0.92rem', color: '#0f172a' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <CalendarRange size={16} style={{ color: isActive ? '#0284c7' : '#64748b' }} />
                        <span>{yr.name}</span>
                        {isActive && (
                          <span style={{
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: '12px',
                            backgroundColor: '#dcfce7',
                            color: '#15803d',
                            border: '1px solid #bbf7d0'
                          }}>
                            ★ ACTIVE
                          </span>
                        )}
                      </div>
                      {yr.description && (
                        <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: '2px' }}>
                          {yr.description}
                        </div>
                      )}
                    </td>

                    <td style={{ padding: '14px 16px', fontSize: '0.86rem', color: '#334155' }}>
                      {new Date(yr.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>

                    <td style={{ padding: '14px 16px', fontSize: '0.86rem', color: '#334155' }}>
                      {new Date(yr.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>

                    <td style={{ padding: '14px 16px', fontSize: '0.86rem', color: '#334155' }}>
                      <span style={{ fontWeight: 600 }}>{yr.terms_count ?? 0}</span> terms
                    </td>

                    <td style={{ padding: '14px 16px', fontSize: '0.86rem', color: '#334155' }}>
                      <span style={{ fontWeight: 600 }}>{yr.events_count ?? 0}</span> events
                    </td>

                    <td style={{ padding: '14px 16px' }}>
                      <span style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        padding: '3px 10px',
                        borderRadius: '12px',
                        backgroundColor: isActive ? '#ecfdf5' : (yr.status === 'Completed' ? '#f1f5f9' : '#fffbeb'),
                        color: isActive ? '#059669' : (yr.status === 'Completed' ? '#475569' : '#b45309'),
                        border: `1px solid ${isActive ? '#a7f3d0' : (yr.status === 'Completed' ? '#e2e8f0' : '#fde68a')}`
                      }}>
                        {isActive ? 'Active' : (yr.status || 'Inactive')}
                      </span>
                    </td>

                    {canManage && (
                      <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                          {!isActive && (
                            <button
                              type="button"
                              className="btn btn-secondary btn-xs"
                              onClick={() => handleActivate(yr)}
                              disabled={actionLoading === yr.id}
                              style={{ color: '#059669', borderColor: '#a7f3d0' }}
                              title="Set as Active Session"
                            >
                              <Power size={13} />
                              <span>Set Active</span>
                            </button>
                          )}

                          <button
                            type="button"
                            className="btn btn-ghost btn-xs"
                            onClick={() => {
                              setEditingYear(yr);
                              setIsModalOpen(true);
                            }}
                            title="Edit Session"
                          >
                            <Edit size={14} />
                            <span>Edit</span>
                          </button>

                          {!isActive && (
                            <button
                              type="button"
                              className="btn btn-ghost btn-xs"
                              onClick={() => handleDeactivate(yr)}
                              disabled={actionLoading === yr.id}
                              style={{ color: '#dc2626' }}
                              title="Archive Session"
                            >
                              <Archive size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <AddEditYearModal
          year={editingYear}
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setEditingYear(null);
          }}
          onSaved={() => {
            if (onRefresh) onRefresh();
          }}
        />
      )}
    </div>
  );
}

export default AcademicYearsView;
