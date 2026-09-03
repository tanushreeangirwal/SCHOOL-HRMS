import React, { useState, useEffect } from 'react';
import { 
  X, 
  Printer, 
  Download, 
  Building2, 
  User, 
  Calendar, 
  CheckCircle2, 
  AlertCircle,
  CreditCard,
  FileText
} from 'lucide-react';
import { hrmsApi } from '../../services/api';
import StVincentsLogo from '../common/StVincentsLogo';

// Helper to convert number to Indian English words
function numberToWords(num) {
  const n = Math.round(Number(num) || 0);
  if (n === 0) return 'Zero Rupees Only';

  const units = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convertChunk(val) {
    let str = '';
    if (val >= 100) {
      str += units[Math.floor(val / 100)] + ' Hundred ';
      val %= 100;
    }
    if (val >= 20) {
      str += tens[Math.floor(val / 10)] + ' ';
      val %= 10;
    }
    if (val > 0) {
      str += units[val] + ' ';
    }
    return str.trim();
  }

  let words = '';
  let crore = Math.floor(n / 10000000);
  let remainder = n % 10000000;
  let lakh = Math.floor(remainder / 100000);
  remainder %= 100000;
  let thousand = Math.floor(remainder / 1000);
  remainder %= 1000;

  if (crore > 0) words += convertChunk(crore) + ' Crore ';
  if (lakh > 0) words += convertChunk(lakh) + ' Lakh ';
  if (thousand > 0) words += convertChunk(thousand) + ' Thousand ';
  if (remainder > 0) words += convertChunk(remainder) + ' ';

  return words.trim() + ' Rupees Only';
}

