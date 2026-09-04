import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  FileText, 
  CheckCircle2, 
  Printer, 
  Building2, 
  User, 
  Calendar,
  AlertCircle,
  ShieldCheck,
  CreditCard,
  ChevronDown
} from 'lucide-react';
import { hrmsApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export function EmployeePayrollView({ 
  currentMonth, 
  currentYear, 
  onMonthChange, 
  onViewPayslip,
  departments = [] 
}) {
  const { isSuperAdmin, isAdmin, isHR } = useAuth();
  const canApprove = isSuperAdmin || isAdmin;

  const [records, setRecords] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState({});

  useEffect(() => {
    fetchRecords();
  }, [currentMonth, currentYear, selectedDept, selectedStatus, searchTerm]);

  const fetchRecords = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = {
        month: currentMonth,
        year: currentYear
      };
      if (selectedDept !== 'ALL') params.department_id = selectedDept;
      if (selectedStatus !== 'ALL') params.status = selectedStatus;
      if (searchTerm.trim()) params.search = searchTerm.trim();

      const res = await hrmsApi.getPayrollRecords(params);
      if (res && res.success) {
        setRecords(res.data);
      } else {
        setError(res.message || 'Failed to fetch payroll records.');
      }
    } catch (err) {
      setError(err.message || 'Error loading employee payroll.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusChange = async (recordId, newStatus) => {
    setIsUpdatingStatus(prev => ({ ...prev, [recordId]: true }));
    try {
      const res = await hrmsApi.updatePayrollRecordStatus(recordId, newStatus);
      if (res && res.success) {
        setRecords(prev => prev.map(r => r.id === recordId ? { ...r, status: newStatus } : r));
      } else {
        alert(res.message || 'Failed to update payroll status.');
      }
    } catch (err) {
      alert(err.message || 'Error updating status.');
    } finally {
      setIsUpdatingStatus(prev => ({ ...prev, [recordId]: false }));
    }
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  return (
    <div className="employee-payroll-view" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Search & Filter Toolbar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        backgroundColor: '#ffffff',
        padding: '14px 18px',
        borderRadius: '12px',
        border: '1px solid #e2e8f0'
      }}>
        {/* Left: Search Input */}
        <div className="payroll-search-wrapper" style={{ position: 'relative', flex: '1 1 220px', minWidth: '180px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input
            type="text"
            className="form-control"
            placeholder="Search faculty or code..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ paddingLeft: '36px', height: '38px', fontSize: '0.85rem' }}
          />
        </div>

        {/* Right: Dropdown Filters */}
        <div className="payroll-filters-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Month Selector */}
          <select
            className="form-control"
            value={currentMonth}
            onChange={e => onMonthChange(parseInt(e.target.value, 10), currentYear)}
            style={{ width: '130px', height: '38px', fontSize: '0.85rem' }}
          >
            {monthNames.map((name, idx) => (
              <option key={idx + 1} value={idx + 1}>
                {name}
              </option>
            ))}
          </select>

          {/* Department Filter */}
          <select
            className="form-control"
            value={selectedDept}
            onChange={e => setSelectedDept(e.target.value)}
            style={{ width: '160px', height: '38px', fontSize: '0.85rem' }}
          >
            <option value="ALL">All Departments</option>
            {departments.map(d => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            className="form-control"
            value={selectedStatus}
            onChange={e => setSelectedStatus(e.target.value)}
            style={{ width: '130px', height: '38px', fontSize: '0.85rem' }}
          >
            <option value="ALL">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="processed">Processed</option>
            <option value="approved">Approved</option>
            <option value="paid">Paid</option>
          </select>
        </div>
      </div>

      {/* Main Payroll Table */}
      <div className="table-responsive" style={{
        backgroundColor: '#ffffff',
        borderRadius: '14px',
        border: '1px solid #e2e8f0',
        overflowX: 'auto',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
      }}>
        {isLoading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
            Loading employee payroll ledger...
          </div>
        ) : error ? (
          <div style={{ padding: '30px', textAlign: 'center', color: '#ef4444' }}>
            <AlertCircle size={24} style={{ margin: '0 auto 6px', display: 'block' }} />
            {error}
          </div>
        ) : records.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#64748b', fontSize: '0.9rem' }}>
            No payroll entries found for this period. Click <strong>Run Monthly Calculation</strong> on the dashboard to generate.
          </div>
        ) : (
          <table className="employee-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ minWidth: '220px' }}>Faculty / Employee</th>
                <th style={{ minWidth: '180px' }}>Department & Designation</th>
                <th style={{ width: '130px', textAlign: 'center' }}>Payable Days</th>
                <th style={{ width: '130px', textAlign: 'right' }}>Gross Salary</th>
                <th style={{ width: '120px', textAlign: 'right' }}>Deductions</th>
                <th style={{ width: '140px', textAlign: 'right' }}>Net Payable</th>
                <th style={{ width: '110px', textAlign: 'center' }}>Status</th>
                <th style={{ width: '160px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {records.map(rec => {
                const initials = `${rec.first_name?.[0] || ''}${rec.last_name?.[0] || ''}`.toUpperCase();
                return (
                  <tr key={rec.id}>
                    {/* Faculty / Employee */}
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: '34px',
                          height: '34px',
                          borderRadius: '50%',
                          backgroundColor: '#eff6ff',
                          color: '#2563eb',
                          fontWeight: 800,
                          fontSize: '0.78rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}>
                          {initials}
                        </div>
                        <div>
                          <strong style={{ color: '#0f172a', display: 'block', fontSize: '0.86rem' }}>
                            {rec.first_name} {rec.last_name}
                          </strong>
                          <span style={{ fontSize: '0.74rem', color: '#64748b', fontFamily: 'monospace' }}>
                            {rec.employee_code}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Department & Designation */}
                    <td>
                      <div style={{ fontSize: '0.82rem', color: '#1e293b', fontWeight: 600 }}>
                        {rec.designation_name || 'Teaching Faculty'}
                      </div>
                      <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                        {rec.department_name}
                      </div>
                    </td>

                    {/* Payable Days */}
                    <td style={{ textAlign: 'center' }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        backgroundColor: '#f1f5f9',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        color: '#334155'
                      }}>
                        {rec.payable_days} / {rec.total_working_days || 30}
                      </span>
                    </td>

                    {/* Gross Salary */}
                    <td style={{ textAlign: 'right', fontWeight: 600, color: '#334155', fontSize: '0.86rem' }}>
                      ₹{Number(rec.gross_earnings).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>

                    {/* Deductions */}
                    <td style={{ textAlign: 'right', fontWeight: 600, color: '#dc2626', fontSize: '0.86rem' }}>
                      ₹{Number(rec.total_deductions).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>

                    {/* Net Payable */}
                    <td style={{ textAlign: 'right', fontWeight: 800, color: '#15803d', fontSize: '0.92rem' }}>
                      ₹{Number(rec.net_salary).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>

                    {/* Status Badge */}
                    <td style={{ textAlign: 'center' }}>
                      <span className={`badge badge-${rec.status === 'paid' ? 'success' : rec.status === 'approved' ? 'info' : 'warning'}`} style={{ textTransform: 'uppercase', fontSize: '0.68rem' }}>
                        {rec.status}
                      </span>
                    </td>

                    {/* Actions */}
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-xs"
                          onClick={() => onViewPayslip(rec.id)}
                          title="View Official Payslip"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#2563eb' }}
                        >
                          <FileText size={13} />
                          <span>Payslip</span>
                        </button>

                        {/* Status Transition Shortcut */}
                        {canApprove && rec.status === 'processed' && (
                          <button
                            type="button"
                            className="btn btn-primary btn-xs"
                            onClick={() => handleStatusChange(rec.id, 'approved')}
                            disabled={isUpdatingStatus[rec.id]}
                            title="Approve calculation"
                            style={{ height: '26px', fontSize: '0.72rem', padding: '0 8px' }}
                          >
                            Approve
                          </button>
                        )}

                        {canApprove && rec.status === 'approved' && (
                          <button
                            type="button"
                            className="btn btn-secondary btn-xs"
                            onClick={() => handleStatusChange(rec.id, 'paid')}
                            disabled={isUpdatingStatus[rec.id]}
                            title="Mark as Disbursed / Paid"
                            style={{ height: '26px', fontSize: '0.72rem', padding: '0 8px', color: '#166534', backgroundColor: '#dcfce7', border: 'none' }}
                          >
                            Mark Paid
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default EmployeePayrollView;
