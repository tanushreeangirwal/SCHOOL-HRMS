const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken, requirePermission, requireRole } = require('../middleware/auth');

/**
 * -----------------------------------------------------------------------------
 * 1. TRAINING DASHBOARD METRICS & OVERVIEW
 * -----------------------------------------------------------------------------
 * GET /api/training/dashboard
 */
router.get('/dashboard', authenticateToken, async (req, res) => {
  try {
    const isMgr = req.user.role?.toLowerCase() === 'manager';
    const deptId = isMgr ? req.user.department_id : req.query.department_id;

    // Filter clause for department if specified
    const deptFilterProg = deptId ? `AND (tp.department_id = '${deptId}' OR tp.department_id IS NULL)` : '';
    const deptFilterEnroll = deptId ? `AND e.department_id = '${deptId}'` : '';

    // Total trainings conducted and status breakdown
    const statsRes = await pool.query(`
      SELECT 
        COUNT(*) AS total_trainings,
        COUNT(*) FILTER (WHERE tp.status = 'Upcoming' OR (tp.start_date > CURRENT_DATE AND tp.status NOT IN ('Cancelled', 'Completed'))) AS upcoming_trainings,
        COUNT(*) FILTER (WHERE tp.status = 'Ongoing' OR (tp.start_date <= CURRENT_DATE AND tp.end_date >= CURRENT_DATE AND tp.status NOT IN ('Cancelled', 'Completed'))) AS ongoing_trainings,
        COUNT(*) FILTER (WHERE tp.status = 'Completed') AS completed_trainings,
        COUNT(*) FILTER (WHERE tp.status = 'Planned') AS planned_trainings,
        COUNT(*) FILTER (WHERE tp.status = 'Cancelled') AS cancelled_trainings
      FROM training_programs tp
      WHERE 1=1 ${deptFilterProg};
    `);
    const programCounts = statsRes.rows[0];

    // Enrollment and completion stats
    const enrollStatsRes = await pool.query(`
      SELECT 
        COUNT(DISTINCT te.employee_id) AS total_employees_enrolled,
        COUNT(DISTINCT te.employee_id) FILTER (WHERE te.completion_status = 'Completed') AS employees_completed,
        COUNT(DISTINCT te.employee_id) FILTER (WHERE te.completion_status IN ('Pending', 'Incomplete')) AS employees_pending,
        COALESCE(SUM(te.hours_completed), 0) AS training_hours_completed,
        COUNT(te.id) AS total_enrollment_records,
        COUNT(te.id) FILTER (WHERE te.completion_status = 'Completed') AS completed_enrollment_records
      FROM training_enrollments te
      JOIN employees e ON te.employee_id = e.id
      WHERE 1=1 ${deptFilterProg} ${deptFilterEnroll};
    `);
    const enrollCounts = enrollStatsRes.rows[0];

    // Total active employees for participation ratio
    const activeStaffRes = await pool.query(`
      SELECT COUNT(*) AS total_staff 
      FROM employees 
      WHERE employment_status IN ('Active', 'Probation');
    `);
    const totalStaffCount = parseInt(activeStaffRes.rows[0].total_staff, 10) || 1;

    const totalEnrollments = parseInt(enrollCounts.total_enrollment_records, 10) || 0;
    const completedEnrollments = parseInt(enrollCounts.completed_enrollment_records, 10) || 0;
    const completionPercentage = totalEnrollments > 0 ? Math.round((completedEnrollments / totalEnrollments) * 100) : 0;

    // Upcoming Sessions preview
    const upcomingSessionsRes = await pool.query(`
      SELECT 
        tp.id, tp.title, tp.category, tp.training_type, tp.start_date, tp.end_date,
        tp.start_time, tp.end_time, tp.duration_hours, tp.trainer_name, tp.training_provider,
        tp.location_type, tp.location_venue, tp.status, tp.target_audience,
        d.name AS department_name,
        COUNT(te.id) AS enrolled_count
      FROM training_programs tp
      LEFT JOIN departments d ON tp.department_id = d.id
      LEFT JOIN training_enrollments te ON tp.id = te.training_id
      WHERE tp.status IN ('Upcoming', 'Ongoing', 'Planned')
        ${deptFilterProg}
      GROUP BY tp.id, d.name
      ORDER BY tp.start_date ASC
      LIMIT 5;
    `);

    // Category distribution
    const categoryStatsRes = await pool.query(`
      SELECT 
        tp.category,
        COUNT(tp.id) AS count,
        COALESCE(SUM(tp.duration_hours), 0) AS total_hours
      FROM training_programs tp
      WHERE 1=1 ${deptFilterProg}
      GROUP BY tp.category
      ORDER BY count DESC;
    `);

    // Total certificates count
    const certCountRes = await pool.query(`
      SELECT COUNT(*) AS total_certificates
      FROM training_certificates tc
      JOIN employees e ON tc.employee_id = e.id
      WHERE 1=1 ${deptFilterEnroll};
    `);

    res.json({
      success: true,
      data: {
        total_trainings: parseInt(programCounts.total_trainings, 10) || 0,
        upcoming_trainings: parseInt(programCounts.upcoming_trainings, 10) || 0,
        ongoing_trainings: parseInt(programCounts.ongoing_trainings, 10) || 0,
        completed_trainings: parseInt(programCounts.completed_trainings, 10) || 0,
        planned_trainings: parseInt(programCounts.planned_trainings, 10) || 0,
        cancelled_trainings: parseInt(programCounts.cancelled_trainings, 10) || 0,
        total_employees_enrolled: parseInt(enrollCounts.total_employees_enrolled, 10) || 0,
        total_staff: totalStaffCount,
        employees_completed: parseInt(enrollCounts.employees_completed, 10) || 0,
        employees_pending: parseInt(enrollCounts.employees_pending, 10) || 0,
        training_hours_completed: parseFloat(enrollCounts.training_hours_completed) || 0,
        completion_percentage: completionPercentage,
        total_certificates: parseInt(certCountRes.rows[0].total_certificates, 10) || 0,
        upcoming_sessions: upcomingSessionsRes.rows,
        category_breakdown: categoryStatsRes.rows
      }
    });
  } catch (err) {
    console.error('Error fetching training dashboard:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve training dashboard data.' });
  }
});

