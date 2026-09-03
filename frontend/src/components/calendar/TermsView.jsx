import React, { useState, useMemo } from 'react';
import { 
  Layers, 
  Plus, 
  Edit, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  Calendar, 
  RefreshCw,
  Power
} from 'lucide-react';
import { hrmsApi } from '../../services/api';
import { TableSkeleton } from '../common/LoadingSpinner';
import AddEditTermModal from './AddEditTermModal';

export function TermsView({
  terms = [],
  academicYears = [],
  activeYearId = null,
  isLoading = false,
  isRefreshing = false,
  onRefresh,
  canManage = false
}) {
  const [selectedYearFilter, setSelectedYearFilter] = useState(activeYearId || 'ALL');
  const [editingTerm, setEditingTerm] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const filteredTerms = useMemo(() => {
    if (selectedYearFilter === 'ALL') return terms;
    return terms.filter(t => t.academic_year_id === selectedYearFilter);
  }, [terms, selectedYearFilter]);

  const handleToggleStatus = async (term) => {
    try {
      const res = await hrmsApi.toggleAcademicTermStatus(term.id, !term.is_active);
      if (res && res.success) {
        if (onRefresh) onRefresh();
      }
    } catch (err) {
      console.error('Error toggling term status:', err);
      setFeedback({ type: 'error', message: err.message || 'Failed to update term status.' });
    }
  };

  return (
    <div className="terms-view">
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
            School Academic Terms
          </h3>
          <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '2px 0 0' }}>
            Manage term boundaries, examinations, and curricular phases within academic sessions.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Year Filter */}
          <select
            className="form-control"
            style={{ width: '200px', fontSize: '0.84rem' }}
            value={selectedYearFilter}
            onChange={e => setSelectedYearFilter(e.target.value)}
          >
            <option value="ALL">All Academic Years</option>
            {academicYears.map(y => (
              <option key={y.id} value={y.id}>
                {y.name} {y.is_active ? '★ (Active)' : ''}
              </option>
            ))}
          </select>

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
                setEditingTerm(null);
                setIsModalOpen(true);
              }}
            >
              <Plus size={15} />
              <span>Add School Term</span>
            </button>
          )}
        </div>
      </div>

      {feedback && (
        <div style={{
          marginBottom: '16px',
          padding: '10px 14px',
          borderRadius: '8px',
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          color: '#b91c1c',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>{feedback.message}</span>
          <button type="button" onClick={() => setFeedback(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>✕</button>
        </div>
      )}

      {/* Terms Table */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '14px',
        border: '1px solid #e2e8f0',
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
      }}>
        {isLoading ? (
          <TableSkeleton rows={4} />
        ) : filteredTerms.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
            No school terms found for the selected academic year. Click "Add School Term" to configure one.
          </div>
        ) : (
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                <th style={{ padding: '12px 16px', fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>TERM TITLE</th>
                <th style={{ padding: '12px 16px', fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>ACADEMIC YEAR</th>
                <th style={{ padding: '12px 16px', fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>START DATE</th>
                <th style={{ padding: '12px 16px', fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>END DATE</th>
                <th style={{ padding: '12px 16px', fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>STATUS</th>
                {canManage && <th style={{ padding: '12px 16px', fontSize: '0.78rem', fontWeight: 700, color: '#475569', textAlign: 'right' }}>ACTIONS</th>}
              </tr>
            </thead>
            <tbody>
              {filteredTerms.map((term) => {
                return (
                  <tr key={term.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '14px 16px', fontWeight: 700, fontSize: '0.92rem', color: '#0f172a' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Layers size={16} style={{ color: '#7c3aed' }} />
                        <span>{term.name}</span>
                      </div>
                      {term.description && (
                        <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: '2px' }}>
                          {term.description}
                        </div>
                      )}
                    </td>

                    <td style={{ padding: '14px 16px', fontSize: '0.86rem', color: '#334155' }}>
                      <span style={{ fontWeight: 600 }}>{term.year_name || 'Academic Session'}</span>
                    </td>

                    <td style={{ padding: '14px 16px', fontSize: '0.86rem', color: '#334155' }}>
                      {new Date(term.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>

                    <td style={{ padding: '14px 16px', fontSize: '0.86rem', color: '#334155' }}>
                      {new Date(term.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>

                    <td style={{ padding: '14px 16px' }}>
                      <span style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        padding: '3px 10px',
                        borderRadius: '12px',
                        backgroundColor: term.is_active ? '#ecfdf5' : '#f1f5f9',
                        color: term.is_active ? '#059669' : '#64748b',
                        border: `1px solid ${term.is_active ? '#a7f3d0' : '#e2e8f0'}`
                      }}>
                        {term.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>

                    {canManage && (
                      <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                          <button
                            type="button"
                            className="btn btn-ghost btn-xs"
                            onClick={() => {
                              setEditingTerm(term);
                              setIsModalOpen(true);
                            }}
                            title="Edit Term"
                          >
                            <Edit size={14} />
                            <span>Edit</span>
                          </button>

                          <button
                            type="button"
                            className="btn btn-ghost btn-xs"
                            onClick={() => handleToggleStatus(term)}
                            style={{ color: term.is_active ? '#dc2626' : '#059669' }}
                            title={term.is_active ? 'Deactivate Term' : 'Activate Term'}
                          >
                            <Power size={14} />
                          </button>
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
        <AddEditTermModal
          term={editingTerm}
          isOpen={isModalOpen}
          academicYears={academicYears}
          activeYearId={activeYearId}
          onClose={() => {
            setIsModalOpen(false);
            setEditingTerm(null);
          }}
          onSaved={() => {
            if (onRefresh) onRefresh();
          }}
        />
      )}
    </div>
  );
}

export default TermsView;
