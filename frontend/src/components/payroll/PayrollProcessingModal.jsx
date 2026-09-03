import React, { useState } from 'react';
import { 
  X, 
  Calculator, 
  Calendar, 
  AlertCircle, 
  CheckCircle2, 
  Loader2, 
  Users, 
  ShieldCheck,
  ArrowRight
} from 'lucide-react';
import { hrmsApi } from '../../services/api';

export function PayrollProcessingModal({ isOpen, onClose, onProcessed, defaultMonth, defaultYear }) {
  const [month, setMonth] = useState(defaultMonth || (new Date().getMonth() + 1));
  const [year, setYear] = useState(defaultYear || new Date().getFullYear());
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  if (!isOpen) return null;

  const handleProcess = async (e) => {
    e.preventDefault();
    setIsProcessing(true);
    setError(null);
    try {
      const res = await hrmsApi.processMonthlyPayroll({ month: parseInt(month, 10), year: parseInt(year, 10) });
      if (res && res.success) {
        setResult(res);
        if (onProcessed) onProcessed();
      } else {
        setError(res.message || 'Failed to process monthly payroll.');
      }
    } catch (err) {
      setError(err.message || 'An error occurred during payroll processing.');
    } finally {
      setIsProcessing(false);
    }
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  return (
    <div className="modal-backdrop active" onClick={onClose}>
      <div 
        className="modal-container"
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: '560px',
          width: '95%',
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
        }}
      >
        {/* Modal Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '18px 24px',
          borderBottom: '1px solid #e2e8f0',
          backgroundColor: '#f8fafc'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Calculator size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                Run Monthly Payroll Calculation
              </h3>
              <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '2px 0 0' }}>
                St. Vincent's High School Compensation Engine
              </p>
            </div>
          </div>

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

        {/* Modal Body */}
        <div style={{ padding: '24px' }}>
          {error && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '12px 16px',
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '8px',
              color: '#dc2626',
              fontSize: '0.84rem',
              marginBottom: '18px'
            }}>
              <AlertCircle size={18} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          {result ? (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                backgroundColor: '#dcfce7',
                color: '#15803d',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 14px'
              }}>
                <CheckCircle2 size={32} />
              </div>
              <h4 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', margin: '0 0 6px' }}>
                Payroll Run Successfully Executed!
              </h4>
              <p style={{ fontSize: '0.86rem', color: '#475569', margin: '0 0 20px' }}>
                {result.message}
              </p>

              <div style={{
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '14px',
                marginBottom: '20px',
                fontSize: '0.84rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ color: '#64748b' }}>Month:</span>
                  <strong>{monthNames[month - 1]} {year}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ color: '#64748b' }}>Staff Processed:</span>
                  <span style={{ color: '#166534', fontWeight: 700 }}>{result.count} Employees</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Initial Status:</span>
                  <span className="badge badge-warning" style={{ textTransform: 'uppercase', fontSize: '0.7rem' }}>PROCESSED</span>
                </div>
              </div>

              <button
                type="button"
                className="btn btn-primary btn-md"
                onClick={onClose}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                View Payroll Register
              </button>
            </div>
          ) : (
            <form onSubmit={handleProcess}>
              {/* Month and Year Selectors */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Payroll Month
                  </label>
                  <select
                    className="form-control"
                    value={month}
                    onChange={e => setMonth(parseInt(e.target.value, 10))}
                    disabled={isProcessing}
                    style={{ width: '100%', height: '40px' }}
                  >
                    {monthNames.map((name, idx) => (
                      <option key={idx + 1} value={idx + 1}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Payroll Year
                  </label>
                  <select
                    className="form-control"
                    value={year}
                    onChange={e => setYear(parseInt(e.target.value, 10))}
                    disabled={isProcessing}
                    style={{ width: '100%', height: '40px' }}
                  >
                    <option value={2025}>2025</option>
                    <option value={2026}>2026</option>
                    <option value={2027}>2027</option>
                  </select>
                </div>
              </div>

              {/* Data Integration Notice */}
              <div style={{
                backgroundColor: '#eff6ff',
                border: '1px solid #bfdbfe',
                borderRadius: '10px',
                padding: '14px',
                marginBottom: '20px',
                fontSize: '0.8rem',
                color: '#1e40af'
              }}>
                <div style={{ fontWeight: 700, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <ShieldCheck size={16} />
                  <span>Real-Time Attendance & Leave Integration</span>
                </div>
                <p style={{ margin: 0, lineHeight: 1.4, color: '#3b82f6' }}>
                  The engine automatically audits:
                  <br />• <strong>Attendance records</strong> (Present, Late, Half-day)
                  <br />• <strong>Approved paid leaves</strong> (Casual, Medical, Privilege)
                  <br />• <strong>Unpaid leaves (LWP) & unexcused absences</strong> for exact Loss of Pay deduction
                  <br />• <strong>Official school calendar holidays & Sundays</strong>
                </p>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-md"
                  onClick={onClose}
                  disabled={isProcessing}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-md"
                  disabled={isProcessing}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 size={16} className="spin-animation" />
                      <span>Computing Payroll...</span>
                    </>
                  ) : (
                    <>
                      <Calculator size={16} />
                      <span>Execute Calculation</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default PayrollProcessingModal;
