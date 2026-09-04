import React from 'react';
import { 
  X, 
  Calendar, 
  Clock, 
  Tag, 
  CheckCircle2, 
  AlertCircle, 
  XCircle, 
  Layers, 
  FileText,
  Plus,
  Edit,
  Trash2
} from 'lucide-react';

export function DayDetailModal({
  dayData,
  isOpen,
  onClose,
  onAddEventOnDate,
  onEditEvent,
  onDeleteEvent,
  canManage = false
}) {
  if (!isOpen || !dayData) return null;

  const dateObj = new Date(dayData.date);
  const formattedDate = dateObj.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });

  const isWorking = dayData.is_working_day;
  const events = dayData.events || [];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div 
        className="apply-leave-modal-card" 
        style={{ maxWidth: '560px' }}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="apply-leave-header">
          <div className="apply-leave-header-left">
            <div 
              className="apply-leave-icon-circle" 
              style={{ 
                backgroundColor: isWorking ? '#f0fdf4' : '#fef2f2', 
                color: isWorking ? '#166534' : '#dc2626' 
              }}
            >
              <Calendar size={18} />
            </div>
            <div>
              <h2 className="apply-leave-title" style={{ fontSize: '1.1rem' }}>
                {formattedDate}
              </h2>
              <p className="apply-leave-subtitle">
                {dayData.term_name || 'Academic Calendar Session 2026–2027'}
              </p>
            </div>
          </div>
          <button type="button" className="apply-leave-close-btn" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="apply-leave-body" style={{ gap: '16px' }}>
          {/* Day Status Banner */}
          <div style={{
            padding: '14px 16px',
            borderRadius: '10px',
            backgroundColor: isWorking ? '#f0fdf4' : '#fff1f2',
            border: `1px solid ${isWorking ? '#bbf7d0' : '#fecdd3'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: isWorking ? '#166534' : '#9f1239' }}>
                Institutional Classification
              </div>
              <div style={{ fontSize: '0.98rem', fontWeight: 800, color: isWorking ? '#15803d' : '#e11d48', marginTop: '2px' }}>
                {dayData.day_type || (isWorking ? 'Normal Working Day' : 'Holiday / School Closed')}
              </div>
            </div>
            <span style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              padding: '4px 10px',
              borderRadius: '20px',
              backgroundColor: isWorking ? '#dcfce7' : '#ffe4e6',
              color: isWorking ? '#15803d' : '#be123c'
            }}>
              {isWorking ? 'Staff Active' : 'Classes Suspended'}
            </span>
          </div>

          {/* Events on this date */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.74rem', fontWeight: 700, textTransform: 'uppercase', color: '#94a3b8' }}>
                Scheduled School Events ({events.length})
              </span>
              {canManage && (
                <button
                  type="button"
                  className="btn btn-ghost btn-xs"
                  style={{ color: '#2563eb', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                  onClick={() => {
                    onClose();
                    if (onAddEventOnDate) onAddEventOnDate(dayData.date);
                  }}
                >
                  <Plus size={13} />
                  <span>Add Event on Date</span>
                </button>
              )}
            </div>

            {events.length === 0 ? (
              <div style={{
                padding: '18px',
                textAlign: 'center',
                backgroundColor: '#f8fafc',
                borderRadius: '8px',
                border: '1px dashed #e2e8f0',
                color: '#64748b',
                fontSize: '0.84rem'
              }}>
                Regular school schedule in effect. No special institutional events scheduled for this date.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {events.map((ev, idx) => {
                  const isHoliday = ev.event_type === 'Holiday';
                  const isClosure = ev.event_type === 'School Closure';
                  const isNonInst = ev.event_type === 'Non-Instructional';
                  const isOverride = ev.event_type === 'Working Day Override';

                  let badgeColor = '#3b82f6';
                  let badgeBg = '#eff6ff';
                  if (isHoliday) { badgeColor = '#dc2626'; badgeBg = '#fef2f2'; }
                  else if (isClosure) { badgeColor = '#e11d48'; badgeBg = '#fff1f2'; }
                  else if (isNonInst) { badgeColor = '#7c3aed'; badgeBg = '#f5f3ff'; }
                  else if (isOverride) { badgeColor = '#059669'; badgeBg = '#ecfdf5'; }

                  return (
                    <div 
                      key={ev.id || idx}
                      style={{
                        padding: '12px 14px',
                        backgroundColor: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        borderLeft: `4px solid ${badgeColor}`
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a' }}>
                          {ev.title}
                        </div>
                        <span style={{
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '12px',
                          backgroundColor: badgeBg,
                          color: badgeColor,
                          whiteSpace: 'nowrap'
                        }}>
                          {ev.event_type}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '6px', fontSize: '0.78rem', color: '#64748b', flexWrap: 'wrap' }}>
                        <span>Category: <strong>{ev.category || 'Public Holiday'}</strong></span>
                        {ev.start_time && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#1e293b', fontWeight: 600 }}>
                            <Clock size={12} style={{ color: '#64748b' }} />
                            {ev.start_time}{ev.end_time ? ` – ${ev.end_time}` : ''}
                          </span>
                        )}
                        {ev.total_days > 1 && (
                          <span>Duration: <strong>{ev.total_days} Days</strong></span>
                        )}
                      </div>

                      {ev.description && (
                        <p style={{ margin: '6px 0 0', fontSize: '0.8rem', color: '#475569', lineHeight: 1.4 }}>
                          {ev.description.replace(/\[INCLUDE_SATURDAY\]|\[INCLUDES_SATURDAY\]|\[INCLUDE_SUNDAY\]|\[INCLUDES_SUNDAY\]/g, '').trim()}
                        </p>
                      )}

                      {canManage && (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', marginTop: '10px', paddingTop: '8px', borderTop: '1px solid #f1f5f9' }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-xs"
                            onClick={() => {
                              onClose();
                              if (onEditEvent) onEditEvent(ev);
                            }}
                            style={{ fontSize: '0.75rem', padding: '3px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}
                            title="Edit this event"
                          >
                            <Edit size={12} />
                            <span>Edit Event</span>
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-xs"
                            onClick={() => {
                              onClose();
                              if (onDeleteEvent) onDeleteEvent(ev);
                            }}
                            style={{ fontSize: '0.75rem', padding: '3px 8px', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '4px' }}
                            title="Delete this event"
                          >
                            <Trash2 size={12} />
                            <span>Delete</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="apply-leave-footer" style={{ padding: '12px 20px' }}>
          <button
            type="button"
            className="btn btn-secondary apply-leave-cancel-btn"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default DayDetailModal;
