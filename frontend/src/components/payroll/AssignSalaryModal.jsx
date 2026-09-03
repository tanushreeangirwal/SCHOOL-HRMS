import React, { useState, useEffect } from 'react';
import { 
  X, 
  DollarSign, 
  Layers, 
  User, 
  Calendar, 
  AlertCircle, 
  CheckCircle2, 
  Loader2,
  ShieldCheck,
  Calculator
} from 'lucide-react';
import { hrmsApi } from '../../services/api';

export function AssignSalaryModal({ 
  isOpen, 
  onClose, 
  onAssigned, 
  initialEmployee = null,
  structures = [],
  employees = []
}) {
  const [employeeId, setEmployeeId] = useState(initialEmployee?.id || initialEmployee?.employee_id || '');
  const [salaryStructureId, setSalaryStructureId] = useState('');
  const [monthlyGross, setMonthlyGross] = useState('');
  const [annualCtc, setAnnualCtc] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().split('T')[0]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Available structures list if not passed via props
  const [availableStructures, setAvailableStructures] = useState(structures);
  const [availableEmployees, setAvailableEmployees] = useState(employees);

  useEffect(() => {
    if (isOpen) {
      if (initialEmployee) {
        setEmployeeId(initialEmployee.id || initialEmployee.employee_id || '');
        if (initialEmployee.salary_structure_id) {
          setSalaryStructureId(initialEmployee.salary_structure_id);
        }
        if (initialEmployee.monthly_gross) {
          setMonthlyGross(String(initialEmployee.monthly_gross));
          setAnnualCtc(String(Number(initialEmployee.monthly_gross) * 12));
        }
        if (initialEmployee.salary_effective_from || initialEmployee.effective_from) {
          setEffectiveFrom(initialEmployee.salary_effective_from || initialEmployee.effective_from);
        }
      }
      loadInitialData();
    }
  }, [isOpen, initialEmployee]);

  const loadInitialData = async () => {
    try {
      if (availableStructures.length === 0) {
        const sRes = await hrmsApi.getSalaryStructures();
        if (sRes?.success) setAvailableStructures(sRes.data);
      }
      if (availableEmployees.length === 0) {
        const eRes = await hrmsApi.getEmployees({ status: 'Active' });
        if (eRes?.success) setAvailableEmployees(eRes.data);
      }
    } catch (err) {
      console.error('Error fetching data for salary assignment:', err);
    }
  };

  // Auto-fill structure recommendation based on selected employee
  const handleEmployeeChange = (id) => {
    setEmployeeId(id);
    const emp = availableEmployees.find(e => e.id === id);
    if (emp) {
      const isFaculty = (emp.department_name || '').toLowerCase().includes('academic') || 
                        (emp.designation_name || '').toLowerCase().includes('teacher') ||
                        (emp.designation_name || '').toLowerCase().includes('faculty');
      
      const matchedStruct = availableStructures.find(s => 
        isFaculty ? s.code === 'FACULTY_STANDARD' : s.code === 'ADMIN_STANDARD'
      );
      if (matchedStruct && !salaryStructureId) {
        setSalaryStructureId(matchedStruct.id);
      }
      if (emp.monthly_gross) {
        setMonthlyGross(String(emp.monthly_gross));
        setAnnualCtc(String(Number(emp.monthly_gross) * 12));
      }
    }
  };

  const handleMonthlyGrossChange = (val) => {
    setMonthlyGross(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num > 0) {
      setAnnualCtc(String(Math.round(num * 12)));
    } else {
      setAnnualCtc('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!employeeId) {
      setError('Please select an employee.');
      return;
    }
    if (!salaryStructureId) {
      setError('Please choose a salary structure.');
      return;
    }
    if (!monthlyGross || parseFloat(monthlyGross) <= 0) {
      setError('Please specify a valid monthly base gross salary (₹).');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        employee_id: employeeId,
        salary_structure_id: salaryStructureId,
        monthly_gross: parseFloat(monthlyGross),
        annual_ctc: parseFloat(annualCtc) || (parseFloat(monthlyGross) * 12),
        effective_from: effectiveFrom || new Date().toISOString().split('T')[0]
      };

      const res = await hrmsApi.assignEmployeeSalary(payload);
      if (res && res.success) {
        setSuccessMsg(res.message || 'Salary structure successfully assigned.');
        setTimeout(() => {
          if (onAssigned) onAssigned(res.data);
          onClose();
        }, 900);
      } else {
        setError(res.message || 'Failed to assign salary structure.');
      }
    } catch (err) {
      setError(err.message || 'An error occurred assigning salary structure.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop active" onClick={onClose}>
      <div 
        className="modal-container"
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: '560px',
          width: '95%',
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 22px',
          borderBottom: '1px solid #e2e8f0',
          backgroundColor: '#f8fafc'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <DollarSign size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                Assign Salary Structure
              </h3>
              <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '2px 0 0' }}>
                St. Vincent's High School Remuneration Registry
              </p>
            </div>
          </div>

          <button
            type="button"
            className="btn-close"
            onClick={onClose}
            aria-label="Close"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#64748b' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '22px' }}>
          {error && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 14px',
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '8px',
              color: '#dc2626',
              fontSize: '0.82rem',
              marginBottom: '16px'
            }}>
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 14px',
              backgroundColor: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: '8px',
              color: '#166534',
              fontSize: '0.82rem',
              marginBottom: '16px'
            }}>
              <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* 1. Employee Selection */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                Staff / Faculty Member <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <select
                className="form-control"
                value={employeeId}
                onChange={e => handleEmployeeChange(e.target.value)}
                disabled={isSaving || (initialEmployee && initialEmployee.id)}
                style={{ width: '100%', height: '40px', fontSize: '0.86rem' }}
                required
              >
                <option value="">-- Choose Employee --</option>
                {availableEmployees.map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {emp.employee_code} • {emp.first_name} {emp.last_name} ({emp.department_name || 'Academic'})
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Salary Structure Selection */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                Applicable Salary Structure <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <select
                className="form-control"
                value={salaryStructureId}
                onChange={e => setSalaryStructureId(e.target.value)}
                disabled={isSaving}
                style={{ width: '100%', height: '40px', fontSize: '0.86rem' }}
                required
              >
                <option value="">-- Choose Structure Template --</option>
                {availableStructures.map(struct => (
                  <option key={struct.id} value={struct.id}>
                    {struct.name} ({struct.code})
                  </option>
                ))}
              </select>
            </div>

            {/* 3. Monthly Gross & Annual CTC */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Monthly Base Gross (₹) <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', fontWeight: 700 }}>
                    ₹
                  </span>
                  <input
                    type="number"
                    step="100"
                    min="1000"
                    className="form-control"
                    placeholder="e.g. 54000"
                    value={monthlyGross}
                    onChange={e => handleMonthlyGrossChange(e.target.value)}
                    disabled={isSaving}
                    style={{ paddingLeft: '28px', height: '40px', fontSize: '0.88rem' }}
                    required
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Annual CTC (₹)
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', fontWeight: 700 }}>
                    ₹
                  </span>
                  <input
                    type="number"
                    step="100"
                    className="form-control"
                    placeholder="e.g. 648000"
                    value={annualCtc}
                    onChange={e => setAnnualCtc(e.target.value)}
                    disabled={isSaving}
                    style={{ paddingLeft: '28px', height: '40px', fontSize: '0.88rem', backgroundColor: '#f8fafc' }}
                  />
                </div>
              </div>
            </div>

            {/* 4. Effective Date */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                Effective From Date <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="date"
                className="form-control"
                value={effectiveFrom}
                onChange={e => setEffectiveFrom(e.target.value)}
                disabled={isSaving}
                style={{ width: '100%', height: '40px', fontSize: '0.86rem' }}
                required
              />
            </div>

            {/* Policy Info */}
            <div style={{
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '10px 12px',
              fontSize: '0.76rem',
              color: '#64748b',
              marginBottom: '20px'
            }}>
              Assigning a new structure automatically closes any previous active salary record for this employee and applies the new components (Basic, HRA, PF, PT, TDS) to upcoming monthly payroll runs.
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary btn-md"
                onClick={onClose}
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary btn-md"
                disabled={isSaving}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
              >
                {isSaving ? (
                  <>
                    <Loader2 size={16} className="spin-animation" />
                    <span>Assigning Salary...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck size={16} />
                    <span>Save Salary Assignment</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default AssignSalaryModal;
