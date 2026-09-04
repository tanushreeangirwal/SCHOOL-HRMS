const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken, requireRole, getManagerDepartmentIds } = require('../middleware/auth');

const SCHOOL_TIMEZONE = process.env.APP_TIMEZONE || 'Asia/Kolkata';

/**
 * Returns today's date in YYYY-MM-DD format for the school campus timezone
 */
function getSchoolTodayDate() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: SCHOOL_TIMEZONE }).format(new Date());
}

/**
 * Returns current time in HH:MM format for the school campus timezone
 */
function getSchoolCurrentTimeStr() {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: SCHOOL_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(new Date());
}

/**
 * Formats a Date/timestamp into 12-hour school time (e.g. "10:30 AM") in school timezone
 */
function formatSchoolTime(dateVal) {
  if (!dateVal) return null;
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('en-US', {
    timeZone: SCHOOL_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  }).format(d);
}

/**
 * Helper to calculate minutes difference between two HH:MM or ISO timestamp strings
 */
function calculateMinutesLate(checkInTimeStr, shiftStartTimeStr) {
  if (!checkInTimeStr || !shiftStartTimeStr) return 0;

  // Extract HH:MM
  let inH, inM;
  if (checkInTimeStr.includes('T') || checkInTimeStr.includes(' ')) {
    const timePart = checkInTimeStr.split(/[T ]/)[1];
    [inH, inM] = timePart.split(':').map(Number);
  } else {
    [inH, inM] = checkInTimeStr.split(':').map(Number);
  }

  const [sH, sM] = shiftStartTimeStr.slice(0, 5).split(':').map(Number);

  const totalIn = inH * 60 + inM;
  const totalStart = sH * 60 + sM;

  const diff = totalIn - totalStart;
  return diff > 0 ? diff : 0;
}

/**
 * Helper to format duration in "Xh Ym"
 */
function formatWorkingHours(checkIn, checkOut) {
  if (!checkIn || !checkOut) return '—';
  const t1 = new Date(checkIn);
  const t2 = new Date(checkOut);
  if (isNaN(t1.getTime()) || isNaN(t2.getTime())) return '—';

  let diffMs = t2.getTime() - t1.getTime();
  if (diffMs < 0) return '—';

  const totalMins = Math.floor(diffMs / (1000 * 60));
  const hrs = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  return `${hrs}h ${mins}m`;
}

