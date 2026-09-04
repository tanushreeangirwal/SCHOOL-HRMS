import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  Layers, 
  Sparkles, 
  CalendarDays, 
  CheckCircle2, 
  AlertCircle, 
  Plus, 
  RefreshCw, 
  Info,
  CalendarRange,
  ArrowRight,
  Filter,
  Check
} from 'lucide-react';
import { hrmsApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useCalendarSync } from '../../context/CalendarSyncContext';
import { TableSkeleton, LoadingSpinner } from '../common/LoadingSpinner';
import DayDetailModal from './DayDetailModal';

export function CalendarOverviewView({
  onAddEvent,
  onEditEvent,
  onViewHolidays,
  onViewYears,
  onViewTerms,
  canManage = false
}) {
  const { user } = useAuth();
  const { calendarVersion } = useCalendarSync();

  const [overviewData, setOverviewData] = useState(null);
  const [monthData, setMonthData] = useState(null);
  const [currentYear, setCurrentYear] = useState(() => new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(() => new Date().getMonth() + 1); // 1-12

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const [selectedDayData, setSelectedDayData] = useState(null);
  const [isDayModalOpen, setIsDayModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'agenda'

  // Fetch overview & month matrix
  const fetchData = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsLoading(true);
    else setIsRefreshing(true);
    setError(null);

    try {
      const [overviewRes, monthRes] = await Promise.all([
        hrmsApi.getCalendarOverview(),
        hrmsApi.getCalendarMonth(currentYear, currentMonth)
      ]);

      if (overviewRes && overviewRes.success) {
        setOverviewData(overviewRes.data);
      }
      if (monthRes && monthRes.success) {
        setMonthData(monthRes.data);
      }
    } catch (err) {
      console.error('Failed to load calendar data:', err);
      setError(err.message || 'Unable to connect to St. Vincent\'s Calendar service.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [currentYear, currentMonth]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Real-time synchronization: Re-fetch whenever calendarVersion changes across the HRMS
  useEffect(() => {
    if (calendarVersion > 0) {
      fetchData(true);
    }
  }, [calendarVersion, fetchData]);

  // Month navigation
  const handlePrevMonth = () => {
    if (currentMonth === 1) {
      setCurrentYear(prev => prev - 1);
      setCurrentMonth(12);
    } else {
      setCurrentMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 12) {
      setCurrentYear(prev => prev + 1);
      setCurrentMonth(1);
    } else {
      setCurrentMonth(prev => prev + 1);
    }
  };

  const handleToday = () => {
    const now = new Date();
    setCurrentYear(now.getFullYear());
    setCurrentMonth(now.getMonth() + 1);
  };

  // Day click handler
  const handleDayClick = (day) => {
    setSelectedDayData(day);
    setIsDayModalOpen(true);
  };

  // Compute first day of week offset for grid
  const monthStartOffset = useMemo(() => {
    if (!monthData || !monthData.days || monthData.days.length === 0) return 0;
    return monthData.days[0].day_of_week; // 0=Sun, 1=Mon ...
  }, [monthData]);

  const monthName = useMemo(() => {
    const d = new Date(currentYear, currentMonth - 1, 1);
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }, [currentYear, currentMonth]);

  return (
    <div className="calendar-overview-view">
      {/* 1. TOP STATS KPI CARDS */}
      <div className="stats-grid" style={{ marginBottom: '20px' }}>
        {/* KPI 1: Current Academic Year */}
        <div className="stat-card stat-indigo">
          <div className="stat-content">
            <span className="stat-title">Academic Session</span>
            <div className="stat-number-wrapper">
              <span className="stat-number" style={{ fontSize: '1.25rem', color: '#2563eb' }}>
                {overviewData?.active_year?.name || '2026–2027'}
              </span>
            </div>
            <span className="stat-subtext" style={{ color: '#059669', fontWeight: 600 }}>
              ★ Official Active Session
            </span>
          </div>
          <div className="stat-icon-badge" style={{ backgroundColor: '#eff6ff', color: '#2563eb' }}>
            <CalendarRange size={20} />
          </div>
        </div>

        {/* KPI 2: Current Term */}
        <div className="stat-card stat-violet" style={{ borderLeftColor: '#7c3aed' }}>
          <div className="stat-content">
            <span className="stat-title">Current School Term</span>
            <div className="stat-number-wrapper">
              <span className="stat-number" style={{ fontSize: '1.15rem', color: '#7c3aed' }}>
                {overviewData?.active_term?.name ? overviewData.active_term.name.split('(')[0].trim() : 'Term 1'}
              </span>
            </div>
            <span className="stat-subtext">
              {overviewData?.active_term?.name ? (overviewData.active_term.name.includes('(') ? overviewData.active_term.name.split('(')[1].replace(')', '') : 'Active Term') : 'Monsoon Session'}
            </span>
          </div>
          <div className="stat-icon-badge" style={{ backgroundColor: '#f5f3ff', color: '#7c3aed' }}>
            <Layers size={20} />
          </div>
        </div>

        {/* KPI 3: Upcoming Holiday */}
        <div className="stat-card stat-rose" style={{ borderLeftColor: '#e11d48' }}>
          <div className="stat-content">
            <span className="stat-title">Upcoming Holiday</span>
            <div className="stat-number-wrapper">
              <span className="stat-number" style={{ fontSize: '1.05rem', color: '#e11d48', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {overviewData?.upcoming_holiday?.title || 'None upcoming'}
              </span>
            </div>
            <span className="stat-subtext" style={{ color: '#be123c', fontWeight: 600 }}>
              {overviewData?.upcoming_holiday ? (
                overviewData.upcoming_holiday.days_remaining === 0 ? 'Today' :
                overviewData.upcoming_holiday.days_remaining === 1 ? 'Tomorrow' :
                `${overviewData.upcoming_holiday.days_remaining} days away`
              ) : 'School in session'}
            </span>
          </div>
          <div className="stat-icon-badge" style={{ backgroundColor: '#fff1f2', color: '#e11d48' }}>
            <CalendarDays size={20} />
          </div>
        </div>

        {/* KPI 4: Working Days This Month */}
        <div className="stat-card stat-emerald">
          <div className="stat-content">
            <span className="stat-title">Working Days ({new Date().toLocaleDateString('en-US', { month: 'short' })})</span>
            <div className="stat-number-wrapper">
              <span className="stat-number text-emerald">
                {overviewData?.working_days_this_month ?? '—'}
              </span>
            </div>
            <span className="stat-subtext">
              Out of {overviewData?.total_days_in_month ?? 30} calendar days
            </span>
          </div>
          <div className="stat-icon-badge">
            <CheckCircle2 size={20} />
          </div>
        </div>
      </div>

      {/* 2. TODAY STATUS BANNER */}
      {overviewData?.today_status && (
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          padding: '14px 20px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              backgroundColor: overviewData.today_status.is_working_day ? '#ecfdf5' : '#fff1f2',
              color: overviewData.today_status.is_working_day ? '#059669' : '#e11d48',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <Clock size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>
                  Today — {overviewData.today_status.day_name}
                </span>
                <span style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '12px',
                  backgroundColor: overviewData.today_status.is_working_day ? '#dcfce7' : '#fee2e2',
                  color: overviewData.today_status.is_working_day ? '#15803d' : '#b91c1c'
                }}>
                  {overviewData.today_status.status_label}
                </span>
              </div>
              <div style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>
                {overviewData.today_status.formatted_date} • {overviewData.today_status.term_name}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => fetchData(true)}
              disabled={isRefreshing}
              title="Refresh Calendar"
            >
              <RefreshCw size={14} className={isRefreshing ? 'spin-animation' : ''} />
              <span>Sync</span>
            </button>
            {canManage && (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={onAddEvent}
              >
                <Plus size={15} />
                <span>Add Event / Holiday</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* 3. MAIN CALENDAR CONTAINER (GRID + UPCOMING EVENTS SIDEBAR) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '20px', alignItems: 'start' }}>
        {/* Left: Monthly Matrix Calendar */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '14px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          overflow: 'hidden'
        }}>
          {/* Calendar Header Navigation */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid #f1f5f9',
            backgroundColor: '#fafbfc'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <CalendarIcon size={18} style={{ color: '#2563eb' }} />
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                {monthName}
              </h3>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                type="button"
                className="btn btn-secondary btn-xs"
                onClick={handlePrevMonth}
                title="Previous Month"
              >
                <ChevronLeft size={16} />
              </button>

              <button
                type="button"
                className="btn btn-ghost btn-xs"
                onClick={handleToday}
                style={{ fontWeight: 600, fontSize: '0.8rem', padding: '4px 10px' }}
              >
                Today
              </button>

              <button
                type="button"
                className="btn btn-secondary btn-xs"
                onClick={handleNextMonth}
                title="Next Month"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          {/* Mobile swipe instruction */}
          <div className="mobile-calendar-hint">
            👉 Swipe horizontally to see all days • Tap any date to view exams or holidays
          </div>

          {/* Calendar Grid Wrapper for Smooth Horizontal Mobile Scroll */}
          <div className="calendar-grid-wrapper" style={{ overflowX: 'auto', width: '100%', WebkitOverflowScrolling: 'touch' }}>
            <div style={{ minWidth: '640px', width: '100%' }}>
              {/* Calendar Day of Week Header */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                backgroundColor: '#f8fafc',
                borderBottom: '1px solid #e2e8f0',
                textAlign: 'center',
                fontSize: '0.75rem',
                fontWeight: 700,
                color: '#64748b',
                padding: '8px 0'
              }}>
                <div style={{ color: '#dc2626' }}>SUN</div>
                <div>MON</div>
                <div>TUE</div>
                <div>WED</div>
                <div>THU</div>
                <div>FRI</div>
                <div style={{ color: '#475569' }}>SAT</div>
              </div>

              {/* Calendar Grid Matrix */}
              {isLoading ? (
                <div style={{ padding: '40px', textAlign: 'center' }}>
                  <LoadingSpinner text="Rendering school calendar matrix..." />
                </div>
              ) : (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(7, 1fr)',
                  gridAutoRows: 'minmax(90px, auto)',
                  gap: '1px',
                  backgroundColor: '#e2e8f0'
                }}>
                  {/* Blank cells for start offset */}
                  {Array.from({ length: monthStartOffset }).map((_, i) => (
                    <div key={`empty-${i}`} style={{ backgroundColor: '#fafbfc' }} />
                  ))}

              {/* Month Days */}
              {monthData?.days?.map((day) => {
                const isSunday = day.day_of_week === 0;
                const isToday = day.is_today;
                const hasEvents = day.events && day.events.length > 0;
                const hasHoliday = day.events && day.events.some(e => e.event_type === 'Holiday');
                const hasClosure = day.events && day.events.some(e => e.event_type === 'School Closure');
                const hasNonInst = day.events && day.events.some(e => e.event_type === 'Non-Instructional');
                const hasOverride = day.events && day.events.some(e => e.event_type === 'Working Day Override');

                let cellBg = '#ffffff';
                if (isToday) cellBg = '#f0f9ff';
                else if (hasHoliday || hasClosure) cellBg = '#fffafb';
                else if (isSunday) cellBg = '#fafbfc';

                return (
                  <div
                    key={day.date}
                    onClick={() => handleDayClick(day)}
                    style={{
                      backgroundColor: cellBg,
                      padding: '8px',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      transition: 'background-color 0.15s ease',
                      border: isToday ? '2px solid #38bdf8' : 'none',
                      position: 'relative'
                    }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = isToday ? '#e0f2fe' : '#f1f5f9'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = cellBg}
                  >
                    {/* Day Number Row */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{
                        fontSize: '0.82rem',
                        fontWeight: isToday ? 800 : (isSunday ? 600 : 500),
                        color: isToday ? '#0284c7' : (isSunday ? '#dc2626' : '#334155'),
                        width: isToday ? '22px' : 'auto',
                        height: isToday ? '22px' : 'auto',
                        borderRadius: isToday ? '50%' : '0',
                        backgroundColor: isToday ? '#0284c7' : 'transparent',
                        color: isToday ? '#ffffff' : (isSunday ? '#dc2626' : '#334155'),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        {day.day_number}
                      </span>

                      {/* Working status indicator dot */}
                      <span style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        backgroundColor: day.is_working_day ? '#22c55e' : '#ef4444'
                      }} />
                    </div>

                    {/* Event Chips */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: 1, overflow: 'hidden' }}>
                      {day.events?.slice(0, 2).map((ev, evIdx) => {
                        let chipBg = '#eff6ff';
                        let chipColor = '#2563eb';
                        if (ev.event_type === 'Holiday') { chipBg = '#fee2e2'; chipColor = '#dc2626'; }
                        else if (ev.event_type === 'School Closure') { chipBg = '#ffe4e6'; chipColor = '#e11d48'; }
                        else if (ev.event_type === 'Non-Instructional') { chipBg = '#f5f3ff'; chipColor = '#7c3aed'; }
                        else if (ev.event_type === 'Working Day Override') { chipBg = '#dcfce7'; chipColor = '#15803d'; }

                        return (
                          <div
                            key={ev.id || evIdx}
                            style={{
                              fontSize: '0.68rem',
                              fontWeight: 600,
                              padding: '2px 5px',
                              borderRadius: '4px',
                              backgroundColor: chipBg,
                              color: chipColor,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              lineHeight: 1.2
                            }}
                            title={ev.title}
                          >
                            {ev.title}
                          </div>
                        );
                      })}

                      {day.events?.length > 2 && (
                        <span style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 600 }}>
                          +{day.events.length - 2} more
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
            </div>
          </div>

          {/* Calendar Footer Legend */}
          <div style={{
            padding: '10px 18px',
            borderTop: '1px solid #f1f5f9',
            backgroundColor: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            flexWrap: 'wrap',
            fontSize: '0.74rem',
            color: '#64748b'
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#22c55e' }} />
              Working Day
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444' }} />
              Holiday / Closed
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#8b5cf6' }} />
              Non-Instructional
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#0284c7' }} />
              Today
            </span>
          </div>
        </div>

        {/* Right Sidebar: Upcoming School Events List */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '14px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{
            padding: '16px 18px',
            borderBottom: '1px solid #f1f5f9',
            backgroundColor: '#fafbfc',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={16} style={{ color: '#2563eb' }} />
              <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                Upcoming School Events
              </h4>
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-xs"
              onClick={onViewHolidays}
              style={{ fontSize: '0.78rem', color: '#2563eb', padding: '2px 6px' }}
            >
              All Events →
            </button>
          </div>

          <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {overviewData?.upcoming_events?.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: '0.84rem' }}>
                No upcoming events scheduled in this term.
              </div>
            ) : (
              overviewData?.upcoming_events?.slice(0, 7).map((ev) => {
                const startDateObj = new Date(ev.start_date);
                const monthShort = startDateObj.toLocaleDateString('en-US', { month: 'short' });
                const dayNum = startDateObj.getDate();

                const isHoliday = ev.event_type === 'Holiday';
                const isClosure = ev.event_type === 'School Closure';
                const isNonInst = ev.event_type === 'Non-Instructional';

                let badgeColor = '#2563eb';
                let badgeBg = '#eff6ff';
                if (isHoliday) { badgeColor = '#dc2626'; badgeBg = '#fef2f2'; }
                else if (isClosure) { badgeColor = '#e11d48'; badgeBg = '#fff1f2'; }
                else if (isNonInst) { badgeColor = '#7c3aed'; badgeBg = '#f5f3ff'; }

                const daysRem = parseInt(ev.days_remaining, 10);
                let daysLabel = `${daysRem} days away`;
                if (daysRem === 0) daysLabel = 'Today';
                else if (daysRem === 1) daysLabel = 'Tomorrow';

                return (
                  <div
                    key={ev.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '10px 12px',
                      backgroundColor: '#f8fafc',
                      borderRadius: '10px',
                      border: '1px solid #e2e8f0',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {/* Date Block */}
                    <div style={{
                      width: '42px',
                      height: '42px',
                      backgroundColor: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <span style={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', lineHeight: 1 }}>
                        {monthShort}
                      </span>
                      <span style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', lineHeight: 1.1 }}>
                        {dayNum}
                      </span>
                    </div>

                    {/* Event Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: '0.86rem',
                        fontWeight: 700,
                        color: '#0f172a',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>
                        {ev.title}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px', flexWrap: 'wrap' }}>
                        <span style={{
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          padding: '1px 6px',
                          borderRadius: '8px',
                          backgroundColor: badgeBg,
                          color: badgeColor
                        }}>
                          {ev.category || ev.event_type}
                        </span>
                        {ev.start_time && (
                          <span style={{ fontSize: '0.72rem', color: '#1e293b', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                            <Clock size={11} style={{ color: '#64748b' }} />
                            {ev.start_time}{ev.end_time ? ` – ${ev.end_time}` : ''}
                          </span>
                        )}
                        <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                          {daysLabel}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Day Detail Inspector Modal */}
      {isDayModalOpen && selectedDayData && (
        <DayDetailModal
          dayData={selectedDayData}
          isOpen={isDayModalOpen}
          onClose={() => {
            setIsDayModalOpen(false);
            setSelectedDayData(null);
          }}
          onAddEventOnDate={(date) => {
            if (onAddEvent) onAddEvent(date);
          }}
          onEditEvent={(ev) => {
            setIsDayModalOpen(false);
            setSelectedDayData(null);
            if (onEditEvent) onEditEvent(ev);
          }}
          onDeleteEvent={async (ev) => {
            if (!window.confirm(`Delete calendar event "${ev.title}"?`)) return;
            try {
              const res = await hrmsApi.deleteCalendarEvent(ev.id);
              if (res && res.success) {
                setIsDayModalOpen(false);
                setSelectedDayData(null);
                fetchData(true);
              }
            } catch (err) {
              console.error('Error deleting event:', err);
              alert(err.message || 'Failed to delete event.');
            }
          }}
          canManage={canManage}
        />
      )}
    </div>
  );
}

export default CalendarOverviewView;