export function PayslipModal({ recordId, isOpen, onClose }) {
  const [payslip, setPayslip] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen && recordId) {
      fetchPayslip();
    }
  }, [isOpen, recordId]);

  const fetchPayslip = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await hrmsApi.getPayslip(recordId);
      if (res && res.success) {
        setPayslip(res.data);
      } else {
        setError(res.message || 'Failed to load payslip.');
      }
    } catch (err) {
      setError(err.message || 'An error occurred fetching payslip.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop active" onClick={onClose}>
      <div 
        className="modal-container payslip-modal-container"
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: '820px',
          width: '95%',
          maxHeight: '94vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
        }}
      >
        {/* Modal Top Control Bar (Hidden on Print) */}
        <div className="no-print" style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 24px',
          borderBottom: '1px solid #e2e8f0',
          backgroundColor: '#f8fafc'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={18} style={{ color: '#2563eb' }} />
            <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>
              Official Institutional Salary Slip
            </h3>
            {payslip && (
              <span className={`badge badge-${payslip.status === 'paid' ? 'success' : payslip.status === 'approved' ? 'info' : 'warning'}`} style={{ textTransform: 'uppercase', fontSize: '0.7rem' }}>
                {payslip.status}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handlePrint}
              disabled={isLoading || !payslip}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Printer size={15} />
              <span>Print / Save PDF</span>
            </button>
            <button
              type="button"
              className="btn-close"
              onClick={onClose}
              aria-label="Close"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#64748b' }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Payslip Content Body */}
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }} className="printable-payslip-area">
          {isLoading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
              Loading institutional salary slip...
            </div>
          ) : error ? (
            <div style={{ padding: '30px', textAlign: 'center', color: '#ef4444' }}>
              <AlertCircle size={28} style={{ margin: '0 auto 8px', display: 'block' }} />
              {error}
            </div>
          ) : payslip ? (
            <div style={{
              border: '2px solid #e2e8f0',
              borderRadius: '12px',
              padding: '24px',
              backgroundColor: '#ffffff'
            }}>
              {/* Institution Header Lockup */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '2px solid #0f172a',
                paddingBottom: '16px',
                marginBottom: '16px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <StVincentsLogo size={52} theme="light" />
                  <div>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
                      ST. VINCENT'S HIGH SCHOOL
                    </h2>
                    <p style={{ fontSize: '0.78rem', color: '#475569', margin: '2px 0 0', fontWeight: 500 }}>
                      Camp, Pune - 411001, Maharashtra, India
                    </p>
                    <p style={{ fontSize: '0.72rem', color: '#64748b', margin: '1px 0 0' }}>
                      Affiliated to CISCE / State Board of Education • ESTD 1867
                    </p>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.05em' }}>
                    Pay Slip
                  </span>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#2563eb' }}>
                    {payslip.month_name}
                  </div>
                  <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                    Ref: SV-PAY-{payslip.payroll_year}-{String(payslip.payroll_month).padStart(2, '0')}-{payslip.employee_code}
                  </span>
                </div>
              </div>

              {/* Employee & Attendance Grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '16px',
                backgroundColor: '#f8fafc',
                padding: '14px 16px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                marginBottom: '20px',
                fontSize: '0.82rem'
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b', fontWeight: 600 }}>Employee Name:</span>
                    <strong style={{ color: '#0f172a' }}>{payslip.first_name} {payslip.last_name}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b', fontWeight: 600 }}>Employee Code:</span>
                    <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#2563eb' }}>{payslip.employee_code}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b', fontWeight: 600 }}>Designation:</span>
                    <span style={{ color: '#0f172a' }}>{payslip.designation_name || 'Faculty'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b', fontWeight: 600 }}>Department:</span>
                    <span style={{ color: '#0f172a' }}>{payslip.department_name || 'Academic'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b', fontWeight: 600 }}>Date of Joining:</span>
                    <span style={{ color: '#0f172a' }}>{payslip.joining_date ? new Date(payslip.joining_date).toLocaleDateString('en-GB') : '—'}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', borderLeft: '1px solid #e2e8f0', paddingLeft: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b', fontWeight: 600 }}>Total Month Days:</span>
                    <strong style={{ color: '#0f172a' }}>{payslip.metrics?.total_days_in_month || payslip.total_working_days || 30} Days</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b', fontWeight: 600 }}>Present Days:</span>
                    <span style={{ color: '#166534', fontWeight: 700 }}>{payslip.metrics?.present_days || payslip.present_days || 0}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b', fontWeight: 600 }}>Paid Leave Taken:</span>
                    <span style={{ color: '#2563eb' }}>{payslip.metrics?.paid_leave_days || payslip.paid_leave_days || 0} Days</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b', fontWeight: 600 }}>Unpaid Leave (LWP):</span>
                    <span style={{ color: '#dc2626', fontWeight: 700 }}>{payslip.metrics?.unpaid_leave_days || payslip.unpaid_leave_days || 0} Days</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed #cbd5e1', paddingTop: '4px' }}>
                    <span style={{ color: '#0f172a', fontWeight: 700 }}>Payable Days:</span>
                    <span style={{ color: '#0284c7', fontWeight: 800 }}>{payslip.metrics?.payable_days || payslip.payable_days || 30} Days</span>
                  </div>
                </div>
              </div>

              {/* Earnings and Deductions Two-Column Ledger */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '20px' }}>
                {/* Earnings Table */}
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                  <div style={{ backgroundColor: '#f1f5f9', padding: '8px 12px', fontWeight: 800, fontSize: '0.82rem', color: '#0f172a', display: 'flex', justifyContent: 'space-between' }}>
                    <span>EARNINGS & ALLOWANCES</span>
                    <span>AMOUNT (₹)</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {payslip.earnings?.map((item, idx) => (
                      <div key={idx} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        borderBottom: '1px solid #f1f5f9',
                        fontSize: '0.8rem'
                      }}>
                        <span style={{ color: '#334155' }}>{item.name}</span>
                        <strong style={{ color: '#0f172a' }}>₹{Number(item.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                      </div>
                    ))}
                    {(!payslip.earnings || payslip.earnings.length === 0) && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', fontSize: '0.8rem' }}>
                        <span>Gross Basic & Allowances</span>
                        <strong>₹{Number(payslip.gross_earnings).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                      </div>
                    )}
                  </div>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    backgroundColor: '#f8fafc',
                    borderTop: '2px solid #e2e8f0',
                    fontWeight: 800,
                    fontSize: '0.85rem'
                  }}>
                    <span>TOTAL GROSS EARNINGS</span>
                    <span style={{ color: '#166534' }}>₹{Number(payslip.gross_earnings).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>

                {/* Deductions Table */}
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                  <div style={{ backgroundColor: '#f1f5f9', padding: '8px 12px', fontWeight: 800, fontSize: '0.82rem', color: '#0f172a', display: 'flex', justifyContent: 'space-between' }}>
                    <span>STATUTORY & OTHER DEDUCTIONS</span>
                    <span>AMOUNT (₹)</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {payslip.deductions?.map((item, idx) => (
                      <div key={idx} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        borderBottom: '1px solid #f1f5f9',
                        fontSize: '0.8rem'
                      }}>
                        <span style={{ color: '#334155' }}>{item.name}</span>
                        <strong style={{ color: '#dc2626' }}>₹{Number(item.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                      </div>
                    ))}
                    {Number(payslip.loss_of_pay) > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '1px solid #f1f5f9', fontSize: '0.8rem', color: '#dc2626' }}>
                        <span>Loss of Pay (Absent / LWP)</span>
                        <strong>₹{Number(payslip.loss_of_pay).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                      </div>
                    )}
                    {(!payslip.deductions || payslip.deductions.length === 0) && Number(payslip.loss_of_pay) === 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', fontSize: '0.8rem' }}>
                        <span>Standard Deductions</span>
                        <strong>₹{Number(payslip.total_deductions).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                      </div>
                    )}
                  </div>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    backgroundColor: '#f8fafc',
                    borderTop: '2px solid #e2e8f0',
                    fontWeight: 800,
                    fontSize: '0.85rem'
                  }}>
                    <span>TOTAL DEDUCTIONS</span>
                    <span style={{ color: '#dc2626' }}>₹{Number(payslip.total_deductions).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>

              {/* Net Payout Banner */}
              <div style={{
                backgroundColor: '#eff6ff',
                border: '2px solid #bfdbfe',
                borderRadius: '10px',
                padding: '16px 20px',
                marginBottom: '20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px'
              }}>
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1e40af', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Net Salary Payable
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#475569', marginTop: '3px' }}>
                    In Words: <strong style={{ color: '#0f172a' }}>{numberToWords(payslip.net_salary)}</strong>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#1d4ed8' }}>
                    ₹{Number(payslip.net_salary).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                  <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                    Disbursement via {payslip.payment_method || 'Direct Bank Transfer'}
                  </span>
                </div>
              </div>

              {/* Signatures & Institutional Declarations */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '20px',
                marginTop: '36px',
                textAlign: 'center',
                fontSize: '0.75rem',
                color: '#64748b'
              }}>
                <div>
                  <div style={{ borderTop: '1px solid #94a3b8', paddingTop: '6px', fontWeight: 700 }}>
                    Prepared By (HR & Accounts)
                  </div>
                  <span>St. Vincent's High School</span>
                </div>

                <div>
                  <div style={{ borderTop: '1px solid #94a3b8', paddingTop: '6px', fontWeight: 700 }}>
                    Verified & Approved By
                  </div>
                  <span>Principal / Head of Institution</span>
                </div>

                <div>
                  <div style={{ borderTop: '1px solid #94a3b8', paddingTop: '6px', fontWeight: 700 }}>
                    Employee Signature / Acknowledgment
                  </div>
                  <span>{payslip.first_name} {payslip.last_name}</span>
                </div>
              </div>

              {/* Footer Stamp */}
              <div style={{ marginTop: '24px', borderTop: '1px solid #f1f5f9', paddingTop: '8px', fontSize: '0.68rem', color: '#94a3b8', textAlign: 'center' }}>
                This is a computer-generated institutional document produced by St. Vincent's High School HRMS and requires no physical seal for internal audit.
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default PayslipModal;
