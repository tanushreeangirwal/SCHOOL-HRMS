import React, { useState, useEffect } from 'react';
import { X, GraduationCap, Calendar, Clock, MapPin, Users, Award, AlertCircle, Save } from 'lucide-react';
import { hrmsApi } from '../../services/api';

export function AddEditTrainingModal({ isOpen, onClose, onSaved, initialProgram = null, departments = [] }) {
  const isEditing = Boolean(initialProgram?.id);

  const [formData, setFormData] = useState({
    title: '',
    category: 'Pedagogy & Classroom Management',
    description: '',
    trainer_name: '',
    training_provider: '',
    training_type: 'Workshop',
    start_date: '',
    end_date: '',
    start_time: '09:30',
    end_time: '12:30',
    duration_hours: '4',
    location_type: 'On-Campus',
    location_venue: 'Main Auditorium',
    max_participants: '30',
    target_audience: 'All Teaching Faculty',
    department_id: '',
    status: 'Upcoming',
    sync_calendar: true
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  useEffect(() => {
    if (initialProgram) {
      setFormData({
        title: initialProgram.title || '',
        category: initialProgram.category || 'Pedagogy & Classroom Management',
        description: initialProgram.description || '',
        trainer_name: initialProgram.trainer_name || '',
        training_provider: initialProgram.training_provider || '',
        training_type: initialProgram.training_type || 'Workshop',
        start_date: initialProgram.start_date ? initialProgram.start_date.split('T')[0] : '',
        end_date: initialProgram.end_date ? initialProgram.end_date.split('T')[0] : '',
        start_time: initialProgram.start_time || '09:30',
        end_time: initialProgram.end_time || '12:30',
        duration_hours: initialProgram.duration_hours?.toString() || '4',
        location_type: initialProgram.location_type || 'On-Campus',
        location_venue: initialProgram.location_venue || '',
        max_participants: initialProgram.max_participants?.toString() || '0',
        target_audience: initialProgram.target_audience || 'All Teaching Faculty',
        department_id: initialProgram.department_id || '',
        status: initialProgram.status || 'Upcoming',
        sync_calendar: initialProgram.sync_calendar !== false
      });
    } else {
      // Default dates for new training: next week
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      const nextWeekEnd = new Date(nextWeek);
      nextWeekEnd.setDate(nextWeekEnd.getDate() + 1);

      setFormData({
        title: '',
        category: 'Pedagogy & Classroom Management',
        description: '',
        trainer_name: '',
        training_provider: "St. Vincent's Centre of Excellence",
        training_type: 'Workshop',
        start_date: nextWeek.toISOString().split('T')[0],
        end_date: nextWeekEnd.toISOString().split('T')[0],
        start_time: '09:30',
        end_time: '13:00',
        duration_hours: '4.0',
        location_type: 'On-Campus',
        location_venue: 'Main Auditorium (Block B)',
        max_participants: '35',
        target_audience: 'Teaching Faculty',
        department_id: '',
        status: 'Upcoming',
        sync_calendar: true
      });
    }
  }, [initialProgram, isOpen]);

  const schoolCategories = [
    'Pedagogy & Classroom Management',
    'Child Safeguarding & Safety',
    'NEP & Curriculum',
    'First Aid & Health',
    'Digital Teaching Tools',
    'Leadership & Administration',
    'Examination & Assessment',
    'Inclusive Education'
  ];

  const trainingTypes = [
    'Workshop',
    'Seminar',
    'Webinar',
    'Certification',
    'Internal',
    'External'
  ];

  const statuses = [
    'Planned',
    'Upcoming',
    'Ongoing',
    'Completed',
    'Cancelled'
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.trainer_name.trim() || !formData.start_date || !formData.end_date) {
      setErrorMessage('Please fill in all required fields (Title, Trainer Name, Start Date, End Date).');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const payload = {
        ...formData,
        duration_hours: parseFloat(formData.duration_hours) || 1.0,
        max_participants: parseInt(formData.max_participants, 10) || 0,
        department_id: formData.department_id || null
      };

      let res;
      if (isEditing) {
        res = await hrmsApi.updateTrainingProgram(initialProgram.id, payload);
      } else {
        res = await hrmsApi.createTrainingProgram(payload);
      }

      if (res && res.success) {
        if (onSaved) onSaved(res.data);
        onClose();
      } else {
        setErrorMessage(res?.message || 'Failed to save training program.');
      }
    } catch (err) {
      console.error('Error saving training program:', err);
      setErrorMessage(err.message || 'Error occurred while saving program.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div 
        className="modal-container modal-lg" 
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '720px' }}
      >
        {/* Modal Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              backgroundColor: '#eff6ff',
              color: 'var(--color-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <GraduationCap size={20} />
            </div>
            <div>
              <h2 className="modal-title" style={{ margin: 0 }}>
                {isEditing ? 'Edit Training Program' : 'Schedule New Training Program'}
              </h2>
              <span className="text-muted text-xs">
                Plan and configure professional development modules for faculty and staff.
              </span>
            </div>
          </div>
          <button 
            type="button" 
            className="modal-close-btn" 
            onClick={onClose}
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '72vh', overflowY: 'auto' }}>
            {errorMessage && (
              <div style={{
                padding: '10px 14px',
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '8px',
                color: '#991b1b',
                fontSize: '0.84rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <AlertCircle size={16} />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Row 1: Title & Category */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600, fontSize: '0.82rem' }}>
                  Training Title <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Classroom Management & Positive Discipline"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600, fontSize: '0.82rem' }}>
                  Training Category <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select
                  className="form-control"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  required
                >
                  {schoolCategories.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Row 2: Description */}
            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 600, fontSize: '0.82rem' }}>
                Course Description & Learning Outcomes
              </label>
              <textarea
                className="form-control"
                rows={2}
                placeholder="Key competencies covered, instructional goals, and materials required..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            {/* Row 3: Trainer & Training Provider */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600, fontSize: '0.82rem' }}>
                  Trainer / Lead Facilitator <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Dr. Sudha Ramachandran"
                  value={formData.trainer_name}
                  onChange={(e) => setFormData({ ...formData, trainer_name: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600, fontSize: '0.82rem' }}>
                  Training Provider / Organization
                </label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. CBSE Centre of Excellence / NCERT"
                  value={formData.training_provider}
                  onChange={(e) => setFormData({ ...formData, training_provider: e.target.value })}
                />
              </div>
            </div>

            {/* Row 4: Training Type, Status, Duration Hours */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600, fontSize: '0.82rem' }}>
                  Training Type <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select
                  className="form-control"
                  value={formData.training_type}
                  onChange={(e) => setFormData({ ...formData, training_type: e.target.value })}
                >
                  {trainingTypes.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600, fontSize: '0.82rem' }}>
                  Status <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select
                  className="form-control"
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                >
                  {statuses.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600, fontSize: '0.82rem' }}>
                  Duration (Hours) <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  max="120"
                  className="form-control"
                  value={formData.duration_hours}
                  onChange={(e) => setFormData({ ...formData, duration_hours: e.target.value })}
                  required
                />
              </div>
            </div>

            {/* Row 5: Schedule Dates & Times */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600, fontSize: '0.82rem' }}>
                  Start Date <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="date"
                  className="form-control"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600, fontSize: '0.82rem' }}>
                  End Date <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="date"
                  className="form-control"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600, fontSize: '0.82rem' }}>
                  Start Time
                </label>
                <input
                  type="time"
                  className="form-control"
                  value={formData.start_time}
                  onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600, fontSize: '0.82rem' }}>
                  End Time
                </label>
                <input
                  type="time"
                  className="form-control"
                  value={formData.end_time}
                  onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                />
              </div>
            </div>

            {/* Row 6: Location & Max Capacity */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600, fontSize: '0.82rem' }}>
                  Location Type
                </label>
                <select
                  className="form-control"
                  value={formData.location_type}
                  onChange={(e) => setFormData({ ...formData, location_type: e.target.value })}
                >
                  <option value="On-Campus">On-Campus</option>
                  <option value="Online">Online / Virtual</option>
                  <option value="Hybrid">Hybrid</option>
                  <option value="Off-Campus">Off-Campus Venue</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600, fontSize: '0.82rem' }}>
                  Venue / Room / Link
                </label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Auditorium / AV Room 2 / Zoom URL"
                  value={formData.location_venue}
                  onChange={(e) => setFormData({ ...formData, location_venue: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600, fontSize: '0.82rem' }}>
                  Max Capacity (0 = Unlimited)
                </label>
                <input
                  type="number"
                  min="0"
                  max="1000"
                  className="form-control"
                  value={formData.max_participants}
                  onChange={(e) => setFormData({ ...formData, max_participants: e.target.value })}
                />
              </div>
            </div>

            {/* Row 7: Department & Target Audience */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600, fontSize: '0.82rem' }}>
                  Target Department
                </label>
                <select
                  className="form-control"
                  value={formData.department_id}
                  onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
                >
                  <option value="">All Departments (Institutional)</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600, fontSize: '0.82rem' }}>
                  Target Faculty / Audience
                </label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Primary Teachers, HODs, Lab Techs"
                  value={formData.target_audience}
                  onChange={(e) => setFormData({ ...formData, target_audience: e.target.value })}
                />
              </div>
            </div>

            {/* Row 8: Sync Calendar Checkbox */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 14px',
              backgroundColor: '#f8fafc',
              borderRadius: '8px',
              border: '1px solid #e2e8f0'
            }}>
              <input
                type="checkbox"
                id="sync_calendar_chk"
                checked={formData.sync_calendar}
                onChange={(e) => setFormData({ ...formData, sync_calendar: e.target.checked })}
                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
              />
              <label htmlFor="sync_calendar_chk" style={{ fontSize: '0.84rem', color: '#334155', cursor: 'pointer', margin: 0 }}>
                Synchronize schedule with institutional HRMS Academic Calendar
              </label>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="modal-footer">
            <button 
              type="button" 
              className="btn btn-secondary" 
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="btn btn-primary" 
              disabled={isSubmitting}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Save size={15} />
              <span>{isSubmitting ? 'Saving...' : isEditing ? 'Update Program' : 'Schedule Program'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddEditTrainingModal;
