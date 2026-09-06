import React, { useState, useEffect } from 'react';
import { 
  Award, 
  Search, 
  Plus, 
  Calendar, 
  Building2, 
  AlertCircle, 
  Clock, 
  CheckCircle2, 
  Trash2, 
  Edit3, 
  FileText,
  Filter,
  RefreshCw
} from 'lucide-react';
import { hrmsApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { StaffAvatar } from '../common/StaffAvatar';
import AddCertificateModal from './AddCertificateModal';

export function TrainingCertificatesView({ departments = [] }) {
  const { isSuperAdmin, isAdmin, isHR, isManager } = useAuth();
  const canManage = isSuperAdmin || isAdmin || isHR;

  const [certificates, setCertificates] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCert, setEditingCert] = useState(null);

  const fetchCertificates = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = {};
      if (search) params.search = search;
      if (selectedDept) params.department_id = selectedDept;
      if (statusFilter) params.status = statusFilter;

      const res = await hrmsApi.getTrainingCertificates(params);
      if (res && res.success) {
        setCertificates(res.data || []);
      } else {
        setError(res?.message || 'Failed to load certificate records.');
      }
    } catch (err) {
      console.error('Error fetching certificates:', err);
      setError(err.message || 'Error occurred while loading certificates.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCertificates();
  }, [search, selectedDept, statusFilter]);

  const handleDelete = async (cert) => {
    if (!canManage) return;
    if (!window.confirm(`Delete certificate "${cert.certificate_name}" for ${cert.first_name} ${cert.last_name}?`)) {
      return;
    }

    try {
      const res = await hrmsApi.deleteTrainingCertificate(cert.id);
      if (res && res.success) {
        setCertificates(prev => prev.filter(c => c.id !== cert.id));
      } else {
        alert(res?.message || 'Failed to delete certificate record.');
      }
    } catch (err) {
      alert(err.message || 'Error deleting certificate record.');
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const checkExpiryStatus = (expiryDate) => {
    if (!expiryDate) return { label: 'Permanent', color: '#16a34a', bg: '#f0fdf4' };
    const exp = new Date(expiryDate);
    const today = new Date();
    if (exp < today) return { label: 'Expired', color: '#dc2626', bg: '#fef2f2' };
    const diffDays = Math.ceil((exp - today) / (1000 * 60 * 60 * 24));
    if (diffDays <= 60) return { label: `Expiring (${diffDays}d)`, color: '#d97706', bg: '#fffbeb' };
    return { label: 'Valid', color: '#16a34a', bg: '#f0fdf4' };
  };

  const totalCerts = certificates.length;
  const expiredCount = certificates.filter(c => c.expiry_date && new Date(c.expiry_date) < new Date()).length;
  const expiringSoonCount = certificates.filter(c => {
    if (!c.expiry_date) return false;
    const diff = Math.ceil((new Date(c.expiry_date) - new Date()) / (1000 * 60 * 60 * 24));
    return diff >= 0 && diff <= 60;
  }).length;

  return (
    <div className="training-certificates-view" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* 1. Header Toolbar with KPI Summary */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px'
      }}>
        <div className="stat-card">
          <div className="stat-content">
            <span className="stat-title">Certificates Awarded</span>
            <div className="stat-number-wrapper">
              <span className="stat-number" style={{ color: '#d97706' }}>
                {totalCerts}
              </span>
            </div>
            <span className="stat-subtext">Active faculty credentials</span>
          </div>
          <div className="stat-icon-badge" style={{ backgroundColor: '#fef3c7', color: '#d97706' }}>
            <Award size={20} />
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-content">
            <span className="stat-title">Expiring Soon (60 Days)</span>
            <div className="stat-number-wrapper">
              <span className="stat-number" style={{ color: '#ea580c' }}>
                {expiringSoonCount}
              </span>
            </div>
            <span className="stat-subtext">Requires recertification</span>
          </div>
          <div className="stat-icon-badge" style={{ backgroundColor: '#fff7ed', color: '#ea580c' }}>
            <Clock size={20} />
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-content">
            <span className="stat-title">Expired Credentials</span>
            <div className="stat-number-wrapper">
              <span className="stat-number" style={{ color: '#dc2626' }}>
                {expiredCount}
              </span>
            </div>
            <span className="stat-subtext">Past validity deadline</span>
          </div>
          <div className="stat-icon-badge" style={{ backgroundColor: '#fef2f2', color: '#dc2626' }}>
            <AlertCircle size={20} />
          </div>
        </div>
      </div>

      {/* 2. Filter & Actions Toolbar */}
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
        {/* Search */}
        <div style={{ position: 'relative', minWidth: '240px', flex: 1 }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input
            type="text"
            className="form-control"
            placeholder="Search by faculty, certificate name, or number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: '36px', height: '38px', fontSize: '0.85rem' }}
          />
        </div>

        {/* Dropdowns */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <select
            className="form-control"
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            style={{ width: '180px', height: '38px', fontSize: '0.84rem' }}
          >
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>

          <select
            className="form-control"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ width: '130px', height: '38px', fontSize: '0.84rem' }}
          >
            <option value="">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Expired">Expired</option>
            <option value="Revoked">Revoked</option>
          </select>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={fetchCertificates}
            title="Refresh list"
          >
            <RefreshCw size={14} className={isLoading ? 'spin-animation' : ''} />
          </button>

          {canManage && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => {
                setEditingCert(null);
                setIsModalOpen(true);
              }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Plus size={15} />
              <span>Record Certificate</span>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', color: '#991b1b', fontSize: '0.86rem' }}>
          {error}
        </div>
      )}

      {/* 3. Certificates Table */}
      {isLoading ? (
        <div style={{ padding: '60px 0', textAlign: 'center' }}>
          <LoadingSpinner text="Fetching certification registry records..." size={32} />
        </div>
      ) : certificates.length === 0 ? (
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '14px',
          border: '1px solid #e2e8f0',
          padding: '60px 20px',
          textAlign: 'center',
          color: '#64748b'
        }}>
          <Award size={36} style={{ color: '#d97706', margin: '0 auto 10px auto' }} />
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#172033', margin: 0 }}>
            No Certificate Records Found
          </h3>
          <p style={{ fontSize: '0.84rem', color: '#64748b', marginTop: '4px' }}>
            No professional development certificates match your filter criteria.
          </p>
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
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>Certificate Name & Number</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>Faculty Recipient</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>Provider / Associated Training</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>Issue Date</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>Expiry Date</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>Compliance Status</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {certificates.map((cert) => {
                  const expiryStatus = checkExpiryStatus(cert.expiry_date);
                  return (
                    <tr key={cert.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      {/* Name & Number */}
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.88rem' }}>
                            {cert.certificate_name}
                          </span>
                          <span className="text-monospace font-bold" style={{ fontSize: '0.74rem', color: '#3155D9' }}>
                            {cert.certificate_number || 'No ID Assigned'}
                          </span>
                        </div>
                      </td>

                      {/* Recipient */}
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <StaffAvatar
                            firstName={cert.first_name}
                            lastName={cert.last_name}
                            size="sm"
                          />
                          <div>
                            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1e293b' }}>
                              {cert.first_name} {cert.last_name}
                            </div>
                            <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                              {cert.employee_code} • {cert.department_name || 'Staff'}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Provider & Program */}
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span style={{ fontSize: '0.84rem', fontWeight: 500, color: '#334155' }}>
                            {cert.training_provider || 'St. Vincent’s Academy'}
                          </span>
                          {cert.training_title && (
                            <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
                              Module: {cert.training_title}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Issue Date */}
                      <td style={{ padding: '12px 16px', fontSize: '0.82rem', color: '#1e293b' }}>
                        {formatDate(cert.issue_date)}
                      </td>

                      {/* Expiry Date */}
                      <td style={{ padding: '12px 16px', fontSize: '0.82rem', color: '#475569' }}>
                        {cert.expiry_date ? formatDate(cert.expiry_date) : 'Does Not Expire'}
                      </td>

                      {/* Compliance Status */}
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '12px',
                          color: expiryStatus.color,
                          backgroundColor: expiryStatus.bg
                        }}>
                          <span>•</span>
                          <span>{expiryStatus.label}</span>
                        </span>
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        {canManage && (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                            <button
                              type="button"
                              className="btn btn-ghost btn-xs"
                              onClick={() => {
                                setEditingCert(cert);
                                setIsModalOpen(true);
                              }}
                              title="Edit Record"
                            >
                              <Edit3 size={13} />
                            </button>
                            <button
                              type="button"
                              className="btn btn-ghost btn-xs"
                              onClick={() => handleDelete(cert)}
                              title="Delete Record"
                              style={{ color: '#ef4444' }}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Record / Edit Certificate Modal */}
      {isModalOpen && (
        <AddCertificateModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setEditingCert(null);
          }}
          onSaved={() => {
            fetchCertificates();
          }}
          initialCertificate={editingCert}
        />
      )}
    </div>
  );
}

export default TrainingCertificatesView;
