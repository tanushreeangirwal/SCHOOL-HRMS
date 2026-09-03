import React, { useState, useEffect } from 'react';
import { 
  DollarSign, 
  Users, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  CreditCard, 
  Building2, 
  ShieldCheck, 
  ArrowUpRight, 
  Play, 
  Check, 
  ChevronRight,
  TrendingDown,
  Layers,
  FileSpreadsheet,
  Award
} from 'lucide-react';
import { hrmsApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export function PayrollDashboardView({ 
  currentMonth, 
  currentYear, 
  onMonthChange, 
  onOpenProcessingModal, 
  onNavigateToRecords,
  onNavigateToStructures 
}) {
  const { isSuperAdmin, isAdmin, isHR } = useAuth();
  const canApprove = isSuperAdmin || isAdmin;

  const [overview, setOverview] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdatingBatch, setIsUpdatingBatch] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchOverview();
  }, [currentMonth, currentYear]);

  const fetchOverview = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await hrmsApi.getPayrollOverview(currentMonth, currentYear);
      if (res && res.success) {
        setOverview(res.data);
      } else {
        setError(res.message || 'Failed to load payroll overview.');
      }
    } catch (err) {
      setError(err.message || 'Error fetching payroll overview.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBatchStatus = async (targetStatus) => {
    const confirmMsg = targetStatus === 'approved' 
      ? `Approve all processed payroll records for ${overview?.month_name}?`
      : `Mark all approved records for ${overview?.month_name} as Paid?`;

    if (!window.confirm(confirmMsg)) return;

    setIsUpdatingBatch(true);
    try {
      const res = await hrmsApi.batchUpdatePayrollStatus(currentMonth, currentYear, targetStatus);
      if (res && res.success) {
        alert(res.message);
        fetchOverview();
      } else {
        alert(res.message || 'Failed to update payroll records.');
      }
    } catch (err) {
      alert(err.message || 'Error executing batch payroll update.');
    } finally {
      setIsUpdatingBatch(false);
    }
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  return (
    <div className="payroll-dashboard-view" style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {/* 1. Header Toolbar with Month Selector & Primary Actions */}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={18} style={{ color: '#2563eb' }} />
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e293b' }}>
              Payroll Period:
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <select
              className="form-control"
              value={currentMonth}
              onChange={e => onMonthChange(parseInt(e.target.value, 10), currentYear)}
              style={{ width: '140px', height: '36px', fontSize: '0.85rem' }}
            >
              {monthNames.map((name, idx) => (
                <option key={idx + 1} value={idx + 1}>
                  {name}
                </option>
              ))}
            </select>

            <select
              className="form-control"
              value={currentYear}
              onChange={e => onMonthChange(currentMonth, parseInt(e.target.value, 10))}
              style={{ width: '100px', height: '36px', fontSize: '0.85rem' }}
            >
              <option value={2025}>2025</option>
              <option value={2026}>2026</option>
              <option value={2027}>2027</option>
            </select>
          </div>

          {overview && (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '20px',
              fontSize: '0.74rem',
              fontWeight: 700,
              backgroundColor: overview.run_status === 'Paid' ? '#dcfce7' : overview.run_status === 'Approved' ? '#dbeafe' : '#fef3c7',
              color: overview.run_status === 'Paid' ? '#15803d' : overview.run_status === 'Approved' ? '#1d4ed8' : '#b45309',
              border: '1px solid transparent'
            }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'currentColor' }} />
              Status: {overview.run_status}
            </span>
          )}
        </div>

        {/* Executive Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={onOpenProcessingModal}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Play size={14} />
            <span>Run Monthly Calculation</span>
          </button>

          {canApprove && overview && overview.run_status === 'Processed' && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => handleBatchStatus('approved')}
              disabled={isUpdatingBatch}
              style={{ color: '#2563eb', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <ShieldCheck size={14} />
              <span>Approve All</span>
            </button>
          )}

          {canApprove && overview && overview.run_status === 'Approved' && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => handleBatchStatus('paid')}
              disabled={isUpdatingBatch}
              style={{ color: '#166534', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <CheckCircle2 size={14} />
              <span>Mark All as Paid</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Top KPI Metric Cards */}
      <div className="stats-grid">
        {/* KPI 1: Gross Payroll */}
        <div className="stat-card stat-indigo">
          <div className="stat-content">
            <span className="stat-title">Gross Payroll (Earnings)</span>
            <div className="stat-number-wrapper">
              <span className="stat-number" style={{ color: '#2563eb' }}>
                ₹{Number(overview?.gross_payroll || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </span>
            </div>
            <span className="stat-subtext">
              Base earnings across all active faculty
            </span>
          </div>
          <div className="stat-icon-badge" style={{ backgroundColor: '#eff6ff', color: '#2563eb' }}>
            <DollarSign size={20} />
          </div>
        </div>

        {/* KPI 2: Total Deductions */}
        <div className="stat-card stat-rose">
          <div className="stat-content">
            <span className="stat-title">Total Deductions & LOP</span>
            <div className="stat-number-wrapper">
              <span className="stat-number text-rose">
                ₹{Number(overview?.total_deductions || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </span>
            </div>
            <span className="stat-subtext">
              PF, Professional Tax, TDS & Leave Loss
            </span>
          </div>
          <div className="stat-icon-badge">
            <TrendingDown size={20} />
          </div>
        </div>

        {/* KPI 3: Net Payroll Disbursable */}
        <div className="stat-card stat-emerald">
          <div className="stat-content">
            <span className="stat-title">Net Salary Disbursable</span>
            <div className="stat-number-wrapper">
              <span className="stat-number text-emerald" style={{ fontWeight: 800 }}>
                ₹{Number(overview?.net_payroll || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </span>
            </div>
            <span className="stat-subtext">
              Payable amount for {overview?.month_name || 'selected month'}
            </span>
          </div>
          <div className="stat-icon-badge">
            <CreditCard size={20} />
          </div>
        </div>

        {/* KPI 4: Staff Processed Status */}
        <div className="stat-card stat-amber">
          <div className="stat-content">
            <span className="stat-title">Staff Processed</span>
            <div className="stat-number-wrapper">
              <span className="stat-number text-amber">
                {overview?.processed_employees || 0} / {overview?.total_employees || 0}
              </span>
            </div>
            <span className="stat-subtext">
              {overview?.pending_employees === 0 ? 'All staff computed' : `${overview?.pending_employees || 0} pending calculation`}
            </span>
          </div>
          <div className="stat-icon-badge">
            <Users size={20} />
          </div>
        </div>
      </div>

      {/* 3. Department Breakdown & Quick Workflow Navigation */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 320px',
        gap: '20px',
        alignItems: 'start'
      }}>
        {/* Left: Department Payroll Distribution */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '14px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          overflow: 'hidden'
        }}>
          <div style={{
            padding: '16px 20px',
            borderBottom: '1px solid #f1f5f9',
            backgroundColor: '#fafbfc',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Building2 size={16} style={{ color: '#2563eb' }} />
              <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                Department-Wise Payroll Distribution
              </h4>
            </div>

            <button
              type="button"
              className="btn btn-ghost btn-xs"
              onClick={onNavigateToRecords}
              style={{ fontSize: '0.78rem', color: '#2563eb', fontWeight: 600 }}
            >
              Full Register →
            </button>
          </div>

          <div style={{ padding: '0' }} className="table-responsive">
            {overview?.breakdown_by_department?.length === 0 ? (
              <div style={{ padding: '36px', textAlign: 'center', color: '#64748b', fontSize: '0.86rem' }}>
                No payroll calculations recorded for {overview?.month_name}. Click <strong>Run Monthly Calculation</strong> above to generate.
              </div>
            ) : (
              <table className="employee-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th>Department</th>
                    <th style={{ width: '120px', textAlign: 'center' }}>Staff Count</th>
                    <th style={{ width: '160px', textAlign: 'right' }}>Gross Total</th>
                    <th style={{ width: '160px', textAlign: 'right' }}>Net Payable</th>
                  </tr>
                </thead>
                <tbody>
                  {overview?.breakdown_by_department?.map((dept, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 700, color: '#1e293b' }}>
                        {dept.department_name}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className="badge badge-secondary" style={{ borderRadius: '12px' }}>
                          {dept.employee_count}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: '#475569' }}>
                        ₹{Number(dept.gross_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 800, color: '#15803d' }}>
                        ₹{Number(dept.net_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Right: Operational Shortcuts */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Action Card 1: View Employee Register */}
          <div 
            onClick={onNavigateToRecords}
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              padding: '16px 18px',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = '#93c5fd'}
            onMouseLeave={e => e.currentTarget.style.borderColor = '#e2e8f0'}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FileSpreadsheet size={18} />
              </div>
              <ChevronRight size={16} style={{ color: '#94a3b8' }} />
            </div>
            <h5 style={{ fontSize: '0.9rem', fontWeight: 800, color: '#0f172a', margin: '0 0 4px' }}>
              Employee Payroll Register
            </h5>
            <p style={{ fontSize: '0.78rem', color: '#64748b', margin: 0, lineHeight: 1.4 }}>
              Inspect individual payslips, attendance proration, and approve payouts.
            </p>
          </div>

          {/* Action Card 2: Salary Structure Management */}
          <div 
            onClick={onNavigateToStructures}
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              padding: '16px 18px',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = '#93c5fd'}
            onMouseLeave={e => e.currentTarget.style.borderColor = '#e2e8f0'}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: '#f0fdf4', color: '#166534', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Layers size={18} />
              </div>
              <ChevronRight size={16} style={{ color: '#94a3b8' }} />
            </div>
            <h5 style={{ fontSize: '0.9rem', fontWeight: 800, color: '#0f172a', margin: '0 0 4px' }}>
              Salary Structure Rules
            </h5>
            <p style={{ fontSize: '0.78rem', color: '#64748b', margin: 0, lineHeight: 1.4 }}>
              Configure Basic, HRA, PF, PT, TDS, and teacher compensation templates.
            </p>
          </div>

          {/* Institutional Compliance Notice */}
          <div style={{
            backgroundColor: '#fafbfc',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '14px',
            fontSize: '0.78rem',
            color: '#64748b'
          }}>
            <div style={{ fontWeight: 700, color: '#1e293b', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ShieldCheck size={14} style={{ color: '#2563eb' }} />
              <span>Audit & Compliance Ready</span>
            </div>
            Proration factors automatically calculate loss of pay from approved leave entries and unexcused absences without manual calculations.
          </div>
        </div>
      </div>
    </div>
  );
}

export default PayrollDashboardView;
