import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  CalendarDays, 
  Search, 
  Filter, 
  Plus, 
  Edit, 
  Trash2, 
  Power, 
  RefreshCw, 
  Calendar, 
  AlertCircle, 
  Check, 
  Layers,
  Sparkles
} from 'lucide-react';
import { hrmsApi } from '../../services/api';
import { TableSkeleton } from '../common/LoadingSpinner';
import AddEditEventModal from './AddEditEventModal';

export function HolidaysView({
  academicYears = [],
  terms = [],
  activeYearId = null,
  canManage = false,
  initialEvent = null
}) {
  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedYear, setSelectedYear] = useState(activeYearId || 'ALL');
  const [selectedType, setSelectedType] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');

  // Modals & Actions
  const [editingEvent, setEditingEvent] = useState(initialEvent);
  const [isModalOpen, setIsModalOpen] = useState(Boolean(initialEvent));
  const [actionLoading, setActionLoading] = useState(null);
  const [feedback, setFeedback] = useState(null);

  const fetchEvents = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsLoading(true);
    else setIsRefreshing(true);
    setError(null);

    try {
      const res = await hrmsApi.getCalendarEvents({
        search: searchTerm,
        academic_year_id: selectedYear,
        event_type: selectedType,
        status: selectedStatus
      });

      if (res && res.success) {
        setEvents(res.data || []);
      }
    } catch (err) {
      console.error('Error fetching calendar events:', err);
      setError(err.message || 'Failed to retrieve calendar events.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [searchTerm, selectedYear, selectedType, selectedStatus]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const handleToggleStatus = async (ev) => {
    setActionLoading(ev.id);
    try {
      const res = await hrmsApi.toggleCalendarEventStatus(ev.id, !ev.is_active);
      if (res && res.success) {
        fetchEvents(true);
      }
    } catch (err) {
      console.error('Error toggling event status:', err);
      setFeedback({ type: 'error', message: err.message || 'Failed to update event status.' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (ev) => {
    if (!window.confirm(`Delete calendar event "${ev.title}"?`)) return;

    setActionLoading(ev.id);
    try {
      const res = await hrmsApi.deleteCalendarEvent(ev.id);
      if (res && res.success) {
        setFeedback({ type: 'success', message: 'Event deleted successfully.' });
        fetchEvents(true);
      }
    } catch (err) {
      console.error('Error deleting event:', err);
      setFeedback({ type: 'error', message: err.message || 'Failed to delete event.' });
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="holidays-view">
      {/* 1. Header & Actions */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '16px',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
            Holidays, Closures & School Events
          </h3>
          <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '2px 0 0' }}>
            Comprehensive institutional registry of gazetted holidays, breaks, non-instructional days, and schedule overrides.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => fetchEvents(true)}
            disabled={isRefreshing}
          >
            <RefreshCw size={14} className={isRefreshing ? 'spin-animation' : ''} />
            <span>Refresh</span>
          </button>

          {canManage && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => {
                setEditingEvent(null);
                setIsModalOpen(true);
              }}
            >
              <Plus size={15} />
              <span>Add Holiday / Event</span>
            </button>
          )}
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div style={{
          marginBottom: '16px',
          padding: '10px 14px',
          borderRadius: '8px',
          backgroundColor: feedback.type === 'error' ? '#fef2f2' : '#f0fdf4',
          border: `1px solid ${feedback.type === 'error' ? '#fecaca' : '#bbf7d0'}`,
          color: feedback.type === 'error' ? '#b91c1c' : '#15803d',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>{feedback.message}</span>
          <button type="button" onClick={() => setFeedback(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>✕</button>
        </div>
      )}

      {/* 2. Filter Bar */}
      <div style={{
        backgroundColor: '#ffffff',
        padding: '14px 18px',
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
        marginBottom: '16px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        flexWrap: 'wrap',
        boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
      }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: '1 1 220px', minWidth: '200px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input
            type="text"
            className="form-control"
            placeholder="Search events, holidays, circulars..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ paddingLeft: '36px', fontSize: '0.84rem' }}
          />
        </div>

        {/* Academic Year Filter */}
        <select
          className="form-control"
          style={{ width: '180px', fontSize: '0.84rem' }}
          value={selectedYear}
          onChange={e => setSelectedYear(e.target.value)}
        >
          <option value="ALL">All Academic Years</option>
          {academicYears.map(y => (
            <option key={y.id} value={y.id}>
              {y.name} {y.is_active ? '★ (Active)' : ''}
            </option>
          ))}
        </select>

        {/* Event Type Filter */}
        <select
          className="form-control"
          style={{ width: '180px', fontSize: '0.84rem' }}
          value={selectedType}
          onChange={e => setSelectedType(e.target.value)}
        >
          <option value="ALL">All Event Types</option>
          <option value="Holiday">Holidays Only</option>
          <option value="Non-Instructional">Non-Instructional Days</option>
          <option value="School Closure">School Closures</option>
          <option value="Working Day Override">Working Overrides</option>
        </select>

        {/* Status Filter */}
        <select
          className="form-control"
          style={{ width: '140px', fontSize: '0.84rem' }}
          value={selectedStatus}
          onChange={e => setSelectedStatus(e.target.value)}
        >
          <option value="ALL">All Status</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
        </select>
      </div>

      {/* 3. Holidays & Closures Table */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '14px',
        border: '1px solid #e2e8f0',
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
      }}>
        {isLoading ? (
          <TableSkeleton rows={5} />
        ) : events.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
            No calendar events found matching your criteria.
          </div>
        ) : (
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                <th style={{ padding: '12px 16px', fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>DATE / PERIOD</th>
                <th style={{ padding: '12px 16px', fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>EVENT TITLE</th>
                <th style={{ padding: '12px 16px', fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>TYPE & CATEGORY</th>
                <th style={{ padding: '12px 16px', fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>ACADEMIC TERM</th>
                <th style={{ padding: '12px 16px', fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>STAFF WORK</th>
                <th style={{ padding: '12px 16px', fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>STATUS</th>
                {canManage && <th style={{ padding: '12px 16px', fontSize: '0.78rem', fontWeight: 700, color: '#475569', textAlign: 'right' }}>ACTIONS</th>}
              </tr>
            </thead>
            <tbody>
              {events.map((ev) => {
                const startDateStr = new Date(ev.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                const endDateStr = new Date(ev.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                const isSingleDay = ev.start_date === ev.end_date || ev.total_days === 1;

                const isHoliday = ev.event_type === 'Holiday';
                const isClosure = ev.event_type === 'School Closure';
                const isNonInst = ev.event_type === 'Non-Instructional';
                const isOverride = ev.event_type === 'Working Day Override';

                let badgeColor = '#2563eb';
                let badgeBg = '#eff6ff';
                if (isHoliday) { badgeColor = '#dc2626'; badgeBg = '#fef2f2'; }
                else if (isClosure) { badgeColor = '#e11d48'; badgeBg = '#fff1f2'; }
                else if (isNonInst) { badgeColor = '#7c3aed'; badgeBg = '#f5f3ff'; }
                else if (isOverride) { badgeColor = '#059669'; badgeBg = '#ecfdf5'; }

                return (
                  <tr key={ev.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '14px 16px', fontSize: '0.84rem', color: '#0f172a', fontWeight: 600 }}>
                      <div>{startDateStr}</div>
                      {!isSingleDay && (
                        <div style={{ fontSize: '0.76rem', color: '#64748b' }}>to {endDateStr}</div>
                      )}
                      <span style={{
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        color: '#64748b',
                        backgroundColor: '#f1f5f9',
                        padding: '1px 6px',
                        borderRadius: '6px',
                        marginTop: '3px',
                        display: 'inline-block'
                      }}>
                        {ev.total_days} {ev.total_days === 1 ? 'Day' : 'Days'}
                      </span>
                    </td>

                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#0f172a' }}>
                        {ev.title}
                      </div>
                      {ev.description && (
                        <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px', maxWidth: '380px' }}>
                          {ev.description}
                        </div>
                      )}
                    </td>

                    <td style={{ padding: '14px 16px' }}>
                      <span style={{
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: '12px',
                        backgroundColor: badgeBg,
                        color: badgeColor
                      }}>
                        {ev.event_type}
                      </span>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>
                        {ev.category}
                      </div>
                    </td>

                    <td style={{ padding: '14px 16px', fontSize: '0.82rem', color: '#334155' }}>
                      <div style={{ fontWeight: 600 }}>{ev.term_name || '—'}</div>
                      <div style={{ fontSize: '0.74rem', color: '#64748b' }}>{ev.academic_year_name}</div>
                    </td>

                    <td style={{ padding: '14px 16px' }}>
                      <span style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: '10px',
                        backgroundColor: ev.is_working_day ? '#dcfce7' : '#fee2e2',
                        color: ev.is_working_day ? '#15803d' : '#b91c1c'
                      }}>
                        {ev.is_working_day ? 'Working' : 'Off'}
                      </span>
                    </td>

                    <td style={{ padding: '14px 16px' }}>
                      <span style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: '10px',
                        backgroundColor: ev.is_active ? '#ecfdf5' : '#f1f5f9',
                        color: ev.is_active ? '#059669' : '#64748b'
                      }}>
                        {ev.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>

                    {canManage && (
                      <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                          <button
                            type="button"
                            className="btn btn-ghost btn-xs"
                            onClick={() => {
                              setEditingEvent(ev);
                              setIsModalOpen(true);
                            }}
                            title="Edit Event"
                          >
                            <Edit size={14} />
                            <span>Edit</span>
                          </button>

                          <button
                            type="button"
                            className="btn btn-ghost btn-xs"
                            onClick={() => handleToggleStatus(ev)}
                            disabled={actionLoading === ev.id}
                            style={{ color: ev.is_active ? '#e11d48' : '#059669' }}
                            title={ev.is_active ? 'Deactivate' : 'Activate'}
                          >
                            <Power size={14} />
                          </button>

                          <button
                            type="button"
                            className="btn btn-ghost btn-xs"
                            onClick={() => handleDelete(ev)}
                            disabled={actionLoading === ev.id}
                            style={{ color: '#dc2626' }}
                            title="Delete Event"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Add / Edit Event Modal */}
      {isModalOpen && (
        <AddEditEventModal
          event={editingEvent}
          isOpen={isModalOpen}
          academicYears={academicYears}
          terms={terms}
          activeYearId={activeYearId}
          onClose={() => {
            setIsModalOpen(false);
            setEditingEvent(null);
          }}
          onSaved={() => {
            fetchEvents(true);
          }}
        />
      )}
    </div>
  );
}

export default HolidaysView;
