import React, { useState, useEffect } from 'react';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  Users, 
  MapPin, 
  ChevronLeft, 
  ChevronRight, 
  Building2, 
  GraduationCap,
  ExternalLink
} from 'lucide-react';
import { hrmsApi } from '../../services/api';
import { LoadingSpinner } from '../common/LoadingSpinner';

export function TrainingCalendarView({ onSelectProgram, departments = [] }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedDayEvents, setSelectedDayEvents] = useState(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1; // 1-12

  const fetchCalendar = async () => {
    setIsLoading(true);
    try {
      const res = await hrmsApi.getTrainingCalendar({ year, month });
      if (res && res.success) {
        setCalendarEvents(res.data || []);
      }
    } catch (err) {
      console.error('Error fetching training calendar:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCalendar();
    setSelectedDayEvents(null);
  }, [year, month]);

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, currentDate.getMonth() + 1, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Generate calendar grid days
  const firstDayIndex = new Date(year, month - 1, 1).getDay(); // 0 = Sunday
  const daysInMonth = new Date(year, month, 0).getDate();
  const prevMonthDays = new Date(year, month - 1, 0).getDate();

  const calendarDays = [];

  // Previous month trailing days
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    calendarDays.push({
      dayNumber: prevMonthDays - i,
      isCurrentMonth: false,
      dateString: `${year}-${String(month - 1).padStart(2, '0')}-${String(prevMonthDays - i).padStart(2, '0')}`
    });
  }

  // Current month days
  for (let i = 1; i <= daysInMonth; i++) {
    const dayStr = `${year}-${String(month).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
    calendarDays.push({
      dayNumber: i,
      isCurrentMonth: true,
      dateString: dayStr,
      isToday: new Date().toISOString().split('T')[0] === dayStr
    });
  }

  // Next month leading days to complete 35 or 42 grid cells
  const remainingCells = (7 - (calendarDays.length % 7)) % 7;
  for (let i = 1; i <= remainingCells; i++) {
    calendarDays.push({
      dayNumber: i,
      isCurrentMonth: false,
      dateString: `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`
    });
  }

  const getEventsForDate = (dateStr) => {
    return calendarEvents.filter(ev => {
      const start = ev.start_date.split('T')[0];
      const end = ev.end_date.split('T')[0];
      return dateStr >= start && dateStr <= end;
    });
  };

  const filteredEvents = selectedDept 
    ? calendarEvents.filter(e => e.department_id === selectedDept || !e.department_id)
    : calendarEvents;

  return (
    <div className="training-calendar-view" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
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
        {/* Month Navigation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handlePrevMonth}
              style={{ padding: '6px 10px' }}
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleToday}
              style={{ fontSize: '0.82rem', fontWeight: 600 }}
            >
              Today
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleNextMonth}
              style={{ padding: '6px 10px' }}
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#172033', margin: 0, minWidth: '180px' }}>
            {monthNames[month - 1]} {year}
          </h2>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Building2 size={16} style={{ color: '#64748b' }} />
          <select
            className="form-control"
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            style={{ width: '200px', height: '36px', fontSize: '0.84rem' }}
          >
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 2. Main Month Grid */}
      {isLoading ? (
        <div style={{ padding: '60px 0', textAlign: 'center' }}>
          <LoadingSpinner text="Rendering training calendar matrix..." size={32} />
        </div>
      ) : (
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '14px',
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
        }}>
          {/* Day Headers (Sun-Sat) */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            backgroundColor: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
            textAlign: 'center',
            fontWeight: 700,
            fontSize: '0.78rem',
            color: '#64748b',
            padding: '10px 0'
          }}>
            <span>SUN</span>
            <span>MON</span>
            <span>TUE</span>
            <span>WED</span>
            <span>THU</span>
            <span>FRI</span>
            <span>SAT</span>
          </div>

          {/* Day Grid Cells */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            minHeight: '480px'
          }}>
            {calendarDays.map((cell, idx) => {
              const dayEvents = getEventsForDate(cell.dateString);
              return (
                <div
                  key={idx}
                  onClick={() => setSelectedDayEvents({ date: cell.dateString, events: dayEvents })}
                  style={{
                    borderRight: (idx + 1) % 7 === 0 ? 'none' : '1px solid #f1f5f9',
                    borderBottom: '1px solid #f1f5f9',
                    padding: '8px',
                    minHeight: '90px',
                    backgroundColor: cell.isToday ? '#f0fdf4' : !cell.isCurrentMonth ? '#fafafa' : '#ffffff',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    transition: 'background-color 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{
                      fontSize: '0.78rem',
                      fontWeight: cell.isToday ? 800 : 600,
                      color: cell.isToday ? '#16a34a' : !cell.isCurrentMonth ? '#94a3b8' : '#334155',
                      width: '22px',
                      height: '22px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: cell.isToday ? '#dcfce7' : 'transparent'
                    }}>
                      {cell.dayNumber}
                    </span>
                    {dayEvents.length > 0 && (
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#3155D9' }}>
                        {dayEvents.length} {dayEvents.length === 1 ? 'event' : 'events'}
                      </span>
                    )}
                  </div>

                  {/* Event Badges */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '2px' }}>
                    {dayEvents.slice(0, 2).map((ev) => (
                      <div
                        key={ev.id}
                        style={{
                          backgroundColor: '#eef2ff',
                          borderLeft: '3px solid #3155D9',
                          borderRadius: '4px',
                          padding: '2px 4px',
                          fontSize: '0.72rem',
                          color: '#1e293b',
                          fontWeight: 600,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                        title={`${ev.title} (${ev.trainer_name})`}
                      >
                        {ev.title}
                      </div>
                    ))}
                    {dayEvents.length > 2 && (
                      <span style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 600 }}>
                        +{dayEvents.length - 2} more
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. Upcoming Agenda Sessions List (Detailed View) */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '14px',
        border: '1px solid #e2e8f0',
        padding: '20px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CalendarIcon size={18} style={{ color: '#3155D9' }} />
            <h3 style={{ fontSize: '0.98rem', fontWeight: 700, color: '#172033', margin: 0 }}>
              Upcoming Training Sessions Agenda
            </h3>
          </div>
          <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
            Showing {filteredEvents.length} scheduled sessions
          </span>
        </div>

        {filteredEvents.length === 0 ? (
          <div style={{ padding: '30px', textAlign: 'center', color: '#64748b', fontSize: '0.86rem' }}>
            No training sessions scheduled for this month.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '14px' }}>
            {filteredEvents.map((session) => (
              <div
                key={session.id}
                style={{
                  padding: '14px 16px',
                  backgroundColor: '#f8fafc',
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                    {session.title}
                  </h4>
                  <span className={`status-pill badge-${session.status?.toLowerCase() || 'upcoming'}`} style={{ fontSize: '0.72rem' }}>
                    <span className="status-dot"></span>
                    <span>{session.status}</span>
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.8rem', color: '#475569' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <CalendarIcon size={13} style={{ color: '#3155D9' }} />
                    <span style={{ fontWeight: 600 }}>{session.start_date}</span>
                    {session.start_time && (
                      <span style={{ color: '#64748b' }}>({session.start_time.substring(0, 5)} - {session.end_time?.substring(0, 5) || ''})</span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Users size={13} style={{ color: '#16a34a' }} />
                    <span>Trainer: <strong>{session.trainer_name}</strong></span>
                  </div>

                  {session.department_name && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Building2 size={13} style={{ color: '#64748b' }} />
                      <span>Target: {session.department_name}</span>
                    </div>
                  )}

                  {session.location_venue && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <MapPin size={13} style={{ color: '#d97706' }} />
                      <span>Venue: {session.location_venue}</span>
                    </div>
                  )}
                </div>

                {onSelectProgram && (
                  <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '8px', marginTop: '4px' }}>
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs"
                      onClick={() => onSelectProgram(session.id)}
                      style={{ fontSize: '0.76rem', color: '#3155D9', fontWeight: 600, padding: 0 }}
                    >
                      View Program & Roster →
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default TrainingCalendarView;
