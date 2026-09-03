import React, { useState, useEffect } from 'react';
import { 
  Layers, 
  Plus, 
  Edit, 
  Trash2, 
  CheckCircle2, 
  XCircle, 
  ShieldCheck, 
  AlertCircle, 
  Loader2,
  Tag,
  Clock
} from 'lucide-react';
import { hrmsApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { AddEditLeaveTypeModal } from './AddEditLeaveTypeModal';

export function LeaveTypesView() {
  const { isSuperAdmin, isAdmin, isHR } = useAuth();
  const canManage = isSuperAdmin || isAdmin || isHR;

  const [loading, setLoading] = useState(true);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [error, setError] = useState(null);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTypeForEdit, setSelectedTypeForEdit] = useState(null);
  const [actionError, setActionError] = useState('');

  const fetchTypes = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await hrmsApi.getLeaveTypes(true); // Include inactive
      if (res && res.success) {
        setLeaveTypes(res.data || []);
      } else {
        setError(res?.message || 'Failed to load leave categories.');
      }
    } catch (err) {
      console.error('Fetch leave types error:', err);
      setError('An unexpected error occurred while loading leave categories.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTypes();
  }, []);

  const handleToggleActive = async (type) => {
    setActionError('');
    try {
      if (type.is_active) {
        // Deactivate
        const res = await hrmsApi.deleteLeaveType(type.id);
        if (res && res.success) {
          fetchTypes();
        } else {
          setActionError(res?.message || 'Failed to deactivate leave category.');
        }
      } else {
        // Activate via update
        const res = await hrmsApi.updateLeaveType(type.id, { is_active: true });
        if (res && res.success) {
          fetchTypes();
        } else {
          setActionError(res?.message || 'Failed to activate leave category.');
        }
      }
    } catch (err) {
      console.error('Toggle type error:', err);
      setActionError(err.message || 'Error updating status.');
    }
  };

  return (
    <div className="leave-types-view" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Banner */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        flexWrap: 'wrap', 
        gap: '16px',
        backgroundColor: '#ffffff',
        padding: '20px 24px',
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
      }}>
        <div>
          <h1 style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Layers size={24} className="text-primary" />
            Leave Categories & Entitlement Policies
          </h1>
          <p style={{ fontSize: '0.86rem', color: '#64748b', margin: '4px 0 0' }}>
            Configure institutional statutory quotas, paid/unpaid status and approval requirements
          </p>
        </div>

        {canManage && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setSelectedTypeForEdit(null);
              setIsModalOpen(true);
            }}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Plus size={16} />
            <span>New Leave Category</span>
          </button>
        )}
      </div>

      {actionError && (
        <div className="error-banner">
          <div className="error-banner-content">
            <AlertCircle size={18} className="error-icon" />
            <span className="error-text">{actionError}</span>
          </div>
        </div>
      )}

      {/* Grid of Leave Types */}
      {loading ? (
        <div style={{ padding: '60px 20px', textAlign: 'center', color: '#64748b' }}>
          <Loader2 size={32} className="spin-animation text-primary" style={{ margin: '0 auto 12px', display: 'block' }} />
          <span>Loading leave policies and categories...</span>
        </div>
      ) : leaveTypes.length === 0 ? (
        <div style={{ padding: '60px 20px', textAlign: 'center', backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <Layers size={40} style={{ color: '#cbd5e1', margin: '0 auto 12px', display: 'block' }} />
          <div style={{ fontWeight: 700, fontSize: '1rem', color: '#1e293b' }}>No Leave Categories Configured</div>
          <div style={{ fontSize: '0.84rem', marginTop: '4px', color: '#64748b' }}>Click 'New Leave Category' above to define school leave quotas.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '18px' }}>
          {leaveTypes.map(type => (
            <div
              key={type.id}
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '12px',
                padding: '20px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                opacity: type.is_active ? 1 : 0.6
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                  <span style={{ 
                    fontSize: '0.82rem', 
                    fontWeight: 700, 
                    backgroundColor: '#eff6ff', 
                    color: '#2563eb', 
                    padding: '3px 10px', 
                    borderRadius: '12px' 
                  }}>
                    {type.code}
                  </span>

                  <div style={{ display: 'flex', gap: '6px' }}>
                    <span style={{ 
                      fontSize: '0.74rem', 
                      fontWeight: 600, 
                      padding: '2px 8px', 
                      borderRadius: '10px',
                      backgroundColor: type.is_paid ? '#ecfdf5' : '#fffbeb',
                      color: type.is_paid ? '#059669' : '#d97706',
                      border: `1px solid ${type.is_paid ? '#a7f3d0' : '#fde68a'}`
                    }}>
                      {type.is_paid ? 'Paid' : 'Unpaid'}
                    </span>

                    <span style={{ 
                      fontSize: '0.74rem', 
                      fontWeight: 600, 
                      padding: '2px 8px', 
                      borderRadius: '10px',
                      backgroundColor: type.is_active ? '#f0fdf4' : '#f1f5f9',
                      color: type.is_active ? '#166534' : '#64748b'
                    }}>
                      {type.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>

                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', margin: '0 0 6px' }}>
                  {type.name}
                </h3>

                <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '0 0 14px', lineHeight: '1.45', minHeight: '38px' }}>
                  {type.description || 'Institutional statutory leave provision.'}
                </p>

                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  padding: '10px 14px', 
                  backgroundColor: '#f8fafc', 
                  borderRadius: '8px', 
                  border: '1px solid #f1f5f9',
                  marginBottom: '16px'
                }}>
                  <div>
                    <span style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600, display: 'block' }}>Annual Entitlement</span>
                    <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>
                      {parseFloat(type.annual_allocation) > 0 ? `${type.annual_allocation} Days` : 'Unlimited / LWP'}
                    </span>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600, display: 'block' }}>Approval</span>
                    <span style={{ fontSize: '0.84rem', fontWeight: 600, color: type.requires_approval ? '#0f172a' : '#64748b' }}>
                      {type.requires_approval ? 'Required' : 'Auto-Approve'}
                    </span>
                  </div>
                </div>
              </div>

              {canManage && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid #f1f5f9', paddingTop: '12px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleToggleActive(type)}
                    style={{ fontSize: '0.78rem' }}
                  >
                    {type.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => {
                      setSelectedTypeForEdit(type);
                      setIsModalOpen(true);
                    }}
                    style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Edit size={13} />
                    <span>Edit</span>
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      <AddEditLeaveTypeModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        leaveType={selectedTypeForEdit}
        onSuccess={() => {
          fetchTypes();
        }}
      />
    </div>
  );
}
