import React, { useState, useEffect } from 'react';
import { X, Award, AlertCircle, Save, Calendar, Building2, User } from 'lucide-react';
import { hrmsApi } from '../../services/api';

export function AddCertificateModal({ 
  isOpen, 
  onClose, 
  onSaved, 
  initialEmployee = null, 
  initialProgram = null,
  initialCertificate = null 
}) {
  const isEditing = Boolean(initialCertificate?.id);

  const [employees, setEmployees] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [isLoadingMeta, setIsLoadingMeta] = useState(false);

  const [formData, setFormData] = useState({
    employee_id: '',
    training_id: '',
    certificate_name: '',
    certificate_number: '',
    training_provider: '',
    issue_date: new Date().toISOString().split('T')[0],
    expiry_date: '',
    document_reference: '',
    status: 'Active'
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  useEffect(() => {
    async function loadMeta() {
      setIsLoadingMeta(true);
      try {
        const [empRes, progRes] = await Promise.all([
          hrmsApi.getEmployees({ limit: 100 }),
          hrmsApi.getTrainingPrograms()
        ]);
        if (empRes && empRes.success) setEmployees(empRes.data || []);
        if (progRes && progRes.success) setPrograms(progRes.data || []);
      } catch (err) {
        console.error('Error loading metadata for certificate modal:', err);
      } finally {
        setIsLoadingMeta(false);
      }
    }

    if (isOpen) {
      loadMeta();
      if (initialCertificate) {
        setFormData({
          employee_id: initialCertificate.employee_id || '',
          training_id: initialCertificate.training_id || '',
          certificate_name: initialCertificate.certificate_name || '',
          certificate_number: initialCertificate.certificate_number || '',
          training_provider: initialCertificate.training_provider || '',
          issue_date: initialCertificate.issue_date ? initialCertificate.issue_date.split('T')[0] : '',
          expiry_date: initialCertificate.expiry_date ? initialCertificate.expiry_date.split('T')[0] : '',
          document_reference: initialCertificate.document_reference || '',
          status: initialCertificate.status || 'Active'
        });
      } else {
        const defaultCertName = initialProgram?.title 
          ? `Certificate of Completion: ${initialProgram.title}` 
          : 'Certificate of Professional Development';

        setFormData({
          employee_id: initialEmployee?.employee_id || initialEmployee?.id || '',
          training_id: initialProgram?.id || '',
          certificate_name: defaultCertName,
          certificate_number: `SV-CPD-${Date.now().toString().slice(-6)}`,
          training_provider: initialProgram?.training_provider || "St. Vincent's Academy",
          issue_date: new Date().toISOString().split('T')[0],
          expiry_date: '',
          document_reference: '',
          status: 'Active'
        });
      }
      setErrorMessage(null);
    }
  }, [isOpen, initialEmployee, initialProgram, initialCertificate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.employee_id || !formData.certificate_name.trim() || !formData.issue_date) {
      setErrorMessage('Employee, Certificate Name, and Issue Date are required.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const payload = {
        ...formData,
        training_id: formData.training_id || null,
        expiry_date: formData.expiry_date || null
      };

      let res;
      if (isEditing) {
        res = await hrmsApi.updateTrainingCertificate(initialCertificate.id, payload);
      } else {
        res = await hrmsApi.recordTrainingCertificate(payload);
      }

      if (res && res.success) {
        if (onSaved) onSaved(res.data);
        onClose();
      } else {
        setErrorMessage(res?.message || 'Failed to save certificate record.');
      }
    } catch (err) {
      console.error('Error saving certificate:', err);
      setErrorMessage(err.message || 'Error occurred while saving certificate.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div 
        className="modal-container" 
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '600px' }}
      >
        {/* Modal Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              backgroundColor: '#fef3c7',
              color: '#d97706',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Award size={20} />
            </div>
            <div>
              <h2 className="modal-title" style={{ margin: 0 }}>
                {isEditing ? 'Edit Certificate Record' : 'Record Professional Certificate'}
              </h2>
              <span className="text-muted text-xs">
                Log institutional or external certification for faculty HR records.
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
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {errorMessage && (
              <div style={{ padding: '10px 14px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#991b1b', fontSize: '0.84rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertCircle size={16} />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Recipient Employee */}
            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 600, fontSize: '0.82rem' }}>
                Recipient Staff Member <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <select
                className="form-control"
                value={formData.employee_id}
                onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                required
              >
                <option value="">-- Select Faculty Member --</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.first_name} {emp.last_name} ({emp.employee_code} - {emp.department_name || 'Staff'})
                  </option>
                ))}
              </select>
            </div>

            {/* Linked Training Program (Optional) */}
            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 600, fontSize: '0.82rem' }}>
                Associated Training Program (Optional)
              </label>
              <select
                className="form-control"
                value={formData.training_id}
                onChange={(e) => {
                  const selectedId = e.target.value;
                  const prog = programs.find(p => p.id === selectedId);
                  setFormData({
                    ...formData,
                    training_id: selectedId,
                    certificate_name: prog ? `Certificate of Completion: ${prog.title}` : formData.certificate_name,
                    training_provider: prog?.training_provider || formData.training_provider
                  });
                }}
              >
                <option value="">-- None (External / Independent Certification) --</option>
                {programs.map((prog) => (
                  <option key={prog.id} value={prog.id}>
                    {prog.title} ({prog.training_type})
                  </option>
                ))}
              </select>
            </div>

            {/* Certificate Name */}
            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 600, fontSize: '0.82rem' }}>
                Certificate Title / Credential Name <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. First Aid & CPR Responder Certification"
                value={formData.certificate_name}
                onChange={(e) => setFormData({ ...formData, certificate_name: e.target.value })}
                required
              />
            </div>

            {/* Certificate Number & Provider */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600, fontSize: '0.82rem' }}>
                  Certificate / Registration Number
                </label>
                <input
                  type="text"
                  className="form-control text-monospace"
                  placeholder="e.g. CERT-2026-0842"
                  value={formData.certificate_number}
                  onChange={(e) => setFormData({ ...formData, certificate_number: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600, fontSize: '0.82rem' }}>
                  Issuing Provider / Organization
                </label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Red Cross / CBSE / St. John Ambulance"
                  value={formData.training_provider}
                  onChange={(e) => setFormData({ ...formData, training_provider: e.target.value })}
                />
              </div>
            </div>

            {/* Issue Date, Expiry Date & Status */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600, fontSize: '0.82rem' }}>
                  Issue Date <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="date"
                  className="form-control"
                  value={formData.issue_date}
                  onChange={(e) => setFormData({ ...formData, issue_date: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600, fontSize: '0.82rem' }}>
                  Expiry Date (If applicable)
                </label>
                <input
                  type="date"
                  className="form-control"
                  value={formData.expiry_date}
                  onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600, fontSize: '0.82rem' }}>
                  Status
                </label>
                <select
                  className="form-control"
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                >
                  <option value="Active">Active</option>
                  <option value="Expired">Expired</option>
                  <option value="Revoked">Revoked</option>
                </select>
              </div>
            </div>

            {/* Document Reference */}
            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 600, fontSize: '0.82rem' }}>
                Document Reference / Verification Number
              </label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Verification URL, HR Audit Filing ID, or Archive Reference"
                value={formData.document_reference}
                onChange={(e) => setFormData({ ...formData, document_reference: e.target.value })}
              />
              <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
                Stored as an audit reference in compliance with institutional records.
              </span>
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
              <span>{isSubmitting ? 'Saving...' : isEditing ? 'Update Record' : 'Record Certificate'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddCertificateModal;