// ============================================================================
// 1. GET /api/attendance/dashboard — Real-time attendance KPIs and breakdown
// ============================================================================
router.get('/dashboard', authenticateToken, async (req, res) => {
  try {
    const targetDate = req.query.date || getSchoolTodayDate();

    // Fetch active employees with their attendance on targetDate
    const result = await pool.query(`
      SELECT 
        e.id as employee_id,
        e.employee_code,
        e.first_name,
        e.last_name,
        d.id as department_id,
        d.name as department_name,
        s.id as shift_id,
        s.name as shift_name,
        ar.id as attendance_id,
        ar.status,
        ar.check_in,
        ar.check_out,
        ar.late_minutes
      FROM employees e
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN shifts s ON e.current_shift_id = s.id
      LEFT JOIN attendance_records ar ON e.id = ar.employee_id AND ar.attendance_date = $1
      WHERE e.employment_status = 'Active'
      ORDER BY d.name, e.first_name;
    `, [targetDate]);

    const rows = result.rows;
    const totalStaff = rows.length;

    let present = 0;
    let absent = 0;
    let late = 0;
    let onLeave = 0;
    let halfDay = 0;
    let notMarked = 0;

    const deptStats = {};

    rows.forEach(r => {
      const st = r.status;
      if (st === 'Present') present++;
      else if (st === 'Absent') absent++;
      else if (st === 'Late') late++;
      else if (st === 'On Leave') onLeave++;
      else if (st === 'Half Day') halfDay++;
      else notMarked++;

      const deptName = r.department_name || 'Unassigned';
      if (!deptStats[deptName]) {
        deptStats[deptName] = { department: deptName, total: 0, present: 0, late: 0, absent: 0, onLeave: 0 };
      }
      deptStats[deptName].total++;
      if (st === 'Present') deptStats[deptName].present++;
      if (st === 'Late') deptStats[deptName].late++;
      if (st === 'Absent') deptStats[deptName].absent++;
      if (st === 'On Leave') deptStats[deptName].onLeave++;
    });

    const departmentSummary = Object.values(deptStats).map(d => ({
      ...d,
      attendanceRate: d.total > 0 ? Math.round(((d.present + d.late) / d.total) * 100) : 0
    }));

    const attendanceRate = totalStaff > 0 ? Math.round(((present + late) / totalStaff) * 100) : 0;

    return res.json({
      success: true,
      data: {
        date: targetDate,
        metrics: {
          total_staff: totalStaff,
          present,
          absent,
          late,
          on_leave: onLeave,
          half_day: halfDay,
          not_marked: notMarked,
          attendance_rate: attendanceRate
        },
        department_summary: departmentSummary
      }
    });
  } catch (err) {
    console.error('Attendance dashboard error:', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve attendance dashboard.' });
  }
});

// ============================================================================
// 2. GET /api/attendance/daily — Operational daily roster
// ============================================================================
router.get('/daily', authenticateToken, async (req, res) => {
  try {
    const { date, department_id, shift_id, status, search } = req.query;
    const targetDate = date || getSchoolTodayDate();

    let query = `
      SELECT 
        e.id as employee_id,
        e.employee_code,
        e.first_name,
        e.last_name,
        e.profile_photo_url,
        d.id as department_id,
        d.name as department_name,
        des.name as designation_name,
        s.id as shift_id,
        s.name as shift_name,
        s.code as shift_code,
        s.start_time as shift_start_time,
        s.end_time as shift_end_time,
        s.late_grace_minutes,
        ar.id as attendance_id,
        ar.attendance_date,
        ar.check_in,
        ar.check_out,
        ar.status,
        ar.late_minutes,
        ar.early_departure_minutes,
        ar.overtime_minutes,
        ar.remarks,
        ar.source
      FROM employees e
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN designations des ON e.designation_id = des.id
      LEFT JOIN shifts s ON e.current_shift_id = s.id
      LEFT JOIN attendance_records ar ON e.id = ar.employee_id AND ar.attendance_date = $1
      WHERE e.employment_status = 'Active'
    `;

    const params = [targetDate];
    let paramIndex = 2;

    const userRole = (req.user.role || '').toLowerCase();
    if (userRole === 'manager') {
      const managerDepts = await getManagerDepartmentIds(req.user);
      if (managerDepts && managerDepts.length > 0) {
        query += ` AND e.department_id = ANY($${paramIndex}::uuid[])`;
        params.push(managerDepts);
        paramIndex++;
      }
    }

    if (department_id && department_id !== 'ALL') {
      query += ` AND (e.department_id = $${paramIndex} OR d.name = $${paramIndex})`;
      params.push(department_id);
      paramIndex++;
    }

    if (shift_id && shift_id !== 'ALL') {
      query += ` AND (e.current_shift_id = $${paramIndex} OR s.name = $${paramIndex})`;
      params.push(shift_id);
      paramIndex++;
    }

    if (status && status !== 'ALL') {
      if (status === 'Not Marked') {
        query += ` AND ar.id IS NULL`;
      } else {
        query += ` AND ar.status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
      }
    }

    if (search && search.trim() !== '') {
      const term = `%${search.trim().toLowerCase()}%`;
      query += ` AND (
        LOWER(e.first_name) LIKE $${paramIndex} OR 
        LOWER(e.last_name) LIKE $${paramIndex} OR 
        LOWER(e.employee_code) LIKE $${paramIndex} OR
        LOWER(d.name) LIKE $${paramIndex} OR
        LOWER(des.name) LIKE $${paramIndex}
      )`;
      params.push(term);
      paramIndex++;
    }

    query += ` ORDER BY d.name ASC, e.first_name ASC;`;

    const result = await pool.query(query, params);

    const formattedRecords = result.rows.map(r => ({
      ...r,
      employee_name: `${r.first_name} ${r.last_name || ''}`.trim(),
      shift_start_formatted: r.shift_start_time ? r.shift_start_time.slice(0, 5) : '—',
      shift_end_formatted: r.shift_end_time ? r.shift_end_time.slice(0, 5) : '—',
      check_in_time_formatted: r.check_in ? formatSchoolTime(r.check_in) : '—',
      check_out_time_formatted: r.check_out ? formatSchoolTime(r.check_out) : '—',
      working_hours_formatted: formatWorkingHours(r.check_in, r.check_out)
    }));

    return res.json({
      success: true,
      data: {
        date: targetDate,
        total: formattedRecords.length,
        records: formattedRecords
      }
    });
  } catch (err) {
    console.error('Daily attendance error:', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve daily attendance roster.' });
  }
});

// ============================================================================
// 3. GET /api/attendance/register — Monthly Matrix for All Staff
// ============================================================================
router.get('/register', authenticateToken, async (req, res) => {
  try {
    const { month, department_id, shift_id, search } = req.query;
    
    // Default to current month YYYY-MM
    const currentMonth = month || new Date().toISOString().slice(0, 7);
    const [yearStr, monthStr] = currentMonth.split('-');
    const year = parseInt(yearStr, 10);
    const mIndex = parseInt(monthStr, 10) - 1;

    // Calculate total days in month
    const totalDaysInMonth = new Date(year, mIndex + 1, 0).getDate();
    const startDateStr = `${currentMonth}-01`;
    const endDateStr = `${currentMonth}-${String(totalDaysInMonth).padStart(2, '0')}`;

    // Fetch working days for all shifts
    const shiftDaysRes = await pool.query('SELECT shift_id, day_of_week FROM shift_working_days;');
    const shiftDaysMap = {};
    shiftDaysRes.rows.forEach(r => {
      if (!shiftDaysMap[r.shift_id]) shiftDaysMap[r.shift_id] = [];
      shiftDaysMap[r.shift_id].push(r.day_of_week);
    });

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    // Fetch active employees with optional filters
    let empQuery = `
      SELECT 
        e.id, 
        e.employee_code, 
        e.first_name, 
        e.last_name, 
        e.profile_photo_url,
        d.id as department_id,
        d.name as department_name,
        des.name as designation_name,
        e.current_shift_id,
        s.name as shift_name
      FROM employees e
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN designations des ON e.designation_id = des.id
      LEFT JOIN shifts s ON e.current_shift_id = s.id
      WHERE e.employment_status = 'Active'
    `;

    const empParams = [];
    let pIdx = 1;

    if (department_id && department_id !== 'ALL') {
      empQuery += ` AND (e.department_id = $${pIdx} OR d.name = $${pIdx})`;
      empParams.push(department_id);
      pIdx++;
    }

    if (shift_id && shift_id !== 'ALL') {
      empQuery += ` AND (e.current_shift_id = $${pIdx} OR s.name = $${pIdx})`;
      empParams.push(shift_id);
      pIdx++;
    }

    if (search && search.trim() !== '') {
      const term = `%${search.trim().toLowerCase()}%`;
      empQuery += ` AND (
        LOWER(e.first_name) LIKE $${pIdx} OR 
        LOWER(e.last_name) LIKE $${pIdx} OR 
        LOWER(e.employee_code) LIKE $${pIdx}
      )`;
      empParams.push(term);
      pIdx++;
    }

    empQuery += ` ORDER BY d.name, e.first_name;`;
    const employeesRes = await pool.query(empQuery, empParams);

    // Fetch all attendance records for this month
    const attRes = await pool.query(`
      SELECT 
        employee_id, 
        attendance_date, 
        status, 
        check_in, 
        check_out, 
        late_minutes 
      FROM attendance_records 
      WHERE attendance_date >= $1 AND attendance_date <= $2;
    `, [startDateStr, endDateStr]);

    const attMap = {};
    attRes.rows.forEach(r => {
      const dStr = r.attendance_date instanceof Date 
        ? r.attendance_date.toISOString().split('T')[0] 
        : String(r.attendance_date).slice(0, 10);
      const key = `${r.employee_id}_${dStr}`;
      attMap[key] = r;
    });

    const matrix = employeesRes.rows.map(emp => {
      const days = [];
      let presentCount = 0;
      let lateCount = 0;
      let absentCount = 0;
      let leaveCount = 0;
      let halfDayCount = 0;
      let nonWorkingCount = 0;

      const allowedDays = emp.current_shift_id && shiftDaysMap[emp.current_shift_id]
        ? shiftDaysMap[emp.current_shift_id]
        : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

      for (let dayNum = 1; dayNum <= totalDaysInMonth; dayNum++) {
        const dateObj = new Date(year, mIndex, dayNum);
        const dayName = dayNames[dateObj.getDay()];
        const dateStr = `${currentMonth}-${String(dayNum).padStart(2, '0')}`;
        const isWorkingDay = allowedDays.includes(dayName);

        const rec = attMap[`${emp.id}_${dateStr}`];

        let code = '-';
        let status = 'Non-Working';

        if (isWorkingDay) {
          if (rec) {
            status = rec.status;
            if (status === 'Present') { code = 'P'; presentCount++; }
            else if (status === 'Late') { code = 'L'; lateCount++; }
            else if (status === 'Absent') { code = 'A'; absentCount++; }
            else if (status === 'On Leave') { code = 'LV'; leaveCount++; }
            else if (status === 'Half Day') { code = 'H'; halfDayCount++; }
            else { code = '?'; }
          } else {
            // Unmarked working day
            code = '•';
            status = 'Not Marked';
          }
        } else {
          code = '-';
          status = 'Weekend / Off';
          nonWorkingCount++;
        }

        days.push({
          day: dayNum,
          date: dateStr,
          dayOfWeek: dayName.slice(0, 3),
          isWorkingDay,
          code,
          status,
          check_in: rec?.check_in || null,
          check_out: rec?.check_out || null
        });
      }

      return {
        employee_id: emp.id,
        employee_code: emp.employee_code,
        employee_name: `${emp.first_name} ${emp.last_name || ''}`.trim(),
        profile_photo_url: emp.profile_photo_url,
        department_name: emp.department_name,
        designation_name: emp.designation_name,
        shift_name: emp.shift_name,
        days,
        summary: {
          present: presentCount,
          late: lateCount,
          absent: absentCount,
          leave: leaveCount,
          half_day: halfDayCount,
          non_working: nonWorkingCount,
          total_working_days: totalDaysInMonth - nonWorkingCount
        }
      };
    });

    return res.json({
      success: true,
      data: {
        month: currentMonth,
        days_in_month: totalDaysInMonth,
        total_employees: matrix.length,
        register: matrix
      }
    });
  } catch (err) {
    console.error('Attendance register error:', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve attendance register.' });
  }
});

// ============================================================================
// 4. GET /api/attendance/employee/:id — Individual Staff Attendance History
// ============================================================================
router.get('/employee/:id', authenticateToken, async (req, res) => {
  try {
    const employeeId = req.params.id;
    const userRole = (req.user.role || '').toLowerCase().trim();

    // Employee role can only view their own attendance
    if (userRole === 'employee' && req.user.employee_id !== employeeId) {
      return res.status(403).json({ success: false, message: 'Access denied. You can only view your own attendance.' });
    }

    const currentMonth = req.query.month || new Date().toISOString().slice(0, 7);

    // Fetch employee details
    const empRes = await pool.query(`
      SELECT 
        e.id, 
        e.employee_code, 
        e.first_name, 
        e.last_name, 
        COALESCE(e.work_email, e.personal_email) as email,
        e.profile_photo_url,
        e.employment_status,
        d.name as department_name,
        des.name as designation_name,
        s.id as shift_id,
        s.name as shift_name,
        s.code as shift_code,
        s.start_time,
        s.end_time,
        s.late_grace_minutes
      FROM employees e
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN designations des ON e.designation_id = des.id
      LEFT JOIN shifts s ON e.current_shift_id = s.id
      WHERE e.id = $1;
    `, [employeeId]);

    if (empRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Employee record not found.' });
    }

    const employee = empRes.rows[0];

    // Fetch shift working days safely
    let workingDaysList = [];
    if (employee.shift_id) {
      const shiftDaysRes = await pool.query('SELECT day_of_week FROM shift_working_days WHERE shift_id = $1;', [employee.shift_id]);
      workingDaysList = shiftDaysRes.rows.map(r => r.day_of_week);
    }

    // Fetch attendance records for this employee for the requested month
    const attRes = await pool.query(`
      SELECT 
        ar.id,
        ar.attendance_date,
        ar.status,
        ar.check_in,
        ar.check_out,
        ar.late_minutes,
        ar.early_departure_minutes,
        ar.remarks,
        s.name as shift_name,
        s.start_time,
        s.end_time
      FROM attendance_records ar
      LEFT JOIN shifts s ON ar.shift_id = s.id
      WHERE ar.employee_id = $1 AND TO_CHAR(ar.attendance_date, 'YYYY-MM') = $2
      ORDER BY ar.attendance_date DESC;
    `, [employeeId, currentMonth]);

    const history = attRes.rows.map(r => ({
      ...r,
      date_formatted: new Date(r.attendance_date).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }),
      check_in_formatted: r.check_in ? new Date(r.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : '—',
      check_out_formatted: r.check_out ? new Date(r.check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : '—',
      working_hours_formatted: formatWorkingHours(r.check_in, r.check_out)
    }));

    // Calculate monthly summary
    let presentCount = 0;
    let lateCount = 0;
    let absentCount = 0;
    let leaveCount = 0;
    let halfDayCount = 0;

    history.forEach(h => {
      if (h.status === 'Present') presentCount++;
      else if (h.status === 'Late') lateCount++;
      else if (h.status === 'Absent') absentCount++;
      else if (h.status === 'On Leave') leaveCount++;
      else if (h.status === 'Half Day') halfDayCount++;
    });

    return res.json({
      success: true,
      data: {
        employee: {
          ...employee,
          full_name: `${employee.first_name} ${employee.last_name || ''}`.trim(),
          working_days: workingDaysList
        },
        month: currentMonth,
        summary: {
          working_days: history.length,
          present: presentCount,
          late: lateCount,
          absent: absentCount,
          on_leave: leaveCount,
          half_day: halfDayCount,
          attendance_rate: history.length > 0 ? Math.round(((presentCount + lateCount) / history.length) * 100) : 0
        },
        history
      }
    });
  } catch (err) {
    console.error('Employee attendance error:', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve employee attendance history.' });
  }
});

// ============================================================================
// 5. GET /api/attendance/reports — Aggregated Reports & Export
// ============================================================================
router.get('/reports', authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate, department_id, shift_id, employee_id, status } = req.query;

    const start = startDate || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const end = endDate || new Date().toISOString().split('T')[0];

    let query = `
      SELECT 
        ar.id,
        ar.attendance_date,
        ar.status,
        ar.check_in,
        ar.check_out,
        ar.late_minutes,
        ar.early_departure_minutes,
        ar.remarks,
        e.id as employee_id,
        e.employee_code,
        e.first_name,
        e.last_name,
        d.name as department_name,
        des.name as designation_name,
        s.name as shift_name
      FROM attendance_records ar
      JOIN employees e ON ar.employee_id = e.id
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN designations des ON e.designation_id = des.id
      LEFT JOIN shifts s ON ar.shift_id = s.id
      WHERE ar.attendance_date >= $1 AND ar.attendance_date <= $2
    `;

    const params = [start, end];
    let pIdx = 3;

    if (department_id && department_id !== 'ALL') {
      query += ` AND (e.department_id = $${pIdx} OR d.name = $${pIdx})`;
      params.push(department_id);
      pIdx++;
    }

    if (shift_id && shift_id !== 'ALL') {
      query += ` AND (ar.shift_id = $${pIdx} OR s.name = $${pIdx})`;
      params.push(shift_id);
      pIdx++;
    }

    if (employee_id && employee_id !== 'ALL') {
      query += ` AND ar.employee_id = $${pIdx}`;
      params.push(employee_id);
      pIdx++;
    }

    if (status && status !== 'ALL') {
      query += ` AND ar.status = $${pIdx}`;
      params.push(status);
      pIdx++;
    }

    query += ` ORDER BY ar.attendance_date DESC, e.first_name ASC;`;

    const result = await pool.query(query, params);

    let totalPresent = 0;
    let totalLate = 0;
    let totalAbsent = 0;
    let totalLeave = 0;
    let totalHalfDay = 0;

    const records = result.rows.map(r => {
      if (r.status === 'Present') totalPresent++;
      else if (r.status === 'Late') totalLate++;
      else if (r.status === 'Absent') totalAbsent++;
      else if (r.status === 'On Leave') totalLeave++;
      else if (r.status === 'Half Day') totalHalfDay++;

      return {
        ...r,
        employee_name: `${r.first_name} ${r.last_name || ''}`.trim(),
        date_formatted: new Date(r.attendance_date).toLocaleDateString(),
        check_in_formatted: r.check_in ? new Date(r.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : '—',
        check_out_formatted: r.check_out ? new Date(r.check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : '—',
        working_hours: formatWorkingHours(r.check_in, r.check_out)
      };
    });

    const totalRecords = records.length;
    const overallRate = totalRecords > 0 ? Math.round(((totalPresent + totalLate) / totalRecords) * 100) : 0;

    return res.json({
      success: true,
      data: {
        period: { start, end },
        summary: {
          total_records: totalRecords,
          present: totalPresent,
          late: totalLate,
          absent: totalAbsent,
          on_leave: totalLeave,
          half_day: totalHalfDay,
          attendance_percentage: overallRate
        },
        records
      }
    });
  } catch (err) {
    console.error('Attendance reports error:', err);
    return res.status(500).json({ success: false, message: 'Failed to generate attendance report.' });
  }
});

// ============================================================================
// 6. GET /api/attendance/audit — Audit logs for corrected attendance records
// ============================================================================
router.get('/audit', authenticateToken, async (req, res) => {
  try {
    const { employee_id, date } = req.query;

    let query = `
      SELECT 
        aal.*,
        e.employee_code,
        e.first_name,
        e.last_name,
        d.name as department_name
      FROM attendance_audit_logs aal
      JOIN employees e ON aal.employee_id = e.id
      LEFT JOIN departments d ON e.department_id = d.id
      WHERE 1=1
    `;

    const params = [];
    let pIdx = 1;

    if (employee_id) {
      query += ` AND aal.employee_id = $${pIdx}`;
      params.push(employee_id);
      pIdx++;
    }

    if (date) {
      query += ` AND aal.attendance_date = $${pIdx}`;
      params.push(date);
      pIdx++;
    }

    query += ` ORDER BY aal.created_at DESC LIMIT 100;`;

    const result = await pool.query(query, params);

    const logs = result.rows.map(l => ({
      ...l,
      employee_name: `${l.first_name} ${l.last_name || ''}`.trim(),
      date_formatted: new Date(l.attendance_date).toLocaleDateString(),
      created_at_formatted: new Date(l.created_at).toLocaleString()
    }));

    return res.json({
      success: true,
      data: logs
    });
  } catch (err) {
    console.error('Attendance audit log error:', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve attendance audit records.' });
  }
});

// ============================================================================
// 7. POST /api/attendance — Mark attendance for staff
// ============================================================================
router.post('/', authenticateToken, requireRole('Super Admin', 'Administrator', 'HR', 'Manager'), async (req, res) => {
  try {
    const { employee_id, attendance_date, status, check_in, check_out, remarks } = req.body;

    if (!employee_id || !attendance_date) {
      return res.status(400).json({ success: false, message: 'Employee and attendance date are required.' });
    }

    // Check for duplicate attendance record
    const dupCheck = await pool.query(
      'SELECT id, status FROM attendance_records WHERE employee_id = $1 AND attendance_date = $2;',
      [employee_id, attendance_date]
    );

    if (dupCheck.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: `Attendance already exists for this employee on ${attendance_date} (Status: ${dupCheck.rows[0].status}). Please use Edit Attendance to correct it.`
      });
    }

    // Fetch employee & assigned shift
    const empRes = await pool.query(`
      SELECT 
        e.id, 
        e.department_id,
        e.current_shift_id,
        s.start_time,
        s.end_time,
        s.late_grace_minutes
      FROM employees e
      LEFT JOIN shifts s ON e.current_shift_id = s.id
      WHERE e.id = $1;
    `, [employee_id]);

    if (empRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Employee not found.' });
    }

    const emp = empRes.rows[0];

    // Manager departmental scope validation
    const userRole = (req.user.role || '').toLowerCase();
    if (userRole === 'manager') {
      const managerDepts = await getManagerDepartmentIds(req.user);
      if (!managerDepts || !managerDepts.includes(emp.department_id)) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You can only record attendance for employees within your authorized department.'
        });
      }
    }
    let finalStatus = status || 'Present';
    let lateMinutes = 0;

    // Evaluate shift grace period if check_in provided
    if (check_in && emp.start_time && finalStatus === 'Present') {
      const diff = calculateMinutesLate(check_in, emp.start_time);
      const grace = emp.late_grace_minutes || 15;
      if (diff > grace) {
        finalStatus = 'Late';
        lateMinutes = diff;
      }
    }

    // Full timestamp values
    let fullCheckIn = null;
    let fullCheckOut = null;

    if (check_in) {
      fullCheckIn = check_in.includes('T') || check_in.includes(' ')
        ? check_in
        : `${attendance_date} ${check_in.length === 5 ? check_in + ':00' : check_in}`;
    }

    if (check_out) {
      fullCheckOut = check_out.includes('T') || check_out.includes(' ')
        ? check_out
        : `${attendance_date} ${check_out.length === 5 ? check_out + ':00' : check_out}`;
    }

    const insertRes = await pool.query(`
      INSERT INTO attendance_records (
        id, employee_id, shift_id, attendance_date, check_in, check_out, status, source, late_minutes, remarks, created_at, updated_at
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4, $5, $6, 'MANUAL', $7, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      ) RETURNING *;
    `, [
      employee_id,
      emp.current_shift_id || null,
      attendance_date,
      fullCheckIn,
      fullCheckOut,
      finalStatus,
      lateMinutes,
      remarks || null
    ]);

    return res.status(201).json({
      success: true,
      message: 'Attendance recorded successfully.',
      data: insertRes.rows[0]
    });
  } catch (err) {
    console.error('Mark attendance error:', err);
    return res.status(500).json({ success: false, message: 'Failed to record attendance.' });
  }
});

// ============================================================================
// 8. PUT /api/attendance/:id — Edit & Correct attendance with audit log
// ============================================================================
router.put('/:id', authenticateToken, requireRole('Super Admin', 'Administrator', 'HR'), async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { status, check_in, check_out, remarks, reason } = req.body;

    await client.query('BEGIN');

    // Fetch existing attendance record
    const prevRes = await client.query('SELECT * FROM attendance_records WHERE id = $1;', [id]);
    if (prevRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Attendance record not found.' });
    }

    const prev = prevRes.rows[0];
    const dateStr = prev.attendance_date instanceof Date
      ? prev.attendance_date.toISOString().split('T')[0]
      : String(prev.attendance_date).slice(0, 10);

    let fullCheckIn = null;
    let fullCheckOut = null;

    if (check_in) {
      fullCheckIn = check_in.includes('T') || check_in.includes(' ')
        ? check_in
        : `${dateStr} ${check_in.length === 5 ? check_in + ':00' : check_in}`;
    }

    if (check_out) {
      fullCheckOut = check_out.includes('T') || check_out.includes(' ')
        ? check_out
        : `${dateStr} ${check_out.length === 5 ? check_out + ':00' : check_out}`;
    }

    // Recalculate late minutes if shift exists
    let lateMinutes = prev.late_minutes || 0;
    if (fullCheckIn && prev.shift_id) {
      const shiftRes = await client.query('SELECT start_time, late_grace_minutes FROM shifts WHERE id = $1;', [prev.shift_id]);
      if (shiftRes.rows.length > 0) {
        const s = shiftRes.rows[0];
        const diff = calculateMinutesLate(fullCheckIn, s.start_time);
        lateMinutes = diff > (s.late_grace_minutes || 15) ? diff : 0;
      }
    }

    // Update attendance record
    const updateRes = await client.query(`
      UPDATE attendance_records SET
        status = $1,
        check_in = $2,
        check_out = $3,
        late_minutes = $4,
        remarks = $5,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $6
      RETURNING *;
    `, [
      status || prev.status,
      fullCheckIn,
      fullCheckOut,
      lateMinutes,
      remarks || prev.remarks,
      id
    ]);

    const updated = updateRes.rows[0];

    // Log correction in attendance_audit_logs
    const changedByName = `${req.user.first_name || 'Admin'} ${req.user.last_name || ''}`.trim();
    await client.query(`
      INSERT INTO attendance_audit_logs (
        id, attendance_id, employee_id, attendance_date, previous_status, new_status,
        previous_check_in, new_check_in, previous_check_out, new_check_out,
        reason, changed_by_user_id, changed_by_name, created_at
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP
      );
    `, [
      id,
      prev.employee_id,
      dateStr,
      prev.status,
      updated.status,
      prev.check_in,
      updated.check_in,
      prev.check_out,
      updated.check_out,
      reason || remarks || 'Attendance record correction',
      req.user.id || null,
      changedByName
    ]);

    await client.query('COMMIT');

    return res.json({
      success: true,
      message: 'Attendance record updated and audit log preserved.',
      data: updated
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Update attendance error:', err);
    return res.status(500).json({ success: false, message: 'Failed to update attendance record.' });
  } finally {
    client.release();
  }
});

// ============================================================================
// 9. POST /api/attendance/quick-mark — Quick batch check-in for scheduled staff
// ============================================================================
router.post('/quick-mark', authenticateToken, requireRole('Super Admin', 'Administrator', 'HR'), async (req, res) => {
  try {
    const { date, department_id } = req.body;
    const targetDate = date || new Date().toISOString().split('T')[0];

    // Find active employees without attendance for targetDate
    let query = `
      SELECT 
        e.id,
        e.current_shift_id,
        s.start_time,
        s.end_time
      FROM employees e
      LEFT JOIN shifts s ON e.current_shift_id = s.id
      LEFT JOIN attendance_records ar ON e.id = ar.employee_id AND ar.attendance_date = $1
      WHERE e.employment_status = 'Active' AND ar.id IS NULL
    `;

    const params = [targetDate];
    if (department_id && department_id !== 'ALL') {
      query += ` AND e.department_id = $2`;
      params.push(department_id);
    }

    const unMarked = await pool.query(query, params);

    let markedCount = 0;
    for (const emp of unMarked.rows) {
      const sStart = emp.start_time ? emp.start_time.slice(0, 5) : '07:30';
      const sEnd = emp.end_time ? emp.end_time.slice(0, 5) : '14:00';

      const checkIn = `${targetDate} ${sStart}:00`;
      const checkOut = `${targetDate} ${sEnd}:00`;

      await pool.query(`
        INSERT INTO attendance_records (
          id, employee_id, shift_id, attendance_date, check_in, check_out, status, source, late_minutes, remarks, created_at, updated_at
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4, $5, 'Present', 'MANUAL', 0, 'Quick batch mark', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
        ON CONFLICT (employee_id, attendance_date) DO NOTHING;
      `, [emp.id, emp.current_shift_id, targetDate, checkIn, checkOut]);

      markedCount++;
    }

    return res.json({
      success: true,
      message: `Successfully marked attendance for ${markedCount} employees.`,
      data: { marked_count: markedCount, date: targetDate }
    });
  } catch (err) {
    console.error('Quick mark error:', err);
    return res.status(500).json({ success: false, message: 'Failed to execute quick attendance marking.' });
  }
});

// ============================================================================
// 10. GET /api/attendance/my-today — Authenticated Employee Today's Status
// ============================================================================
router.get('/my-today', authenticateToken, async (req, res) => {
  try {
    const employeeId = req.user.employee_id;
    if (!employeeId) {
      return res.status(400).json({
        success: false,
        message: 'No linked employee profile found for your user account.'
      });
    }

    // Fetch employee and assigned shift
    const empRes = await pool.query(`
      SELECT 
        e.id, 
        e.employee_code, 
        e.first_name, 
        e.last_name, 
        COALESCE(e.work_email, e.personal_email) as email,
        e.profile_photo_url,
        e.employment_status,
        d.name as department_name,
        des.name as designation_name,
        s.id as shift_id,
        s.name as shift_name,
        s.code as shift_code,
        s.start_time,
        s.end_time,
        s.late_grace_minutes,
        s.break_start_time,
        s.break_end_time
      FROM employees e
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN designations des ON e.designation_id = des.id
      LEFT JOIN shifts s ON e.current_shift_id = s.id
      WHERE e.id = $1;
    `, [employeeId]);

    if (empRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Employee profile not found.' });
    }

    const emp = empRes.rows[0];

    // Fetch shift working days
    let workingDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    if (emp.shift_id) {
      const daysRes = await pool.query(
        'SELECT day_of_week FROM shift_working_days WHERE shift_id = $1;',
        [emp.shift_id]
      );
      if (daysRes.rows.length > 0) {
        workingDays = daysRes.rows.map(r => r.day_of_week);
      }
    }

    // Determine today's date & day name in school campus timezone
    const todayStr = getSchoolTodayDate();
    const currentDayName = new Intl.DateTimeFormat('en-US', { timeZone: SCHOOL_TIMEZONE, weekday: 'long' }).format(new Date());
    const isWorkingDay = workingDays.includes(currentDayName);

    // Query today's attendance record
    const attRes = await pool.query(`
      SELECT 
        ar.id,
        ar.attendance_date,
        ar.check_in,
        ar.check_out,
        ar.status,
        ar.source,
        ar.late_minutes,
        ar.remarks
      FROM attendance_records ar
      WHERE ar.employee_id = $1 AND ar.attendance_date = $2;
    `, [employeeId, todayStr]);

    const record = attRes.rows[0] || null;

    let state = 'NOT_MARKED';
    let workingHours = '—';

    if (!isWorkingDay) {
      state = 'NON_WORKING_DAY';
    } else if (record) {
      if (record.status === 'On Leave') {
        state = 'ON_LEAVE';
      } else if (record.status === 'Absent') {
        state = 'ABSENT';
      } else if (record.check_in && !record.check_out) {
        state = 'CHECKED_IN';
      } else if (record.check_in && record.check_out) {
        state = 'COMPLETED';
        workingHours = formatWorkingHours(record.check_in, record.check_out);
      }
    }

    const formattedRecord = record ? {
      ...record,
      check_in_formatted: record.check_in ? formatSchoolTime(record.check_in) : null,
      check_out_formatted: record.check_out ? formatSchoolTime(record.check_out) : null,
      working_hours: workingHours
    } : null;

    return res.json({
      success: true,
      data: {
        employee: {
          id: emp.id,
          employee_code: emp.employee_code,
          first_name: emp.first_name,
          last_name: emp.last_name,
          full_name: `${emp.first_name} ${emp.last_name || ''}`.trim(),
          email: emp.email,
          profile_photo_url: emp.profile_photo_url,
          department_name: emp.department_name,
          designation_name: emp.designation_name
        },
        shift: {
          id: emp.shift_id,
          name: emp.shift_name || 'Regular School Teaching Shift',
          code: emp.shift_code || 'REG-TEACH',
          start_time: emp.start_time ? emp.start_time.slice(0, 5) : '07:30',
          end_time: emp.end_time ? emp.end_time.slice(0, 5) : '14:00',
          start_time_formatted: emp.start_time ? new Date(`1970-01-01T${emp.start_time}`).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : '7:30 AM',
          end_time_formatted: emp.end_time ? new Date(`1970-01-01T${emp.end_time}`).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : '2:00 PM',
          late_grace_minutes: emp.late_grace_minutes || 15,
          break_start_time: emp.break_start_time ? emp.break_start_time.slice(0, 5) : null,
          break_end_time: emp.break_end_time ? emp.break_end_time.slice(0, 5) : null,
          working_days: workingDays
        },
        today_date: todayStr,
        day_name: currentDayName,
        is_working_day: isWorkingDay,
        state,
        attendance: formattedRecord,
        school_timezone: SCHOOL_TIMEZONE,
        server_now: new Date().toISOString()
      }
    });
  } catch (err) {
    console.error('Get my today attendance error:', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve today\'s attendance status.' });
  }
});

// ============================================================================
// 11. POST /api/attendance/check-in — Authenticated Employee Self Check-In
// ============================================================================
router.post('/check-in', authenticateToken, async (req, res) => {
  try {
    const employeeId = req.user.employee_id;
    if (!employeeId) {
      return res.status(400).json({
        success: false,
        message: 'No linked employee profile found for your user account.'
      });
    }

    const todayStr = getSchoolTodayDate();
    const currentDayName = new Intl.DateTimeFormat('en-US', { timeZone: SCHOOL_TIMEZONE, weekday: 'long' }).format(new Date());

    // 1. Fetch employee & assigned shift
    const empRes = await pool.query(`
      SELECT 
        e.id, 
        e.current_shift_id,
        s.id as shift_id,
        s.name as shift_name,
        s.start_time,
        s.end_time,
        s.late_grace_minutes
      FROM employees e
      LEFT JOIN shifts s ON e.current_shift_id = s.id
      WHERE e.id = $1;
    `, [employeeId]);

    if (empRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Employee profile not found.' });
    }

    const emp = empRes.rows[0];

    // 2. Validate Working Day
    let workingDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    if (emp.shift_id) {
      const daysRes = await pool.query(
        'SELECT day_of_week FROM shift_working_days WHERE shift_id = $1;',
        [emp.shift_id]
      );
      if (daysRes.rows.length > 0) {
        workingDays = daysRes.rows.map(r => r.day_of_week);
      }
    }

    if (!workingDays.includes(currentDayName)) {
      return res.status(400).json({
        success: false,
        message: 'Today is a non-working day for your assigned shift. No attendance is required.'
      });
    }

    // 3. Duplicate check
    const existing = await pool.query(
      'SELECT id, check_in, check_out, status FROM attendance_records WHERE employee_id = $1 AND attendance_date = $2;',
      [employeeId, todayStr]
    );

    if (existing.rows.length > 0) {
      const rec = existing.rows[0];
      const checkInFormatted = rec.check_in 
        ? formatSchoolTime(rec.check_in)
        : 'earlier';
      return res.status(409).json({
        success: false,
        message: `You have already checked in today at ${checkInFormatted}.`
      });
    }

    // 4. Calculate Status (Present vs Late) in school campus timezone
    let status = 'Present';
    let lateMinutes = 0;

    const sStart = emp.start_time ? emp.start_time.slice(0, 5) : '07:30';
    const currentTimeStr = getSchoolCurrentTimeStr();
    const graceMinutes = emp.late_grace_minutes || 15;

    const diff = calculateMinutesLate(currentTimeStr, sStart);
    if (diff > graceMinutes) {
      status = 'Late';
      lateMinutes = diff;
    }

    // 5. Insert attendance record with source = 'WEB'
    const insertRes = await pool.query(`
      INSERT INTO attendance_records (
        id, employee_id, shift_id, attendance_date, check_in, status, source, late_minutes, remarks, created_at, updated_at
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, CURRENT_TIMESTAMP, $4, 'WEB', $5, 'Self check-in via Web', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      ) RETURNING *;
    `, [employeeId, emp.current_shift_id, todayStr, status, lateMinutes]);

    const created = insertRes.rows[0];
    const formattedCheckIn = formatSchoolTime(created.check_in);

    return res.json({
      success: true,
      message: `Checked in successfully at ${formattedCheckIn}. Status: ${status}.`,
      data: {
        id: created.id,
        attendance_date: created.attendance_date,
        check_in: created.check_in,
        check_in_formatted: formattedCheckIn,
        status: created.status,
        late_minutes: created.late_minutes,
        source: created.source
      }
    });
  } catch (err) {
    console.error('Employee check-in error:', err);
    return res.status(500).json({ success: false, message: 'Failed to record check-in. Please try again or contact HR.' });
  }
});

// ============================================================================
// 12. POST /api/attendance/check-out — Authenticated Employee Self Check-Out
// ============================================================================
router.post('/check-out', authenticateToken, async (req, res) => {
  try {
    const employeeId = req.user.employee_id;
    if (!employeeId) {
      return res.status(400).json({
        success: false,
        message: 'No linked employee profile found for your user account.'
      });
    }

    const todayStr = getSchoolTodayDate();

    // Find today's attendance record
    const recordRes = await pool.query(
      'SELECT id, check_in, check_out, status FROM attendance_records WHERE employee_id = $1 AND attendance_date = $2;',
      [employeeId, todayStr]
    );

    if (recordRes.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot check out before checking in. Please check in first.'
      });
    }

    const record = recordRes.rows[0];
    if (record.check_out) {
      const checkOutFormatted = formatSchoolTime(record.check_out);
      return res.status(409).json({
        success: false,
        message: `Your attendance for today is already completed (Checked out at ${checkOutFormatted}).`
      });
    }

    // Update check-out timestamp
    const updateRes = await pool.query(`
      UPDATE attendance_records
      SET check_out = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *;
    `, [record.id]);

    const updated = updateRes.rows[0];
    const workingHours = formatWorkingHours(updated.check_in, updated.check_out);
    const formattedCheckIn = formatSchoolTime(updated.check_in);
    const formattedCheckOut = formatSchoolTime(updated.check_out);

    return res.json({
      success: true,
      message: `Checked out successfully at ${formattedCheckOut}. Total working hours: ${workingHours}.`,
      data: {
        id: updated.id,
        attendance_date: updated.attendance_date,
        check_in: updated.check_in,
        check_out: updated.check_out,
        check_in_formatted: formattedCheckIn,
        check_out_formatted: formattedCheckOut,
        working_hours: workingHours,
        status: updated.status
      }
    });
  } catch (err) {
    console.error('Employee check-out error:', err);
    return res.status(500).json({ success: false, message: 'Failed to record check-out. Please try again or contact HR.' });
  }
});

// ============================================================================
// 13. GET /api/attendance/my-summary — Employee Self Monthly Summary
// ============================================================================
router.get('/my-summary', authenticateToken, async (req, res) => {
  try {
    const employeeId = req.user.employee_id;
    if (!employeeId) {
      return res.status(400).json({ success: false, message: 'No linked employee profile found.' });
    }

    const currentMonth = req.query.month || getSchoolTodayDate().slice(0, 7);

    // Fetch employee details
    const empRes = await pool.query(`
      SELECT 
        e.id, 
        e.employee_code, 
        e.first_name, 
        e.last_name, 
        COALESCE(e.work_email, e.personal_email) as email,
        e.profile_photo_url,
        e.employment_status,
        d.name as department_name,
        des.name as designation_name,
        s.id as shift_id,
        s.name as shift_name,
        s.code as shift_code,
        s.start_time,
        s.end_time,
        s.late_grace_minutes
      FROM employees e
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN designations des ON e.designation_id = des.id
      LEFT JOIN shifts s ON e.current_shift_id = s.id
      WHERE e.id = $1;
    `, [employeeId]);

    if (empRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Employee record not found.' });
    }

    const employee = empRes.rows[0];

    // Fetch shift working days
    let workingDaysList = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    if (employee.shift_id) {
      const shiftDaysRes = await pool.query('SELECT day_of_week FROM shift_working_days WHERE shift_id = $1;', [employee.shift_id]);
      if (shiftDaysRes.rows.length > 0) {
        workingDaysList = shiftDaysRes.rows.map(r => r.day_of_week);
      }
    }

    // Fetch attendance records for requested month
    const attRes = await pool.query(`
      SELECT 
        ar.id,
        ar.attendance_date,
        ar.status,
        ar.check_in,
        ar.check_out,
        ar.late_minutes,
        ar.early_departure_minutes,
        ar.remarks,
        s.name as shift_name,
        s.start_time,
        s.end_time
      FROM attendance_records ar
      LEFT JOIN shifts s ON ar.shift_id = s.id
      WHERE ar.employee_id = $1 AND TO_CHAR(ar.attendance_date, 'YYYY-MM') = $2
      ORDER BY ar.attendance_date DESC;
    `, [employeeId, currentMonth]);

    const history = attRes.rows.map(r => ({
      ...r,
      date_formatted: new Date(r.attendance_date).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }),
      check_in_formatted: formatSchoolTime(r.check_in),
      check_out_formatted: formatSchoolTime(r.check_out),
      working_hours_formatted: formatWorkingHours(r.check_in, r.check_out)
    }));

    let presentCount = 0;
    let lateCount = 0;
    let absentCount = 0;
    let leaveCount = 0;
    let halfDayCount = 0;

    history.forEach(h => {
      if (h.status === 'Present') presentCount++;
      else if (h.status === 'Late') lateCount++;
      else if (h.status === 'Absent') absentCount++;
      else if (h.status === 'On Leave') leaveCount++;
      else if (h.status === 'Half Day') halfDayCount++;
    });

    const totalRecorded = history.length;
    const rate = totalRecorded > 0 ? Math.round(((presentCount + lateCount) / totalRecorded) * 100) : 0;

    return res.json({
      success: true,
      data: {
        employee: {
          ...employee,
          full_name: `${employee.first_name} ${employee.last_name || ''}`.trim(),
          working_days: workingDaysList
        },
        month: currentMonth,
        summary: {
          working_days: totalRecorded,
          present: presentCount,
          late: lateCount,
          absent: absentCount,
          on_leave: leaveCount,
          half_day: halfDayCount,
          attendance_rate: rate
        },
        history
      }
    });
  } catch (err) {
    console.error('Get my attendance summary error:', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve attendance summary.' });
  }
});

// ============================================================================
// 14. GET /api/attendance/my-shift — Authenticated Employee Assigned Shift Info
// ============================================================================
router.get('/my-shift', authenticateToken, async (req, res) => {
  try {
    const employeeId = req.user.employee_id;
    if (!employeeId) {
      return res.status(400).json({ success: false, message: 'No linked employee profile found.' });
    }

    const empRes = await pool.query(`
      SELECT 
        e.id, 
        e.employee_code, 
        e.first_name, 
        e.last_name,
        d.name as department_name,
        des.name as designation_name,
        s.id as shift_id,
        s.name as shift_name,
        s.code as shift_code,
        s.start_time,
        s.end_time,
        s.late_grace_minutes,
        s.break_start_time,
        s.break_end_time,
        s.description
      FROM employees e
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN designations des ON e.designation_id = des.id
      LEFT JOIN shifts s ON e.current_shift_id = s.id
      WHERE e.id = $1;
    `, [employeeId]);

    if (empRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Employee profile not found.' });
    }

    const emp = empRes.rows[0];

    let workingDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    if (emp.shift_id) {
      const daysRes = await pool.query(
        'SELECT day_of_week FROM shift_working_days WHERE shift_id = $1;',
        [emp.shift_id]
      );
      if (daysRes.rows.length > 0) {
        workingDays = daysRes.rows.map(r => r.day_of_week);
      }
    }

    return res.json({
      success: true,
      data: {
        employee: {
          id: emp.id,
          employee_code: emp.employee_code,
          full_name: `${emp.first_name} ${emp.last_name || ''}`.trim(),
          department_name: emp.department_name,
          designation_name: emp.designation_name
        },
        shift: {
          id: emp.shift_id,
          name: emp.shift_name || 'Regular School Teaching Shift',
          code: emp.shift_code || 'REG-TEACH',
          start_time: emp.start_time ? emp.start_time.slice(0, 5) : '07:30',
          end_time: emp.end_time ? emp.end_time.slice(0, 5) : '14:00',
          start_time_formatted: emp.start_time ? new Date(`1970-01-01T${emp.start_time}`).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : '7:30 AM',
          end_time_formatted: emp.end_time ? new Date(`1970-01-01T${emp.end_time}`).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : '2:00 PM',
          late_grace_minutes: emp.late_grace_minutes || 15,
          break_start_time: emp.break_start_time ? emp.break_start_time.slice(0, 5) : null,
          break_end_time: emp.break_end_time ? emp.break_end_time.slice(0, 5) : null,
          working_days: workingDays,
          description: emp.description || 'Standard academic faculty teaching shift.'
        }
      }
    });
  } catch (err) {
    console.error('Get my shift error:', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve shift schedule.' });
  }
});

module.exports = router;