/**
 * -----------------------------------------------------------------------------
 * 2. TRAINING PROGRAMS LIST & CRUD
 * -----------------------------------------------------------------------------
 * GET /api/training/programs
 */
router.get('/programs', authenticateToken, async (req, res) => {
  try {
    const { search, category, status, training_type, department_id, start_date, end_date } = req.query;
    let query = `
      SELECT 
        tp.*,
        d.name AS department_name,
        COUNT(te.id) AS enrolled_count,
        COUNT(te.id) FILTER (WHERE te.completion_status = 'Completed') AS completed_count,
        COUNT(te.id) FILTER (WHERE te.attendance_status = 'Present') AS attended_count
      FROM training_programs tp
      LEFT JOIN departments d ON tp.department_id = d.id
      LEFT JOIN training_enrollments te ON tp.id = te.training_id
      WHERE 1=1
    `;
    const params = [];

    // Role-based restrictions: Department Managers only see programs relevant to their department or institutional ones
    if (req.user.role?.toLowerCase() === 'manager' && req.user.department_id) {
      params.push(req.user.department_id);
      query += ` AND (tp.department_id = $${params.length} OR tp.department_id IS NULL)`;
    } else if (department_id) {
      params.push(department_id);
      query += ` AND tp.department_id = $${params.length}`;
    }

    if (search) {
      params.push(`%${search.trim()}%`);
      query += ` AND (tp.title ILIKE $${params.length} OR tp.trainer_name ILIKE $${params.length} OR tp.training_provider ILIKE $${params.length} OR tp.description ILIKE $${params.length})`;
    }

    if (category) {
      params.push(category);
      query += ` AND tp.category = $${params.length}`;
    }

    if (status) {
      params.push(status);
      query += ` AND tp.status = $${params.length}`;
    }

    if (training_type) {
      params.push(training_type);
      query += ` AND tp.training_type = $${params.length}`;
    }

    if (start_date) {
      params.push(start_date);
      query += ` AND tp.start_date >= $${params.length}`;
    }

    if (end_date) {
      params.push(end_date);
      query += ` AND tp.end_date <= $${params.length}`;
    }

    query += `
      GROUP BY tp.id, d.name
      ORDER BY tp.start_date DESC, tp.created_at DESC;
    `;

    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Error fetching training programs:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve training programs.' });
  }
});

/**
 * GET /api/training/programs/:id
 */
router.get('/programs/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT 
        tp.*,
        d.name AS department_name,
        u.email AS created_by_email,
        COUNT(te.id) AS enrolled_count,
        COUNT(te.id) FILTER (WHERE te.completion_status = 'Completed') AS completed_count,
        COUNT(te.id) FILTER (WHERE te.attendance_status = 'Present') AS attended_count
      FROM training_programs tp
      LEFT JOIN departments d ON tp.department_id = d.id
      LEFT JOIN users u ON tp.created_by = u.id
      LEFT JOIN training_enrollments te ON tp.id = te.training_id
      WHERE tp.id = $1
      GROUP BY tp.id, d.name, u.email;
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Training program not found.' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Error fetching training program by ID:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve training program.' });
  }
});

/**
 * POST /api/training/programs
 * Create new training program
 */
