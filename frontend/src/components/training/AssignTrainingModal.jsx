import React, { useState, useEffect } from 'react';
import { X, Users, Building2, Award, Search, Check, AlertCircle, UserPlus } from 'lucide-react';
import { hrmsApi } from '../../services/api';
import { StaffAvatar } from '../common/StaffAvatar';
import { LoadingSpinner } from '../common/LoadingSpinner';

export function AssignTrainingModal({ 
  isOpen, 
  onClose, 
  onAssigned, 
  trainingProgram, 
  departments = [] 
}) {
  const [assignmentMode, setAssignmentMode] = useState('individual'); // 'individual' | 'department' | 'designation'
  const [employees, setEmployees] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(true);

  // Selections
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState(new Set());
  const [selectedDepartmentId, setSelectedDepartmentId] = useState('');
  const [selectedDesignationId, setSelectedDesignationId] = useState('');
  const [searchFilter, setSearchFilter] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  useEffect(() => {
    async function loadData() {
      setIsLoadingEmployees(true);
      try {
        const [empRes, desigRes] = await Promise.all([
          hrmsApi.getEmployees({ limit: 100 }),
          hrmsApi.getDesignations()
        ]);
        if (empRes && empRes.success) {
          setEmployees(empRes.data || []);
        }
        if (desigRes && desigRes.success) {
          setDesignations(desigRes.data || []);
        }
      } catch (err) {
        console.error('Error fetching employees for training assignment:', err);
      } finally {
        setIsLoadingEmployees(false);
      }
    }

    if (isOpen) {
      loadData();
      setSelectedEmployeeIds(new Set());
      setSelectedDepartmentId('');
      setSelectedDesignationId('');
      setSearchFilter('');
      setErrorMessage(null);
    }
  }, [isOpen]);

  const toggleEmployee = (id) => {
    setSelectedEmployeeIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllFiltered = (filtered) => {
    setSelectedEmployeeIds(prev => {
      const next = new Set(prev);
      const allSelected = filtered.every(e => next.has(e.id));
      if (allSelected) {
        filtered.forEach(e => next.delete(e.id));
      } else {
        filtered.forEach(e => next.add(e.id));
      }
      return next;
    });
  };

  const filteredEmployees = employees.filter(e => {
    if (searchFilter) {
      const term = searchFilter.toLowerCase();
      const name = `${e.first_name || ''} ${e.last_name || ''}`.toLowerCase();
      const code = (e.employee_code || '').toLowerCase();
      const dept = (e.department_name || e.department || '').toLowerCase();
      if (!name.includes(term) && !code.includes(term) && !dept.includes(term)) {
        return false;
      }
    }
    return true;
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!trainingProgram?.id) return;

    let payload = {
      enrollment_type: assignmentMode === 'department' ? 'Department-wide' : assignmentMode === 'designation' ? 'Designation-wide' : 'Individual',
      enrollment_status: 'Assigned'
    };

    if (assignmentMode === 'individual') {
      if (selectedEmployeeIds.size === 0) {
        setErrorMessage('Please select at least one employee from the list.');
        return;
      }
      payload.employee_ids = Array.from(selectedEmployeeIds);
    } else if (assignmentMode === 'department') {
      if (!selectedDepartmentId) {
        setErrorMessage('Please choose a department.');
        return;
      }
      payload.department_id = selectedDepartmentId;
    } else if (assignmentMode === 'designation') {
      if (!selectedDesignationId) {
        setErrorMessage('Please choose a designation.');
        return;
      }
      payload.designation_id = selectedDesignationId;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await hrmsApi.enrollTrainingParticipants(trainingProgram.id, payload);
      if (res && res.success) {
        if (onAssigned) onAssigned(res);
        onClose();
      } else {
        setErrorMessage(res?.message || 'Failed to assign participants.');
      }
    } catch (err) {
      console.error('Error assigning employees to training:', err);
      setErrorMessage(err.message || 'Error occurred while enrolling employees.');
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
        style={{ maxWidth: '680px' }}
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
              <UserPlus size={20} />
            </div>
            <div>
              <h2 className="modal-title" style={{ margin: 0 }}>
                Enroll Faculty in Training
              </h2>
              <span className="text-muted text-xs">
                Program: <strong style={{ color: 'var(--color-primary)' }}>{trainingProgram?.title}</strong>
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
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {errorMessage && (
              <div style={{ padding: '10px 14px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#991b1b', fontSize: '0.84rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertCircle size={16} />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Assignment Strategy Selector */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#334155' }}>
                Assignment Mode:
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                <button
                  type="button"
                  className={`btn btn-sm ${assignmentMode === 'individual' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setAssignmentMode('individual')}
                  style={{ gap: '6px', fontSize: '0.82rem' }}
                >
                  <Users size={14} />
                  <span>Select Individuals</span>
                </button>

                <button
                  type="button"
                  className={`btn btn-sm ${assignmentMode === 'department' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setAssignmentMode('department')}
                  style={{ gap: '6px', fontSize: '0.82rem' }}
                >
                  <Building2 size={14} />
                  <span>By Department</span>
                </button>

                <button
                  type="button"
                  className={`btn btn-sm ${assignmentMode === 'designation' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setAssignmentMode('designation')}
                  style={{ gap: '6px', fontSize: '0.82rem' }}
                >
                  <Award size={14} />
                  <span>By Role / Desig</span>
                </button>
              </div>
            </div>

            {/* Mode 1: Individual Selection */}
            {assignmentMode === 'individual' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Search staff by name, employee code, or department..."
                      value={searchFilter}
                      onChange={(e) => setSearchFilter(e.target.value)}
                      style={{ paddingLeft: '32px', height: '34px', fontSize: '0.82rem' }}
                    />
                  </div>

                  <button
                    type="button"
                    className="btn btn-ghost btn-xs"
                    onClick={() => selectAllFiltered(filteredEmployees)}
                    style={{ fontSize: '0.78rem', color: '#3155D9', fontWeight: 600 }}
                  >
                    {filteredEmployees.every(e => selectedEmployeeIds.has(e.id)) ? 'Deselect All' : 'Select All Filtered'}
                  </button>
                </div>

                <div style={{
                  maxHeight: '260px',
                  overflowY: 'auto',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  backgroundColor: '#ffffff'
                }}>
                  {isLoadingEmployees ? (
                    <div style={{ padding: '30px', textAlign: 'center' }}>
                      <LoadingSpinner text="Loading faculty list..." size={22} />
                    </div>
                  ) : filteredEmployees.length === 0 ? (
                    <div style={{ padding: '30px', textAlign: 'center', color: '#64748b', fontSize: '0.84rem' }}>
                      No faculty members found matching your search.
                    </div>
                  ) : (
                    filteredEmployees.map((emp) => {
                      const isSelected = selectedEmployeeIds.has(emp.id);
                      return (
                        <div
                          key={emp.id}
                          onClick={() => toggleEmployee(emp.id)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '9px 14px',
                            borderBottom: '1px solid #f1f5f9',
                            cursor: 'pointer',
                            backgroundColor: isSelected ? '#f0fdf4' : 'transparent',
                            transition: 'background-color 0.15s ease'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              style={{ width: '15px', height: '15px', cursor: 'pointer' }}
                            />
                            <StaffAvatar
                              firstName={emp.first_name}
                              lastName={emp.last_name}
                              photoUrl={emp.profile_photo_url}
                              size="sm"
                            />
                            <div>
                              <div style={{ fontSize: '0.86rem', fontWeight: 600, color: '#0f172a' }}>
                                {emp.first_name} {emp.last_name}
                              </div>
                              <div style={{ fontSize: '0.74rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span className="text-monospace font-bold">{emp.employee_code}</span>
                                <span>•</span>
                                <span>{emp.designation_name || emp.designation || 'Staff'}</span>
                              </div>
                            </div>
                          </div>

                          <span style={{ fontSize: '0.74rem', color: '#475569', fontWeight: 500 }}>
                            {emp.department_name || emp.department || 'General'}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>

                <div style={{ fontSize: '0.78rem', color: '#64748b', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Showing {filteredEmployees.length} staff members</span>
                  <span style={{ fontWeight: 600, color: '#3155D9' }}>{selectedEmployeeIds.size} Selected</span>
                </div>
              </div>
            )}

            {/* Mode 2: Department-wide Selection */}
            {assignmentMode === 'department' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#334155' }}>
                  Select School Department:
                </label>
                <select
                  className="form-control"
                  value={selectedDepartmentId}
                  onChange={(e) => setSelectedDepartmentId(e.target.value)}
                  required
                >
                  <option value="">-- Choose Department --</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
                <span style={{ fontSize: '0.76rem', color: '#64748b' }}>
                  All active teaching and administrative staff assigned to this department will be automatically enrolled.
                </span>
              </div>
            )}

            {/* Mode 3: Designation / Role-wide Selection */}
            {assignmentMode === 'designation' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#334155' }}>
                  Select Job Position / Designation:
                </label>
                <select
                  className="form-control"
                  value={selectedDesignationId}
                  onChange={(e) => setSelectedDesignationId(e.target.value)}
                  required
                >
                  <option value="">-- Choose Designation --</option>
                  {designations.map((des) => (
                    <option key={des.id} value={des.id}>
                      {des.name} ({des.department_name || 'All Wings'})
                    </option>
                  ))}
                </select>
                <span style={{ fontSize: '0.76rem', color: '#64748b' }}>
                  All faculty members holding this specific position will be assigned to this session.
                </span>
              </div>
            )}
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
            >
              {isSubmitting ? 'Enrolling...' : 'Confirm Enrollment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AssignTrainingModal;
