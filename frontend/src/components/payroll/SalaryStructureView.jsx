import React, { useState, useEffect } from 'react';
import { 
  Layers, 
  DollarSign, 
  Users, 
  Plus, 
  Check, 
  AlertCircle, 
  ShieldCheck, 
  Percent, 
  Building2,
  FileText
} from 'lucide-react';
import { hrmsApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export function SalaryStructureView() {
  const { isSuperAdmin, isAdmin, isHR } = useAuth();
  const canEdit = isSuperAdmin || isAdmin || isHR;

  const [activeSubTab, setActiveSubTab] = useState('structures'); // 'structures' | 'components' | 'assignments'
  const [structures, setStructures] = useState([]);
  const [components, setComponents] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [structRes, compRes, assignRes] = await Promise.all([
        hrmsApi.getSalaryStructures(),
        hrmsApi.getSalaryComponents(),
        hrmsApi.getEmployeeSalaryAssignments()
      ]);

      if (structRes?.success) setStructures(structRes.data);
      if (compRes?.success) setComponents(compRes.data);
      if (assignRes?.success) setAssignments(assignRes.data);
    } catch (err) {
      setError(err.message || 'Failed to fetch salary structure configuration.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="salary-structure-view" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Sub-Navigation Tabs */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid #e2e8f0',
        paddingBottom: '2px',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            type="button"
            className={`btn btn-sm ${activeSubTab === 'structures' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiveSubTab('structures')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}
          >
            <Layers size={15} />
            <span>Salary Structures ({structures.length})</span>
          </button>

          <button
            type="button"
            className={`btn btn-sm ${activeSubTab === 'components' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiveSubTab('components')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}
          >
            <DollarSign size={15} />
            <span>Salary Components ({components.length})</span>
          </button>

          <button
            type="button"
            className={`btn btn-sm ${activeSubTab === 'assignments' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiveSubTab('assignments')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}
          >
            <Users size={15} />
            <span>Staff Salary Registry ({assignments.length})</span>
          </button>
        </div>
      </div>

      {isLoading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
          Loading salary structures and components...
        </div>
      ) : error ? (
        <div style={{ padding: '30px', textAlign: 'center', color: '#ef4444' }}>
          <AlertCircle size={24} style={{ margin: '0 auto 6px', display: 'block' }} />
          {error}
        </div>
      ) : (
        <>
          {/* TAB 1: SALARY STRUCTURES */}
          {activeSubTab === 'structures' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {structures.map(struct => (
                <div
                  key={struct.id}
                  style={{
                    backgroundColor: '#ffffff',
                    borderRadius: '14px',
                    border: '1px solid #e2e8f0',
                    padding: '20px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                          {struct.name}
                        </h4>
                        <span className="badge badge-primary" style={{ fontFamily: 'monospace', fontSize: '0.72rem' }}>
                          {struct.code}
                        </span>
                      </div>
                      <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '4px 0 0' }}>
                        {struct.description}
                      </p>
                    </div>

                    <span className="badge badge-success" style={{ textTransform: 'uppercase', fontSize: '0.7rem' }}>
                      Active Structure
                    </span>
                  </div>

                  {/* Component Breakdown Table */}
                  <div className="table-responsive">
                    <table className="employee-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                      <thead>
                        <tr>
                          <th>Component Name</th>
                          <th>Code</th>
                          <th>Type</th>
                          <th>Calculation Rule</th>
                          <th>Percentage / Fixed Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {struct.items?.map(item => (
                          <tr key={item.id}>
                            <td style={{ fontWeight: 700, color: '#1e293b' }}>
                              {item.component_name}
                            </td>
                            <td>
                              <span style={{ fontFamily: 'monospace', color: '#2563eb', fontWeight: 600 }}>
                                {item.component_code}
                              </span>
                            </td>
                            <td>
                              <span className={`badge badge-${item.component_type === 'Earning' ? 'success' : 'danger'}`} style={{ fontSize: '0.7rem' }}>
                                {item.component_type}
                              </span>
                            </td>
                            <td>
                              {item.calculation_type === 'percentage' 
                                ? item.percentage_of_component_code 
                                  ? `% of ${item.percentage_of_component_code}`
                                  : '% of Monthly Gross'
                                : 'Fixed Monthly Value'
                              }
                            </td>
                            <td style={{ fontWeight: 700, color: '#0f172a' }}>
                              {item.calculation_type === 'percentage' ? `${item.percentage}%` : `₹${item.fixed_amount}`}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 2: SALARY COMPONENTS CATALOG */}
          {activeSubTab === 'components' && (
            <div className="table-responsive" style={{
              backgroundColor: '#ffffff',
              borderRadius: '14px',
              border: '1px solid #e2e8f0',
              overflowX: 'auto',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
            }}>
              <table className="employee-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th>Component Name</th>
                    <th>Code</th>
                    <th>Classification</th>
                    <th>Taxability</th>
                    <th>Description</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {components.map(comp => (
                    <tr key={comp.id}>
                      <td style={{ fontWeight: 700, color: '#0f172a' }}>
                        {comp.name}
                      </td>
                      <td>
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#2563eb' }}>
                          {comp.code}
                        </span>
                      </td>
                      <td>
                        <span className={`badge badge-${comp.component_type === 'Earning' ? 'success' : 'danger'}`} style={{ textTransform: 'uppercase', fontSize: '0.7rem' }}>
                          {comp.component_type}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.8rem', color: comp.is_taxable ? '#dc2626' : '#15803d', fontWeight: 600 }}>
                          {comp.is_taxable ? 'Taxable' : 'Tax Exempt'}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.8rem', color: '#64748b' }}>
                        {comp.description}
                      </td>
                      <td>
                        <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>
                          Active
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 3: STAFF SALARY REGISTRY */}
          {activeSubTab === 'assignments' && (
            <div className="table-responsive" style={{
              backgroundColor: '#ffffff',
              borderRadius: '14px',
              border: '1px solid #e2e8f0',
              overflowX: 'auto',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
            }}>
              <table className="employee-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th>Faculty / Staff Member</th>
                    <th>Department & Designation</th>
                    <th>Assigned Structure</th>
                    <th style={{ textAlign: 'right' }}>Monthly Base Gross</th>
                    <th style={{ textAlign: 'right' }}>Annual CTC</th>
                    <th>Effective From</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {assignments.map(a => (
                    <tr key={a.id}>
                      <td>
                        <strong style={{ color: '#0f172a', display: 'block' }}>
                          {a.first_name} {a.last_name}
                        </strong>
                        <span style={{ fontSize: '0.74rem', color: '#64748b', fontFamily: 'monospace' }}>
                          {a.employee_code}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: '#1e293b', fontSize: '0.82rem' }}>
                          {a.designation_name}
                        </div>
                        <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                          {a.department_name}
                        </div>
                      </td>
                      <td>
                        <span className="badge badge-secondary" style={{ fontWeight: 600, fontSize: '0.75rem' }}>
                          {a.structure_name || 'Standard Structure'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                        ₹{Number(a.monthly_gross).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: '#2563eb' }}>
                        ₹{Number(a.annual_ctc).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ fontSize: '0.8rem', color: '#64748b' }}>
                        {a.effective_from ? new Date(a.effective_from).toLocaleDateString('en-GB') : '—'}
                      </td>
                      <td>
                        <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>
                          Active
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default SalaryStructureView;
