import React, { useState, useEffect } from 'react';
import {
  CalendarClock,
  Clock,
  Calendar,
  Coffee,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Building2,
  Info,
  ShieldAlert
} from 'lucide-react';
import { hrmsApi } from '../../services/api';
import { LoadingSpinner } from '../common/LoadingSpinner';

export function MyShiftView() {
  const [shiftData, setShiftData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchShift = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await hrmsApi.getMyShift();
      if (res && res.success) {
        setShiftData(res.data);
      } else {
        throw new Error(res?.message || 'Failed to load assigned shift schedule.');
      }
    } catch (err) {
      console.error('Fetch shift error:', err);
      setError(err.message || 'Unable to connect to St. Vincent\'s server.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchShift();
  }, []);

  const employee = shiftData?.employee || {};
  const shift = shiftData?.shift || {};
  const workingDays = shift?.working_days || [];

  const allWeekDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  return (
    <div className="my-shift-view-container" style={{ width: '100%', maxWidth: '900px', margin: '0 auto', boxSizing: 'border-box' }}>
      {/* 1. Header */}
      <div className="page-header-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 4px 0' }}>
            My Work Schedule & Shift
          </h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
            Official institutional work hours, weekly schedule, and policy rules.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={fetchShift}
          title="Refresh shift details"
        >
          <RefreshCw size={14} />
          <span>Refresh</span>
        </button>
      </div>

      {isLoading ? (
        <div style={{ padding: '60px', textAlign: 'center' }}>
          <LoadingSpinner text="Loading your assigned shift schedule..." size={32} />
        </div>
      ) : error ? (
        <div className="table-state-container error-state" style={{ padding: '36px', textAlign: 'center' }}>
          <AlertCircle size={32} className="text-danger" style={{ margin: '0 auto 8px' }} />
          <h4 style={{ margin: '0 0 4px', fontSize: '1rem', color: 'var(--text-main)' }}>Unable to load shift schedule</h4>
          <p style={{ margin: '0 0 16px', fontSize: '0.84rem', color: 'var(--text-muted)' }}>{error}</p>
          <button type="button" className="btn btn-secondary btn-sm" onClick={fetchShift}>
            <RefreshCw size={14} />
            <span>Retry</span>
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Main Shift Dossier Card */}
          <div className="table-wrapper-card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div className="stat-icon-badge stat-indigo" style={{ width: '44px', height: '44px', borderRadius: '10px' }}>
                  <CalendarClock size={22} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                      {shift.name}
                    </h2>
                    <span className="code-badge" style={{ backgroundColor: '#eff6ff', color: '#1d4ed8' }}>
                      {shift.code}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Assigned to {employee.full_name} ({employee.employee_code}) • {employee.department_name}
                  </span>
                </div>
              </div>
            </div>

            {/* Shift Timing Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '20px' }}>
              <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#166534', fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase' }}>
                  <Clock size={14} />
                  Shift Hours
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#166534', margin: '6px 0 2px 0' }}>
                  {shift.start_time_formatted} – {shift.end_time_formatted}
                </div>
                <span style={{ fontSize: '0.74rem', color: '#166534' }}>
                  Standard institutional hours
                </span>
              </div>

              <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#92400e', fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase' }}>
                  <ShieldAlert size={14} />
                  Late Grace Period
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#92400e', margin: '6px 0 2px 0' }}>
                  {shift.late_grace_minutes} Minutes
                </div>
                <span style={{ fontSize: '0.74rem', color: '#92400e' }}>
                  Arrival after this time is marked Late
                </span>
              </div>

              <div style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#1e40af', fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase' }}>
                  <Coffee size={14} />
                  Lunch / Recess Break
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1e40af', margin: '6px 0 2px 0' }}>
                  {shift.break_start_time ? `${shift.break_start_time} – ${shift.break_end_time}` : '10:30 – 11:00'}
                </div>
                <span style={{ fontSize: '0.74rem', color: '#1e40af' }}>
                  Official recess period
                </span>
              </div>
            </div>

            {/* Weekly Working Days Visual Ledger */}
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '10px' }}>
                Weekly Working Days
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px' }}>
                {allWeekDays.map((day) => {
                  const isWork = workingDays.includes(day);
                  return (
                    <div
                      key={day}
                      style={{
                        padding: '12px 8px',
                        borderRadius: '6px',
                        textAlign: 'center',
                        backgroundColor: isWork ? '#f0fdf4' : '#f8fafc',
                        border: `1px solid ${isWork ? '#86efac' : '#e2e8f0'}`
                      }}
                    >
                      <span style={{ fontSize: '0.74rem', fontWeight: 700, color: isWork ? '#166534' : '#94a3b8', display: 'block' }}>
                        {day.slice(0, 3)}
                      </span>
                      <span style={{ fontSize: '0.7rem', fontWeight: 600, color: isWork ? '#059669' : '#cbd5e1', marginTop: '4px', display: 'block' }}>
                        {isWork ? 'Working' : 'Off'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Shift Notes / Description */}
            <div style={{ backgroundColor: '#f8fafc', border: '1px solid var(--border-light)', borderRadius: '6px', padding: '14px 16px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '4px' }}>
                <Info size={14} className="text-primary" />
                Shift Policy Notes
              </div>
              <p style={{ margin: 0 }}>
                {shift.description || 'Standard academic faculty teaching shift. Employees must record daily attendance upon arrival on campus and check out upon concluding official instructional hours.'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MyShiftView;
