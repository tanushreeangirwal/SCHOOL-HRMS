import React, { useState } from 'react';
import { 
  X, 
  Calendar, 
  Copy, 
  Check, 
  Download, 
  RefreshCw, 
  ExternalLink, 
  CheckCircle2, 
  AlertCircle,
  HelpCircle,
  Clock,
  Sparkles,
  Layers,
  BookOpen
} from 'lucide-react';
import { hrmsApi } from '../../services/api';

export function CalendarSyncModal({
  isOpen,
  onClose,
  academicYears = [],
  activeYearId = null,
  canManage = false,
  onHolidaysSynced
}) {
  const [activeTab, setActiveTab] = useState('feed'); // 'feed' | 'download' | 'holidays'
  const [selectedYear, setSelectedYear] = useState(activeYearId || 'ALL');
  const [selectedCategory, setSelectedCategory] = useState('ALL'); // 'ALL' | 'Exams' | 'Holidays'
  
  const [copied, setCopied] = useState(false);
  const [isSyncingHolidays, setIsSyncingHolidays] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState(null);

  if (!isOpen) return null;

  // Build the live feed URL
  const feedUrl = hrmsApi.getCalendarFeedUrl(selectedYear, selectedCategory);
  const webcalUrl = feedUrl.replace(/^http:\/\//, 'webcal://').replace(/^https:\/\//, 'webcal://');
  const googleCalendarSubscribeUrl = `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcalUrl)}`;

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(feedUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error('Failed to copy feed URL:', err);
    }
  };

  const handleDownloadIcs = () => {
    const downloadUrl = hrmsApi.getCalendarExportUrl(selectedYear, selectedCategory);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.setAttribute('download', 'st-vincents-academic-calendar.ics');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSyncOfficialHolidays = async () => {
    setIsSyncingHolidays(true);
    setSyncFeedback(null);
    try {
      const res = await hrmsApi.syncOfficialHolidays({
        academic_year_id: selectedYear === 'ALL' ? activeYearId : selectedYear,
        replace_existing: false
      });

      if (res && res.success) {
        setSyncFeedback({
          type: 'success',
          message: res.message || 'Official holidays synchronized successfully.'
        });
        if (onHolidaysSynced) {
          onHolidaysSynced();
        }
      } else {
        throw new Error(res?.message || 'Failed to sync official holidays.');
      }
    } catch (err) {
      console.error('Error syncing official holidays:', err);
      setSyncFeedback({
        type: 'error',
        message: err.message || 'Failed to sync official holidays.'
      });
    } finally {
      setIsSyncingHolidays(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div 
        className="modal-container" 
        style={{ 
          maxWidth: '680px', 
          width: '94%',
          backgroundColor: '#ffffff', 
          borderRadius: '14px', 
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
          overflow: 'hidden' 
        }}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#ffffff'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              backgroundColor: '#eef2ff',
              color: '#3155D9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Calendar size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#172033', margin: 0, letterSpacing: '-0.01em' }}>
                Calendar Sync & Live Feeds
              </h2>
              <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '2px 0 0' }}>
                Connect St. Vincent's academic schedule with Google Calendar, Outlook, and Apple Calendar.
              </p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className="btn btn-ghost btn-sm"
            style={{ padding: '6px', borderRadius: '8px', color: '#64748b' }}
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div style={{
          display: 'flex',
          padding: '0 24px',
          borderBottom: '1px solid #e2e8f0',
          backgroundColor: '#f8fafc',
          gap: '8px'
        }}>
          <button
            type="button"
            className={`btn btn-ghost btn-sm ${activeTab === 'feed' ? 'active' : ''}`}
            onClick={() => setActiveTab('feed')}
            style={{
              padding: '12px 14px',
              borderRadius: 0,
              borderBottom: activeTab === 'feed' ? '2px solid #3155D9' : '2px solid transparent',
              color: activeTab === 'feed' ? '#3155D9' : '#64748b',
              fontWeight: activeTab === 'feed' ? 700 : 500,
              fontSize: '0.84rem'
            }}
          >
            Live Calendar Feed (Google / Outlook)
          </button>
          <button
            type="button"
            className={`btn btn-ghost btn-sm ${activeTab === 'download' ? 'active' : ''}`}
            onClick={() => setActiveTab('download')}
            style={{
              padding: '12px 14px',
              borderRadius: 0,
              borderBottom: activeTab === 'download' ? '2px solid #3155D9' : '2px solid transparent',
              color: activeTab === 'download' ? '#3155D9' : '#64748b',
              fontWeight: activeTab === 'download' ? 700 : 500,
              fontSize: '0.84rem'
            }}
          >
            Download .ICS File
          </button>
          {canManage && (
            <button
              type="button"
              className={`btn btn-ghost btn-sm ${activeTab === 'holidays' ? 'active' : ''}`}
              onClick={() => setActiveTab('holidays')}
              style={{
                padding: '12px 14px',
                borderRadius: 0,
                borderBottom: activeTab === 'holidays' ? '2px solid #3155D9' : '2px solid transparent',
                color: activeTab === 'holidays' ? '#3155D9' : '#64748b',
                fontWeight: activeTab === 'holidays' ? 700 : 500,
                fontSize: '0.84rem'
              }}
            >
              Sync Official Public Holidays
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div style={{ padding: '24px', maxHeight: '520px', overflowY: 'auto' }}>
          {/* Feed Customization Controls (Common for Tab 1 & 2) */}
          {(activeTab === 'feed' || activeTab === 'download') && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '14px',
              marginBottom: '20px',
              backgroundColor: '#f8fafc',
              padding: '14px',
              borderRadius: '10px',
              border: '1px solid #e2e8f0'
            }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>
                  Academic Session
                </label>
                <select
                  className="form-control"
                  value={selectedYear}
                  onChange={e => setSelectedYear(e.target.value)}
                  style={{ fontSize: '0.82rem', height: '36px' }}
                >
                  <option value="ALL">All Active Calendar Years</option>
                  {academicYears.map(y => (
                    <option key={y.id} value={y.id}>
                      {y.name} {y.is_active ? '★ (Active)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>
                  Calendar Event Scope
                </label>
                <select
                  className="form-control"
                  value={selectedCategory}
                  onChange={e => setSelectedCategory(e.target.value)}
                  style={{ fontSize: '0.82rem', height: '36px' }}
                >
                  <option value="ALL">Entire Calendar (Exams, Holidays & Events)</option>
                  <option value="Exams">Examinations & Assessments Only</option>
                  <option value="Holidays">Holidays & School Breaks Only</option>
                </select>
              </div>
            </div>
          )}

          {/* TAB 1: LIVE FEED SUBSCRIPTION */}
          {activeTab === 'feed' && (
            <div>
              <div style={{ marginBottom: '18px' }}>
                <span style={{ fontSize: '0.84rem', fontWeight: 700, color: '#172033', display: 'block', marginBottom: '6px' }}>
                  Live iCal / Webcal Feed URL
                </span>
                <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0 0 10px' }}>
                  Add this live subscription URL to your personal calendar. Any rescheduled exams or newly declared holidays in the school HRMS will automatically sync to your phone and calendar app.
                </p>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    readOnly
                    value={feedUrl}
                    className="form-control"
                    style={{
                      fontFamily: 'monospace',
                      fontSize: '0.78rem',
                      backgroundColor: '#f8fafc',
                      color: '#334155'
                    }}
                  />
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={handleCopyUrl}
                    style={{ minWidth: '110px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                  >
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                    <span>{copied ? 'Copied!' : 'Copy Link'}</span>
                  </button>
                </div>
              </div>

              {/* Quick 1-Click Integration Buttons */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                marginBottom: '24px',
                flexWrap: 'wrap'
              }}>
                <a
                  href={googleCalendarSubscribeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}
                >
                  <ExternalLink size={13} />
                  <span>Subscribe in Google Calendar</span>
                </a>

                <a
                  href={webcalUrl}
                  className="btn btn-secondary btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}
                >
                  <ExternalLink size={13} />
                  <span>Open in Apple / Outlook Calendar</span>
                </a>
              </div>

              {/* Step by Step Help */}
              <div style={{
                backgroundColor: '#f8fafc',
                borderRadius: '10px',
                padding: '16px',
                border: '1px solid #e2e8f0'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                  <HelpCircle size={15} style={{ color: '#3155D9' }} />
                  <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#172033' }}>
                    How to Add this Live Feed to Your Device:
                  </span>
                </div>
                <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.78rem', color: '#475569', lineHeight: 1.6 }}>
                  <li><strong>Google Calendar:</strong> Click <strong>+</strong> next to "Other calendars" on the left sidebar → Select <strong>"From URL"</strong> → Paste the copied link → Click <strong>"Add calendar"</strong>.</li>
                  <li><strong>Apple Calendar (Mac / iPhone):</strong> On Mac, go to <strong>File → New Calendar Subscription</strong> → Paste link. On iPhone, go to <strong>Settings → Calendar → Accounts → Add Subscribed Calendar</strong>.</li>
                  <li><strong>Microsoft Outlook:</strong> Click <strong>"Add Calendar"</strong> → Select <strong>"Subscribe from web"</strong> → Paste the link → Click <strong>"Import"</strong>.</li>
                </ul>
              </div>
            </div>
          )}

          {/* TAB 2: DOWNLOAD .ICS FILE */}
          {activeTab === 'download' && (
            <div>
              <div style={{
                textAlign: 'center',
                padding: '30px 20px',
                backgroundColor: '#f8fafc',
                borderRadius: '12px',
                border: '1px dashed #cbd5e1',
                marginBottom: '20px'
              }}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  backgroundColor: '#eef2ff',
                  color: '#3155D9',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 12px'
                }}>
                  <Download size={24} />
                </div>
                <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#172033', margin: '0 0 6px' }}>
                  Export RFC 5545 iCalendar File
                </h3>
                <p style={{ fontSize: '0.82rem', color: '#64748b', maxWidth: '420px', margin: '0 auto 18px', lineHeight: 1.5 }}>
                  Download the universal <code>.ics</code> calendar file to import directly into desktop calendar applications (Microsoft Outlook, Apple Calendar, Mozilla Thunderbird).
                </p>

                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleDownloadIcs}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 20px', fontSize: '0.88rem' }}
                >
                  <Download size={16} />
                  <span>Download .ICS Calendar File</span>
                </button>
              </div>

              <div style={{ fontSize: '0.78rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle2 size={14} style={{ color: '#059669' }} />
                <span>Compatible with all standard calendar software on Windows, macOS, Android, and iOS.</span>
              </div>
            </div>
          )}

          {/* TAB 3: SYNC OFFICIAL PUBLIC HOLIDAYS */}
          {activeTab === 'holidays' && (
            <div>
              <div style={{ marginBottom: '18px' }}>
                <h3 style={{ fontSize: '0.98rem', fontWeight: 800, color: '#172033', margin: '0 0 4px' }}>
                  Official National & Academic Holiday Library
                </h3>
                <p style={{ fontSize: '0.82rem', color: '#64748b', margin: 0, lineHeight: 1.5 }}>
                  Pre-load verified national, regional, and institutional public holidays (Independence Day, Republic Day, Gandhi Jayanti, Diwali Break, Eid, Christmas, Summer/Winter vacations) directly into the academic session to ensure dates are accurate without manual data entry.
                </p>
              </div>

              {syncFeedback && (
                <div style={{
                  padding: '12px 14px',
                  borderRadius: '8px',
                  marginBottom: '16px',
                  backgroundColor: syncFeedback.type === 'success' ? '#f0fdf4' : '#fef2f2',
                  border: `1px solid ${syncFeedback.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
                  color: syncFeedback.type === 'success' ? '#166534' : '#991b1b',
                  fontSize: '0.84rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  {syncFeedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                  <span>{syncFeedback.message}</span>
                </div>
              )}

              <div style={{
                backgroundColor: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '16px',
                marginBottom: '20px'
              }}>
                <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                  Included Gazetted & Institutional Observances:
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', fontSize: '0.8rem', color: '#334155' }}>
                  <div>• Independence Day (Aug 15)</div>
                  <div>• Gandhi Jayanti (Oct 02)</div>
                  <div>• Dussehra Festival (Oct 20)</div>
                  <div>• Diwali Break (Nov 08 – 12)</div>
                  <div>• Guru Nanak Jayanti (Nov 24)</div>
                  <div>• Christmas Day (Dec 25)</div>
                  <div>• Winter Vacation (Dec 26 – Jan 02)</div>
                  <div>• Republic Day (Jan 26)</div>
                  <div>• Maha Shivratri (Feb 15)</div>
                  <div>• Holi Festival (Mar 04)</div>
                  <div>• Good Friday (Mar 26)</div>
                  <div>• Eid-ul-Fitr (Mar 20)</div>
                  <div>• Dr. Ambedkar Jayanti (Apr 14)</div>
                  <div>• Summer Vacation (May 01 – Jun 10)</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                  Duplicates are safely identified and skipped automatically.
                </span>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleSyncOfficialHolidays}
                  disabled={isSyncingHolidays}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '9px 18px' }}
                >
                  <RefreshCw size={15} className={isSyncingHolidays ? 'spin-animation' : ''} />
                  <span>{isSyncingHolidays ? 'Synchronizing Holidays...' : 'Sync Official Holidays Now'}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 24px',
          borderTop: '1px solid #e2e8f0',
          backgroundColor: '#f8fafc',
          display: 'flex',
          justifyContent: 'flex-end'
        }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onClose}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

export default CalendarSyncModal;
