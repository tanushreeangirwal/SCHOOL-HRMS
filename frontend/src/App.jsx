import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { hrmsApi } from './services/api';
import LoginView from './components/auth/LoginView';
import TwoFactorSetupModal from './components/auth/TwoFactorSetupModal';
import Sidebar from './components/layout/Sidebar';
import Header from './components/layout/Header';
import EmployeeStats from './components/employees/EmployeeStats';
import EmployeeFilters from './components/employees/EmployeeFilters';
import EmployeeTable from './components/employees/EmployeeTable';
import EmployeeDetailModal from './components/employees/EmployeeDetailModal';
import AddEmployeeModal from './components/employees/AddEmployeeModal';
import EmployeeDashboardView from './components/dashboard/EmployeeDashboardView';
import MyAttendanceView from './components/attendance/MyAttendanceView';
import MarkAttendanceView from './components/attendance/MarkAttendanceView';
import MyShiftView from './components/attendance/MyShiftView';
import DashboardView from './components/dashboard/DashboardView';
import DepartmentListView from './components/departments/DepartmentListView';
import DepartmentCategoriesView from './components/departments/DepartmentCategoriesView';
import AssignEmployeeView from './components/departments/AssignEmployeeView';
import DepartmentDetailModal from './components/departments/DepartmentDetailModal';
import AddEditDepartmentModal from './components/departments/AddEditDepartmentModal';
import DesignationListView from './components/designations/DesignationListView';
import AddEditDesignationModal from './components/designations/AddEditDesignationModal';
import DesignationDetailModal from './components/designations/DesignationDetailModal';
import ShiftListView from './components/shifts/ShiftListView';
import AddEditShiftModal from './components/shifts/AddEditShiftModal';
import ShiftDetailModal from './components/shifts/ShiftDetailModal';
import AssignShiftView from './components/shifts/AssignShiftView';
import AttendanceDashboardView from './components/attendance/AttendanceDashboardView';
import DailyAttendanceView from './components/attendance/DailyAttendanceView';
import AttendanceRegisterView from './components/attendance/AttendanceRegisterView';
import EmployeeAttendanceView from './components/attendance/EmployeeAttendanceView';
import AttendanceReportsView from './components/attendance/AttendanceReportsView';
import MarkAttendanceModal from './components/attendance/MarkAttendanceModal';
import AttendanceAuditModal from './components/attendance/AttendanceAuditModal';
import { LeaveModuleView } from './components/leave/LeaveModuleView';
import { AcademicCalendarModule } from './components/calendar/AcademicCalendarModule';
import PayrollModule from './components/payroll/PayrollModule';
import MyPayslipsView from './components/payroll/MyPayslipsView';
import Toast from './components/common/Toast';
import { TableSkeleton, LoadingSpinner } from './components/common/LoadingSpinner';
import EmptyState from './components/common/EmptyState';
import { AlertCircle, RefreshCw } from 'lucide-react';
import './App.css';

