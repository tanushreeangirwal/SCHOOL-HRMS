import React, { useState, useEffect, useCallback } from 'react';
import { 
  FileText, 
  Search, 
  Filter, 
  Download, 
  Plus, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Calendar, 
  User, 
  AlertCircle,
  Loader2,
  RefreshCw,
  Eye,
  Building2
} from 'lucide-react';
import { hrmsApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { ApplyLeaveModal } from './ApplyLeaveModal';
import { LeaveDetailsModal } from './LeaveDetailsModal';

export function LeaveRequestsView() {
  const { user, isSuperAdmin, isAdmin, isHR, isManager } = useAuth();
  const canManage = isSuperAdmin || isAdmin || isHR || isManager;

  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [departments, setDepartments] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [employees, setEmployees] = useState([]);

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');

  // Modals state
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [selectedRequestForDetail, setSelectedRequestForDetail] = useState(null);
  const [isExporting, setIsExporting] = useState(false);
  const [actionError, setActionError] = useState('');

  // Fetch initial master filters
  useEffect(() => {
    async function loadMasterData() {
      try {
        const [depRes, typesRes, empRes] = await Promise.all([
          hrmsApi.getDepartments(),
          hrmsApi.getLeaveTypes(false),
          hrmsApi.getEmployees({ limit: 100 })
        ]);

        if (depRes && depRes.success) setDepartments(depRes.data || []);
        if (typesRes && typesRes.success) setLeaveTypes(typesRes.data || []);
        if (empRes && empRes.success) setEmployees(empRes.data.employees || empRes.data || []);
      } catch (err) {
        console.error('Failed to load filter metadata:', err);
      }
    }
    loadMasterData();
  }, []);

  // Fetch leave requests
  const fetchRequests = useCallback(async () => {
    setLoading(true);
    setActionError('');
    try {
      const params = {
        status: statusFilter,
        leave_type_id: typeFilter,
        department_id: deptFilter,
        start_date: startDateFilter,
        end_date: endDateFilter,
        search: searchTerm.trim()
      };

      const res = await hrmsApi.getLeaveRequests(params);
      if (res && res.success) {
        setRequests(res.data.requests || []);
        setTotalCount(res.data.total || 0);
      } else {
        setActionError(res?.message || 'Failed to fetch leave requests.');
      }
    } catch (err) {
      console.error('Error fetching requests:', err);
      setActionError(err.message || 'Error communicating with server.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, typeFilter, deptFilter, startDateFilter, endDateFilter, searchTerm]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchRequests();
    }, 250);
    return () => clearTimeout(timer);
  }, [fetchRequests]);

  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      await hrmsApi.exportLeaveRequests({
        status: statusFilter,
        leave_type_id: typeFilter,
        department_id: deptFilter
      });
    } catch (err) {
      console.error('Export error:', err);
      alert('Failed to export leave requests.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleQuickApprove = async (e, reqId) => {
    e.stopPropagation();
    try {
      const res = await hrmsApi.approveLeave(reqId);
      if (res && res.success) {
        fetchRequests();
      }
    } catch (err) {
      console.error('Approve error:', err);
    }
  };

  const handleQuickReject = async (e, req) => {
    e.stopPropagation();
    setSelectedRequestForDetail(req);
  };

  const formatDate = (dStr) => {
    if (!dStr) return '—';
    return new Date(dStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Approved':
        return <span className="status-badge active" style={{ backgroundColor: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0' }}>Approved</span>;
      case 'Pending':
        return <span className="status-badge pending" style={{ backgroundColor: '#fffbeb', color: '#d97706', border: '1px solid #fde68a' }}>Pending</span>;
      case 'Rejected':
        return <span className="status-badge inactive" style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>Rejected</span>;
      case 'Cancelled':
        return <span className="status-badge" style={{ backgroundColor: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0' }}>Cancelled</span>;
      default:
        return <span className="status-badge">{status}</span>;
    }
  };

  return (
    <div className="leave-requests-view" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Header Card */}
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
            <FileText size={24} className="text-primary" />
            Leave Applications Registry
          </h1>
          <p style={{ fontSize: '0.86rem', color: '#64748b', margin: '4px 0 0' }}>
            Search, filter, audit and process institutional leave requests ({totalCount} records found)
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleExportCSV}
            disabled={isExporting}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            {isExporting ? <Loader2 size={16} className="spin-animation" /> : <Download size={16} />}
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setIsApplyModalOpen(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Plus size={16} />
            <span>Apply For Leave</span>
          </button>
        </div>
      </div>

      {actionError && (
        <div className="error-banner">
          <div className="error-banner-content">
            <AlertCircle size={18} className="error-icon" />
            <span className="error-text">{actionError}</span>
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div style={{ 
        backgroundColor: '#ffffff', 
        borderRadius: '12px', 
        padding: '16px 20px', 
        border: '1px solid #e2e8f0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
          {/* Search Box */}
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              type="text"
              className="form-control"
              placeholder="Search faculty name, code, reason..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{ paddingLeft: '36px', fontSize: '0.86rem' }}
            />
          </div>

          {/* Status Filter */}
          <div>
            <select
              className="form-control"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              style={{ fontSize: '0.86rem' }}
            >
              <option value="ALL">All Statuses</option>
              <option value="Pending">Pending Review</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>

          {/* Leave Type Filter */}
          <div>
            <select
              className="form-control"
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              style={{ fontSize: '0.86rem' }}
            >
              <option value="ALL">All Categories</option>
              {leaveTypes.map(lt => (
                <option key={lt.id} value={lt.id}>
                  {lt.name} ({lt.code})
                </option>
              ))}
            </select>
          </div>

          {/* Department Filter */}
          <div>
            <select
              className="form-control"
              value={deptFilter}
              onChange={e => setDeptFilter(e.target.value)}
              style={{ fontSize: '0.86rem' }}
            >
              <option value="ALL">All Departments</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Date Filters & Reset */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', paddingTop: '8px', borderTop: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>From:</span>
            <input
              type="date"
              className="form-control"
              value={startDateFilter}
              onChange={e => setStartDateFilter(e.target.value)}
              style={{ width: 'auto', padding: '4px 8px', fontSize: '0.82rem' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>To:</span>
            <input
              type="date"
              className="form-control"
              value={endDateFilter}
              onChange={e => setEndDateFilter(e.target.value)}
              style={{ width: 'auto', padding: '4px 8px', fontSize: '0.82rem' }}
            />
          </div>

          {(searchTerm || statusFilter !== 'ALL' || typeFilter !== 'ALL' || deptFilter !== 'ALL' || startDateFilter || endDateFilter) && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('ALL');
                setTypeFilter('ALL');
                setDeptFilter('ALL');
                setStartDateFilter('');
                setEndDateFilter('');
              }}
              style={{ fontSize: '0.78rem', marginLeft: 'auto' }}
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Main Table */}
      <div style={{ 
        backgroundColor: '#ffffff', 
        borderRadius: '12px', 
        border: '1px solid #e2e8f0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        overflow: 'hidden'
      }}>
        {loading ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: '#64748b' }}>
            <Loader2 size={32} className="spin-animation text-primary" style={{ margin: '0 auto 12px', display: 'block' }} />
            <span>Loading leave registry records...</span>
          </div>
        ) : requests.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: '#64748b' }}>
            <FileText size={40} style={{ color: '#cbd5e1', margin: '0 auto 12px', display: 'block' }} />
            <div style={{ fontWeight: 700, fontSize: '1rem', color: '#1e293b' }}>No Leave Requests Match Filters</div>
            <div style={{ fontSize: '0.84rem', marginTop: '4px' }}>Try adjusting your search query, status filters or date range.</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="clean-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#64748b' }}>
                  <th style={{ padding: '12px 18px', textAlign: 'left' }}>Staff Member</th>
                  <th style={{ padding: '12px 18px', textAlign: 'left' }}>Department</th>
                  <th style={{ padding: '12px 18px', textAlign: 'left' }}>Category</th>
                  <th style={{ padding: '12px 18px', textAlign: 'left' }}>Duration & Dates</th>
                  <th style={{ padding: '12px 18px', textAlign: 'left' }}>Reason Excerpt</th>
                  <th style={{ padding: '12px 18px', textAlign: 'center' }}>Status</th>
                  <th style={{ padding: '12px 18px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {requests.map(req => (
                  <tr 
                    key={req.id}
                    onClick={() => setSelectedRequestForDetail(req)}
                    style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer', transition: 'background-color 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f8fafc'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = '#ffffff'}
                  >
                    <td style={{ padding: '14px 18px' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a' }}>
                        {req.employee_name}
                      </div>
                      <div style={{ fontSize: '0.76rem', color: '#64748b' }}>
                        {req.employee_code}
                      </div>
                    </td>

                    <td style={{ padding: '14px 18px', fontSize: '0.84rem', color: '#334155' }}>
                      {req.department_name || 'Academic'}
                    </td>

                    <td style={{ padding: '14px 18px' }}>
                      <span style={{ 
                        fontSize: '0.78rem', 
                        fontWeight: 600, 
                        padding: '3px 8px', 
                        borderRadius: '12px',
                        backgroundColor: '#eff6ff',
                        color: '#2563eb'
                      }}>
                        {req.leave_type_code} • {req.leave_type_name}
                      </span>
                    </td>

                    <td style={{ padding: '14px 18px' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.86rem', color: '#0f172a' }}>
                        {req.total_days} Working Day{req.total_days > 1 ? 's' : ''}
                      </div>
                      <div style={{ fontSize: '0.76rem', color: '#64748b' }}>
                        {formatDate(req.start_date)} – {formatDate(req.end_date)}
                      </div>
                    </td>

                    <td style={{ padding: '14px 18px', fontSize: '0.84rem', color: '#475569', maxWidth: '220px' }}>
                      <span style={{ display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {req.reason}
                      </span>
                    </td>

                    <td style={{ padding: '14px 18px', textAlign: 'center' }}>
                      {getStatusBadge(req.status)}
                    </td>

                    <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }} onClick={e => e.stopPropagation()}>
                        {req.status === 'Pending' && canManage && (
                          <>
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              onClick={(e) => handleQuickApprove(e, req.id)}
                              style={{ backgroundColor: '#059669', borderColor: '#059669', padding: '4px 8px', fontSize: '0.76rem' }}
                              title="Approve Leave"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              className="btn btn-danger btn-sm"
                              onClick={(e) => handleQuickReject(e, req)}
                              style={{ padding: '4px 8px', fontSize: '0.76rem' }}
                              title="Reject Leave"
                            >
                              Reject
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => setSelectedRequestForDetail(req)}
                          style={{ padding: '4px 8px', fontSize: '0.76rem' }}
                        >
                          <Eye size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      <ApplyLeaveModal
        isOpen={isApplyModalOpen}
        onClose={() => setIsApplyModalOpen(false)}
        onSuccess={() => {
          fetchRequests();
        }}
        employees={employees}
        leaveTypes={leaveTypes}
      />

      <LeaveDetailsModal
        isOpen={Boolean(selectedRequestForDetail)}
        onClose={() => setSelectedRequestForDetail(null)}
        leaveRequest={selectedRequestForDetail}
        onStatusUpdated={() => {
          fetchRequests();
        }}
      />
    </div>
  );
}
