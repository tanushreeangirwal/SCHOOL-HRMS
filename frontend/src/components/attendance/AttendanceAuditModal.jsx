import React, { useState, useEffect } from 'react';
import {
  X,
  History,
  Clock,
  User,
  AlertCircle,
  Loader2,
  Calendar
} from 'lucide-react';
import { hrmsApi } from '../../services/api';

export function AttendanceAuditModal({
  isOpen = false,
  onClose,
  employeeId = null,
  employeeName = null
}) {
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen || !employeeId) return;

    let isMounted = true;
    setIsLoading(true);
    setError(null);

    hrmsApi.getAttendanceAudit({ employee_id: employeeId })
      .then((res) => {
        if (isMounted) {
          if (res && res.success) {
            setLogs(res.data || []);
          } else {
            setError(res?.message || 'Failed to load audit records.');
          }
        }
      })
      .catch((err) => {
        if (isMounted) setError(err.message || 'Error fetching audit records.');
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => { isMounted = false; };
  }, [isOpen, employeeId]);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-container" style={{ maxWidth: '640px', width: '92%' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header" style={{ padding: '18px 22px', borderBottom: '1px solid var(--border-light)' }}>
          <div className="modal-header-icon-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="stat-icon-badge stat-slate" style={{ width: '38px', height: '38px' }}>
              <History size={18} />
            </div>
            <div>
              <h3 className="modal-title" style={{ fontSize: '1.05rem', margin: 0 }}>
                Attendance Correction History
              </h3>
              <p className="modal-subtitle" style={{ fontSize: '0.78rem', margin: '2px 0 0 0' }}>
                {employeeName ? `Audit trail for ${employeeName}` : 'Historical audit logs for attendance corrections'}
              </p>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: '20px', maxHeight: '520px', overflowY: 'auto' }}>
          {isLoading ? (
            <div style={{ padding: '36px', textAlign: 'center' }}>
              <Loader2 size={24} className="spin-animation text-primary" style={{ margin: '0 auto 8px' }} />
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Loading audit logs...</p>
            </div>
          ) : error ? (
            <div style={{ padding: '24px', textAlign: 'center' }}>
              <AlertCircle size={28} className="text-danger" style={{ margin: '0 auto 8px' }} />
              <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>{error}</p>
            </div>
          ) : logs.length === 0 ? (
            <div style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <History size={28} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
              <p style={{ fontSize: '0.86rem', fontWeight: 600, margin: 0 }}>No correction logs found</p>
              <p style={{ fontSize: '0.76rem', margin: '4px 0 0 0' }}>This employee has no historical attendance edits recorded.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {logs.map((log) => (
                <div
                  key={log.id}
                  style={{
                    padding: '12px 14px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-light)',
                    backgroundColor: '#f8fafc'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)' }}>
                      Date: {log.date_formatted}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {log.created_at_formatted}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', fontSize: '0.78rem', marginBottom: '8px', backgroundColor: '#ffffff', padding: '8px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                    <div>
                      <span style={{ color: 'var(--text-muted)', display: 'block' }}>Previous Status:</span>
                      <strong style={{ color: '#dc2626' }}>{log.previous_status || '—'}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)', display: 'block' }}>Corrected Status:</span>
                      <strong style={{ color: '#059669' }}>{log.new_status}</strong>
                    </div>
                  </div>

                  <div style={{ fontSize: '0.76rem', color: 'var(--text-main)' }}>
                    <strong>Reason:</strong> {log.reason || 'Record adjustment'}
                  </div>

                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Modified by: {log.changed_by_name || 'System Admin'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="modal-footer" style={{ padding: '12px 20px', borderTop: '1px solid var(--border-light)' }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default AttendanceAuditModal;