function MainAppShell() {
  const { user, isAuthenticated, isLoading: isAuthLoading, hasPermission, hasRole, isSuperAdmin, isAdmin, isHR, isManager, isEmployee } = useAuth();

  // Navigation State: 'dashboard' | 'departments' | 'designations' | 'shifts' | 'employees' | 'attendance' | 'my-attendance' | 'leave' | 'my-leave' | 'calendar'
  const [activeView, setActiveView] = useState('dashboard');

  // Department Sub-Navigation State: 'view' | 'categories' | 'assign'
  const [departmentSubTab, setDepartmentSubTab] = useState('view');

  // Designation Sub-Navigation State: 'view'
  const [designationSubTab, setDesignationSubTab] = useState('view');

  // Shift Sub-Navigation State: 'view' | 'assign'
  const [shiftSubTab, setShiftSubTab] = useState('view');

  // Attendance Sub-Navigation State: 'dashboard' | 'daily' | 'register' | 'employee' | 'reports'
  const [attendanceSubTab, setAttendanceSubTab] = useState('dashboard');

  // Leave Management Sub-Navigation State: 'dashboard' | 'requests' | 'types' | 'calendar' | 'my-leave'
  const [leaveSubTab, setLeaveSubTab] = useState('dashboard');

  // Academic Calendar Sub-Navigation State: 'overview' | 'holidays' | 'terms' | 'years'
  const [calendarSubTab, setCalendarSubTab] = useState('overview');

  // Payroll Sub-Navigation State: 'dashboard' | 'records' | 'structures'
  const [payrollSubTab, setPayrollSubTab] = useState('dashboard');

  // Mobile Navigation Drawer State
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Auto-close mobile drawer on navigation
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [activeView, departmentSubTab, shiftSubTab, attendanceSubTab, leaveSubTab, calendarSubTab, payrollSubTab]);

  // Guard: if Employee tries to access restricted administrative modules, redirect to dashboard
  useEffect(() => {
    if (isEmployee && (activeView === 'departments' || activeView === 'designations' || activeView === 'shifts' || activeView === 'attendance' || activeView === 'payroll')) {
      setActiveView('dashboard');
    }
  }, [isEmployee, activeView]);

  // Employees Data States
  const [employees, setEmployees] = useState([]);
  const [isEmployeesLoading, setIsEmployeesLoading] = useState(true);
  const [isEmployeesRefreshing, setIsEmployeesRefreshing] = useState(false);
  const [employeeFetchError, setEmployeeFetchError] = useState(null);

  // Departments Data States
  const [departments, setDepartments] = useState([]);
  const [isDeptsLoading, setIsDeptsLoading] = useState(true);
  const [isDeptsRefreshing, setIsDeptsRefreshing] = useState(false);
  const [deptFetchError, setDeptFetchError] = useState(null);

  // Department Categories Data States
  const [categories, setCategories] = useState([]);
  const [isCategoriesLoading, setIsCategoriesLoading] = useState(true);
  const [isCategoriesRefreshing, setIsCategoriesRefreshing] = useState(false);
  const [categoryFetchError, setCategoryFetchError] = useState(null);

  // Designations Data States
  const [designations, setDesignations] = useState([]);
  const [isDesignationsLoading, setIsDesignationsLoading] = useState(true);
  const [isDesignationsRefreshing, setIsDesignationsRefreshing] = useState(false);
  const [designationFetchError, setDesignationFetchError] = useState(null);

  // Shifts Data States
  const [shifts, setShifts] = useState([]);
  const [shiftStats, setShiftStats] = useState({});
  const [isShiftsLoading, setIsShiftsLoading] = useState(true);
  const [isShiftsRefreshing, setIsShiftsRefreshing] = useState(false);
  const [shiftFetchError, setShiftFetchError] = useState(null);

  const [backendStatus, setBackendStatus] = useState({ online: false, lastChecked: null });

  // Filter & Search States (Employees)
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [departmentFilter, setDepartmentFilter] = useState('ALL');

  // Employee Modals & Actions
  const [isAddEmployeeModalOpen, setIsAddEmployeeModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null);
  const [employeeToDelete, setEmployeeToDelete] = useState(null);
  const [employeeToToggleStatus, setEmployeeToToggleStatus] = useState(null);
  const [isActionLoading, setIsActionLoading] = useState(false);

  // Department Modals
  const [isAddDeptModalOpen, setIsAddDeptModalOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState(null);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState(null);

  // Designation Modals
  const [isAddDesignationModalOpen, setIsAddDesignationModalOpen] = useState(false);
  const [editingDesignation, setEditingDesignation] = useState(null);
  const [selectedDesignationId, setSelectedDesignationId] = useState(null);

  // Shift Modals
  const [isAddShiftModalOpen, setIsAddShiftModalOpen] = useState(false);
  const [editingShift, setEditingShift] = useState(null);
  const [selectedShiftId, setSelectedShiftId] = useState(null);

  // Attendance Modals & State
  const [isMarkAttendanceModalOpen, setIsMarkAttendanceModalOpen] = useState(false);
  const [editingAttendanceRecord, setEditingAttendanceRecord] = useState(null);
  const [attendanceModalInitialDate, setAttendanceModalInitialDate] = useState(null);
  const [attendanceModalInitialEmployee, setAttendanceModalInitialEmployee] = useState(null);
  const [selectedEmployeeAttendanceId, setSelectedEmployeeAttendanceId] = useState(null);
  const [auditModalEmployeeId, setAuditModalEmployeeId] = useState(null);
  const [auditModalEmployeeName, setAuditModalEmployeeName] = useState(null);

  // 2FA Security Modal
  const [is2FAModalOpen, setIs2FAModalOpen] = useState(false);

  // Toast Notification
  const [toast, setToast] = useState(null);

  const showToast = useCallback((type, title, message) => {
    setToast({ type, title, message });
  }, []);

  const canCreateStaff = hasPermission('employees:create') || isSuperAdmin || isAdmin || isHR;
  const canManageDepartments = hasPermission('departments:create') || isSuperAdmin || isAdmin || isHR;
  const canManageDesignations = hasPermission('designations:create') || isSuperAdmin || isAdmin || isHR;

  // 1. Fetch employees
  const fetchEmployeesData = useCallback(async (isSilent = false) => {
    if (!isAuthenticated) return;

    if (!isSilent) setIsEmployeesLoading(true);
    else setIsEmployeesRefreshing(true);
    setEmployeeFetchError(null);

    try {
      const response = await hrmsApi.getEmployees();
      if (response && response.success) {
        setEmployees(response.data || []);
        setBackendStatus({ online: true, lastChecked: new Date() });
      } else {
        throw new Error(response?.message || 'Failed to retrieve employee records');
      }
    } catch (err) {
      console.error('Fetch employees error:', err);
      setEmployeeFetchError(err.message || 'Unable to connect to St. Vincent\'s backend server.');
      setBackendStatus({ online: false, lastChecked: new Date() });
      if (isSilent) {
        showToast('error', 'Sync Failed', err.message);
      }
    } finally {
      setIsEmployeesLoading(false);
      setIsEmployeesRefreshing(false);
    }
  }, [isAuthenticated, showToast]);

  // 2. Fetch departments
  const fetchDepartmentsData = useCallback(async (isSilent = false) => {
    if (!isAuthenticated) return;

    if (!isSilent) setIsDeptsLoading(true);
    else setIsDeptsRefreshing(true);
    setDeptFetchError(null);

    try {
      const response = await hrmsApi.getDepartments();
      if (response && response.success) {
        setDepartments(response.data || []);
        setBackendStatus({ online: true, lastChecked: new Date() });
      } else {
        throw new Error(response?.message || 'Failed to retrieve departments list');
      }
    } catch (err) {
      console.error('Fetch departments error:', err);
      setDeptFetchError(err.message || 'Unable to connect to St. Vincent\'s backend server.');
      setBackendStatus({ online: false, lastChecked: new Date() });
      if (isSilent) {
        showToast('error', 'Sync Failed', err.message);
      }
    } finally {
      setIsDeptsLoading(false);
      setIsDeptsRefreshing(false);
    }
  }, [isAuthenticated, showToast]);

  // 3. Fetch department categories
  const fetchCategoriesData = useCallback(async (isSilent = false) => {
    if (!isAuthenticated) return;

    if (!isSilent) setIsCategoriesLoading(true);
    else setIsCategoriesRefreshing(true);
    setCategoryFetchError(null);

    try {
      const response = await hrmsApi.getDepartmentCategories();
      if (response && response.success) {
        setCategories(response.data || []);
      } else {
        throw new Error(response?.message || 'Failed to retrieve categories list');
      }
    } catch (err) {
      console.error('Fetch categories error:', err);
      setCategoryFetchError(err.message || 'Unable to load department categories.');
    } finally {
      setIsCategoriesLoading(false);
      setIsCategoriesRefreshing(false);
    }
  }, [isAuthenticated]);

  // 4. Fetch designations
  const fetchDesignationsData = useCallback(async (isSilent = false) => {
    if (!isAuthenticated) return;

    if (!isSilent) setIsDesignationsLoading(true);
    else setIsDesignationsRefreshing(true);
    setDesignationFetchError(null);

    try {
      const response = await hrmsApi.getDesignations();
      if (response && response.success) {
        setDesignations(response.data || []);
        setBackendStatus({ online: true, lastChecked: new Date() });
      } else {
        throw new Error(response?.message || 'Failed to retrieve designations');
      }
    } catch (err) {
      console.error('Fetch designations error:', err);
      setDesignationFetchError(err.message || 'Unable to connect to St. Vincent\'s backend server.');
      if (isSilent) {
        showToast('error', 'Sync Failed', err.message);
      }
    } finally {
      setIsDesignationsLoading(false);
      setIsDesignationsRefreshing(false);
    }
  }, [isAuthenticated, showToast]);

  // 5. Fetch shifts & stats
  const fetchShiftsData = useCallback(async (isSilent = false) => {
    if (!isAuthenticated) return;

    if (!isSilent) setIsShiftsLoading(true);
    else setIsShiftsRefreshing(true);
    setShiftFetchError(null);

    try {
      const [shiftsRes, statsRes] = await Promise.all([
        hrmsApi.getShifts(),
        hrmsApi.getShiftStats().catch(() => ({ success: false, data: {} }))
      ]);

      if (shiftsRes && shiftsRes.success) {
        setShifts(shiftsRes.data || []);
        setBackendStatus({ online: true, lastChecked: new Date() });
      } else {
        throw new Error(shiftsRes?.message || 'Failed to retrieve work shifts');
      }

      if (statsRes && statsRes.success) {
        setShiftStats(statsRes.data || {});
      }
    } catch (err) {
      console.error('Fetch shifts error:', err);
      setShiftFetchError(err.message || 'Unable to connect to St. Vincent\'s backend server.');
      if (isSilent) {
        showToast('error', 'Sync Failed', err.message);
      }
    } finally {
      setIsShiftsLoading(false);
      setIsShiftsRefreshing(false);
    }
  }, [isAuthenticated, showToast]);

  // Initial load when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      fetchEmployeesData();
      fetchDepartmentsData();
      fetchCategoriesData();
      fetchDesignationsData();
      fetchShiftsData();
    }
  }, [isAuthenticated, fetchEmployeesData, fetchDepartmentsData, fetchCategoriesData, fetchDesignationsData, fetchShiftsData]);

  // Master Refresh
  const handleMasterRefresh = () => {
    fetchEmployeesData(true);
    fetchDepartmentsData(true);
    fetchCategoriesData(true);
    fetchDesignationsData(true);
    fetchShiftsData(true);
  };

  // Handle Shift Saved (Add/Edit)
  const handleShiftSaved = (savedShift, isEdit) => {
    fetchShiftsData(true);
    fetchEmployeesData(true);
    showToast(
      'success',
      isEdit ? 'Shift Updated' : 'Shift Created',
      `"${savedShift.name}" (${savedShift.code}) has been ${isEdit ? 'updated' : 'created'} successfully.`
    );
  };

  // Handle Toggle Shift Status (Activate / Deactivate)
  const handleToggleShiftStatus = async (shiftId, targetStatus) => {
    try {
      const response = await hrmsApi.toggleShiftStatus(shiftId, targetStatus);
      if (response && response.success) {
        fetchShiftsData(true);
        showToast(
          'success',
          targetStatus ? 'Shift Activated' : 'Shift Deactivated',
          response.message || 'Shift status updated.'
        );
      } else {
        throw new Error(response?.message || 'Failed to toggle shift status.');
      }
    } catch (err) {
      console.error('Toggle shift status error:', err);
      showToast('error', 'Action Failed', err.message || 'Could not update shift status.');
      throw err;
    }
  };

  // Handle Delete Shift (Permanent)
  const handleDeleteShift = async (shiftId) => {
    try {
      const response = await hrmsApi.deleteShift(shiftId);
      if (response && response.success) {
        fetchShiftsData(true);
        showToast('success', 'Shift Deleted', response.message || 'Shift deleted permanently.');
      } else {
        throw new Error(response?.message || 'Failed to delete shift.');
      }
    } catch (err) {
      console.error('Delete shift error:', err);
      showToast('error', 'Delete Failed', err.message || 'Could not delete shift.');
      throw err;
    }
  };

  // Handle Shift Assignment Completed
  const handleShiftAssignmentCompleted = () => {
    fetchShiftsData(true);
    fetchEmployeesData(true);
  };

  // Handle Category Saved (Add/Edit)
  const handleCategorySaved = (savedCat, isEdit) => {
    fetchCategoriesData(true);
    fetchDepartmentsData(true);
    showToast(
      'success',
      isEdit ? 'Category Updated' : 'Category Created',
      `"${savedCat.name}" has been ${isEdit ? 'updated' : 'created'} successfully.`
    );
  };

  // Handle Toggle Category Status
  const handleToggleCategoryStatus = async (catId, targetStatus) => {
    try {
      const response = await hrmsApi.toggleDepartmentCategoryStatus(catId, targetStatus);
      if (response && response.success) {
        fetchCategoriesData(true);
        showToast(
          'success',
          targetStatus ? 'Category Activated' : 'Category Deactivated',
          response.message || 'Category status updated.'
        );
      }
    } catch (err) {
      console.error('Toggle category status error:', err);
      showToast('error', 'Update Failed', err.message || 'Unable to update category status.');
    }
  };

  // Handle Department Created or Updated
  const handleDepartmentSaved = (savedDept, isEdit) => {
    setIsAddDeptModalOpen(false);
    setEditingDepartment(null);
    fetchDepartmentsData(true);
    fetchCategoriesData(true);
    
    showToast(
      'success',
      isEdit ? 'Department Updated' : 'Department Registered',
      `"${savedDept.name}" has been ${isEdit ? 'updated' : 'registered'} in St. Vincent's HRMS.`
    );
  };

  // Handle Department Status Toggle
  const handleToggleDepartmentStatus = async (deptId, targetStatus) => {
    try {
      const response = await hrmsApi.toggleDepartmentStatus(deptId, targetStatus);
      if (response && response.success) {
        fetchDepartmentsData(true);
        fetchCategoriesData(true);
        showToast(
          'success',
          targetStatus ? 'Department Activated' : 'Department Deactivated',
          response.message || 'Department status updated.'
        );
      }
    } catch (err) {
      console.error('Toggle department status error:', err);
      showToast('error', 'Update Failed', err.message || 'Unable to change department status.');
    }
  };

  // Handle Designation Created or Updated
  const handleDesignationSaved = (savedDesig, isEdit) => {
    setIsAddDesignationModalOpen(false);
    setEditingDesignation(null);
    fetchDesignationsData(true);
    fetchEmployeesData(true);

    showToast(
      'success',
      isEdit ? 'Designation Updated' : 'Designation Created',
      `"${savedDesig.name}" has been ${isEdit ? 'updated' : 'created'} in St. Vincent's HRMS.`
    );
  };

  // Handle Designation Status Toggle
  const handleToggleDesignationStatus = async (desigId, targetStatus) => {
    try {
      const response = await hrmsApi.toggleDesignationStatus(desigId, targetStatus);
      if (response && response.success) {
        fetchDesignationsData(true);
        showToast(
          'success',
          targetStatus ? 'Designation Activated' : 'Designation Deactivated',
          response.message || 'Designation status updated.'
        );
      }
    } catch (err) {
      console.error('Toggle designation status error:', err);
      showToast('error', 'Update Failed', err.message || 'Unable to change designation status.');
    }
  };

  // Handle Employee Assignment Completed
  const handleAssignmentCompleted = () => {
    fetchEmployeesData(true);
    fetchDepartmentsData(true);
    showToast('success', 'Assignment Recorded', 'Faculty member assigned to department and logged in audit history.');
  };

  // Handle Employee Created from Form
  const handleEmployeeCreated = (newEmployee) => {
    setIsAddEmployeeModalOpen(false);
    setEditingEmployee(null);
    fetchEmployeesData(true);
    fetchDepartmentsData(true);
    fetchDesignationsData(true);
    setActiveView('employees');
    
    const empName = [newEmployee.first_name, newEmployee.last_name].filter(Boolean).join(' ') || 'Employee';
    showToast(
      'success',
      'Faculty Member Registered',
      `${empName} (${newEmployee.employee_code}) has been added to St. Vincent's database.`
    );
  };

  // Handle Employee Updated from Form
  const handleEmployeeUpdated = (updatedEmployee) => {
    setIsAddEmployeeModalOpen(false);
    setEditingEmployee(null);
    fetchEmployeesData(true);
    fetchDepartmentsData(true);
    fetchDesignationsData(true);
    
    const empName = [updatedEmployee.first_name, updatedEmployee.last_name].filter(Boolean).join(' ') || 'Employee';
    showToast(
      'success',
      'Profile Updated',
      `${empName} (${updatedEmployee.employee_code}) has been updated successfully.`
    );
  };

  // Handle Status Toggle (Deactivate / Reactivate)
  const handleConfirmToggleStatus = async () => {
    if (!employeeToToggleStatus) return;
    setIsActionLoading(true);

    const isCurrentlyInactive = (employeeToToggleStatus.employment_status || '').toLowerCase() === 'inactive';
    const targetStatus = isCurrentlyInactive ? 'Active' : 'Inactive';
    const empName = `${employeeToToggleStatus.first_name} ${employeeToToggleStatus.last_name || ''}`.trim();

    try {
      const res = await hrmsApi.toggleEmployeeStatus(employeeToToggleStatus.id, targetStatus);
      if (res && res.success) {
        showToast(
          'success',
          isCurrentlyInactive ? 'Faculty Reactivated' : 'Faculty Deactivated',
          `${empName} (${employeeToToggleStatus.employee_code}) is now ${targetStatus}.`
        );
        setEmployeeToToggleStatus(null);
        fetchEmployeesData(true);
        fetchDepartmentsData(true);
      } else {
        throw new Error(res?.message || 'Failed to update employee status');
      }
    } catch (err) {
      console.error('Toggle employee status error:', err);
      showToast('error', 'Status Update Failed', err.message);
    } finally {
      setIsActionLoading(false);
    }
  };

  // Handle Permanent Delete
  const handleConfirmDeleteEmployee = async () => {
    if (!employeeToDelete) return;
    setIsActionLoading(true);

    const empName = `${employeeToDelete.first_name} ${employeeToDelete.last_name || ''}`.trim();
    const empCode = employeeToDelete.employee_code;

    try {
      const res = await hrmsApi.deleteEmployee(employeeToDelete.id);
      if (res && res.success) {
        showToast(
          'success',
          'Record Deleted',
          `Employee "${empName}" (${empCode}) was permanently removed.`
        );
        setEmployeeToDelete(null);
        fetchEmployeesData(true);
        fetchDepartmentsData(true);
      } else {
        throw new Error(res?.message || 'Failed to delete employee record');
      }
    } catch (err) {
      console.error('Delete employee error:', err);
      showToast('error', 'Deletion Blocked', err.message);
    } finally {
      setIsActionLoading(false);
    }
  };

  // ------------------------------------------------------------------------
  // Attendance Handlers
  // ------------------------------------------------------------------------
  const handleOpenMarkAttendanceModal = (employee = null, date = null) => {
    setEditingAttendanceRecord(null);
    setAttendanceModalInitialEmployee(employee);
    setAttendanceModalInitialDate(date || new Date().toISOString().split('T')[0]);
    setIsMarkAttendanceModalOpen(true);
  };

  const handleOpenEditAttendanceModal = (record, date = null) => {
    setEditingAttendanceRecord(record);
    setAttendanceModalInitialEmployee(null);
    setAttendanceModalInitialDate(date || record.attendance_date || new Date().toISOString().split('T')[0]);
    setIsMarkAttendanceModalOpen(true);
  };

  const handleAttendanceSaved = (data, isEdit) => {
    showToast(
      'success',
      isEdit ? 'Attendance Corrected' : 'Attendance Recorded',
      isEdit
        ? `Attendance record updated successfully with audit trail.`
        : `Attendance marked successfully for the employee.`
    );
  };

  const handleViewEmployeeAttendance = (empId) => {
    setSelectedEmployeeAttendanceId(empId);
    setActiveView('attendance');
    setAttendanceSubTab('employee');
  };

  // Reset Filters (Employees)
  const handleResetFilters = () => {
    setSearchTerm('');
    setStatusFilter('ALL');
    setDepartmentFilter('ALL');
  };

  // Filtered employees list
  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      if (statusFilter !== 'ALL') {
        const empStatus = (emp.employment_status || '').toLowerCase();
        if (empStatus !== statusFilter.toLowerCase()) return false;
      }

      if (departmentFilter !== 'ALL') {
        const empDept = (emp.department_name || emp.department || '').toLowerCase();
        if (!empDept.includes(departmentFilter.toLowerCase())) return false;
      }

      if (searchTerm.trim() !== '') {
        const term = searchTerm.toLowerCase().trim();
        const code = (emp.employee_code || '').toLowerCase();
        const firstName = (emp.first_name || '').toLowerCase();
        const lastName = (emp.last_name || '').toLowerCase();
        const fullName = `${firstName} ${lastName}`.trim();
        const workEmail = (emp.work_email || '').toLowerCase();
        const phone = (emp.phone || '').toLowerCase();
        const deptName = (emp.department_name || '').toLowerCase();

        return code.includes(term) || firstName.includes(term) || lastName.includes(term) || fullName.includes(term) || workEmail.includes(term) || phone.includes(term) || deptName.includes(term);
      }

      return true;
    });
  }, [employees, searchTerm, statusFilter, departmentFilter]);

  // Selected employee name for breadcrumb
  const selectedEmployeeName = useMemo(() => {
    if (!selectedEmployeeId) return null;
    const found = employees.find(e => e.id === selectedEmployeeId);
    if (!found) return 'Faculty Profile';
    return [found.first_name, found.last_name].filter(Boolean).join(' ') || found.employee_code;
  }, [employees, selectedEmployeeId]);

  // Selected department name for breadcrumb
  const selectedDepartmentName = useMemo(() => {
    if (!selectedDepartmentId) return null;
    const found = departments.find(d => d.id === selectedDepartmentId);
    if (!found) return 'Department Profile';
    return found.name;
  }, [departments, selectedDepartmentId]);

  // Selected designation name for breadcrumb
  const selectedDesignationName = useMemo(() => {
    if (!selectedDesignationId) return null;
    const found = designations.find(d => d.id === selectedDesignationId);
    if (!found) return 'Designation Profile';
    return found.name;
  }, [designations, selectedDesignationId]);

  // Selected shift name for breadcrumb
  const selectedShiftName = useMemo(() => {
    if (!selectedShiftId) return null;
    const found = shifts.find(s => s.id === selectedShiftId);
    if (!found) return 'Shift Dossier';
    return found.name;
  }, [shifts, selectedShiftId]);

  // Loading Session Screen
  if (isAuthLoading) {
    return (
      <div className="auth-loading-screen">
        <LoadingSpinner text="Connecting to St. Vincent's High School HRMS..." size={36} />
      </div>
    );
  }

  // Unauthenticated Login Screen
  if (!isAuthenticated) {
    return (
      <LoginView 
        onLoginSuccess={(u) => {
          showToast('success', 'Authenticated', `Welcome back, ${u.full_name || u.email}!`);
        }} 
      />
    );
  }

  return (
    <div className="app-layout">
      {/* Toast Notification */}
      <Toast toast={toast} onClose={() => setToast(null)} />

      {/* Mobile Sidebar Overlay Backdrop */}
      <div 
        className={`sidebar-backdrop ${isMobileMenuOpen ? 'open' : ''}`}
        onClick={() => setIsMobileMenuOpen(false)}
        aria-hidden="true"
      />

      {/* Left Navigation Sidebar */}
      <Sidebar
        activeView={activeView}
        setActiveView={setActiveView}
        departmentSubTab={departmentSubTab}
        setDepartmentSubTab={setDepartmentSubTab}
        designationSubTab={designationSubTab}
        setDesignationSubTab={setDesignationSubTab}
        shiftSubTab={shiftSubTab}
        setShiftSubTab={setShiftSubTab}
        attendanceSubTab={attendanceSubTab}
        setAttendanceSubTab={setAttendanceSubTab}
        leaveSubTab={leaveSubTab}
        setLeaveSubTab={setLeaveSubTab}
        calendarSubTab={calendarSubTab}
        setCalendarSubTab={setCalendarSubTab}
        payrollSubTab={payrollSubTab}
        setPayrollSubTab={setPayrollSubTab}
        employeeCount={employees.length}
        departmentCount={departments.length}
        designationCount={designations.length}
        shiftCount={shifts.filter(s => s.is_active).length}
        isMobileMenuOpen={isMobileMenuOpen}
        onCloseMobileMenu={() => setIsMobileMenuOpen(false)}
        onOpen2FAModal={() => setIs2FAModalOpen(true)}
        onOpenAddDepartment={() => { setEditingDepartment(null); setIsAddDeptModalOpen(true); }}
        onOpenAddDesignation={() => { setEditingDesignation(null); setIsAddDesignationModalOpen(true); }}
        onOpenAddShift={() => { setEditingShift(null); setIsAddShiftModalOpen(true); }}
        onOpenAddEmployee={() => setIsAddEmployeeModalOpen(true)}
        onOpenMarkAttendance={() => handleOpenMarkAttendanceModal()}
      />

      {/* Main Content Area */}
      <div className="main-wrapper">
        {/* Top Header */}
        <Header
          activeView={activeView}
          departmentSubTab={departmentSubTab}
          shiftSubTab={shiftSubTab}
          attendanceSubTab={attendanceSubTab}
          leaveSubTab={leaveSubTab}
          calendarSubTab={calendarSubTab}
          payrollSubTab={payrollSubTab}
          selectedEmployeeName={selectedEmployeeName}
          selectedDepartmentName={selectedDepartmentName}
          selectedDesignationName={selectedDesignationName}
          selectedShiftName={selectedShiftName}
          onToggleMobileMenu={() => setIsMobileMenuOpen(prev => !prev)}
          onAddEmployee={() => setIsAddEmployeeModalOpen(true)}
          onAddDepartment={() => { setEditingDepartment(null); setIsAddDeptModalOpen(true); }}
          onAddDesignation={() => { setEditingDesignation(null); setIsAddDesignationModalOpen(true); }}
          onAddShift={() => { setEditingShift(null); setIsAddShiftModalOpen(true); }}
          onMarkAttendance={() => handleOpenMarkAttendanceModal()}
          onRefresh={handleMasterRefresh}
          isRefreshing={isEmployeesRefreshing || isDeptsRefreshing || isCategoriesRefreshing || isDesignationsRefreshing || isShiftsRefreshing}
          backendStatus={backendStatus}
          onOpen2FAModal={() => setIs2FAModalOpen(true)}
        />

        {/* Dynamic Page Views */}
        <main className="page-container">
          {/* VIEW 1: DASHBOARD */}
          {activeView === 'dashboard' && (
            isEmployee ? (
              <EmployeeDashboardView
                onNavigateToAttendanceHistory={() => {
                  setActiveView('attendance');
                  setAttendanceSubTab('employee');
                }}
                onNavigateToMyShift={() => setActiveView('my-shift')}
              />
            ) : (
              <DashboardView
                employees={employees}
                departments={departments}
                onNavigateToEmployees={() => setActiveView('employees')}
                onNavigateToDepartments={() => { setActiveView('departments'); setDepartmentSubTab('view'); }}
                onNavigateToAttendance={() => { setActiveView('attendance'); setAttendanceSubTab('dashboard'); }}
                onNavigateToMyAttendance={() => { setActiveView('my-attendance'); setAttendanceSubTab('mark'); }}
                onAddEmployee={() => setIsAddEmployeeModalOpen(true)}
                onAddDepartment={() => { setEditingDepartment(null); setIsAddDeptModalOpen(true); }}
                onOpen2FAModal={() => setIs2FAModalOpen(true)}
              />
            )
          )}

          {/* VIEW 2: DEPARTMENTS MODULE */}
          {activeView === 'departments' && (
            <div className="department-module-shell">
              {/* SUB-TAB 1: VIEW DEPARTMENTS */}
              {departmentSubTab === 'view' && (
                <DepartmentListView
                  departments={departments}
                  categories={categories}
                  isLoading={isDeptsLoading}
                  isRefreshing={isDeptsRefreshing}
                  error={deptFetchError}
                  onRefresh={() => fetchDepartmentsData(true)}
                  onAddDepartment={() => { setEditingDepartment(null); setIsAddDeptModalOpen(true); }}
                  onAddCategory={() => setDepartmentSubTab('categories')}
                  onAssignEmployees={() => setDepartmentSubTab('assign')}
                  onEditDepartment={(dept) => { setEditingDepartment(dept); setIsAddDeptModalOpen(true); }}
                  onViewDepartment={(deptId) => setSelectedDepartmentId(deptId)}
                  onToggleStatus={handleToggleDepartmentStatus}
                />
              )}

              {/* SUB-TAB 2: DEPARTMENT CATEGORIES */}
              {departmentSubTab === 'categories' && (
                <div className="departments-categories-wrapper">
                  <DepartmentCategoriesView
                    categories={categories}
                    departments={departments}
                    isLoading={isCategoriesLoading}
                    isRefreshing={isCategoriesRefreshing}
                    error={categoryFetchError}
                    onRefresh={() => {
                      fetchCategoriesData(true);
                      fetchDepartmentsData(true);
                    }}
                    onCategorySaved={(savedCat, isEdit) => {
                      handleCategorySaved(savedCat, isEdit);
                      fetchDepartmentsData(true);
                    }}
                    onToggleStatus={handleToggleCategoryStatus}
                    onDepartmentsChanged={() => {
                      fetchDepartmentsData(true);
                      fetchCategoriesData(true);
                    }}
                    showToast={showToast}
                  />
                </div>
              )}

              {/* SUB-TAB 3: ASSIGN EMPLOYEES */}
              {departmentSubTab === 'assign' && (
                <div className="departments-assign-wrapper">
                  <AssignEmployeeView
                    employees={employees}
                    departments={departments}
                    designations={designations}
                    onAssignmentCompleted={handleAssignmentCompleted}
                    onNavigateToEmployee={(empId) => { setSelectedEmployeeId(empId); setActiveView('employees'); }}
                  />
                </div>
              )}
            </div>
          )}

          {/* VIEW 3: DESIGNATIONS MODULE */}
          {activeView === 'designations' && (
            <div className="designations-view-shell">
              <DesignationListView
                designations={designations}
                departments={departments}
                isLoading={isDesignationsLoading}
                isRefreshing={isDesignationsRefreshing}
                error={designationFetchError}
                onRefresh={() => fetchDesignationsData(true)}
                onAddDesignation={() => { setEditingDesignation(null); setIsAddDesignationModalOpen(true); }}
                onEditDesignation={(desig) => { setEditingDesignation(desig); setIsAddDesignationModalOpen(true); }}
                onViewDesignation={(desigId) => setSelectedDesignationId(desigId)}
                onToggleStatus={handleToggleDesignationStatus}
              />
            </div>
          )}

          {/* VIEW 4: SHIFT & WORK SCHEDULE MODULE */}
          {activeView === 'shifts' && (
            <div className="shifts-module-shell">
              {shiftSubTab === 'view' && (
                <ShiftListView
                  shifts={shifts}
                  stats={shiftStats}
                  isLoading={isShiftsLoading}
                  isRefreshing={isShiftsRefreshing}
                  error={shiftFetchError}
                  onRefresh={() => fetchShiftsData(true)}
                  onAddShift={() => { setEditingShift(null); setIsAddShiftModalOpen(true); }}
                  onEditShift={(shift) => { setEditingShift(shift); setIsAddShiftModalOpen(true); }}
                  onViewShift={(shiftId) => setSelectedShiftId(shiftId)}
                  onAssignEmployees={() => setShiftSubTab('assign')}
                  onToggleStatus={handleToggleShiftStatus}
                  onDeleteShift={handleDeleteShift}
                />
              )}

              {shiftSubTab === 'assign' && (
                <div className="shifts-assign-wrapper">
                  <AssignShiftView
                    employees={employees}
                    shifts={shifts}
                    departments={departments}
                    onAssignmentCompleted={handleShiftAssignmentCompleted}
                    onNavigateToEmployee={(empId) => { setSelectedEmployeeId(empId); setActiveView('employees'); }}
                  />
                </div>
              )}
            </div>
          )}

          {/* VIEW 5: MY ATTENDANCE (PERSONAL SELF-SERVICE FOR ALL STAFF) */}
          {activeView === 'my-attendance' && (
            <div className="attendance-module-shell">
              {attendanceSubTab === 'history' ? (
                <MyAttendanceView
                  onNavigateToMarkAttendance={() => setAttendanceSubTab('mark')}
                />
              ) : (
                <MarkAttendanceView
                  onNavigateToHistory={() => setAttendanceSubTab('history')}
                  onOpenAdminMarkModal={() => handleOpenMarkAttendanceModal()}
                  onNavigateToDailyRoster={() => {
                    setActiveView('attendance');
                    setAttendanceSubTab('daily');
                  }}
                />
              )}
            </div>
          )}

          {/* VIEW 6: ATTENDANCE MANAGEMENT MODULE (ADMINISTRATIVE) */}
          {activeView === 'attendance' && !isEmployee && (
            <div className="attendance-module-shell">
              {attendanceSubTab === 'dashboard' && (
                <AttendanceDashboardView
                  onNavigateToDaily={() => setAttendanceSubTab('daily')}
                  onNavigateToRegister={() => setAttendanceSubTab('register')}
                  onNavigateToReports={() => setAttendanceSubTab('reports')}
                />
              )}

              {attendanceSubTab === 'daily' && (
                <DailyAttendanceView
                  departments={departments}
                  shifts={shifts}
                  onOpenMarkModal={handleOpenMarkAttendanceModal}
                  onOpenEditModal={handleOpenEditAttendanceModal}
                  onViewEmployeeAttendance={handleViewEmployeeAttendance}
                />
              )}

              {attendanceSubTab === 'register' && (
                <AttendanceRegisterView
                  departments={departments}
                  shifts={shifts}
                  onViewEmployeeAttendance={handleViewEmployeeAttendance}
                />
              )}

              {attendanceSubTab === 'employee' && (
                <EmployeeAttendanceView
                  employees={employees}
                  initialEmployeeId={selectedEmployeeAttendanceId}
                />
              )}

              {attendanceSubTab === 'reports' && (
                <AttendanceReportsView
                  departments={departments}
                  shifts={shifts}
                  employees={employees}
                />
              )}
            </div>
          )}

          {/* VIEW 6: EMPLOYEES DIRECTORY / PROFILE */}
          {activeView === 'employees' && (
            <div className="employees-view-content">
              {hasRole('Administrator', 'HR', 'Manager') && (
                <EmployeeStats employees={employees} />
              )}

              <div className="table-wrapper-card">
                {hasRole('Administrator', 'HR', 'Manager') && (
                  <EmployeeFilters
                    searchTerm={searchTerm}
                    setSearchTerm={setSearchTerm}
                    statusFilter={statusFilter}
                    setStatusFilter={setStatusFilter}
                    departmentFilter={departmentFilter}
                    setDepartmentFilter={setDepartmentFilter}
                    departments={departments}
                    onResetFilters={handleResetFilters}
                    totalResults={filteredEmployees.length}
                    totalEmployees={employees.length}
                  />
                )}

                {employeeFetchError && (
                  <div className="error-banner">
                    <div className="error-banner-content">
                      <AlertCircle size={20} className="error-icon" />
                      <div className="error-text">
                        <strong>Connection Error:</strong> {employeeFetchError}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => fetchEmployeesData(false)}
                    >
                      <RefreshCw size={14} />
                      <span>Retry</span>
                    </button>
                  </div>
                )}

                {isEmployeesLoading ? (
                  <TableSkeleton rows={5} />
                ) : filteredEmployees.length === 0 ? (
                  <EmptyState
                    isFiltered={searchTerm.trim() !== '' || statusFilter !== 'ALL' || departmentFilter !== 'ALL'}
                    onAddEmployee={canCreateStaff ? () => { setEditingEmployee(null); setIsAddEmployeeModalOpen(true); } : undefined}
                    onResetFilters={handleResetFilters}
                  />
                ) : (
                  <EmployeeTable
                    employees={filteredEmployees}
                    onViewEmployee={(emp) => setSelectedEmployeeId(emp.id)}
                    onEditEmployee={(emp) => { setEditingEmployee(emp); setIsAddEmployeeModalOpen(true); }}
                    onToggleStatus={(emp) => setEmployeeToToggleStatus(emp)}
                    onDeleteEmployee={(emp) => setEmployeeToDelete(emp)}
                    canEdit={canCreateStaff || isSuperAdmin || isAdmin || isHR}
                    canDelete={isSuperAdmin || (isAdmin && hasPermission('employees:delete'))}
                    canToggleStatus={canCreateStaff || isSuperAdmin || isAdmin || isHR}
                  />
                )}
              </div>
            </div>
          )}

          {/* VIEW 7: MY SHIFT (EMPLOYEE) */}
          {activeView === 'my-shift' && (
            <div className="shift-module-shell">
              <MyShiftView />
            </div>
          )}

          {/* VIEW 8: LEAVE MANAGEMENT (ADMINISTRATIVE / ALL STAFF) */}
          {activeView === 'leave' && (
            <div className="leave-module-shell">
              <LeaveModuleView initialTab={leaveSubTab} />
            </div>
          )}

          {/* VIEW 9: MY LEAVE QUOTA & ABSENCE (FOR ALL AUTHENTICATED STAFF) */}
          {activeView === 'my-leave' && (
            <div className="leave-module-shell">
              <LeaveModuleView initialTab="my-leave" />
            </div>
          )}

          {/* VIEW 10: ACADEMIC CALENDAR & HOLIDAY MANAGEMENT */}
          {activeView === 'calendar' && (
            <div className="calendar-module-shell">
              <AcademicCalendarModule initialTab={calendarSubTab} />
            </div>
          )}

          {/* VIEW 11: PAYROLL MANAGEMENT (ADMIN / HR / SUPER ADMIN) */}
          {activeView === 'payroll' && (
            <div className="payroll-module-shell">
              <PayrollModule 
                payrollSubTab={payrollSubTab} 
                setPayrollSubTab={setPayrollSubTab} 
                departments={departments} 
              />
            </div>
          )}

          {/* VIEW 12: MY PAYSLIPS (EMPLOYEE / TEACHER SELF-SERVICE) */}
          {activeView === 'my-payslips' && (
            <div className="my-payslips-module-shell">
              <MyPayslipsView />
            </div>
          )}
        </main>
      </div>

      {/* --------------------------------------------------------------------
          MODALS & DRAWERS
          -------------------------------------------------------------------- */}

      {/* Add / Edit Designation Modal */}
      {isAddDesignationModalOpen && (
        <AddEditDesignationModal
          designation={editingDesignation}
          departments={departments}
          onClose={() => { setIsAddDesignationModalOpen(false); setEditingDesignation(null); }}
          onSaved={handleDesignationSaved}
        />
      )}

      {/* Designation Details Drawer / Modal */}
      {selectedDesignationId && (
        <DesignationDetailModal
          designationId={selectedDesignationId}
          onClose={() => setSelectedDesignationId(null)}
          onEdit={(desig) => { setSelectedDesignationId(null); setEditingDesignation(desig); setIsAddDesignationModalOpen(true); }}
          onViewEmployee={(empId) => { setSelectedDesignationId(null); setSelectedEmployeeId(empId); setActiveView('employees'); }}
        />
      )}

      {/* Add / Edit Shift Modal */}
      {isAddShiftModalOpen && (
        <AddEditShiftModal
          shift={editingShift}
          isOpen={isAddShiftModalOpen}
          onClose={() => { setIsAddShiftModalOpen(false); setEditingShift(null); }}
          onShiftSaved={handleShiftSaved}
        />
      )}

      {/* Shift Details Modal */}
      {selectedShiftId && (
        <ShiftDetailModal
          shiftId={selectedShiftId}
          isOpen={Boolean(selectedShiftId)}
          onClose={() => setSelectedShiftId(null)}
          onEditShift={(shift) => { setSelectedShiftId(null); setEditingShift(shift); setIsAddShiftModalOpen(true); }}
          onAssignEmployees={() => { setSelectedShiftId(null); setShiftSubTab('assign'); setActiveView('shifts'); }}
          onNavigateToEmployee={(empId) => { setSelectedShiftId(null); setSelectedEmployeeId(empId); setActiveView('employees'); }}
        />
      )}

      {/* Add / Edit Department Modal */}
      {isAddDeptModalOpen && (
        <AddEditDepartmentModal
          department={editingDepartment}
          categories={categories}
          employees={employees}
          onClose={() => { setIsAddDeptModalOpen(false); setEditingDepartment(null); }}
          onSaved={handleDepartmentSaved}
        />
      )}

      {/* Department Details Drawer / Modal */}
      {selectedDepartmentId && (
        <DepartmentDetailModal
          departmentId={selectedDepartmentId}
          onClose={() => setSelectedDepartmentId(null)}
          onEdit={(dept) => { setSelectedDepartmentId(null); setEditingDepartment(dept); setIsAddDeptModalOpen(true); }}
          onViewEmployee={(empId) => { setSelectedDepartmentId(null); setSelectedEmployeeId(empId); setActiveView('employees'); }}
        />
      )}

      {/* Add / Edit Employee Modal */}
      {isAddEmployeeModalOpen && (
        <AddEmployeeModal
          employeeToEdit={editingEmployee}
          departments={departments}
          employeesList={employees}
          onClose={() => { setIsAddEmployeeModalOpen(false); setEditingEmployee(null); }}
          onEmployeeCreated={handleEmployeeCreated}
          onEmployeeUpdated={handleEmployeeUpdated}
          nextCodeSuggestion=""
        />
      )}

      {/* View Employee Details Drawer */}
      {selectedEmployeeId && (
        <EmployeeDetailModal
          employeeId={selectedEmployeeId}
          onClose={() => setSelectedEmployeeId(null)}
        />
      )}

      {/* Deactivate / Reactivate Confirmation Dialog */}
      {employeeToToggleStatus && (
        <div className="modal-backdrop" onClick={() => !isActionLoading && setEmployeeToToggleStatus(null)}>
          <div className="modal-container modal-dialog-confirm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-header-icon-title">
                <div className={`icon-badge-${(employeeToToggleStatus.employment_status || '').toLowerCase() === 'inactive' ? 'emerald' : 'amber'}`}>
                  {(employeeToToggleStatus.employment_status || '').toLowerCase() === 'inactive' ? <UserCheck size={20} /> : <UserX size={20} />}
                </div>
                <div>
                  <h3 className="modal-title">
                    {(employeeToToggleStatus.employment_status || '').toLowerCase() === 'inactive'
                      ? `Reactivate ${employeeToToggleStatus.first_name} ${employeeToToggleStatus.last_name || ''}?`
                      : `Deactivate ${employeeToToggleStatus.first_name} ${employeeToToggleStatus.last_name || ''}?`}
                  </h3>
                  <p className="modal-subtitle">
                    Staff Code: <code>{employeeToToggleStatus.employee_code}</code>
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setEmployeeToToggleStatus(null)}
                disabled={isActionLoading}
              >
                <X size={20} />
              </button>
            </div>

            <div className="modal-body-dialog">
              <p className="dialog-explanation">
                {(employeeToToggleStatus.employment_status || '').toLowerCase() === 'inactive' ? (
                  <>Reactivating this faculty member will restore them to <strong>Active</strong> status in school rosters and re-enable their portal credentials.</>
                ) : (
                  <>Deactivating removes this employee from active departmental assignments and disables user login, while <strong>safely preserving all historical records</strong>, attendance, and payroll audit trails.</>
                )}
              </p>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setEmployeeToToggleStatus(null)}
                disabled={isActionLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`btn ${(employeeToToggleStatus.employment_status || '').toLowerCase() === 'inactive' ? 'btn-success' : 'btn-warning'}`}
                onClick={handleConfirmToggleStatus}
                disabled={isActionLoading}
              >
                {isActionLoading ? 'Updating Status...' : (
                  (employeeToToggleStatus.employment_status || '').toLowerCase() === 'inactive' ? 'Reactivate Staff Member' : 'Deactivate Staff Member'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Permanent Delete Confirmation Dialog */}
      {employeeToDelete && (
        <div className="modal-backdrop" onClick={() => !isActionLoading && setEmployeeToDelete(null)}>
          <div className="modal-container modal-dialog-confirm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-header-icon-title">
                <div className="icon-badge-danger">
                  <Trash2 size={20} />
                </div>
                <div>
                  <h3 className="modal-title">
                    Permanently Delete {employeeToDelete.first_name} {employeeToDelete.last_name || ''}?
                  </h3>
                  <p className="modal-subtitle text-danger">
                    Warning: This action cannot be undone.
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setEmployeeToDelete(null)}
                disabled={isActionLoading}
              >
                <X size={20} />
              </button>
            </div>

            <div className="modal-body-dialog">
              <p className="dialog-explanation">
                Are you sure you want to permanently delete <strong>{employeeToDelete.first_name} {employeeToDelete.last_name || ''}</strong> (<code>{employeeToDelete.employee_code}</code>) from the database?
              </p>
              <div className="dialog-warning-card">
                <AlertCircle size={18} className="warning-icon" />
                <p className="warning-text">
                  Permanent deletion is only permitted for test/accidental records without dependent historical data. If this employee is a Department Head, reports manager, or has payroll records, deletion will be safely rejected by the database.
                </p>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setEmployeeToDelete(null)}
                disabled={isActionLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleConfirmDeleteEmployee}
                disabled={isActionLoading}
              >
                {isActionLoading ? 'Deleting Record...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mark / Edit Attendance Modal */}
      {isMarkAttendanceModalOpen && (
        <MarkAttendanceModal
          isOpen={isMarkAttendanceModalOpen}
          onClose={() => {
            setIsMarkAttendanceModalOpen(false);
            setEditingAttendanceRecord(null);
            setAttendanceModalInitialEmployee(null);
          }}
          onSaved={handleAttendanceSaved}
          editingRecord={editingAttendanceRecord}
          initialDate={attendanceModalInitialDate}
          initialEmployee={attendanceModalInitialEmployee}
          employees={employees}
          shifts={shifts}
        />
      )}

      {/* Attendance Audit Log Modal */}
      {auditModalEmployeeId && (
        <AttendanceAuditModal
          isOpen={Boolean(auditModalEmployeeId)}
          onClose={() => {
            setAuditModalEmployeeId(null);
            setAuditModalEmployeeName(null);
          }}
          employeeId={auditModalEmployeeId}
          employeeName={auditModalEmployeeName}
        />
      )}

      {/* Two-Factor Authentication Setup Modal */}
      {is2FAModalOpen && (
        <TwoFactorSetupModal
          onClose={() => setIs2FAModalOpen(false)}
          onStatusUpdated={(enabled) => {
            showToast(
              'success',
              'Security Updated',
              enabled ? 'Two-Factor Authentication activated!' : 'Two-Factor Authentication disabled.'
            );
          }}
        />
      )}
    </div>
  );
}

export function App() {
  return (
    <AuthProvider>
      <MainAppShell />
    </AuthProvider>
  );
}

export default App;
