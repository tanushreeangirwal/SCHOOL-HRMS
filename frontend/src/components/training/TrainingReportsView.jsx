import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Download, 
  Printer, 
  Building2, 
  Calendar, 
  Award, 
  Clock, 
  Users, 
  CheckCircle2, 
  AlertCircle,
  Filter,
  RefreshCw
} from 'lucide-react';
import { hrmsApi } from '../../services/api';
import { LoadingSpinner } from '../common/LoadingSpinner';

export function TrainingReportsView({ departments = [] }) {
  const [reportType, setReportType] = useState('completion');
  const [reportData, setReportData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const reportOptions = [
    { id: 'completion', title: '1. Training Completion Report', desc: 'Overall session attendance, completion numbers, and hours delivered' },
    { id: 'employee_hours', title: '2. Training Hours by Employee', desc: 'Cumulative CPD hours and module counts per faculty member' },
    { id: 'department_participation', title: '3. Department-Wise Participation', desc: 'Total departmental engagement, attendance ratios, and group hours' },
    { id: 'pending', title: '4. Pending Training Roster', desc: 'Faculty members with incomplete or pending assigned training sessions' },
    { id: 'certificates', title: '5. Certificate & Expiry Compliance', desc: 'Active, expiring, and expired professional certifications' }
  ];

  const fetchReport = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await hrmsApi.getTrainingReports({ report_type: reportType });
      if (res && res.success) {
        setReportData(res.data || []);
      } else {
        setError(res?.message || 'Failed to generate report dataset.');
      }
    } catch (err) {
      console.error('Error fetching training report:', err);
      setError(err.message || 'Error occurred while loading report.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [reportType]);

  // Export to CSV
  const handleExportCSV = () => {
    if (!reportData || reportData.length === 0) {
      alert('No report data available to export.');
      return;
    }

    const headers = Object.keys(reportData[0]);
    const csvRows = [];
    csvRows.push(headers.join(','));

    for (const row of reportData) {
      const values = headers.map(header => {
        const val = row[header] === null || row[header] === undefined ? '' : row[header];
        const escaped = ('' + val).replace(/"/g, '""');
        return `"${escaped}"`;
      });
      csvRows.push(values.join(','));
    }

    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `HRMS_Training_Report_${reportType}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="training-reports-view" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* 1. Header Toolbar */}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <FileText size={20} style={{ color: '#3155D9' }} />
          <div>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#172033', margin: 0 }}>
              Institutional Training & CPD Reports
            </h2>
            <span className="text-muted text-xs">
              Audit-ready faculty development records based on live HRMS data.
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={fetchReport}
            title="Refresh Report"
          >
            <RefreshCw size={14} className={isLoading ? 'spin-animation' : ''} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleExportCSV}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Download size={14} />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handlePrint}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Printer size={14} />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* 2. Report Type Selector Chips */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '10px'
      }}>
        {reportOptions.map((opt) => {
          const isSelected = reportType === opt.id;
          return (
            <div
              key={opt.id}
              onClick={() => setReportType(opt.id)}
              style={{
                padding: '12px 14px',
                borderRadius: '10px',
                backgroundColor: isSelected ? '#eef2ff' : '#ffffff',
                border: isSelected ? '1.5px solid #3155D9' : '1px solid #e2e8f0',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                boxShadow: isSelected ? '0 2px 4px rgba(49,85,217,0.08)' : '0 1px 2px rgba(0,0,0,0.02)',
                transition: 'all 0.15s ease'
              }}
            >
              <span style={{ fontSize: '0.86rem', fontWeight: isSelected ? 700 : 600, color: isSelected ? '#3155D9' : '#0f172a' }}>
                {opt.title}
              </span>
              <span style={{ fontSize: '0.74rem', color: isSelected ? '#4338ca' : '#64748b', lineHeight: 1.3 }}>
                {opt.desc}
              </span>
            </div>
          );
        })}
      </div>

      {/* 3. Report Results Table */}
      {error && (
        <div style={{ padding: '12px 16px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', color: '#991b1b', fontSize: '0.86rem' }}>
          {error}
        </div>
      )}

      {isLoading ? (
        <div style={{ padding: '60px 0', textAlign: 'center' }}>
          <LoadingSpinner text="Computing and aggregating report dataset..." size={32} />
        </div>
      ) : reportData.length === 0 ? (
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '14px',
          border: '1px solid #e2e8f0',
          padding: '50px 20px',
          textAlign: 'center',
          color: '#64748b'
        }}>
          No data found for this report configuration.
        </div>
      ) : (
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '14px',
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
        }}>
          {/* Subheader with row count */}
          <div style={{ padding: '12px 18px', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#475569' }}>
            <span>Dataset Entries: <strong>{reportData.length} records</strong></span>
            <span>Generated on: <strong>{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</strong></span>
          </div>

          <div className="table-responsive">
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#ffffff', borderBottom: '1px solid #e2e8f0' }}>
                  {reportType === 'completion' && (
                    <>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>Program Title</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>Category</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>Start Date</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>Enrolled</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>Completed</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>Absent</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>Hours Delivered</th>
                    </>
                  )}

                  {reportType === 'employee_hours' && (
                    <>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>Employee Code</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>Faculty Name</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>Department</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>Enrolled</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>Completed</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>Certificates</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>Total CPD Hours</th>
                    </>
                  )}

                  {reportType === 'department_participation' && (
                    <>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>Department Name</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>Total Faculty</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>Participants</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>Total Enrollments</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>Completions</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>Total Dept Hours</th>
                    </>
                  )}

                  {reportType === 'pending' && (
                    <>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>Faculty Member</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>Department</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>Program Title</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>Scheduled Date</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>Attendance</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>Enrollment Status</th>
                    </>
                  )}

                  {reportType === 'certificates' && (
                    <>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>Faculty Member</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>Department</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>Certificate Name</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>Cert Number</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>Issue Date</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>Expiry Date</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>Status</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {reportData.map((row, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    {reportType === 'completion' && (
                      <>
                        <td style={{ padding: '12px 16px', fontWeight: 600, color: '#0f172a', fontSize: '0.84rem' }}>{row.title}</td>
                        <td style={{ padding: '12px 16px', fontSize: '0.8rem', color: '#475569' }}>{row.category}</td>
                        <td style={{ padding: '12px 16px', fontSize: '0.8rem', color: '#475569' }}>{row.start_date?.split('T')[0]}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600 }}>{row.total_enrolled}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600, color: '#16a34a' }}>{row.completed_count}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'center', color: '#dc2626' }}>{row.absent_count}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: '#0891b2' }}>{parseFloat(row.total_hours_delivered).toFixed(1)} hrs</td>
                      </>
                    )}

                    {reportType === 'employee_hours' && (
                      <>
                        <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontWeight: 700, color: '#3155D9' }}>{row.employee_code}</td>
                        <td style={{ padding: '12px 16px', fontWeight: 600, color: '#0f172a' }}>{row.first_name} {row.last_name}</td>
                        <td style={{ padding: '12px 16px', fontSize: '0.8rem', color: '#475569' }}>{row.department_name || 'General'}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>{row.trainings_enrolled}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600, color: '#16a34a' }}>{row.trainings_completed}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600, color: '#d97706' }}>{row.certificates_earned}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, color: '#0891b2' }}>{parseFloat(row.total_training_hours).toFixed(1)} hrs</td>
                      </>
                    )}

                    {reportType === 'department_participation' && (
                      <>
                        <td style={{ padding: '12px 16px', fontWeight: 600, color: '#0f172a' }}>{row.department_name}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>{row.total_faculty}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600, color: '#3155D9' }}>{row.participating_faculty}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>{row.total_enrollments}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600, color: '#16a34a' }}>{row.total_completions}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, color: '#0891b2' }}>{parseFloat(row.total_department_hours).toFixed(1)} hrs</td>
                      </>
                    )}

                    {reportType === 'pending' && (
                      <>
                        <td style={{ padding: '12px 16px', fontWeight: 600 }}>{row.first_name} {row.last_name} ({row.employee_code})</td>
                        <td style={{ padding: '12px 16px', fontSize: '0.8rem' }}>{row.department_name || 'General'}</td>
                        <td style={{ padding: '12px 16px', fontWeight: 500, color: '#0f172a' }}>{row.training_title}</td>
                        <td style={{ padding: '12px 16px', fontSize: '0.8rem' }}>{row.start_date?.split('T')[0]}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <span className={`status-pill badge-${row.attendance_status?.toLowerCase() || 'pending'}`} style={{ fontSize: '0.72rem' }}>
                            <span className="status-dot"></span>
                            <span>{row.attendance_status || 'Pending'}</span>
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span className="status-pill badge-warning" style={{ fontSize: '0.72rem' }}>
                            <span className="status-dot"></span>
                            <span>{row.enrollment_status}</span>
                          </span>
                        </td>
                      </>
                    )}

                    {reportType === 'certificates' && (
                      <>
                        <td style={{ padding: '12px 16px', fontWeight: 600 }}>{row.first_name} {row.last_name} ({row.employee_code})</td>
                        <td style={{ padding: '12px 16px', fontSize: '0.8rem' }}>{row.department_name}</td>
                        <td style={{ padding: '12px 16px', fontWeight: 600, color: '#0f172a' }}>{row.certificate_name}</td>
                        <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: '0.76rem' }}>{row.certificate_number || '—'}</td>
                        <td style={{ padding: '12px 16px', fontSize: '0.8rem' }}>{row.issue_date?.split('T')[0]}</td>
                        <td style={{ padding: '12px 16px', fontSize: '0.8rem' }}>{row.expiry_date ? row.expiry_date.split('T')[0] : 'Permanent'}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: '12px',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            backgroundColor: row.compliance_status === 'Valid' ? '#dcfce7' : row.compliance_status === 'Expiring Soon' ? '#fef3c7' : '#fef2f2',
                            color: row.compliance_status === 'Valid' ? '#15803d' : row.compliance_status === 'Expiring Soon' ? '#b45309' : '#dc2626'
                          }}>
                            {row.compliance_status}
                          </span>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default TrainingReportsView;
