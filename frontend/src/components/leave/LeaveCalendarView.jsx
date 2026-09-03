import React, { useState, useEffect, useMemo } from 'react';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Filter, 
  Users, 
  Layers, 
  Clock, 
  CheckCircle2, 
  Loader2, 
  Plus,
  User
} from 'lucide-react';
import { hrmsApi } from '../../services/api';
import { ApplyLeaveModal } from './ApplyLeaveModal';
import { LeaveDetailsModal } from './LeaveDetailsModal';

export function LeaveCalendarView() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [calendarData, setCalendarData] = useState({ events: [], summary: {} });
  const [departments, setDepartments] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [employees, setEmployees] = useState([]);

  // Filters
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');

  // Modals state
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [selectedRequestForDetail, setSelectedRequestForDetail] = useState(null);

  const monthStr = useMemo(() => {
    const y = currentDate.getFullYear();
    const m = String(currentDate.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }, [currentDate]);

  const monthTitle = useMemo(() => {
    return currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }, [currentDate]);

  // Load master data once
  useEffect(() => {
    async function loadMasterData() {
      try {
        const [depRes, typesRes, empRes] = await Promise.all([
          hrmsApi.getDepartments(),
          hrmsApi.getLeaveTypes(false),
          hrmsApi.getEmployees({ limit: 100 })
        ]);
        if (depRes && depRes.success) setDepartments(depRes.data || []);
        if (typesRes && typesRes.success) setLeaveTypes(typesRes.data || []);
        if (empRes && empRes.success) setEmployees(empRes.data.employees || empRes.data || []);
      } catch (err) {
        console.error('Failed to load master metadata:', err);
      }
    }
    loadMasterData();
  }, []);

  // Fetch calendar events
  const fetchCalendar = async () => {
    setLoading(true);
    try {
      const res = await hrmsApi.getLeaveCalendar({
        month: monthStr,
        department_id: deptFilter,
        leave_type_id: typeFilter
      });
      if (res && res.success) {
        setCalendarData(res.data);
      }
    } catch (err) {
      console.error('Failed to load leave calendar:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCalendar();
  }, [monthStr, deptFilter, typeFilter]);

  const handlePrevMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Build 35-42 calendar day cells
  const calendarCells = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sunday
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const cells = [];

    // Prev month trailing days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      const prevDate = new Date(year, month - 1, d);
      const dateStr = prevDate.toISOString().split('T')[0];
      cells.push({
        dayNumber: d,
        dateStr,
        isCurrentMonth: false,
        isToday: false,
        events: []
      });
    }

    const todayStr = new Date().toISOString().split('T')[0];

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(year, month, d);
      const dateStr = dateObj.toISOString().split('T')[0];
      
      // Find events spanning this day
      const dayEvents = (calendarData.events || []).filter(e => {
        const start = e.start_date ? e.start_date.split('T')[0] : '';
        const end = e.end_date ? e.end_date.split('T')[0] : '';
        return dateStr >= start && dateStr <= end;
      });

      cells.push({
        dayNumber: d,
        dateStr,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
        events: dayEvents
      });
    }

    // Next month leading days to complete grid (42 total or multiple of 7)
    const totalCurrent = cells.length;
    const remaining = (7 - (totalCurrent % 7)) % 7;
    for (let d = 1; d <= remaining; d++) {
      const nextDate = new Date(year, month + 1, d);
      const dateStr = nextDate.toISOString().split('T')[0];
      cells.push({
        dayNumber: d,
        dateStr,
        isCurrentMonth: false,
        isToday: false,
        events: []
      });
    }

    return cells;
  }, [currentDate, calendarData.events]);

  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="leave-calendar-view" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Banner with Navigation and Filters */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        flexWrap: 'wrap', 
        gap: '16px',
        backgroundColor: '#ffffff',
        padding: '20px 24px',
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
      }}>
        <div>
          <h1 style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <CalendarIcon size={24} className="text-primary" />
            Faculty & Staff Absence Calendar
          </h1>
          <p style={{ fontSize: '0.86rem', color: '#64748b', margin: '4px 0 0' }}>
            Visual monthly schedule of approved leaves and scheduled absences across all school departments
          </p>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setIsApplyModalOpen(true)}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <Plus size={16} />
          <span>Apply For Leave</span>
        </button>
      </div>

      {/* Controls Bar */}
      <div style={{ 
        backgroundColor: '#ffffff', 
        borderRadius: '12px', 
        padding: '16px 20px', 
        border: '1px solid #e2e8f0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        {/* Month Navigation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button
              type="button"
              className="btn btn-secondary btn-icon-only"
              onClick={handlePrevMonth}
              title="Previous Month"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-icon-only"
              onClick={handleNextMonth}
              title="Next Month"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', margin: 0, minWidth: '180px' }}>
            {monthTitle}
          </h2>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleToday}
            style={{ fontSize: '0.8rem' }}
          >
            Today
          </button>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 600 }}>Category:</span>
            <select
              className="form-control"
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              style={{ width: 'auto', fontSize: '0.84rem' }}
            >
              <option value="ALL">All Categories</option>
              {leaveTypes.map(lt => (
                <option key={lt.id} value={lt.id}>{lt.name} ({lt.code})</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 600 }}>Department:</span>
            <select
              className="form-control"
              value={deptFilter}
              onChange={e => setDeptFilter(e.target.value)}
              style={{ width: 'auto', fontSize: '0.84rem' }}
            >
              <option value="ALL">All Departments</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Calendar Grid Container */}
      <div style={{ 
        backgroundColor: '#ffffff', 
        borderRadius: '12px', 
        border: '1px solid #e2e8f0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        overflow: 'hidden'
      }}>
        {/* Days Header */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(7, 1fr)', 
          backgroundColor: '#f8fafc', 
          borderBottom: '1px solid #e2e8f0' 
        }}>
          {daysOfWeek.map((day, idx) => (
            <div 
              key={idx} 
              style={{ 
                padding: '12px 10px', 
                textAlign: 'center', 
                fontSize: '0.8rem', 
                fontWeight: 700, 
                color: idx === 0 || idx === 6 ? '#94a3b8' : '#475569',
                textTransform: 'uppercase',
                letterSpacing: '0.04em'
              }}
            >
              {day}
            </div>
          ))}
        </div>

        {/* Days Cells Grid */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(7, 1fr)',
          minHeight: '600px'
        }}>
          {calendarCells.map((cell, idx) => (
            <div 
              key={idx}
              style={{ 
                minHeight: '110px',
                padding: '8px',
                borderRight: (idx + 1) % 7 !== 0 ? '1px solid #f1f5f9' : 'none',
                borderBottom: '1px solid #f1f5f9',
                backgroundColor: cell.isCurrentMonth ? (cell.isToday ? '#f0fdf4' : '#ffffff') : '#f8fafc',
                opacity: cell.isCurrentMonth ? 1 : 0.45,
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                position: 'relative'
              }}
            >
              {/* Day Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                <span style={{ 
                  fontSize: '0.84rem', 
                  fontWeight: cell.isToday ? 800 : 600, 
                  color: cell.isToday ? '#166534' : '#334155',
                  width: cell.isToday ? '24px' : 'auto',
                  height: cell.isToday ? '24px' : 'auto',
                  borderRadius: cell.isToday ? '50%' : '0',
                  backgroundColor: cell.isToday ? '#bbf7d0' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {cell.dayNumber}
                </span>

                {cell.events.length > 0 && (
                  <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>
                    {cell.events.length} away
                  </span>
                )}
              </div>

              {/* Event Chips */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', overflowY: 'auto', maxHeight: '100px' }}>
                {cell.events.map((ev, evIdx) => (
                  <div
                    key={evIdx}
                    onClick={() => setSelectedRequestForDetail(ev)}
                    title={`${ev.first_name} ${ev.last_name} (${ev.leave_type_name})`}
                    style={{ 
                      padding: '3px 6px', 
                      borderRadius: '6px', 
                      backgroundColor: '#eff6ff', 
                      border: '1px solid #bfdbfe',
                      fontSize: '0.74rem',
                      color: '#1e40af',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}
                  >
                    <span style={{ 
                      width: '6px', 
                      height: '6px', 
                      borderRadius: '50%', 
                      backgroundColor: '#2563eb', 
                      flexShrink: 0 
                    }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {ev.first_name} {ev.last_name ? ev.last_name[0] + '.' : ''} ({ev.leave_type_code})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modals */}
      <ApplyLeaveModal
        isOpen={isApplyModalOpen}
        onClose={() => setIsApplyModalOpen(false)}
        onSuccess={() => {
          fetchCalendar();
        }}
        employees={employees}
        leaveTypes={leaveTypes}
      />

      <LeaveDetailsModal
        isOpen={Boolean(selectedRequestForDetail)}
        onClose={() => setSelectedRequestForDetail(null)}
        leaveRequest={selectedRequestForDetail}
        onStatusUpdated={() => {
          fetchCalendar();
        }}
      />
    </div>
  );
}