router.post('/programs', authenticateToken, requirePermission('training:manage'), async (req, res) => {
  try {
    const {
      title, category, description, trainer_name, training_provider,
      training_type, start_date, end_date, start_time, end_time,
      duration_hours, location_type, location_venue, max_participants,
      target_audience, department_id, status, sync_calendar
    } = req.body;

    if (!title || !category || !trainer_name || !training_type || !start_date || !end_date) {
      return res.status(400).json({
        success: false,
        message: 'Title, category, trainer name, training type, start date, and end date are required.'
      });
    }

    const duration = parseFloat(duration_hours) > 0 ? parseFloat(duration_hours) : 1.0;
    const maxPart = parseInt(max_participants, 10) >= 0 ? parseInt(max_participants, 10) : 0;
    const progStatus = status || 'Planned';
    const doSync = sync_calendar !== false;

    const insertRes = await pool.query(`
      INSERT INTO training_programs (
        title, category, description, trainer_name, training_provider,
        training_type, start_date, end_date, start_time, end_time,
        duration_hours, location_type, location_venue, max_participants,
        target_audience, department_id, status, sync_calendar, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      RETURNING *;
    `, [
      title.trim(), category.trim(), description || null, trainer_name.trim(),
      training_provider ? training_provider.trim() : null, training_type.trim(),
      start_date, end_date, start_time || null, end_time || null,
      duration, location_type || 'On-Campus', location_venue || null,
      maxPart, target_audience || 'All Teaching Faculty',
      department_id || null, progStatus, doSync, req.user.id
    ]);

    const newProgram = insertRes.rows[0];

    // Optional: Synchronize with Academic Calendar events if sync_calendar is enabled
    if (doSync) {
      try {
        const activeYear = await pool.query(`SELECT id FROM academic_years WHERE is_active = true LIMIT 1;`);
        if (activeYear.rows.length > 0) {
          await pool.query(`
            INSERT INTO calendar_events (
              academic_year_id, title, event_type, category,
              start_date, end_date, start_time, end_time, total_days,
              description, is_working_day, is_active, created_by
            ) VALUES ($1, $2, 'Non-Instructional', 'Professional Development', $3, $4, $5, $6, 1, $7, true, true, $8)
            ON CONFLICT DO NOTHING;
          `, [
            activeYear.rows[0].id,
            `[Training] ${title}`,
            start_date,
            end_date,
            start_time || '09:00',
            end_time || '13:00',
            `Professional Development Session: ${title} conducted by ${trainer_name} (${training_provider || 'School CPD'}). Venue: ${location_venue || 'Campus'}`,
            req.user.id
          ]);
        }
      } catch (calErr) {
        console.warn('Notice: Calendar event auto-sync skipped:', calErr.message);
      }
    }

    res.status(201).json({
      success: true,
      message: 'Training program created successfully.',
      data: newProgram
    });
  } catch (err) {
    console.error('Error creating training program:', err);
    res.status(500).json({ success: false, message: 'Failed to create training program.' });
  }
});

/**
 * PUT /api/training/programs/:id
 * Update training program
 */
router.put('/programs/:id', authenticateToken, requirePermission('training:manage'), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title, category, description, trainer_name, training_provider,
      training_type, start_date, end_date, start_time, end_time,
      duration_hours, location_type, location_venue, max_participants,
      target_audience, department_id, status, sync_calendar
    } = req.body;

    const existing = await pool.query(`SELECT id FROM training_programs WHERE id = $1;`, [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Training program not found.' });
    }

    const duration = parseFloat(duration_hours) > 0 ? parseFloat(duration_hours) : 1.0;
    const maxPart = parseInt(max_participants, 10) >= 0 ? parseInt(max_participants, 10) : 0;

    const updateRes = await pool.query(`
      UPDATE training_programs
      SET 
        title = COALESCE($1, title),
        category = COALESCE($2, category),
        description = $3,
        trainer_name = COALESCE($4, trainer_name),
        training_provider = $5,
        training_type = COALESCE($6, training_type),
        start_date = COALESCE($7, start_date),
        end_date = COALESCE($8, end_date),
        start_time = $9,
        end_time = $10,
        duration_hours = $11,
        location_type = COALESCE($12, location_type),
        location_venue = $13,
        max_participants = $14,
        target_audience = COALESCE($15, target_audience),
        department_id = $16,
        status = COALESCE($17, status),
        sync_calendar = COALESCE($18, sync_calendar),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $19
      RETURNING *;
    `, [
      title ? title.trim() : null,
      category ? category.trim() : null,
      description !== undefined ? description : null,
      trainer_name ? trainer_name.trim() : null,
      training_provider !== undefined ? training_provider : null,
      training_type ? training_type.trim() : null,
      start_date, end_date,
      start_time || null, end_time || null,
      duration,
      location_type,
      location_venue || null,
      maxPart,
      target_audience,
      department_id || null,
      status,
      sync_calendar,
      id
    ]);

    res.json({
      success: true,
      message: 'Training program updated successfully.',
      data: updateRes.rows[0]
    });
  } catch (err) {
    console.error('Error updating training program:', err);
    res.status(500).json({ success: false, message: 'Failed to update training program.' });
  }
});

/**
 * DELETE /api/training/programs/:id
 */
router.delete('/programs/:id', authenticateToken, requirePermission('training:manage'), async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`DELETE FROM training_programs WHERE id = $1 RETURNING id, title;`, [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Training program not found.' });
    }
    res.json({ success: true, message: `Training program "${result.rows[0].title}" deleted successfully.` });
  } catch (err) {
    console.error('Error deleting training program:', err);
    res.status(500).json({ success: false, message: 'Failed to delete training program.' });
  }
});

/**
 * -----------------------------------------------------------------------------
 * 3. PARTICIPANTS & ATTENDANCE MANAGEMENT
 * -----------------------------------------------------------------------------
 * GET /api/training/programs/:id/participants
 */
