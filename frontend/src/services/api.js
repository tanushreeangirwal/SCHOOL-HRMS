/**
 * St. Vincent's School HRMS - Centralized API Service Layer
 * Clean, production-ready client for REST API endpoints.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const TOKEN_STORAGE_KEY = 'school_hrms_auth_token';

/**
 * Retrieves the stored JWT authentication token
 */
export function getStoredToken() {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

/**
 * Persists the JWT authentication token
 */
export function setStoredToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
}

/**
 * Removes the stored JWT authentication token
 */
export function removeStoredToken() {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
}

/**
 * Sanitizes form payload before sending to backend.
 * Converts empty strings to null to ensure compatibility with PostgreSQL UUID, DATE, and nullable columns.
 */
function sanitizePayload(data) {
  const sanitized = {};
  for (const [key, value] of Object.entries(data)) {
    if (value === '' || value === undefined) {
      sanitized[key] = null;
    } else if (typeof value === 'string') {
      sanitized[key] = value.trim();
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

/**
 * Generic request helper with automatic token injection and error handling
 */
async function request(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const token = getStoredToken();
  
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  try {
    const response = await fetch(url, {
      ...options,
      headers
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      // If 401 Unauthorized or expired token on protected routes, broadcast expiration
      if (response.status === 401 && !endpoint.startsWith('/auth/login') && !endpoint.startsWith('/auth/verify-2fa')) {
        removeStoredToken();
        window.dispatchEvent(new Event('auth:session_expired'));
      }

      const errorMessage = data?.message || data?.error || `HTTP error ${response.status}: ${response.statusText}`;
      const err = new Error(errorMessage);
      err.status = response.status;
      err.data = data;
      throw err;
    }

    return data;
  } catch (err) {
    if (err.name === 'TypeError' && err.message === 'Failed to fetch') {
      const connErr = new Error('Cannot connect to St. Vincent\'s backend server (http://localhost:5000). Please ensure backend is running.');
      connErr.isNetworkError = true;
      throw connErr;
    }
    throw err;
  }
}

export const hrmsApi = {
  // ------------------------------------------------------------------------
  // Authentication & Security (Public & Protected)
  // ------------------------------------------------------------------------
  async login(identifierOrCredentials, password) {
    let payload;
    if (typeof identifierOrCredentials === 'object' && identifierOrCredentials !== null) {
      payload = identifierOrCredentials;
    } else {
      payload = { email: identifierOrCredentials, password };
    }
    return request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async verify2FA(tempToken, code) {
    const payload = typeof tempToken === 'object' && tempToken !== null
      ? tempToken
      : { tempToken, code };
    return request('/auth/verify-2fa', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async getMe() {
    return request('/auth/me');
  },

  async getCurrentUser() {
    return request('/auth/me');
  },

  async logout() {
    return request('/auth/logout', { method: 'POST' }).catch(() => ({ success: true }));
  },

  async setup2FA() {
    return request('/auth/2fa/setup', {
      method: 'POST'
    });
  },

  async enable2FA(token) {
    return request('/auth/2fa/enable', {
      method: 'POST',
      body: JSON.stringify({ token })
    });
  },

  async disable2FA(password) {
    return request('/auth/2fa/disable', {
      method: 'POST',
      body: JSON.stringify({ password })
    });
  },

  // ------------------------------------------------------------------------
  // Department Categories (Protected)
  // ------------------------------------------------------------------------
  async getDepartmentCategories(params = {}) {
    const query = new URLSearchParams();
    if (params.search) query.append('search', params.search);
    if (params.status) query.append('status', params.status);

    const queryString = query.toString() ? `?${query.toString()}` : '';
    return request(`/department-categories${queryString}`);
  },

  async createDepartmentCategory(categoryData) {
    const payload = sanitizePayload(categoryData);
    return request('/department-categories', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async updateDepartmentCategory(id, categoryData) {
    const payload = sanitizePayload(categoryData);
    return request(`/department-categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  },

  async toggleDepartmentCategoryStatus(id, is_active) {
    return request(`/department-categories/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active })
    });
  },

  // ------------------------------------------------------------------------
  // Departments (Protected)
  // ------------------------------------------------------------------------
  async getDepartments(params = {}) {
    const query = new URLSearchParams();
    if (params.search) query.append('search', params.search);
    if (params.category_id) query.append('category_id', params.category_id);
    if (params.status) query.append('status', params.status);

    const queryString = query.toString() ? `?${query.toString()}` : '';
    return request(`/departments${queryString}`);
  },

  async getDepartmentById(id) {
    return request(`/departments/${id}`);
  },

  async createDepartment(departmentData) {
    const payload = sanitizePayload(departmentData);
    return request('/departments', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async updateDepartment(id, departmentData) {
    const payload = sanitizePayload(departmentData);
    return request(`/departments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  },

  async toggleDepartmentStatus(id, is_active) {
    return request(`/departments/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active })
    });
  },

  async updateDepartmentCategory(id, category_id) {
    try {
      return await request(`/departments/${id}/category`, {
        method: 'PATCH',
        body: JSON.stringify({ category_id: category_id || null })
      });
    } catch (err) {
      if (err.status === 404) {
        const deptRes = await request(`/departments/${id}`);
        if (deptRes && deptRes.data) {
          const dept = deptRes.data;
          return await request(`/departments/${id}`, {
            method: 'PUT',
            body: JSON.stringify({
              name: dept.name,
              code: dept.code,
              category_id: category_id || null,
              description: dept.description,
              head_id: dept.head_id,
              branch_id: dept.branch_id,
              is_active: dept.is_active,
              effective_date: dept.effective_date
            })
          });
        }
      }
      throw err;
    }
  },

  async assignEmployeeToDepartment(assignmentData) {
    const payload = sanitizePayload(assignmentData);
    return request('/departments/assign', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async getDepartmentAssignmentHistory() {
    return request('/departments/assignments/history');
  },

  // ------------------------------------------------------------------------
  // Designations (Protected)
  // ------------------------------------------------------------------------
  async getDesignations(params = {}) {
    const query = new URLSearchParams();
    if (params.search) query.append('search', params.search);
    if (params.department_id) query.append('department_id', params.department_id);
    if (params.status) query.append('status', params.status);

    const queryString = query.toString() ? `?${query.toString()}` : '';
    return request(`/designations${queryString}`);
  },

  async getDesignationById(id) {
    return request(`/designations/${id}`);
  },

  async createDesignation(designationData) {
    const payload = sanitizePayload(designationData);
    return request('/designations', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async updateDesignation(id, designationData) {
    const payload = sanitizePayload(designationData);
    return request(`/designations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  },

  async toggleDesignationStatus(id, is_active) {
    return request(`/designations/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active })
    });
  },

  // ------------------------------------------------------------------------
  // Employees (Protected)
  // ------------------------------------------------------------------------
  async getEmployees(params = {}) {
    const query = new URLSearchParams();
    if (params.search) query.append('search', params.search);
    if (params.department_id) query.append('department_id', params.department_id);
    if (params.status) query.append('status', params.status);

    const queryString = query.toString() ? `?${query.toString()}` : '';
    return request(`/employees${queryString}`);
  },

  async getEmployeeById(id) {
    return request(`/employees/${id}`);
  },

  async createEmployee(employeeData) {
    const payload = sanitizePayload(employeeData);
    return request('/employees', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async updateEmployee(id, employeeData) {
    const payload = sanitizePayload(employeeData);
    return request(`/employees/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  },

  async toggleEmployeeStatus(id, status) {
    return request(`/employees/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    });
  },

  async deleteEmployee(id) {
    return request(`/employees/${id}`, {
      method: 'DELETE'
    });
  },

  // ------------------------------------------------------------------------
  // Shifts & Work Schedules (Protected)
  // ------------------------------------------------------------------------
  async getShifts(params = {}) {
    const query = new URLSearchParams();
    if (params.search) query.append('search', params.search);
    if (params.status) query.append('status', params.status);
    if (params.working_day) query.append('working_day', params.working_day);

    const queryString = query.toString() ? `?${query.toString()}` : '';
    return request(`/shifts${queryString}`);
  },

  async getShiftStats() {
    return request('/shifts/stats');
  },

  async getShiftById(id) {
    return request(`/shifts/${id}`);
  },

  async createShift(shiftData) {
    const payload = sanitizePayload(shiftData);
    return request('/shifts', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async updateShift(id, shiftData) {
    const payload = sanitizePayload(shiftData);
    return request(`/shifts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  },

  async toggleShiftStatus(id, is_active) {
    return request(`/shifts/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active })
    });
  },

  async deleteShift(id) {
    return request(`/shifts/${id}`, {
      method: 'DELETE'
    });
  },

  async assignEmployeeShift(assignmentData) {
    const payload = sanitizePayload(assignmentData);
    return request('/shifts/assign', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async getShiftAssignmentHistory(params = {}) {
    const query = new URLSearchParams();
    if (params.search) query.append('search', params.search);
    if (params.employee_id) query.append('employee_id', params.employee_id);
    if (params.shift_id) query.append('shift_id', params.shift_id);

    const queryString = query.toString() ? `?${query.toString()}` : '';
    return request(`/shifts/assignments/history${queryString}`);
  },

  async getUnassignedShiftEmployees() {
    return request('/shifts/unassigned/employees');
  },

  async getEmployeeShiftHistory(employeeId) {
    return request(`/shifts/employee/${employeeId}/history`);
  },

  // ------------------------------------------------------------------------
  // Attendance Management
  // ------------------------------------------------------------------------
  async getAttendanceDashboard(date) {
    const query = date ? `?date=${encodeURIComponent(date)}` : '';
    return request(`/attendance/dashboard${query}`);
  },

  async getDailyAttendance(params = {}) {
    const query = new URLSearchParams();
    if (params.date) query.append('date', params.date);
    if (params.department_id) query.append('department_id', params.department_id);
    if (params.shift_id) query.append('shift_id', params.shift_id);
    if (params.status) query.append('status', params.status);
    if (params.search) query.append('search', params.search);

    const queryString = query.toString() ? `?${query.toString()}` : '';
    return request(`/attendance/daily${queryString}`);
  },

  async getAttendanceRegister(params = {}) {
    const query = new URLSearchParams();
    if (params.month) query.append('month', params.month);
    if (params.department_id) query.append('department_id', params.department_id);
    if (params.shift_id) query.append('shift_id', params.shift_id);
    if (params.search) query.append('search', params.search);

    const queryString = query.toString() ? `?${query.toString()}` : '';
    return request(`/attendance/register${queryString}`);
  },

  async getEmployeeAttendance(employeeId, month) {
    const query = month ? `?month=${encodeURIComponent(month)}` : '';
    return request(`/attendance/employee/${employeeId}${query}`);
  },

  async getAttendanceReports(params = {}) {
    const query = new URLSearchParams();
    if (params.startDate) query.append('startDate', params.startDate);
    if (params.endDate) query.append('endDate', params.endDate);
    if (params.department_id) query.append('department_id', params.department_id);
    if (params.shift_id) query.append('shift_id', params.shift_id);
    if (params.employee_id) query.append('employee_id', params.employee_id);
    if (params.status) query.append('status', params.status);

    const queryString = query.toString() ? `?${query.toString()}` : '';
    return request(`/attendance/reports${queryString}`);
  },

  async getAttendanceAudit(params = {}) {
    const query = new URLSearchParams();
    if (params.employee_id) query.append('employee_id', params.employee_id);
    if (params.date) query.append('date', params.date);

    const queryString = query.toString() ? `?${query.toString()}` : '';
    return request(`/attendance/audit${queryString}`);
  },

  async markAttendance(attendanceData) {
    const payload = sanitizePayload(attendanceData);
    return request('/attendance', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async updateAttendance(id, attendanceData) {
    const payload = sanitizePayload(attendanceData);
    return request(`/attendance/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  },

  async quickMarkAttendance(data = {}) {
    const payload = sanitizePayload(data);
    return request('/attendance/quick-mark', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  // ------------------------------------------------------------------------
  // Employee Self-Attendance & Profile Services
  // ------------------------------------------------------------------------
  async getMyTodayAttendance() {
    return request('/attendance/my-today');
  },

  async employeeCheckIn() {
    return request('/attendance/check-in', {
      method: 'POST'
    });
  },

  async employeeCheckOut() {
    return request('/attendance/check-out', {
      method: 'POST'
    });
  },

  async getMyAttendanceSummary(month) {
    const query = month ? `?month=${encodeURIComponent(month)}` : '';
    return request(`/attendance/my-summary${query}`);
  },

  async getMyShift() {
    return request('/attendance/my-shift');
  },

  // ------------------------------------------------------------------------
  // Leave Management Services
  // ------------------------------------------------------------------------
  async getLeaveDashboard() {
    return request('/leaves/dashboard');
  },

  async getLeaveTypes(includeInactive = false) {
    const query = includeInactive ? '?include_inactive=true' : '';
    return request(`/leaves/types${query}`);
  },

  async createLeaveType(data) {
    const payload = sanitizePayload(data);
    return request('/leaves/types', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async updateLeaveType(id, data) {
    const payload = sanitizePayload(data);
    return request(`/leaves/types/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  },

  async deleteLeaveType(id) {
    return request(`/leaves/types/${id}`, {
      method: 'DELETE'
    });
  },

  async getLeaveRequests(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.status && params.status !== 'ALL') searchParams.append('status', params.status);
    if (params.leave_type_id && params.leave_type_id !== 'ALL') searchParams.append('leave_type_id', params.leave_type_id);
    if (params.department_id && params.department_id !== 'ALL') searchParams.append('department_id', params.department_id);
    if (params.employee_id && params.employee_id !== 'ALL') searchParams.append('employee_id', params.employee_id);
    if (params.search) searchParams.append('search', params.search);
    if (params.start_date) searchParams.append('start_date', params.start_date);
    if (params.end_date) searchParams.append('end_date', params.end_date);
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return request(`/leaves/requests${query}`);
  },

  async getLeaveRequestById(id) {
    return request(`/leaves/requests/${id}`);
  },

  async applyLeave(data) {
    const payload = sanitizePayload(data);
    return request('/leaves/requests', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async approveLeave(id) {
    return request(`/leaves/requests/${id}/approve`, {
      method: 'PUT'
    });
  },

  async rejectLeave(id, reason) {
    return request(`/leaves/requests/${id}/reject`, {
      method: 'PUT',
      body: JSON.stringify({ rejection_reason: reason })
    });
  },

  async cancelLeave(id) {
    return request(`/leaves/requests/${id}/cancel`, {
      method: 'PUT'
    });
  },

  async getMyLeaveSummary() {
    return request('/leaves/my-summary');
  },

  async getLeaveCalendar(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.month) searchParams.append('month', params.month);
    if (params.department_id && params.department_id !== 'ALL') searchParams.append('department_id', params.department_id);
    if (params.leave_type_id && params.leave_type_id !== 'ALL') searchParams.append('leave_type_id', params.leave_type_id);
    if (params.employee_id && params.employee_id !== 'ALL') searchParams.append('employee_id', params.employee_id);
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return request(`/leaves/calendar${query}`);
  },

  async exportLeaveRequests(params = {}) {
    const token = localStorage.getItem('school_hrms_auth_token');
    const searchParams = new URLSearchParams();
    if (params.status && params.status !== 'ALL') searchParams.append('status', params.status);
    if (params.leave_type_id && params.leave_type_id !== 'ALL') searchParams.append('leave_type_id', params.leave_type_id);
    if (params.department_id && params.department_id !== 'ALL') searchParams.append('department_id', params.department_id);
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    
    const res = await fetch(`${API_BASE_URL}/leaves/export${query}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    if (!res.ok) throw new Error('Failed to download leave export CSV');
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `st_vincents_leaves_${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
    return true;
  },

  // ------------------------------------------------------------------------
  // Academic Calendar & Holiday Management Services
  // ------------------------------------------------------------------------
  async getCalendarOverview() {
    return request('/academic-calendar/overview');
  },

  async getCalendarMonth(year, month) {
    const query = (year && month) ? `?year=${year}&month=${month}` : '';
    return request(`/academic-calendar/month${query}`);
  },

  async getDayStatus(date) {
    const query = date ? `?date=${encodeURIComponent(date)}` : '';
    return request(`/academic-calendar/day-status${query}`);
  },

  async getAcademicYears() {
    return request('/academic-calendar/years');
  },

  async getAcademicYearById(id) {
    return request(`/academic-calendar/years/${id}`);
  },

  async createAcademicYear(data) {
    const payload = sanitizePayload(data);
    return request('/academic-calendar/years', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async updateAcademicYear(id, data) {
    const payload = sanitizePayload(data);
    return request(`/academic-calendar/years/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  },

  async activateAcademicYear(id) {
    return request(`/academic-calendar/years/${id}/activate`, {
      method: 'PATCH'
    });
  },

  async toggleAcademicYearStatus(id, statusData) {
    return request(`/academic-calendar/years/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify(statusData)
    });
  },

  async deleteAcademicYear(id) {
    return request(`/academic-calendar/years/${id}`, {
      method: 'DELETE'
    });
  },

  async getAcademicTerms(academicYearId) {
    const query = academicYearId ? `?academic_year_id=${encodeURIComponent(academicYearId)}` : '';
    return request(`/academic-calendar/terms${query}`);
  },

  async createAcademicTerm(data) {
    const payload = sanitizePayload(data);
    return request('/academic-calendar/terms', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async updateAcademicTerm(id, data) {
    const payload = sanitizePayload(data);
    return request(`/academic-calendar/terms/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  },

  async toggleAcademicTermStatus(id, is_active) {
    return request(`/academic-calendar/terms/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active })
    });
  },

  async deleteAcademicTerm(id) {
    return request(`/academic-calendar/terms/${id}`, {
      method: 'DELETE'
    });
  },

  async getCalendarEvents(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.search) searchParams.append('search', params.search);
    if (params.academic_year_id && params.academic_year_id !== 'ALL') searchParams.append('academic_year_id', params.academic_year_id);
    if (params.event_type && params.event_type !== 'ALL') searchParams.append('event_type', params.event_type);
    if (params.month) searchParams.append('month', params.month);
    if (params.status && params.status !== 'ALL') searchParams.append('status', params.status);
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return request(`/academic-calendar/events${query}`);
  },

  async getCalendarEventById(id) {
    return request(`/academic-calendar/events/${id}`);
  },

  async createCalendarEvent(data) {
    const payload = sanitizePayload(data);
    return request('/academic-calendar/events', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async updateCalendarEvent(id, data) {
    const payload = sanitizePayload(data);
    return request(`/academic-calendar/events/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  },

  async toggleCalendarEventStatus(id, is_active) {
    return request(`/academic-calendar/events/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active })
    });
  },

  async deleteCalendarEvent(id) {
    return request(`/academic-calendar/events/${id}`, {
      method: 'DELETE'
    });
  },

  async getUpcomingCalendarEvents() {
    return request('/academic-calendar/upcoming');
  }
};

export default hrmsApi;
