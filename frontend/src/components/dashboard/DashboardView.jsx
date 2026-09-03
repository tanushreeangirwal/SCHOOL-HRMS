import React from 'react';
import { 
  Users, 
  Building2, 
  CalendarCheck, 
  Clock, 
  UserPlus, 
  ArrowRight,
  Sparkles,
  Award,
  CheckCircle2,
  ShieldCheck,
  ShieldAlert,
  User,
  Mail,
  IdCard,
  GraduationCap,
  UserCheck
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export function DashboardView({ 
  employees = [], 
  departments = [],
  onNavigateToEmployees, 
  onNavigateToDepartments,
  onNavigateToAttendance,
  onNavigateToMyAttendance,
  onAddEmployee,
  onAddDepartment,
  onOpen2FAModal 
}) {
  const { user, hasPermission, isSuperAdmin, isAdmin, isHR, isManager, isEmployee } = useAuth();

  const totalEmployees = employees.length;
  const activeEmployees = employees.filter(e => (e.employment_status || '').toLowerCase() === 'active').length;
  const probationEmployees = employees.filter(e => (e.employment_status || '').toLowerCase() === 'probation').length;
  const inactiveEmployees = employees.filter(e => (e.employment_status || '').toLowerCase() === 'inactive').length;
  
  // Teaching vs Non-Teaching calculation based on department names / faculty
  const teachingStaff = employees.filter(e => {
    const dept = (e.department_name || e.department || '').toLowerCase();
    return dept.includes('faculty') || dept.includes('science') || dept.includes('humanities') || dept.includes('language') || dept.includes('sports') || dept.includes('academic');
  }).length;
  const nonTeachingStaff = totalEmployees - teachingStaff;

  const totalDepartments = departments.length;
  const activeDepartments = departments.filter(d => d.is_active).length;
  const departmentsWithHead = departments.filter(d => Boolean(d.head_name)).length;
  
  const recentEmployees = employees.slice(0, 5);
  const topDepartments = departments.slice(0, 5);

  // If Manager: locate manager's department
  const managerEmpId = user?.employee_id;
  const managerEmployee = employees.find(e => e.id === managerEmpId || e.work_email === user?.email);
  const managerDeptId = managerEmployee?.department_id;
  const managerDept = departments.find(d => d.id === managerDeptId || d.name === managerEmployee?.department_name);
  const managerTeam = employees.filter(e => e.department_id === managerDeptId || (managerDept && e.department_name === managerDept.name));

  // If regular employee, find their personal employee record
  const ownEmployeeRecord = employees.find(e => e.id === user?.employee_id || e.work_email === user?.email) || (isEmployee ? employees[0] : null);

  const canCreateStaff = hasPermission('employees:create') || isSuperAdmin || isAdmin || isHR;

  // =========================================================================
  // 1. SUPER ADMIN / PRINCIPAL DASHBOARD
  // =========================================================================
  if (isSuperAdmin) {
    return (
      <div className="dashboard-content">
        {/* Principal Welcome Banner */}
        <div className="dashboard-welcome-banner superadmin-banner">
          <div className="welcome-text-container">
            <div className="welcome-tag">
              <Sparkles size={14} />
              <span>👑 Super Admin • Principal Portal</span>
            </div>

            <h2 className="welcome-title">
              St. Vincent's High School • Institutional Governance & Executive Oversight
            </h2>

            <p className="welcome-subtitle">
              Welcome, Principal! Comprehensive institutional dashboard providing school-wide workforce analytics, faculty headcounts, academic department status, and system security controls.
            </p>

            <div className="welcome-buttons">
              <button 
                type="button" 
                className="btn btn-primary" 
                onClick={onNavigateToDepartments}
              >
                <Building2 size={16} />
                <span>{`Academic Faculties (${totalDepartments})`}</span>
              </button>

              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={onNavigateToEmployees}
              >
                <Users size={16} />
                <span>{`Staff Directory (${totalEmployees})`}</span>
              </button>

              {user?.employee_id && onNavigateToMyAttendance && (
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={onNavigateToMyAttendance}
                  title="Mark your personal daily attendance"
                >
                  <Clock size={16} />
                  <span>My Attendance</span>
                </button>
              )}

              {canCreateStaff && (
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={onAddEmployee}
                >
                  <UserPlus size={16} />
                  <span>Register Staff</span>
                </button>
              )}

              {!user?.two_factor_enabled && (
                <button 
                  type="button" 
                  className="btn btn-secondary btn-2fa-cta" 
                  onClick={onOpen2FAModal}
                >
                  <ShieldAlert size={16} className="text-amber" />
                  <span>Enable 2FA Protection</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Real Institutional KPIs */}
        <div className="dashboard-metrics-grid">
          <div className="kpi-card" onClick={onNavigateToEmployees} style={{ cursor: 'pointer' }}>
            <div className="kpi-header">
              <span className="kpi-title">Total Staff</span>
              <div className="kpi-icon-pill indigo">
                <Users size={18} />
              </div>
            </div>
            <div className="kpi-body">
              <span className="kpi-value">{totalEmployees}</span>
              <span className="kpi-trend trend-positive">
                <span>{activeEmployees} Active on Duty</span>
              </span>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-header">
              <span className="kpi-title">Teaching Faculty</span>
              <div className="kpi-icon-pill sky">
                <GraduationCap size={18} />
              </div>
            </div>
            <div className="kpi-body">
              <span className="kpi-value">{teachingStaff}</span>
              <span className="kpi-trend trend-neutral">
                <span>{nonTeachingStaff} Non-Teaching / Support</span>
              </span>
            </div>
          </div>

          <div className="kpi-card" onClick={onNavigateToDepartments} style={{ cursor: 'pointer' }}>
            <div className="kpi-header">
              <span className="kpi-title">Faculties & Depts</span>
              <div className="kpi-icon-pill emerald">
                <Building2 size={18} />
              </div>
            </div>
            <div className="kpi-body">
              <span className="kpi-value">{totalDepartments}</span>
              <span className="kpi-trend trend-positive">
                <span>{activeDepartments} Operational Wings</span>
              </span>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-header">
              <span className="kpi-title">Staff in Probation</span>
              <div className="kpi-icon-pill amber">
                <Clock size={18} />
              </div>
            </div>
            <div className="kpi-body">
              <span className="kpi-value">{probationEmployees}</span>
              <span className="kpi-trend trend-neutral">
                <span>{inactiveEmployees} Inactive / On Leave</span>
              </span>
            </div>
          </div>
        </div>

        {/* Lower Institutional Governance Grid */}
        <div className="dashboard-sections-grid">
          {/* Department Breakdown */}
          <div className="dashboard-card">
            <div className="dashboard-card-header">
              <div>
                <h3 className="card-title">Academic Faculties & Head of Departments</h3>
                <p className="card-subtitle">Real-time faculty allocations and leadership oversight</p>
              </div>
              <button type="button" className="btn-link" onClick={onNavigateToDepartments}>
                <span>Manage All</span>
                <ArrowRight size={14} />
              </button>
            </div>

            <div className="recent-staff-list">
              {topDepartments.map((dept) => (
                <div key={dept.id} className="recent-staff-item" onClick={onNavigateToDepartments} style={{ cursor: 'pointer' }}>
                  <div className="staff-avatar-initials small" style={{ backgroundColor: '#ede9fe', color: '#5b21b6' }}>
                    <Building2 size={14} />
                  </div>
                  <div className="recent-staff-info">
                    <span className="recent-staff-name">{dept.name}</span>
                    <span className="recent-staff-code text-monospace">
                      {dept.code || 'DEPT'} • {dept.head_name ? `HOD: ${dept.head_name}` : 'HOD: Pending Appointment'}
                    </span>
                  </div>
                  <span className="staff-count-badge badge-has-staff">
                    <Users size={11} />
                    <span>{dept.employee_count || 0} Faculty</span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Institutional Governance & Security Controls */}
          <div className="dashboard-card quick-actions-card">
            <div className="dashboard-card-header">
              <div>
                <h3 className="card-title">Executive Governance & Security</h3>
                <p className="card-subtitle">Institutional security, 2FA status and RBAC controls</p>
              </div>
            </div>

            <div className="module-links-list">
              <div className="module-link-item active-module" onClick={onNavigateToEmployees}>
                <div className="module-icon-box indigo">
                  <UserCheck size={20} />
                </div>
                <div className="module-info">
                  <span className="module-title">Faculty & Staff Records</span>
                  <span className="module-desc">Full institutional personnel registry & tenure records</span>
                </div>
                <span className="module-status-badge ready">{totalEmployees} Records</span>
              </div>

              <div className="module-link-item active-module" onClick={onNavigateToDepartments}>
                <div className="module-icon-box sky">
                  <Building2 size={20} />
                </div>
                <div className="module-info">
                  <span className="module-title">Faculties & Divisions</span>
                  <span className="module-desc">Departmental allocation matrix & HOD appointments</span>
                </div>
                <span className="module-status-badge ready">{totalDepartments} Depts</span>
              </div>

              <div className="module-link-item active-module" onClick={onOpen2FAModal}>
                <div className="module-icon-box amber">
                  <ShieldCheck size={20} />
                </div>
                <div className="module-info">
                  <span className="module-title">Principal 2FA Security</span>
                  <span className="module-desc">Two-factor authenticator protection for executive access</span>
                </div>
                <span className={`module-status-badge ${user?.two_factor_enabled ? 'ready' : 'upcoming'}`}>
                  {user?.two_factor_enabled ? 'Active' : 'Setup'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // 2. ADMIN (ADMINISTRATOR) DASHBOARD
  // =========================================================================
  if (isAdmin) {
    return (
      <div className="dashboard-content">
        <div className="dashboard-welcome-banner">
          <div className="welcome-text-container">
            <div className="welcome-tag">
              <Sparkles size={14} />
              <span>🛡️ Admin • Administrator Portal</span>
            </div>

            <h2 className="welcome-title">
              St. Vincent's HR Operations & Master Data Management
            </h2>

            <p className="welcome-subtitle">
              Manage school-wide personnel records, faculty department allocations, designations, and system administration.
            </p>

            <div className="welcome-buttons">
              <button type="button" className="btn btn-primary" onClick={onNavigateToDepartments}>
                <Building2 size={16} />
                <span>{`Departments (${totalDepartments})`}</span>
              </button>
              <button type="button" className="btn btn-secondary" onClick={onNavigateToEmployees}>
                <Users size={16} />
                <span>{`Staff Directory (${totalEmployees})`}</span>
              </button>
              {user?.employee_id && onNavigateToMyAttendance && (
                <button type="button" className="btn btn-secondary" onClick={onNavigateToMyAttendance} title="Mark your personal daily attendance">
                  <Clock size={16} />
                  <span>My Attendance</span>
                </button>
              )}
              {canCreateStaff && (
                <button type="button" className="btn btn-secondary" onClick={onAddEmployee}>
                  <UserPlus size={16} />
                  <span>Register Staff</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Operational HR KPIs */}
        <div className="dashboard-metrics-grid">
          <div className="kpi-card" onClick={onNavigateToEmployees} style={{ cursor: 'pointer' }}>
            <div className="kpi-header">
              <span className="kpi-title">Total Staff</span>
              <div className="kpi-icon-pill indigo">
                <Users size={18} />
              </div>
            </div>
            <div className="kpi-body">
              <span className="kpi-value">{totalEmployees}</span>
              <span className="kpi-trend trend-positive">
                <span>{activeEmployees} Active Personnel</span>
              </span>
            </div>
          </div>

          <div className="kpi-card" onClick={onNavigateToDepartments} style={{ cursor: 'pointer' }}>
            <div className="kpi-header">
              <span className="kpi-title">Departments</span>
              <div className="kpi-icon-pill sky">
                <Building2 size={18} />
              </div>
            </div>
            <div className="kpi-body">
              <span className="kpi-value">{totalDepartments}</span>
              <span className="kpi-trend trend-positive">
                <span>{activeDepartments} Active Units</span>
              </span>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-header">
              <span className="kpi-title">Probation Period</span>
              <div className="kpi-icon-pill amber">
                <Clock size={18} />
              </div>
            </div>
            <div className="kpi-body">
              <span className="kpi-value">{probationEmployees}</span>
              <span className="kpi-trend trend-neutral">
                <span>Faculty on Review</span>
              </span>
            </div>
          </div>

          <div className="kpi-card" onClick={onOpen2FAModal} style={{ cursor: 'pointer' }}>
            <div className="kpi-header">
              <span className="kpi-title">Account Security</span>
              <div className="kpi-icon-pill emerald">
                <ShieldCheck size={18} />
              </div>
            </div>
            <div className="kpi-body">
              <span className="kpi-value">{user?.two_factor_enabled ? 'Active' : 'Setup'}</span>
              <span className="kpi-trend trend-positive">
                <span>2FA Protected</span>
              </span>
            </div>
          </div>
        </div>

        {/* Operational Modules */}
        <div className="dashboard-sections-grid">
          <div className="dashboard-card">
            <div className="dashboard-card-header">
              <div>
                <h3 className="card-title">Active Departments & Faculty Count</h3>
                <p className="card-subtitle">Staff allocations across institutional departments</p>
              </div>
              <button type="button" className="btn-link" onClick={onNavigateToDepartments}>
                <span>View All</span>
                <ArrowRight size={14} />
              </button>
            </div>
            <div className="recent-staff-list">
              {topDepartments.map((dept) => (
                <div key={dept.id} className="recent-staff-item" onClick={onNavigateToDepartments} style={{ cursor: 'pointer' }}>
                  <div className="staff-avatar-initials small" style={{ backgroundColor: '#dbeafe', color: '#1e40af' }}>
                    <Building2 size={14} />
                  </div>
                  <div className="recent-staff-info">
                    <span className="recent-staff-name">{dept.name}</span>
                    <span className="recent-staff-code text-monospace">
                      {dept.code || 'DEPT'} • {dept.head_name ? `HOD: ${dept.head_name}` : 'No HOD Assigned'}
                    </span>
                  </div>
                  <span className="staff-count-badge badge-has-staff">
                    <Users size={11} />
                    <span>{dept.employee_count || 0} Staff</span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="dashboard-card quick-actions-card">
            <div className="dashboard-card-header">
              <div>
                <h3 className="card-title">HR Operations & Catalog</h3>
                <p className="card-subtitle">Master tables and staff onboarding tools</p>
              </div>
            </div>
            <div className="module-links-list">
              <div className="module-link-item active-module" onClick={onAddEmployee}>
                <div className="module-icon-box indigo">
                  <UserPlus size={20} />
                </div>
                <div className="module-info">
                  <span className="module-title">Register New Faculty</span>
                  <span className="module-desc">Add teacher profile, employment terms & contact info</span>
                </div>
                <span className="module-status-badge ready">New</span>
              </div>
              <div className="module-link-item active-module" onClick={onNavigateToDepartments}>
                <div className="module-icon-box sky">
                  <Building2 size={20} />
                </div>
                <div className="module-info">
                  <span className="module-title">Department Allocation</span>
                  <span className="module-desc">Assign teachers and manage faculty categories</span>
                </div>
                <span className="module-status-badge ready">Active</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // 3. HR (HUMAN RESOURCES) DASHBOARD
  // =========================================================================
  if (isHR) {
    return (
      <div className="dashboard-content">
        <div className="dashboard-welcome-banner">
          <div className="welcome-text-container">
            <div className="welcome-tag">
              <Sparkles size={14} />
              <span>📋 HR • Human Resources Portal</span>
            </div>

            <h2 className="welcome-title">
              Staff Administration & Workforce Operations
            </h2>

            <p className="welcome-subtitle">
              Manage faculty registrations, departmental staffing allocations, probation periods, and job positions.
            </p>

            <div className="welcome-buttons">
              <button type="button" className="btn btn-primary" onClick={onNavigateToEmployees}>
                <Users size={16} />
                <span>{`Staff Directory (${totalEmployees})`}</span>
              </button>
              {canCreateStaff && (
                <button type="button" className="btn btn-secondary" onClick={onAddEmployee}>
                  <UserPlus size={16} />
                  <span>Register Staff</span>
                </button>
              )}
              <button type="button" className="btn btn-secondary" onClick={onNavigateToDepartments}>
                <Building2 size={16} />
                <span>Assign Departments</span>
              </button>
            </div>
          </div>
        </div>

        {/* HR KPIs */}
        <div className="dashboard-metrics-grid">
          <div className="kpi-card" onClick={onNavigateToEmployees} style={{ cursor: 'pointer' }}>
            <div className="kpi-header">
              <span className="kpi-title">Total Staff</span>
              <div className="kpi-icon-pill indigo">
                <Users size={18} />
              </div>
            </div>
            <div className="kpi-body">
              <span className="kpi-value">{totalEmployees}</span>
              <span className="kpi-trend trend-positive">
                <span>{activeEmployees} Active</span>
              </span>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-header">
              <span className="kpi-title">Probation Reviews</span>
              <div className="kpi-icon-pill amber">
                <Clock size={18} />
              </div>
            </div>
            <div className="kpi-body">
              <span className="kpi-value">{probationEmployees}</span>
              <span className="kpi-trend trend-neutral">
                <span>Pending Review</span>
              </span>
            </div>
          </div>

          <div className="kpi-card" onClick={onNavigateToDepartments} style={{ cursor: 'pointer' }}>
            <div className="kpi-header">
              <span className="kpi-title">Departments</span>
              <div className="kpi-icon-pill emerald">
                <Building2 size={18} />
              </div>
            </div>
            <div className="kpi-body">
              <span className="kpi-value">{totalDepartments}</span>
              <span className="kpi-trend trend-positive">
                <span>{departmentsWithHead} Assigned HODs</span>
              </span>
            </div>
          </div>

          <div className="kpi-card" onClick={onOpen2FAModal} style={{ cursor: 'pointer' }}>
            <div className="kpi-header">
              <span className="kpi-title">Security & 2FA</span>
              <div className="kpi-icon-pill sky">
                <ShieldCheck size={18} />
              </div>
            </div>
            <div className="kpi-body">
              <span className="kpi-value">{user?.two_factor_enabled ? 'Active' : 'Setup'}</span>
              <span className="kpi-trend trend-positive">
                <span>TOTP Protected</span>
              </span>
            </div>
          </div>
        </div>

        {/* HR Lower Grid */}
        <div className="dashboard-sections-grid">
          <div className="dashboard-card">
            <div className="dashboard-card-header">
              <div>
                <h3 className="card-title">Recent Staff Additions</h3>
                <p className="card-subtitle">Latest registered teachers and administrative personnel</p>
              </div>
              <button type="button" className="btn-link" onClick={onNavigateToEmployees}>
                <span>View Directory</span>
                <ArrowRight size={14} />
              </button>
            </div>
            <div className="recent-staff-list">
              {recentEmployees.map((emp) => (
                <div key={emp.id} className="recent-staff-item" onClick={onNavigateToEmployees} style={{ cursor: 'pointer' }}>
                  <div className="staff-avatar-initials small">
                    {emp.first_name?.[0]}{emp.last_name?.[0]}
                  </div>
                  <div className="recent-staff-info">
                    <span className="recent-staff-name">{emp.first_name} {emp.last_name}</span>
                    <span className="recent-staff-code text-monospace">
                      {emp.employee_code} • {emp.department_name || 'No Dept'}
                    </span>
                  </div>
                  <span className={`status-badge-compact ${emp.employment_status?.toLowerCase()}`}>
                    {emp.employment_status || 'Active'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="dashboard-card quick-actions-card">
            <div className="dashboard-card-header">
              <div>
                <h3 className="card-title">HR Action Shortcuts</h3>
                <p className="card-subtitle">Quick access to staff workflows</p>
              </div>
            </div>
            <div className="module-links-list">
              <div className="module-link-item active-module" onClick={onAddEmployee}>
                <div className="module-icon-box indigo">
                  <UserPlus size={20} />
                </div>
                <div className="module-info">
                  <span className="module-title">Register Employee</span>
                  <span className="module-desc">Add new teacher or staff profile</span>
                </div>
                <span className="module-status-badge ready">+ Add</span>
              </div>
              <div className="module-link-item active-module" onClick={onNavigateToDepartments}>
                <div className="module-icon-box emerald">
                  <Building2 size={20} />
                </div>
                <div className="module-info">
                  <span className="module-title">Assign Department</span>
                  <span className="module-desc">Allocate faculty to departments</span>
                </div>
                <span className="module-status-badge ready">Manage</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // 4. MANAGER DASHBOARD
  // =========================================================================
  if (isManager) {
    return (
      <div className="dashboard-content">
        <div className="dashboard-welcome-banner">
          <div className="welcome-text-container">
            <div className="welcome-tag">
              <Sparkles size={14} />
              <span>📊 Manager • Department Head Portal</span>
            </div>

            <h2 className="welcome-title">
              {managerDept ? `${managerDept.name} • Team Oversight` : 'Department Oversight & Faculty Roster'}
            </h2>

            <p className="welcome-subtitle">
              Oversee your academic division, monitor faculty allocations, review team probation periods, and track department members.
            </p>

            <div className="welcome-buttons">
              <button type="button" className="btn btn-primary" onClick={onNavigateToEmployees}>
                <Users size={16} />
                <span>{`Team Directory (${managerTeam.length || totalEmployees})`}</span>
              </button>
              <button type="button" className="btn btn-secondary" onClick={onNavigateToDepartments}>
                <Building2 size={16} />
                <span>View Department Info</span>
              </button>
            </div>
          </div>
        </div>

        {/* Manager Team KPIs */}
        <div className="dashboard-metrics-grid">
          <div className="kpi-card">
            <div className="kpi-header">
              <span className="kpi-title">Assigned Department</span>
              <div className="kpi-icon-pill indigo">
                <Building2 size={18} />
              </div>
            </div>
            <div className="kpi-body">
              <span className="kpi-value" style={{ fontSize: '1.2rem' }}>
                {managerDept?.name || 'Academic Division'}
              </span>
              <span className="kpi-trend trend-neutral">
                <span>{managerDept?.code || 'DEPT'}</span>
              </span>
            </div>
          </div>

          <div className="kpi-card" onClick={onNavigateToEmployees} style={{ cursor: 'pointer' }}>
            <div className="kpi-header">
              <span className="kpi-title">Department Faculty</span>
              <div className="kpi-icon-pill sky">
                <Users size={18} />
              </div>
            </div>
            <div className="kpi-body">
              <span className="kpi-value">{managerTeam.length || totalEmployees}</span>
              <span className="kpi-trend trend-positive">
                <span>Assigned Staff</span>
              </span>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-header">
              <span className="kpi-title">Active Members</span>
              <div className="kpi-icon-pill emerald">
                <CheckCircle2 size={18} />
              </div>
            </div>
            <div className="kpi-body">
              <span className="kpi-value">
                {managerTeam.filter(e => (e.employment_status || '').toLowerCase() === 'active').length || activeEmployees}
              </span>
              <span className="kpi-trend trend-positive">
                <span>Active Status</span>
              </span>
            </div>
          </div>

          <div className="kpi-card" onClick={onOpen2FAModal} style={{ cursor: 'pointer' }}>
            <div className="kpi-header">
              <span className="kpi-title">Account Security</span>
              <div className="kpi-icon-pill amber">
                <ShieldCheck size={18} />
              </div>
            </div>
            <div className="kpi-body">
              <span className="kpi-value">{user?.two_factor_enabled ? 'Active' : 'Setup'}</span>
              <span className="kpi-trend trend-positive">
                <span>2FA Enabled</span>
              </span>
            </div>
          </div>
        </div>

        {/* Manager Team Roster */}
        <div className="dashboard-sections-grid">
          <div className="dashboard-card">
            <div className="dashboard-card-header">
              <div>
                <h3 className="card-title">Department Faculty Roster</h3>
                <p className="card-subtitle">Staff members reporting to your academic division</p>
              </div>
              <button type="button" className="btn-link" onClick={onNavigateToEmployees}>
                <span>View Full List</span>
                <ArrowRight size={14} />
              </button>
            </div>
            <div className="recent-staff-list">
              {(managerTeam.length > 0 ? managerTeam : recentEmployees).map((emp) => (
                <div key={emp.id} className="recent-staff-item" onClick={onNavigateToEmployees} style={{ cursor: 'pointer' }}>
                  <div className="staff-avatar-initials small">
                    {emp.first_name?.[0]}{emp.last_name?.[0]}
                  </div>
                  <div className="recent-staff-info">
                    <span className="recent-staff-name">{emp.first_name} {emp.last_name}</span>
                    <span className="recent-staff-code text-monospace">
                      {emp.employee_code} • {emp.designation_name || emp.department_name || 'Faculty Member'}
                    </span>
                  </div>
                  <span className={`status-badge-compact ${emp.employment_status?.toLowerCase()}`}>
                    {emp.employment_status || 'Active'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="dashboard-card quick-actions-card">
            <div className="dashboard-card-header">
              <div>
                <h3 className="card-title">Team Operations</h3>
                <p className="card-subtitle">Department management tools</p>
              </div>
            </div>
            <div className="module-links-list">
              <div className="module-link-item active-module" onClick={onNavigateToEmployees}>
                <div className="module-icon-box sky">
                  <Users size={20} />
                </div>
                <div className="module-info">
                  <span className="module-title">Faculty Directory</span>
                  <span className="module-desc">View profiles & contact information</span>
                </div>
                <span className="module-status-badge ready">View</span>
              </div>
              <div className="module-link-item active-module" onClick={onNavigateToDepartments}>
                <div className="module-icon-box indigo">
                  <Building2 size={20} />
                </div>
                <div className="module-info">
                  <span className="module-title">Department Profile</span>
                  <span className="module-desc">View department details and categories</span>
                </div>
                <span className="module-status-badge ready">View</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // 5. EMPLOYEE (FACULTY / STAFF) DASHBOARD - PERSONAL ONLY
  // =========================================================================
  return (
    <div className="dashboard-content">
      {/* Employee Personal Welcome */}
      <div className="dashboard-welcome-banner employee-personal-banner">
        <div className="welcome-text-container">
          <div className="welcome-tag">
            <Sparkles size={14} />
            <span>👨‍🏫 St. Vincent's Faculty & Staff Portal</span>
          </div>

          <h2 className="welcome-title">
            Welcome, {user?.full_name || 'Faculty Member'}!
          </h2>

          <p className="welcome-subtitle">
            Welcome to your verified personal portal. Access your official institutional records, department affiliation, and security settings.
          </p>

          <div className="welcome-buttons">
            <button type="button" className="btn btn-primary" onClick={onNavigateToEmployees}>
              <User size={16} />
              <span>View My Profile</span>
            </button>
            {!user?.two_factor_enabled && (
              <button type="button" className="btn btn-secondary btn-2fa-cta" onClick={onOpen2FAModal}>
                <ShieldAlert size={16} className="text-amber" />
                <span>Enable 2FA Protection</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Employee Personal Overview Cards ONLY (No School-Wide Aggregate Metrics) */}
      <div className="dashboard-metrics-grid">
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Employee Code</span>
            <div className="kpi-icon-pill indigo">
              <IdCard size={18} />
            </div>
          </div>
          <div className="kpi-body">
            <span className="kpi-value text-monospace">
              {user?.employee_code || ownEmployeeRecord?.employee_code || 'EMP-1001'}
            </span>
            <span className="kpi-trend trend-neutral">
              <span>Verified Institutional ID</span>
            </span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Assigned Faculty</span>
            <div className="kpi-icon-pill amber">
              <Building2 size={18} />
            </div>
          </div>
          <div className="kpi-body">
            <span className="kpi-value" style={{ fontSize: '1.15rem' }}>
              {ownEmployeeRecord?.department_name || 'Science & Mathematics Faculty'}
            </span>
            <span className="kpi-trend trend-neutral">
              <span>Academic Wing</span>
            </span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Standing</span>
            <div className="kpi-icon-pill emerald">
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div className="kpi-body">
            <span className="kpi-value">
              {ownEmployeeRecord?.employment_status || 'Active'}
            </span>
            <span className="kpi-trend trend-positive">
              <span>Official Status</span>
            </span>
          </div>
        </div>

        <div className="kpi-card" onClick={onOpen2FAModal} style={{ cursor: 'pointer' }}>
          <div className="kpi-header">
            <span className="kpi-title">Account Security</span>
            <div className="kpi-icon-pill sky">
              <ShieldCheck size={18} />
            </div>
          </div>
          <div className="kpi-body">
            <span className="kpi-value" style={{ fontSize: '1.15rem' }}>
              {user?.two_factor_enabled ? '2FA Active' : '2FA Setup'}
            </span>
            <span className="kpi-trend trend-positive">
              <span>Authenticator Protected</span>
            </span>
          </div>
        </div>
      </div>

      {/* Employee Personal Record & Quick Actions */}
      <div className="dashboard-sections-grid">
        <div className="dashboard-card">
          <div className="dashboard-card-header">
            <div>
              <h3 className="card-title">My Institutional Profile</h3>
              <p className="card-subtitle">Verified details registered in St. Vincent's High School HRMS</p>
            </div>
            <button type="button" className="btn-link" onClick={onNavigateToEmployees}>
              <span>Full Profile</span>
              <ArrowRight size={14} />
            </button>
          </div>

          <div className="recent-staff-list">
            <div className="recent-staff-item" style={{ cursor: 'default' }}>
              <div className="staff-avatar-initials small" style={{ backgroundColor: '#e0e7ff', color: '#3730a3' }}>
                <Mail size={14} />
              </div>
              <div className="recent-staff-info">
                <span className="recent-staff-name">{user?.email || ownEmployeeRecord?.work_email}</span>
                <span className="recent-staff-code">Institutional Email Address</span>
              </div>
            </div>

            <div className="recent-staff-item" style={{ cursor: 'default' }}>
              <div className="staff-avatar-initials small" style={{ backgroundColor: '#d1fae5', color: '#065f46' }}>
                <Building2 size={14} />
              </div>
              <div className="recent-staff-info">
                <span className="recent-staff-name">
                  {ownEmployeeRecord?.department_name || 'Science & Mathematics Faculty'}
                </span>
                <span className="recent-staff-code">Department Affiliation</span>
              </div>
            </div>

            <div className="recent-staff-item" style={{ cursor: 'default' }}>
              <div className="staff-avatar-initials small" style={{ backgroundColor: '#fef3c7', color: '#92400e' }}>
                <ShieldCheck size={14} />
              </div>
              <div className="recent-staff-info">
                <span className="recent-staff-name">
                  {user?.two_factor_enabled ? 'Two-Factor Authentication Active' : '2FA Protection Recommended'}
                </span>
                <span className="recent-staff-code">TOTP Multi-Factor Security</span>
              </div>
            </div>
          </div>
        </div>

        <div className="dashboard-card quick-actions-card">
          <div className="dashboard-card-header">
            <div>
              <h3 className="card-title">Self-Service Actions</h3>
              <p className="card-subtitle">Personal portal management tools</p>
            </div>
          </div>
          <div className="module-links-list">
            <div className="module-link-item active-module" onClick={onNavigateToEmployees}>
              <div className="module-icon-box indigo">
                <User size={20} />
              </div>
              <div className="module-info">
                <span className="module-title">My Staff Profile</span>
                <span className="module-desc">View verified employment and contact information</span>
              </div>
              <span className="module-status-badge ready">View</span>
            </div>

            <div className="module-link-item active-module" onClick={onOpen2FAModal}>
              <div className="module-icon-box amber">
                <ShieldCheck size={20} />
              </div>
              <div className="module-info">
                <span className="module-title">2FA Security Setup</span>
                <span className="module-desc">Configure Google Authenticator or Microsoft Authenticator</span>
              </div>
              <span className={`module-status-badge ${user?.two_factor_enabled ? 'ready' : 'upcoming'}`}>
                {user?.two_factor_enabled ? 'Active' : 'Setup'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DashboardView;