router.get('/programs/:id/participants', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT 
        te.id AS enrollment_id,
        te.training_id,
        te.employee_id,
        te.enrollment_type,
        te.enrollment_status,
        te.attendance_status,
        te.attendance_date,
        te.hours_completed,
        te.completion_status,
        te.completion_date,
        te.remarks,
        te.assigned_at,
        e.employee_code,
        e.first_name,
        e.last_name,
        e.work_email,
        e.profile_photo_url,
        d.name AS department_name,
        des.name AS designation_name,
        tc.id AS certificate_id,
        tc.certificate_number,
        tc.issue_date AS certificate_issue_date
      FROM training_enrollments te
      JOIN employees e ON te.employee_id = e.id
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN designations des ON e.designation_id = des.id
      LEFT JOIN training_certificates tc ON tc.enrollment_id = te.id
      WHERE te.training_id = $1
      ORDER BY e.employee_code ASC;
    `, [id]);

    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Error fetching participants:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve training participants.' });
  }
});

/**
 * POST /api/training/programs/:id/enroll
 * Assign employees (Individual selection, Department-wide, or Designation-wide)
 */
router.post('/programs/:id/enroll', authenticateToken, requirePermission('training:assign'), async (req, res) => {
  try {
    const { id: trainingId } = req.params;
    const { employee_ids, department_id, designation_id, enrollment_type, enrollment_status } = req.body;

    const progCheck = await pool.query(`SELECT id, duration_hours, max_participants FROM training_programs WHERE id = $1;`, [trainingId]);
    if (progCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Training program not found.' });
    }
    const program = progCheck.rows[0];

    let targetEmployeeIds = [];

    if (Array.isArray(employee_ids) && employee_ids.length > 0) {
      targetEmployeeIds = employee_ids;
    } else if (department_id) {
      const deptEmps = await pool.query(`
        SELECT id FROM employees 
        WHERE department_id = $1 AND employment_status IN ('Active', 'Probation');
      `, [department_id]);
      targetEmployeeIds = deptEmps.rows.map(r => r.id);
    } else if (designation_id) {
      const desigEmps = await pool.query(`
        SELECT id FROM employees 
        WHERE designation_id = $1 AND employment_status IN ('Active', 'Probation');
      `, [designation_id]);
      targetEmployeeIds = desigEmps.rows.map(r => r.id);
    }

    if (targetEmployeeIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please select at least one employee, department, or designation to enroll.'
      });
    }

    const type = enrollment_type || (department_id ? 'Department-wide' : designation_id ? 'Designation-wide' : 'Individual');
    const status = enrollment_status || 'Assigned';

    let enrolledCount = 0;
    for (const empId of targetEmployeeIds) {
      await pool.query(`
        INSERT INTO training_enrollments (
          training_id, employee_id, enrollment_type, enrollment_status,
          attendance_status, completion_status, assigned_by
        ) VALUES ($1, $2, $3, $4, 'Pending', 'Pending', $5)
        ON CONFLICT (training_id, employee_id) DO UPDATE
        SET enrollment_status = EXCLUDED.enrollment_status,
            enrollment_type = EXCLUDED.enrollment_type,
            updated_at = CURRENT_TIMESTAMP;
      `, [trainingId, empId, type, status, req.user.id]);
      enrolledCount++;
    }

    res.json({
      success: true,
      message: `Successfully enrolled ${enrolledCount} staff member(s) in this training session.`,
      enrolled_count: enrolledCount
    });
  } catch (err) {
    console.error('Error enrolling employees:', err);
    res.status(500).json({ success: false, message: 'Failed to enroll employees in training.' });
  }
});

/**
 * DELETE /api/training/programs/:id/enroll/:employeeId
 * Remove employee enrollment
 */
router.delete('/programs/:id/enroll/:employeeId', authenticateToken, requirePermission('training:assign'), async (req, res) => {
  try {
    const { id: trainingId, employeeId } = req.params;
    const result = await pool.query(`
      DELETE FROM training_enrollments 
      WHERE training_id = $1 AND employee_id = $2
      RETURNING id;
    `, [trainingId, employeeId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Participant enrollment record not found.' });
    }

    res.json({ success: true, message: 'Participant removed from training roster.' });
  } catch (err) {
    console.error('Error removing enrollment:', err);
    res.status(500).json({ success: false, message: 'Failed to remove participant.' });
  }
});

/**
 * PATCH /api/training/programs/:id/participants/:employeeId
 * Update attendance and completion status
 */
router.patch('/programs/:id/participants/:employeeId', authenticateToken, requirePermission('training:attendance'), async (req, res) => {
  try {
    const { id: trainingId, employeeId } = req.params;
    const {
      enrollment_status, attendance_status, attendance_date,
      hours_completed, completion_status, completion_date, remarks
    } = req.body;

    const progRes = await pool.query(`SELECT duration_hours, start_date FROM training_programs WHERE id = $1;`, [trainingId]);
    if (progRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Training program not found.' });
    }
    const prog = progRes.rows[0];

    // Calculate hours credited
    let hours = hours_completed !== undefined ? parseFloat(hours_completed) : null;
    if (hours === null && completion_status === 'Completed') {
      hours = parseFloat(prog.duration_hours) || 1.0;
    }

    let compDate = completion_date;
    if (completion_status === 'Completed' && !compDate) {
      compDate = new Date().toISOString().split('T')[0];
    }

    let attDate = attendance_date;
    if (attendance_status === 'Present' && !attDate) {
      attDate = prog.start_date || new Date().toISOString().split('T')[0];
    }

    const updateRes = await pool.query(`
      UPDATE training_enrollments
      SET 
        enrollment_status = COALESCE($1, enrollment_status),
        attendance_status = COALESCE($2, attendance_status),
        attendance_date = COALESCE($3, attendance_date),
        hours_completed = COALESCE($4, hours_completed),
        completion_status = COALESCE($5, completion_status),
        completion_date = COALESCE($6, completion_date),
        remarks = COALESCE($7, remarks),
        updated_at = CURRENT_TIMESTAMP
      WHERE training_id = $8 AND employee_id = $9
      RETURNING *;
    `, [
      enrollment_status, attendance_status, attDate, hours,
      completion_status, compDate, remarks, trainingId, employeeId
    ]);

    if (updateRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Participant record not found.' });
    }

    res.json({
      success: true,
      message: 'Participant attendance and completion updated successfully.',
      data: updateRes.rows[0]
    });
  } catch (err) {
    console.error('Error updating participant attendance:', err);
    res.status(500).json({ success: false, message: 'Failed to update participant attendance.' });
  }
});

/**
 * POST /api/training/programs/:id/bulk-attendance
 * Batch update attendance / completion
 */
router.post('/programs/:id/bulk-attendance', authenticateToken, requirePermission('training:attendance'), async (req, res) => {
  try {
    const { id: trainingId } = req.params;
    const { updates, mark_all_present, mark_all_completed } = req.body;

    const progRes = await pool.query(`SELECT duration_hours, start_date FROM training_programs WHERE id = $1;`, [trainingId]);
    if (progRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Training program not found.' });
    }
    const prog = progRes.rows[0];
    const today = new Date().toISOString().split('T')[0];

    if (mark_all_present) {
      await pool.query(`
        UPDATE training_enrollments
        SET attendance_status = 'Present',
            attendance_date = COALESCE(attendance_date, $2),
            enrollment_status = 'Attended',
            updated_at = CURRENT_TIMESTAMP
        WHERE training_id = $1;
      `, [trainingId, prog.start_date || today]);
      return res.json({ success: true, message: 'All participants marked as Present.' });
    }

    if (mark_all_completed) {
      await pool.query(`
        UPDATE training_enrollments
        SET completion_status = 'Completed',
            completion_date = COALESCE(completion_date, $2),
            hours_completed = $3,
            attendance_status = 'Present',
            attendance_date = COALESCE(attendance_date, $2),
            enrollment_status = 'Completed',
            updated_at = CURRENT_TIMESTAMP
        WHERE training_id = $1;
      `, [trainingId, prog.start_date || today, parseFloat(prog.duration_hours) || 1.0]);
      return res.json({ success: true, message: 'All participants marked as Completed with credited hours.' });
    }

    if (Array.isArray(updates)) {
      for (const item of updates) {
        await pool.query(`
          UPDATE training_enrollments
          SET 
            attendance_status = COALESCE($1, attendance_status),
            completion_status = COALESCE($2, completion_status),
            hours_completed = COALESCE($3, hours_completed),
            remarks = COALESCE($4, remarks),
            updated_at = CURRENT_TIMESTAMP
          WHERE training_id = $5 AND employee_id = $6;
        `, [
          item.attendance_status, item.completion_status,
          item.hours_completed !== undefined ? parseFloat(item.hours_completed) : null,
          item.remarks, trainingId, item.employee_id
        ]);
      }
      return res.json({ success: true, message: `Batch updated ${updates.length} participant records.` });
    }

    res.status(400).json({ success: false, message: 'Invalid bulk update request.' });
  } catch (err) {
    console.error('Error in bulk attendance update:', err);
    res.status(500).json({ success: false, message: 'Failed to process bulk attendance update.' });
  }
});

/**
 * -----------------------------------------------------------------------------
 * 4. CERTIFICATES MANAGEMENT
 * -----------------------------------------------------------------------------
 * GET /api/training/certificates
 */
router.get('/certificates', authenticateToken, async (req, res) => {
  try {
    const { search, department_id, status } = req.query;
    let query = `
      SELECT 
        tc.*,
        e.employee_code,
        e.first_name,
        e.last_name,
        e.work_email,
        d.name AS department_name,
        des.name AS designation_name,
        tp.title AS training_title,
        tp.category AS training_category,
        tp.training_type
      FROM training_certificates tc
      JOIN employees e ON tc.employee_id = e.id
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN designations des ON e.designation_id = des.id
      LEFT JOIN training_programs tp ON tc.training_id = tp.id
      WHERE 1=1
    `;
    const params = [];

    // Role-based restrictions
    if (req.user.role?.toLowerCase() === 'manager' && req.user.department_id) {
      params.push(req.user.department_id);
      query += ` AND e.department_id = $${params.length}`;
    } else if (department_id) {
      params.push(department_id);
      query += ` AND e.department_id = $${params.length}`;
    }

    if (search) {
      params.push(`%${search.trim()}%`);
      query += ` AND (
        tc.certificate_name ILIKE $${params.length} OR 
        tc.certificate_number ILIKE $${params.length} OR 
        e.first_name ILIKE $${params.length} OR 
        e.last_name ILIKE $${params.length} OR 
        e.employee_code ILIKE $${params.length} OR
        tp.title ILIKE $${params.length}
      )`;
    }

    if (status) {
      params.push(status);
      query += ` AND tc.status = $${params.length}`;
    }

    query += ` ORDER BY tc.issue_date DESC, tc.created_at DESC;`;

    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Error fetching certificates:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve certificate records.' });
  }
});

/**
 * POST /api/training/certificates
 * Record or issue certificate for employee
 */
router.post('/certificates', authenticateToken, requirePermission('training:certificates'), async (req, res) => {
  try {
    const {
      training_id, employee_id, certificate_name, certificate_number,
      training_provider, issue_date, expiry_date, document_reference, status
    } = req.body;

    if (!employee_id || !certificate_name || !issue_date) {
      return res.status(400).json({
        success: false,
        message: 'Employee, certificate name, and issue date are required.'
      });
    }

    // Find enrollment_id if training_id provided
    let enrollmentId = null;
    if (training_id) {
      const enrRes = await pool.query(`SELECT id FROM training_enrollments WHERE training_id = $1 AND employee_id = $2;`, [training_id, employee_id]);
      if (enrRes.rows.length > 0) {
        enrollmentId = enrRes.rows[0].id;
      }
    }

    const insertRes = await pool.query(`
      INSERT INTO training_certificates (
        training_id, employee_id, enrollment_id, certificate_name,
        certificate_number, training_provider, issue_date, expiry_date,
        document_reference, status, issued_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *;
    `, [
      training_id || null, employee_id, enrollmentId, certificate_name.trim(),
      certificate_number ? certificate_number.trim() : null,
      training_provider ? training_provider.trim() : null,
      issue_date, expiry_date || null,
      document_reference ? document_reference.trim() : null,
      status || 'Active', req.user.id
    ]);

    res.status(201).json({
      success: true,
      message: 'Certificate record created successfully.',
      data: insertRes.rows[0]
    });
  } catch (err) {
    console.error('Error recording certificate:', err);
    res.status(500).json({ success: false, message: 'Failed to record certificate.' });
  }
});

/**
 * PUT /api/training/certificates/:id
 */
router.put('/certificates/:id', authenticateToken, requirePermission('training:certificates'), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      certificate_name, certificate_number, training_provider,
      issue_date, expiry_date, document_reference, status
    } = req.body;

    const updateRes = await pool.query(`
      UPDATE training_certificates
      SET 
        certificate_name = COALESCE($1, certificate_name),
        certificate_number = COALESCE($2, certificate_number),
        training_provider = COALESCE($3, training_provider),
        issue_date = COALESCE($4, issue_date),
        expiry_date = $5,
        document_reference = COALESCE($6, document_reference),
        status = COALESCE($7, status),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $8
      RETURNING *;
    `, [
      certificate_name ? certificate_name.trim() : null,
      certificate_number ? certificate_number.trim() : null,
      training_provider ? training_provider.trim() : null,
      issue_date,
      expiry_date || null,
      document_reference ? document_reference.trim() : null,
      status,
      id
    ]);

    if (updateRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Certificate record not found.' });
    }

    res.json({
      success: true,
      message: 'Certificate record updated successfully.',
      data: updateRes.rows[0]
    });
  } catch (err) {
    console.error('Error updating certificate:', err);
    res.status(500).json({ success: false, message: 'Failed to update certificate.' });
  }
});

/**
 * DELETE /api/training/certificates/:id
 */
router.delete('/certificates/:id', authenticateToken, requirePermission('training:certificates'), async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`DELETE FROM training_certificates WHERE id = $1 RETURNING id, certificate_name;`, [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Certificate record not found.' });
    }
    res.json({ success: true, message: `Certificate "${result.rows[0].certificate_name}" deleted successfully.` });
  } catch (err) {
    console.error('Error deleting certificate:', err);
    res.status(500).json({ success: false, message: 'Failed to delete certificate.' });
  }
});

/**
 * -----------------------------------------------------------------------------
 * 5. EMPLOYEE SELF-SERVICE & PROFILE TRAINING HISTORY
 * -----------------------------------------------------------------------------
 * GET /api/training/my-trainings
 */
router.get('/my-trainings', authenticateToken, async (req, res) => {
  try {
    const employeeId = req.user.employee_id;
    if (!employeeId) {
      return res.status(400).json({
        success: false,
        message: 'No employee profile linked to current user account.'
      });
    }

    // 1. All enrolled trainings
    const trainingsRes = await pool.query(`
      SELECT 
        te.id AS enrollment_id,
        te.enrollment_type,
        te.enrollment_status,
        te.attendance_status,
        te.attendance_date,
        te.hours_completed,
        te.completion_status,
        te.completion_date,
        te.remarks,
        te.assigned_at,
        tp.id AS training_id,
        tp.title,
        tp.category,
        tp.description,
        tp.trainer_name,
        tp.training_provider,
        tp.training_type,
        tp.start_date,
        tp.end_date,
        tp.start_time,
        tp.end_time,
        tp.duration_hours,
        tp.location_type,
        tp.location_venue,
        tp.status AS program_status,
        tc.id AS certificate_id,
        tc.certificate_number,
        tc.issue_date AS certificate_issue_date
      FROM training_enrollments te
      JOIN training_programs tp ON te.training_id = tp.id
      LEFT JOIN training_certificates tc ON tc.enrollment_id = te.id
      WHERE te.employee_id = $1
      ORDER BY tp.start_date DESC;
    `, [employeeId]);

    const trainings = trainingsRes.rows;
    const upcoming = trainings.filter(t => t.program_status === 'Upcoming' || t.program_status === 'Planned' || t.enrollment_status === 'Assigned' || t.enrollment_status === 'Registered');
    const ongoing = trainings.filter(t => t.program_status === 'Ongoing' || t.enrollment_status === 'In Progress');
    const completed = trainings.filter(t => t.completion_status === 'Completed' || t.enrollment_status === 'Completed');

    // 2. Personal certificates
    const certsRes = await pool.query(`
      SELECT 
        tc.*,
        tp.title AS training_title,
        tp.category AS training_category,
        tp.duration_hours
      FROM training_certificates tc
      LEFT JOIN training_programs tp ON tc.training_id = tp.id
      WHERE tc.employee_id = $1
      ORDER BY tc.issue_date DESC;
    `, [employeeId]);

    // Total hours calculation
    const totalHours = completed.reduce((sum, item) => sum + (parseFloat(item.hours_completed) || 0), 0);

    res.json({
      success: true,
      data: {
        all_trainings: trainings,
        upcoming_trainings: upcoming,
        ongoing_trainings: ongoing,
        completed_trainings: completed,
        certificates: certsRes.rows,
        summary: {
          total_enrolled: trainings.length,
          completed_count: completed.length,
          upcoming_count: upcoming.length,
          total_hours_completed: Math.round(totalHours * 10) / 10,
          total_certificates: certsRes.rows.length
        }
      }
    });
  } catch (err) {
    console.error('Error fetching employee self training records:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve personal training records.' });
  }
});

/**
 * GET /api/training/employee/:employeeId
 * Training history for a specific employee (For Employee Profile modal & HOD audit)
 */
router.get('/employee/:employeeId', authenticateToken, async (req, res) => {
  try {
    const { employeeId } = req.params;

    // Permissions check: Super Admin, HR, or Manager of same department, or self
    const isSelf = req.user.employee_id === employeeId;
    const isSuperOrHR = req.user.role?.toLowerCase() === 'super admin' || req.user.role?.toLowerCase() === 'administrator' || req.user.role?.toLowerCase() === 'hr';
    
    if (!isSelf && !isSuperOrHR) {
      if (req.user.role?.toLowerCase() === 'manager') {
        const empDept = await pool.query(`SELECT department_id FROM employees WHERE id = $1;`, [employeeId]);
        if (empDept.rows.length === 0 || empDept.rows[0].department_id !== req.user.department_id) {
          return res.status(403).json({ success: false, message: 'Access denied to other department employee records.' });
        }
      } else {
        return res.status(403).json({ success: false, message: 'Access denied.' });
      }
    }

    const historyRes = await pool.query(`
      SELECT 
        te.id AS enrollment_id,
        te.enrollment_status,
        te.attendance_status,
        te.attendance_date,
        te.hours_completed,
        te.completion_status,
        te.completion_date,
        te.remarks,
        tp.id AS training_id,
        tp.title,
        tp.category,
        tp.trainer_name,
        tp.training_provider,
        tp.training_type,
        tp.start_date,
        tp.end_date,
        tp.duration_hours,
        tp.status AS program_status,
        tc.id AS certificate_id,
        tc.certificate_number,
        tc.issue_date AS certificate_issue_date,
        tc.document_reference
      FROM training_enrollments te
      JOIN training_programs tp ON te.training_id = tp.id
      LEFT JOIN training_certificates tc ON tc.enrollment_id = te.id
      WHERE te.employee_id = $1
      ORDER BY tp.start_date DESC;
    `, [employeeId]);

    const certsRes = await pool.query(`
      SELECT tc.*, tp.title AS training_title
      FROM training_certificates tc
      LEFT JOIN training_programs tp ON tc.training_id = tp.id
      WHERE tc.employee_id = $1
      ORDER BY tc.issue_date DESC;
    `, [employeeId]);

    const totalHours = historyRes.rows
      .filter(r => r.completion_status === 'Completed')
      .reduce((sum, r) => sum + (parseFloat(r.hours_completed) || 0), 0);

    res.json({
      success: true,
      data: {
        training_history: historyRes.rows,
        certificates: certsRes.rows,
        total_trainings_attended: historyRes.rows.filter(r => r.attendance_status === 'Present').length,
        total_trainings_completed: historyRes.rows.filter(r => r.completion_status === 'Completed').length,
        total_training_hours: Math.round(totalHours * 10) / 10,
        total_certificates: certsRes.rows.length
      }
    });
  } catch (err) {
    console.error('Error fetching employee training history:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve employee training history.' });
  }
});

/**
 * -----------------------------------------------------------------------------
 * 6. TRAINING CALENDAR INTEGRATION
 * -----------------------------------------------------------------------------
 * GET /api/training/calendar
 */
router.get('/calendar', authenticateToken, async (req, res) => {
  try {
    const { year, month } = req.query;
    let query = `
      SELECT 
        tp.id,
        tp.title,
        tp.category,
        tp.trainer_name,
        tp.training_provider,
        tp.training_type,
        tp.start_date,
        tp.end_date,
        tp.start_time,
        tp.end_time,
        tp.duration_hours,
        tp.location_type,
        tp.location_venue,
        tp.target_audience,
        tp.status,
        d.name AS department_name,
        COUNT(te.id) AS enrolled_count
      FROM training_programs tp
      LEFT JOIN departments d ON tp.department_id = d.id
      LEFT JOIN training_enrollments te ON tp.id = te.training_id
      WHERE tp.status != 'Cancelled'
    `;
    const params = [];

    if (year && month) {
      const monthPadded = String(month).padStart(2, '0');
      const startStr = `${year}-${monthPadded}-01`;
      params.push(startStr);
      query += ` AND tp.end_date >= $${params.length}`;
      // End of month
      const lastDay = new Date(year, month, 0).getDate();
      const endStr = `${year}-${monthPadded}-${lastDay}`;
      params.push(endStr);
      query += ` AND tp.start_date <= $${params.length}`;
    }

    query += `
      GROUP BY tp.id, d.name
      ORDER BY tp.start_date ASC;
    `;

    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Error fetching training calendar:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve training calendar events.' });
  }
});

/**
 * -----------------------------------------------------------------------------
 * 7. HR TRAINING REPORTS & COMPLIANCE
 * -----------------------------------------------------------------------------
 * GET /api/training/reports
 */
router.get('/reports', authenticateToken, requirePermission('training:reports'), async (req, res) => {
  try {
    const { report_type = 'completion', department_id, start_date, end_date } = req.query;

    let reportData = [];

    if (report_type === 'completion') {
      // Training Completion Report
      const result = await pool.query(`
        SELECT 
          tp.id,
          tp.title,
          tp.category,
          tp.training_type,
          tp.start_date,
          tp.end_date,
          tp.duration_hours,
          tp.trainer_name,
          d.name AS department_name,
          COUNT(te.id) AS total_enrolled,
          COUNT(te.id) FILTER (WHERE te.completion_status = 'Completed') AS completed_count,
          COUNT(te.id) FILTER (WHERE te.completion_status = 'Pending' OR te.completion_status = 'Incomplete') AS pending_count,
          COUNT(te.id) FILTER (WHERE te.attendance_status = 'Absent') AS absent_count,
          COALESCE(SUM(te.hours_completed), 0) AS total_hours_delivered
        FROM training_programs tp
        LEFT JOIN departments d ON tp.department_id = d.id
        LEFT JOIN training_enrollments te ON tp.id = te.training_id
        GROUP BY tp.id, d.name
        ORDER BY tp.start_date DESC;
      `);
      reportData = result.rows;
    } else if (report_type === 'employee_hours') {
      // Training Hours by Employee
      const result = await pool.query(`
        SELECT 
          e.id,
          e.employee_code,
          e.first_name,
          e.last_name,
          e.work_email,
          d.name AS department_name,
          des.name AS designation_name,
          COUNT(te.id) AS trainings_enrolled,
          COUNT(te.id) FILTER (WHERE te.completion_status = 'Completed') AS trainings_completed,
          COALESCE(SUM(te.hours_completed), 0) AS total_training_hours,
          COUNT(tc.id) AS certificates_earned
        FROM employees e
        LEFT JOIN departments d ON e.department_id = d.id
        LEFT JOIN designations des ON e.designation_id = des.id
        LEFT JOIN training_enrollments te ON e.id = te.employee_id
        LEFT JOIN training_certificates tc ON e.id = tc.employee_id
        WHERE e.employment_status IN ('Active', 'Probation')
        GROUP BY e.id, d.name, des.name
        ORDER BY total_training_hours DESC, e.employee_code ASC;
      `);
      reportData = result.rows;
    } else if (report_type === 'department_participation') {
      // Department-Wise Participation & Hours
      const result = await pool.query(`
        SELECT 
          d.id,
          d.name AS department_name,
          COUNT(DISTINCT e.id) AS total_faculty,
          COUNT(DISTINCT te.employee_id) AS participating_faculty,
          COUNT(te.id) AS total_enrollments,
          COUNT(te.id) FILTER (WHERE te.completion_status = 'Completed') AS total_completions,
          COALESCE(SUM(te.hours_completed), 0) AS total_department_hours
        FROM departments d
        LEFT JOIN employees e ON d.id = e.department_id AND e.employment_status IN ('Active', 'Probation')
        LEFT JOIN training_enrollments te ON e.id = te.employee_id
        GROUP BY d.id, d.name
        ORDER BY total_department_hours DESC;
      `);
      reportData = result.rows;
    } else if (report_type === 'pending') {
      // Pending Training Roster
      const result = await pool.query(`
        SELECT 
          te.id AS enrollment_id,
          tp.title AS training_title,
          tp.category,
          tp.start_date,
          tp.end_date,
          tp.trainer_name,
          e.employee_code,
          e.first_name,
          e.last_name,
          d.name AS department_name,
          des.name AS designation_name,
          te.enrollment_status,
          te.attendance_status
        FROM training_enrollments te
        JOIN training_programs tp ON te.training_id = tp.id
        JOIN employees e ON te.employee_id = e.id
        LEFT JOIN departments d ON e.department_id = d.id
        LEFT JOIN designations des ON e.designation_id = des.id
        WHERE te.completion_status IN ('Pending', 'Incomplete')
        ORDER BY tp.start_date ASC, e.employee_code ASC;
      `);
      reportData = result.rows;
    } else if (report_type === 'certificates') {
      // Certificate & Expiry Tracking Report
      const result = await pool.query(`
        SELECT 
          tc.id,
          tc.certificate_name,
          tc.certificate_number,
          tc.training_provider,
          tc.issue_date,
          tc.expiry_date,
          tc.document_reference,
          tc.status,
          CASE 
            WHEN tc.expiry_date IS NOT NULL AND tc.expiry_date < CURRENT_DATE THEN 'Expired'
            WHEN tc.expiry_date IS NOT NULL AND tc.expiry_date <= (CURRENT_DATE + INTERVAL '60 days') THEN 'Expiring Soon'
            ELSE 'Valid'
          END AS compliance_status,
          e.employee_code,
          e.first_name,
          e.last_name,
          d.name AS department_name,
          des.name AS designation_name,
          tp.title AS training_title
        FROM training_certificates tc
        JOIN employees e ON tc.employee_id = e.id
        LEFT JOIN departments d ON e.department_id = d.id
        LEFT JOIN designations des ON e.designation_id = des.id
        LEFT JOIN training_programs tp ON tc.training_id = tp.id
        ORDER BY tc.expiry_date ASC NULLS LAST;
      `);
      reportData = result.rows;
    }

    res.json({
      success: true,
      report_type,
      generated_at: new Date().toISOString(),
      data: reportData
    });
  } catch (err) {
    console.error('Error generating training report:', err);
    res.status(500).json({ success: false, message: 'Failed to generate training report.' });
  }
});

module.exports = router;
