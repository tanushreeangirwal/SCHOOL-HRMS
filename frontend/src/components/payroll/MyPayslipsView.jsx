import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Printer, 
  Calendar, 
  AlertCircle, 
  CreditCard, 
  DollarSign, 
  TrendingDown, 
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';
import { hrmsApi } from '../../services/api';
import PayslipModal from './PayslipModal';

export function MyPayslipsView() {
  const [payslips, setPayslips] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedRecordId, setSelectedRecordId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    fetchMyPayslips();
  }, []);

  const fetchMyPayslips = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await hrmsApi.getMyPayslips();
      if (res && res.success) {
        setPayslips(res.data);
      } else {
        setError(res.message || 'Failed to load personal payslips.');
      }
    } catch (err) {
      setError(err.message || 'Error fetching payslips.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenPayslip = (recordId) => {
    setSelectedRecordId(recordId);
    setIsModalOpen(true);
  };

  const latestSlip = payslips[0];

  return (
    <div className="my-payslips-view" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* 1. Header Banner */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '14px',
        border: '1px solid #e2e8f0',
        padding: '20px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '14px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={20} style={{ color: '#2563eb' }} />
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              My Salary Slips & Compensation Ledger
            </h3>
          </div>
          <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '4px 0 0' }}>
            St. Vincent's High School Employee Portal • View, audit, and print your official monthly remuneration slips.
          </p>
        </div>

        {latestSlip && (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => handleOpenPayslip(latestSlip.id)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Printer size={15} />
            <span>Latest Payslip ({latestSlip.month_name})</span>
          </button>
        )}
      </div>

      {/* 2. Quick Summary Cards if at least 1 payslip exists */}
      {latestSlip && (
        <div className="stats-grid">
          <div className="stat-card stat-indigo">
            <div className="stat-content">
              <span className="stat-title">Latest Month Net Pay</span>
              <div className="stat-number-wrapper">
                <span className="stat-number" style={{ color: '#2563eb' }}>
                  ₹{Number(latestSlip.net_salary).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <span className="stat-subtext">
                For {latestSlip.month_name} ({latestSlip.payable_days} payable days)
              </span>
            </div>
            <div className="stat-icon-badge" style={{ backgroundColor: '#eff6ff', color: '#2563eb' }}>
              <CreditCard size={20} />
            </div>
          </div>

          <div className="stat-card stat-emerald">
            <div className="stat-content">
              <span className="stat-title">Gross Earnings</span>
              <div className="stat-number-wrapper">
                <span className="stat-number text-emerald">
                  ₹{Number(latestSlip.gross_earnings).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <span className="stat-subtext">
                Before tax & statutory deductions
              </span>
            </div>
            <div className="stat-icon-badge">
              <DollarSign size={20} />
            </div>
          </div>

          <div className="stat-card stat-rose">
            <div className="stat-content">
              <span className="stat-title">Total Deductions</span>
              <div className="stat-number-wrapper">
                <span className="stat-number text-rose">
                  ₹{Number(latestSlip.total_deductions).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <span className="stat-subtext">
                PF, Professional Tax & TDS
              </span>
            </div>
            <div className="stat-icon-badge">
              <TrendingDown size={20} />
            </div>
          </div>
        </div>
      )}

      {/* 3. Payslip Archive History Table */}
      <div className="table-responsive" style={{
        backgroundColor: '#ffffff',
        borderRadius: '14px',
        border: '1px solid #e2e8f0',
        overflowX: 'auto',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
      }}>
        {isLoading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
            Loading your personal payslip archive...
          </div>
        ) : error ? (
          <div style={{ padding: '30px', textAlign: 'center', color: '#ef4444' }}>
            <AlertCircle size={24} style={{ margin: '0 auto 6px', display: 'block' }} />
            {error}
          </div>
        ) : payslips.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#64748b', fontSize: '0.9rem' }}>
            No payslips have been generated yet for your profile. Please check back after the monthly payroll cycle is processed.
          </div>
        ) : (
          <table className="employee-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th>Payroll Period</th>
                <th style={{ textAlign: 'center' }}>Payable Days</th>
                <th style={{ textAlign: 'right' }}>Gross Earnings</th>
                <th style={{ textAlign: 'right' }}>Deductions</th>
                <th style={{ textAlign: 'right' }}>Net Salary</th>
                <th style={{ textAlign: 'center' }}>Status</th>
                <th style={{ textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {payslips.map(slip => (
                <tr key={slip.id}>
                  <td>
                    <strong style={{ color: '#0f172a', fontSize: '0.88rem' }}>
                      {slip.month_name}
                    </strong>
                    <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                      Processed on {slip.processed_at ? new Date(slip.processed_at).toLocaleDateString('en-GB') : '—'}
                    </div>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span className="badge badge-secondary" style={{ fontWeight: 700 }}>
                      {slip.payable_days} / {slip.total_working_days || 30} Days
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 600, color: '#334155' }}>
                    ₹{Number(slip.gross_earnings).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 600, color: '#dc2626' }}>
                    ₹{Number(slip.total_deductions).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 800, color: '#15803d', fontSize: '0.94rem' }}>
                    ₹{Number(slip.net_salary).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span className={`badge badge-${slip.status === 'paid' ? 'success' : slip.status === 'approved' ? 'info' : 'warning'}`} style={{ textTransform: 'uppercase', fontSize: '0.7rem' }}>
                      {slip.status}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-xs"
                      onClick={() => handleOpenPayslip(slip.id)}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#2563eb' }}
                    >
                      <Printer size={13} />
                      <span>View / Print</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Payslip Modal */}
      {selectedRecordId && isModalOpen && (
        <PayslipModal
          recordId={selectedRecordId}
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedRecordId(null);
          }}
        />
      )}
    </div>
  );
}

export default MyPayslipsView;
