const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken, requirePermission, requireSuperAdmin } = require('../middleware/auth');

/**
 * Helper: Formats a JS Date to 'YYYY-MM-DD'
 */
function formatDate(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Helper: Checks if a calendar event applies to a specific calendar date.
 * RULE: Examinations and assessments (categories/titles containing 'Exam' or 'Test')
 * are strictly scheduled on instructional weekdays (Monday through Friday) by default.
 * The system NEVER assumes or places an exam on Saturday or Sunday unless the
 * administrator/HR explicitly opted-in via [INCLUDE_SATURDAY] or [INCLUDE_SUNDAY].
 */
function eventAppliesToDate(ev, dateObj) {
  const dateStr = formatDate(dateObj);
  const evStart = formatDate(new Date(ev.start_date));
  const evEnd = formatDate(new Date(ev.end_date));
  if (dateStr < evStart || dateStr > evEnd) return false;

  const dayOfWeek = dateObj.getDay(); // 0 = Sunday, 6 = Saturday
  const isExam = (ev.category && (ev.category.toLowerCase().includes('exam') || ev.category.toLowerCase().includes('test'))) ||
                 (ev.title && (ev.title.toLowerCase().includes('exam') || ev.title.toLowerCase().includes('test')));

  if (isExam) {
    const desc = ev.description || '';
    const incSat = desc.includes('[INCLUDE_SATURDAY]') || desc.includes('[INCLUDES_SATURDAY]');
    const incSun = desc.includes('[INCLUDE_SUNDAY]') || desc.includes('[INCLUDES_SUNDAY]');

    if (dayOfWeek === 0 && !incSun) return false; // Exclude Sunday unless explicitly checked
    if (dayOfWeek === 6 && !incSat) return false; // Exclude Saturday unless explicitly checked
  }

  return true;
}

/**
 * -----------------------------------------------------------------------------
 * REAL-TIME EVENT STREAM & SYNCHRONIZATION SYSTEM
 * -----------------------------------------------------------------------------
 */
const calendarSseClients = new Set();

/**
 * Broadcasts calendar mutations in real-time to all connected HRMS clients
 */
function broadcastCalendarChange(action, eventData) {
  const payload = JSON.stringify({
    action,
    event: eventData || null,
    timestamp: new Date().toISOString()
  });

  for (const client of calendarSseClients) {
    try {
      client.write(`event: calendar_change\ndata: ${payload}\n\n`);
    } catch (err) {
      calendarSseClients.delete(client);
    }
  }
}

/**
 * GET /api/academic-calendar/sync-status
 * Lightweight endpoint returning last modification timestamp and total events count
 */
router.get('/sync-status', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        COALESCE(MAX(updated_at), '1970-01-01'::timestamp with time zone) AS last_modified,
        COUNT(*) AS total_count
      FROM calendar_events;
    `);
    const row = result.rows[0];
    res.json({
      success: true,
      last_modified: row.last_modified,
      total_count: parseInt(row.total_count, 10),
      server_time: new Date().toISOString()
    });
  } catch (err) {
    console.error('Error in calendar sync-status:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve calendar sync status.' });
  }
});

/**
 * GET /api/academic-calendar/stream
 * Real-time Server-Sent Events (SSE) stream for live event propagation
 */
router.get('/stream', (req, res) => {
  const token = req.query.token || (req.headers['authorization'] && req.headers['authorization'].split(' ')[1]);
  if (!token) {
    return res.status(401).json({ success: false, message: 'Authentication required for live calendar stream.' });
  }

  try {
    const jwt = require('jsonwebtoken');
    jwt.verify(token, process.env.JWT_SECRET || 'fallback_jwt_secret_svhs_2026');
  } catch (e) {
    return res.status(403).json({ success: false, message: 'Invalid or expired stream authentication token.' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  res.write(`data: ${JSON.stringify({ type: 'connected', time: new Date().toISOString() })}\n\n`);
  calendarSseClients.add(res);

  const keepAlive = setInterval(() => {
    try {
      res.write(': ping\n\n');
    } catch (e) {
      clearInterval(keepAlive);
      calendarSseClients.delete(res);
    }
  }, 25000);

  req.on('close', () => {
    clearInterval(keepAlive);
    calendarSseClients.delete(res);
  });
});

/**
 * -----------------------------------------------------------------------------
 * 1. CALENDAR OVERVIEW & DASHBOARD METRICS
 * -----------------------------------------------------------------------------
 * GET /api/academic-calendar/overview
 */
router.get('/overview', authenticateToken, async (req, res) => {
  try {
    const today = new Date();
    const todayStr = formatDate(today);
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1; // 1-12

    // 1. Get Active Academic Year
    const activeYearRes = await pool.query(`
      SELECT * FROM academic_years WHERE is_active = true LIMIT 1;
    `);
    const activeYear = activeYearRes.rows[0] || null;

    // 2. Get Current Term
    let activeTerm = null;
    if (activeYear) {
      const termRes = await pool.query(`
        SELECT * FROM academic_terms 
        WHERE academic_year_id = $1 
          AND start_date <= $2 
          AND end_date >= $2
          AND is_active = true
        LIMIT 1;
      `, [activeYear.id, todayStr]);
      activeTerm = termRes.rows[0] || null;
    }

    // 3. Get Upcoming Holiday / School Closure
    const upcomingHolidayRes = await pool.query(`
      SELECT 
        id, title, event_type, category, start_date, end_date, start_time, end_time, total_days, description,
        (start_date - $1::date) AS days_remaining
      FROM calendar_events
      WHERE end_date >= $1::date
        AND is_active = true
        AND event_type IN ('Holiday', 'School Closure')
      ORDER BY start_date ASC
      LIMIT 1;
    `, [todayStr]);
    const upcomingHoliday = upcomingHolidayRes.rows[0] || null;

    // 4. Calculate Working Days in Current Month
    const startOfMonth = new Date(currentYear, currentMonth - 1, 1);
    const endOfMonth = new Date(currentYear, currentMonth, 0);
    const startOfMonthStr = formatDate(startOfMonth);
    const endOfMonthStr = formatDate(endOfMonth);
    const totalDaysInMonth = endOfMonth.getDate();

    // Fetch all events affecting this month
    const monthEventsRes = await pool.query(`
      SELECT * FROM calendar_events
      WHERE is_active = true
        AND start_date <= $2
        AND end_date >= $1
      ORDER BY start_date ASC;
    `, [startOfMonthStr, endOfMonthStr]);
    const monthEvents = monthEventsRes.rows;

    let workingDaysCount = 0;
    for (let day = 1; day <= totalDaysInMonth; day++) {
      const iterDate = new Date(currentYear, currentMonth - 1, day);
      const iterDateStr = formatDate(iterDate);
      const dayOfWeek = iterDate.getDay(); // 0 = Sunday

      // Default: Sunday is non-working
      let isWorking = dayOfWeek !== 0;

      // Check events on this date (respecting weekend exclusions for exams)
      const eventsOnDate = monthEvents.filter(ev => eventAppliesToDate(ev, iterDate));

      for (const ev of eventsOnDate) {
        if (ev.event_type === 'Holiday' || ev.event_type === 'School Closure') {
          isWorking = false;
        } else if (ev.event_type === 'Working Day Override') {
          isWorking = true;
        }
      }

      if (isWorking) workingDaysCount++;
    }

    // 5. Evaluate Today's Status
    const todayEventsRes = await pool.query(`
      SELECT * FROM calendar_events
      WHERE is_active = true
        AND start_date <= $1
        AND end_date >= $1;
    `, [todayStr]);
    const todayEvents = todayEventsRes.rows.filter(ev => eventAppliesToDate(ev, today));

    const todayDayOfWeek = today.getDay();
    let todayIsWorking = todayDayOfWeek !== 0;
    let todayStatusLabel = todayDayOfWeek === 0 ? 'Weekly Off (Sunday)' : 'Normal Working Day';

    const holidayEvent = todayEvents.find(e => e.event_type === 'Holiday');
    const closureEvent = todayEvents.find(e => e.event_type === 'School Closure');
    const nonInstEvent = todayEvents.find(e => e.event_type === 'Non-Instructional');
    const overrideEvent = todayEvents.find(e => e.event_type === 'Working Day Override');

    if (closureEvent) {
      todayIsWorking = false;
      todayStatusLabel = `School Closure — ${closureEvent.title}`;
    } else if (holidayEvent) {
      todayIsWorking = false;
      todayStatusLabel = `Holiday — ${holidayEvent.title}`;
    } else if (overrideEvent) {
      todayIsWorking = true;
      todayStatusLabel = `Working Day Override — ${overrideEvent.title}`;
    } else if (nonInstEvent) {
      todayIsWorking = nonInstEvent.is_working_day;
      todayStatusLabel = `Non-Instructional — ${nonInstEvent.title}`;
    }

    // 6. Next 5 Upcoming Events
    const nextEventsRes = await pool.query(`
      SELECT 
        id, title, event_type, category, start_date, end_date, start_time, end_time, total_days, description,
        (start_date - $1::date) AS days_remaining
      FROM calendar_events
      WHERE end_date >= $1::date AND is_active = true
      ORDER BY start_date ASC
      LIMIT 8;
    `, [todayStr]);

    res.json({
      success: true,
      data: {
        active_year: activeYear,
        active_term: activeTerm,
        upcoming_holiday: upcomingHoliday,
        working_days_this_month: workingDaysCount,
        total_days_in_month: totalDaysInMonth,
        today_status: {
          date: todayStr,
          day_name: today.toLocaleDateString('en-US', { weekday: 'long' }),
          formatted_date: today.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          is_working_day: todayIsWorking,
          status_label: todayStatusLabel,
          term_name: activeTerm ? activeTerm.name : 'Out of Term Session',
          events_today: todayEvents
        },
        upcoming_events: nextEventsRes.rows
      }
    });
  } catch (error) {
    console.error('Error fetching calendar overview:', error);
    res.status(500).json({ success: false, message: 'Failed to load calendar overview.' });
  }
});

/**
 * -----------------------------------------------------------------------------
 * 2. MONTH MATRIX FOR CALENDAR VIEW
 * -----------------------------------------------------------------------------
 * GET /api/academic-calendar/month?year=2026&month=9
 */
router.get('/month', authenticateToken, async (req, res) => {
  try {
    const year = parseInt(req.query.year, 10) || new Date().getFullYear();
    const month = parseInt(req.query.month, 10) || (new Date().getMonth() + 1); // 1-12

    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0);
    const startOfMonthStr = formatDate(startOfMonth);
    const endOfMonthStr = formatDate(endOfMonth);
    const daysInMonth = endOfMonth.getDate();
    const todayStr = formatDate(new Date());

    // Fetch active academic year and terms covering this month
    const termsRes = await pool.query(`
      SELECT t.*, y.name AS year_name
      FROM academic_terms t
      JOIN academic_years y ON t.academic_year_id = y.id
      WHERE t.is_active = true
        AND t.start_date <= $2
        AND t.end_date >= $1
      ORDER BY t.start_date ASC;
    `, [startOfMonthStr, endOfMonthStr]);
    const terms = termsRes.rows;

    // Fetch all events for this month
    const eventsRes = await pool.query(`
      SELECT * FROM calendar_events
      WHERE is_active = true
        AND start_date <= $2
        AND end_date >= $1
      ORDER BY start_date ASC;
    `, [startOfMonthStr, endOfMonthStr]);
    const events = eventsRes.rows;

    // Build day-by-day matrix
    const days = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(year, month - 1, d);
      const dateStr = formatDate(dateObj);
      const dayOfWeek = dateObj.getDay(); // 0 = Sunday, 1 = Monday ... 6 = Saturday

      // Default: Sunday is non-working
      let isWorking = dayOfWeek !== 0;
      let dayType = dayOfWeek === 0 ? 'Weekly Off' : 'Working Day';

      // Find events on this date (respecting weekend exclusions for exams)
      const dayEvents = events.filter(ev => eventAppliesToDate(ev, dateObj));

      // Find term on this date
      const dayTerm = terms.find(t => {
        const tStart = formatDate(new Date(t.start_date));
        const tEnd = formatDate(new Date(t.end_date));
        return dateStr >= tStart && dateStr <= tEnd;
      });

      const holiday = dayEvents.find(e => e.event_type === 'Holiday');
      const closure = dayEvents.find(e => e.event_type === 'School Closure');
      const nonInst = dayEvents.find(e => e.event_type === 'Non-Instructional');
      const override = dayEvents.find(e => e.event_type === 'Working Day Override');

      if (closure) {
        isWorking = false;
        dayType = 'School Closure';
      } else if (holiday) {
        isWorking = false;
        dayType = 'Holiday';
      } else if (override) {
        isWorking = true;
        dayType = 'Working Day Override';
      } else if (nonInst) {
        isWorking = nonInst.is_working_day;
        dayType = 'Non-Instructional';
      }

      days.push({
        date: dateStr,
        day_number: d,
        day_of_week: dayOfWeek,
        is_today: dateStr === todayStr,
        is_working_day: isWorking,
        day_type: dayType,
        term_name: dayTerm ? dayTerm.name : null,
        events: dayEvents
      });
    }

    res.json({
      success: true,
      data: {
        year,
        month,
        month_name: startOfMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        start_date: startOfMonthStr,
        end_date: endOfMonthStr,
        days_in_month: daysInMonth,
        terms,
        events,
        days
      }
    });
  } catch (error) {
    console.error('Error fetching calendar month:', error);
    res.status(500).json({ success: false, message: 'Failed to load month calendar matrix.' });
  }
});

/**
 * -----------------------------------------------------------------------------
 * 3. DAY STATUS LOOKUP (FOR ATTENDANCE / LEAVE INTEGRATION)
 * -----------------------------------------------------------------------------
 * GET /api/academic-calendar/day-status?date=YYYY-MM-DD
 */
router.get('/day-status', authenticateToken, async (req, res) => {
  try {
    const targetDate = req.query.date || formatDate(new Date());
    const dateObj = new Date(targetDate);
    if (isNaN(dateObj.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid date parameter. Use YYYY-MM-DD.' });
    }

    const dayOfWeek = dateObj.getDay();
    let isWorking = dayOfWeek !== 0;
    let dayType = dayOfWeek === 0 ? 'Weekly Off' : 'Working Day';

    const eventsRes = await pool.query(`
      SELECT * FROM calendar_events
      WHERE is_active = true
        AND start_date <= $1
        AND end_date >= $1;
    `, [targetDate]);
    const events = eventsRes.rows;

    const termRes = await pool.query(`
      SELECT t.*, y.name AS year_name
      FROM academic_terms t
      JOIN academic_years y ON t.academic_year_id = y.id
      WHERE t.is_active = true
        AND t.start_date <= $1
        AND t.end_date >= $1
      LIMIT 1;
    `, [targetDate]);
    const term = termRes.rows[0] || null;

    const holiday = events.find(e => e.event_type === 'Holiday');
    const closure = events.find(e => e.event_type === 'School Closure');
    const nonInst = events.find(e => e.event_type === 'Non-Instructional');
    const override = events.find(e => e.event_type === 'Working Day Override');

    if (closure) {
      isWorking = false;
      dayType = 'School Closure';
    } else if (holiday) {
      isWorking = false;
      dayType = 'Holiday';
    } else if (override) {
      isWorking = true;
      dayType = 'Working Day Override';
    } else if (nonInst) {
      isWorking = nonInst.is_working_day;
      dayType = 'Non-Instructional';
    }

    res.json({
      success: true,
      data: {
        date: targetDate,
        day_name: dateObj.toLocaleDateString('en-US', { weekday: 'long' }),
        day_of_week: dayOfWeek,
        is_working_day: isWorking,
        day_type: dayType,
        term: term,
        events: events
      }
    });
  } catch (error) {
    console.error('Error fetching day status:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve day status.' });
  }
});

/**
 * -----------------------------------------------------------------------------
 * 4. ACADEMIC YEARS MANAGEMENT
 * -----------------------------------------------------------------------------
 */

// GET /api/academic-calendar/years
router.get('/years', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        y.*,
        COUNT(DISTINCT t.id) AS terms_count,
        COUNT(DISTINCT e.id) AS events_count
      FROM academic_years y
      LEFT JOIN academic_terms t ON y.id = t.academic_year_id
      LEFT JOIN calendar_events e ON y.id = e.academic_year_id
      GROUP BY y.id
      ORDER BY y.start_date DESC;
    `);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching academic years:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve academic years.' });
  }
});

// GET /api/academic-calendar/years/:id
router.get('/years/:id', authenticateToken, async (req, res) => {
  try {
    const yearRes = await pool.query("SELECT * FROM academic_years WHERE id = $1;", [req.params.id]);
    if (yearRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Academic year not found.' });
    }

    const termsRes = await pool.query("SELECT * FROM academic_terms WHERE academic_year_id = $1 ORDER BY start_date ASC;", [req.params.id]);
    const eventsRes = await pool.query("SELECT * FROM calendar_events WHERE academic_year_id = $1 ORDER BY start_date ASC;", [req.params.id]);

    res.json({
      success: true,
      data: {
        ...yearRes.rows[0],
        terms: termsRes.rows,
        events: eventsRes.rows
      }
    });
  } catch (error) {
    console.error('Error fetching academic year details:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve academic year details.' });
  }
});

// POST /api/academic-calendar/years
router.post('/years', authenticateToken, requirePermission('calendar:manage_years'), async (req, res) => {
  const { name, start_date, end_date, description, is_active } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, message: 'Academic year name is required (e.g. 2026–2027).' });
  }
  if (!start_date || !end_date) {
    return res.status(400).json({ success: false, message: 'Start date and End date are required.' });
  }
  if (new Date(end_date) <= new Date(start_date)) {
    return res.status(400).json({ success: false, message: 'End date must be strictly after Start date.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check for duplicate name
    const existing = await client.query("SELECT id FROM academic_years WHERE name = $1;", [name.trim()]);
    if (existing.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'An academic year with this name already exists.' });
    }

    // If marked active, deactivate other academic years
    if (is_active) {
      await client.query("UPDATE academic_years SET is_active = false, status = 'Completed' WHERE is_active = true;");
    }

    const status = is_active ? 'Active' : (new Date(start_date) > new Date() ? 'Upcoming' : 'Archived');

    const insertRes = await client.query(`
      INSERT INTO academic_years (name, start_date, end_date, is_active, status, description)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
    `, [name.trim(), start_date, end_date, Boolean(is_active), status, description ? description.trim() : null]);

    await client.query('COMMIT');
    res.status(201).json({ success: true, message: 'Academic year created successfully.', data: insertRes.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating academic year:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to create academic year.' });
  } finally {
    client.release();
  }
});

// PUT /api/academic-calendar/years/:id
router.put('/years/:id', authenticateToken, requirePermission('calendar:manage_years'), async (req, res) => {
  const { name, start_date, end_date, description, is_active, status } = req.body;
  const { id } = req.params;

  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, message: 'Academic year name is required.' });
  }
  if (!start_date || !end_date) {
    return res.status(400).json({ success: false, message: 'Start date and End date are required.' });
  }
  if (new Date(end_date) <= new Date(start_date)) {
    return res.status(400).json({ success: false, message: 'End date must be strictly after Start date.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // If activating this year, deactivate all others
    if (is_active) {
      await client.query("UPDATE academic_years SET is_active = false, status = 'Completed' WHERE id != $1 AND is_active = true;", [id]);
    }

    const updatedStatus = is_active ? 'Active' : (status || 'Archived');

    const updateRes = await client.query(`
      UPDATE academic_years
      SET name = $1, start_date = $2, end_date = $3, is_active = $4, status = $5, description = $6, updated_at = CURRENT_TIMESTAMP
      WHERE id = $7
      RETURNING *;
    `, [name.trim(), start_date, end_date, Boolean(is_active), updatedStatus, description ? description.trim() : null, id]);

    if (updateRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Academic year not found.' });
    }

    await client.query('COMMIT');
    res.json({ success: true, message: 'Academic year updated successfully.', data: updateRes.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating academic year:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to update academic year.' });
  } finally {
    client.release();
  }
});

// PATCH /api/academic-calendar/years/:id/activate
router.patch('/years/:id/activate', authenticateToken, requirePermission('calendar:manage_years'), async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Deactivate all others
    await client.query("UPDATE academic_years SET is_active = false, status = 'Completed' WHERE id != $1;", [id]);

    // Activate selected
    const resUpdate = await client.query(`
      UPDATE academic_years
      SET is_active = true, status = 'Active', updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *;
    `, [id]);

    if (resUpdate.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Academic year not found.' });
    }

    await client.query('COMMIT');
    res.json({ success: true, message: `Academic year ${resUpdate.rows[0].name} activated as official session.`, data: resUpdate.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error activating academic year:', error);
    res.status(500).json({ success: false, message: 'Failed to activate academic year.' });
  } finally {
    client.release();
  }
});

// PATCH /api/academic-calendar/years/:id/status
router.patch('/years/:id/status', authenticateToken, requirePermission('calendar:manage_years'), async (req, res) => {
  const { id } = req.params;
  const { is_active, status } = req.body;
  try {
    const resUpdate = await pool.query(`
      UPDATE academic_years
      SET is_active = COALESCE($1, is_active), status = COALESCE($2, status), updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING *;
    `, [is_active, status, id]);

    if (resUpdate.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Academic year not found.' });
    }
    res.json({ success: true, message: 'Academic year status updated.', data: resUpdate.rows[0] });
  } catch (error) {
    console.error('Error updating academic year status:', error);
    res.status(500).json({ success: false, message: 'Failed to update academic year status.' });
  }
});

// DELETE /api/academic-calendar/years/:id
router.delete('/years/:id', authenticateToken, requirePermission('calendar:manage_years'), async (req, res) => {
  const { id } = req.params;
  try {
    const checkDeps = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM academic_terms WHERE academic_year_id = $1) AS terms_count,
        (SELECT COUNT(*) FROM calendar_events WHERE academic_year_id = $1) AS events_count;
    `, [id]);

    const { terms_count, events_count } = checkDeps.rows[0];

    // If records exist, soft-deactivate rather than physical deletion
    if (parseInt(terms_count, 10) > 0 || parseInt(events_count, 10) > 0) {
      await pool.query("UPDATE academic_years SET is_active = false, status = 'Archived', updated_at = CURRENT_TIMESTAMP WHERE id = $1;", [id]);
      return res.json({ success: true, message: 'Academic year archived to preserve associated terms and event records.' });
    }

    await pool.query("DELETE FROM academic_years WHERE id = $1;", [id]);
    res.json({ success: true, message: 'Academic year deleted successfully.' });
  } catch (error) {
    console.error('Error deleting academic year:', error);
    res.status(500).json({ success: false, message: 'Failed to delete academic year.' });
  }
});

/**
 * -----------------------------------------------------------------------------
 * 5. ACADEMIC TERMS MANAGEMENT
 * -----------------------------------------------------------------------------
 */

// GET /api/academic-calendar/terms
router.get('/terms', authenticateToken, async (req, res) => {
  try {
    const { academic_year_id } = req.query;
    let query = `
      SELECT t.*, y.name AS year_name, y.is_active AS year_is_active
      FROM academic_terms t
      JOIN academic_years y ON t.academic_year_id = y.id
    `;
    const params = [];

    if (academic_year_id) {
      params.push(academic_year_id);
      query += ` WHERE t.academic_year_id = $1`;
    }

    query += ` ORDER BY t.start_date ASC;`;

    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching academic terms:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve academic terms.' });
  }
});

// POST /api/academic-calendar/terms
router.post('/terms', authenticateToken, requirePermission('calendar:manage'), async (req, res) => {
  const { academic_year_id, name, start_date, end_date, description, is_active } = req.body;

  if (!academic_year_id) {
    return res.status(400).json({ success: false, message: 'Academic year is required.' });
  }
  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, message: 'Term name is required (e.g. Term 1).' });
  }
  if (!start_date || !end_date) {
    return res.status(400).json({ success: false, message: 'Start date and End date are required.' });
  }
  if (new Date(end_date) < new Date(start_date)) {
    return res.status(400).json({ success: false, message: 'End date must be on or after Start date.' });
  }

  try {
    // Validate term falls within academic year
    const yearRes = await pool.query("SELECT start_date, end_date, name FROM academic_years WHERE id = $1;", [academic_year_id]);
    if (yearRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Selected academic year not found.' });
    }
    const year = yearRes.rows[0];
    if (new Date(start_date) < new Date(year.start_date) || new Date(end_date) > new Date(year.end_date)) {
      return res.status(400).json({
        success: false,
        message: `Term dates must fall within Academic Year ${year.name} (${formatDate(new Date(year.start_date))} to ${formatDate(new Date(year.end_date))}).`
      });
    }

    const insertRes = await pool.query(`
      INSERT INTO academic_terms (academic_year_id, name, start_date, end_date, description, is_active)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
    `, [academic_year_id, name.trim(), start_date, end_date, description ? description.trim() : null, is_active !== false]);

    res.status(201).json({ success: true, message: 'Academic term created successfully.', data: insertRes.rows[0] });
  } catch (error) {
    console.error('Error creating academic term:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to create academic term.' });
  }
});

// PUT /api/academic-calendar/terms/:id
router.put('/terms/:id', authenticateToken, requirePermission('calendar:manage'), async (req, res) => {
  const { academic_year_id, name, start_date, end_date, description, is_active } = req.body;
  const { id } = req.params;

  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, message: 'Term name is required.' });
  }
  if (!start_date || !end_date) {
    return res.status(400).json({ success: false, message: 'Start date and End date are required.' });
  }
  if (new Date(end_date) < new Date(start_date)) {
    return res.status(400).json({ success: false, message: 'End date must be on or after Start date.' });
  }

  try {
    const updateRes = await pool.query(`
      UPDATE academic_terms
      SET academic_year_id = COALESCE($1, academic_year_id),
          name = $2,
          start_date = $3,
          end_date = $4,
          description = $5,
          is_active = COALESCE($6, is_active),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $7
      RETURNING *;
    `, [academic_year_id, name.trim(), start_date, end_date, description ? description.trim() : null, is_active, id]);

    if (updateRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Academic term not found.' });
    }

    res.json({ success: true, message: 'Academic term updated successfully.', data: updateRes.rows[0] });
  } catch (error) {
    console.error('Error updating academic term:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to update academic term.' });
  }
});

// PATCH /api/academic-calendar/terms/:id/status
router.patch('/terms/:id/status', authenticateToken, requirePermission('calendar:manage'), async (req, res) => {
  const { id } = req.params;
  const { is_active } = req.body;
  try {
    const updateRes = await pool.query(`
      UPDATE academic_terms
      SET is_active = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *;
    `, [Boolean(is_active), id]);

    if (updateRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Academic term not found.' });
    }
    res.json({ success: true, message: 'Academic term status updated.', data: updateRes.rows[0] });
  } catch (error) {
    console.error('Error toggling term status:', error);
    res.status(500).json({ success: false, message: 'Failed to update term status.' });
  }
});

// DELETE /api/academic-calendar/terms/:id
router.delete('/terms/:id', authenticateToken, requirePermission('calendar:manage'), async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query("UPDATE academic_terms SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1;", [id]);
    res.json({ success: true, message: 'Academic term deactivated.' });
  } catch (error) {
    console.error('Error deleting term:', error);
    res.status(500).json({ success: false, message: 'Failed to delete term.' });
  }
});

/**
 * -----------------------------------------------------------------------------
 * 6. CALENDAR EVENTS & HOLIDAYS MANAGEMENT
 * -----------------------------------------------------------------------------
 */

// GET /api/academic-calendar/events
router.get('/events', authenticateToken, async (req, res) => {
  try {
    const { search, academic_year_id, event_type, month, status } = req.query;

    let query = `
      SELECT 
        e.*,
        y.name AS academic_year_name,
        t.name AS term_name
      FROM calendar_events e
      JOIN academic_years y ON e.academic_year_id = y.id
      LEFT JOIN academic_terms t ON e.term_id = t.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (search && search.trim()) {
      params.push(`%${search.trim()}%`);
      query += ` AND (e.title ILIKE $${paramIndex} OR e.description ILIKE $${paramIndex} OR e.category ILIKE $${paramIndex})`;
      paramIndex++;
    }

    if (academic_year_id && academic_year_id !== 'ALL') {
      params.push(academic_year_id);
      query += ` AND e.academic_year_id = $${paramIndex}`;
      paramIndex++;
    }

    if (event_type && event_type !== 'ALL') {
      params.push(event_type);
      query += ` AND e.event_type = $${paramIndex}`;
      paramIndex++;
    }

    if (status && status !== 'ALL') {
      const isActive = status === 'Active' || status === 'true';
      params.push(isActive);
      query += ` AND e.is_active = $${paramIndex}`;
      paramIndex++;
    }

    if (month) {
      // month = '2026-09'
      const [y, m] = month.split('-');
      const startM = `${y}-${m}-01`;
      const endM = formatDate(new Date(parseInt(y, 10), parseInt(m, 10), 0));
      params.push(startM, endM);
      query += ` AND e.start_date <= $${paramIndex + 1} AND e.end_date >= $${paramIndex}`;
      paramIndex += 2;
    }

    query += ` ORDER BY e.start_date ASC;`;

    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching calendar events:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve calendar events.' });
  }
});

// GET /api/academic-calendar/events/:id
router.get('/events/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        e.*,
        y.name AS academic_year_name,
        t.name AS term_name
      FROM calendar_events e
      JOIN academic_years y ON e.academic_year_id = y.id
      LEFT JOIN academic_terms t ON e.term_id = t.id
      WHERE e.id = $1;
    `, [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Calendar event not found.' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error fetching calendar event details:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve event details.' });
  }
});

// POST /api/academic-calendar/events
router.post('/events', authenticateToken, requirePermission('calendar:manage'), async (req, res) => {
  const {
    academic_year_id,
    term_id,
    title,
    event_type,
    category,
    start_date,
    end_date,
    start_time,
    end_time,
    description,
    is_working_day
  } = req.body;

  if (!title || !title.trim()) {
    return res.status(400).json({ success: false, message: 'Event title is required.' });
  }
  if (!event_type) {
    return res.status(400).json({ success: false, message: 'Event type is required.' });
  }
  if (!start_date || !end_date) {
    return res.status(400).json({ success: false, message: 'Start date and End date are required.' });
  }
  if (new Date(end_date) < new Date(start_date)) {
    return res.status(400).json({ success: false, message: 'End date must be on or after Start date.' });
  }

  try {
    // If academic_year_id not provided, default to active academic year
    let yearId = academic_year_id;
    if (!yearId) {
      const activeYearRes = await pool.query("SELECT id FROM academic_years WHERE is_active = true LIMIT 1;");
      if (activeYearRes.rows.length > 0) {
        yearId = activeYearRes.rows[0].id;
      } else {
        return res.status(400).json({ success: false, message: 'No active academic year found. Please specify an academic year.' });
      }
    }

    // Auto-calculate total days (respecting weekend exclusions for exams unless opted-in)
    const isExam = (category && (category.toLowerCase().includes('exam') || category.toLowerCase().includes('test'))) ||
                   (title && (title.toLowerCase().includes('exam') || title.toLowerCase().includes('test')));
    const incSat = description && (description.includes('[INCLUDE_SATURDAY]') || description.includes('[INCLUDES_SATURDAY]'));
    const incSun = description && (description.includes('[INCLUDE_SUNDAY]') || description.includes('[INCLUDES_SUNDAY]'));

    let totalDays = 0;
    const sDate = new Date(start_date);
    const eDate = new Date(end_date);
    for (let cur = new Date(sDate); cur <= eDate; cur.setDate(cur.getDate() + 1)) {
      const dow = cur.getDay();
      if (isExam) {
        if (dow === 0 && !incSun) continue; // Skip Sunday
        if (dow === 6 && !incSat) continue; // Skip Saturday
      }
      totalDays++;
    }
    if (totalDays === 0) totalDays = 1;

    // Working day setting
    let isWorking = false;
    if (event_type === 'Working Day Override') {
      isWorking = true;
    } else if (event_type === 'Non-Instructional') {
      isWorking = is_working_day !== undefined ? Boolean(is_working_day) : true;
    }

    const insertRes = await pool.query(`
      INSERT INTO calendar_events (
        academic_year_id, term_id, title, event_type, category,
        start_date, end_date, start_time, end_time, total_days, description, is_working_day, is_active, created_by, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, true, $13, CURRENT_TIMESTAMP)
      RETURNING *;
    `, [
      yearId,
      term_id || null,
      title.trim(),
      event_type,
      category ? category.trim() : (event_type === 'Holiday' ? 'Public Holiday' : 'School Event'),
      start_date,
      end_date,
      start_time ? start_time.trim() : null,
      end_time ? end_time.trim() : null,
      totalDays,
      description ? description.trim() : null,
      isWorking,
      req.user.id
    ]);

    const createdEvent = insertRes.rows[0];

    // Real-time propagation to all connected HRMS clients
    broadcastCalendarChange('CREATE', createdEvent);

    res.status(201).json({ success: true, message: 'Calendar event created successfully.', data: createdEvent });
  } catch (error) {
    console.error('Error creating calendar event:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to create calendar event.' });
  }
});

// PUT /api/academic-calendar/events/:id
router.put('/events/:id', authenticateToken, requirePermission('calendar:manage'), async (req, res) => {
  const { id } = req.params;
  const {
    academic_year_id,
    term_id,
    title,
    event_type,
    category,
    start_date,
    end_date,
    start_time,
    end_time,
    description,
    is_working_day,
    is_active
  } = req.body;

  if (!title || !title.trim()) {
    return res.status(400).json({ success: false, message: 'Event title is required.' });
  }
  if (!start_date || !end_date) {
    return res.status(400).json({ success: false, message: 'Start date and End date are required.' });
  }
  if (new Date(end_date) < new Date(start_date)) {
    return res.status(400).json({ success: false, message: 'End date must be on or after Start date.' });
  }

  try {
    const isExam = (category && (category.toLowerCase().includes('exam') || category.toLowerCase().includes('test'))) ||
                   (title && (title.toLowerCase().includes('exam') || title.toLowerCase().includes('test')));
    const incSat = description && (description.includes('[INCLUDE_SATURDAY]') || description.includes('[INCLUDES_SATURDAY]'));
    const incSun = description && (description.includes('[INCLUDE_SUNDAY]') || description.includes('[INCLUDES_SUNDAY]'));

    let totalDays = 0;
    const sDate = new Date(start_date);
    const eDate = new Date(end_date);
    for (let cur = new Date(sDate); cur <= eDate; cur.setDate(cur.getDate() + 1)) {
      const dow = cur.getDay();
      if (isExam) {
        if (dow === 0 && !incSun) continue; // Skip Sunday
        if (dow === 6 && !incSat) continue; // Skip Saturday
      }
      totalDays++;
    }
    if (totalDays === 0) totalDays = 1;

    let isWorking = false;
    if (event_type === 'Working Day Override') {
      isWorking = true;
    } else if (event_type === 'Non-Instructional') {
      isWorking = is_working_day !== undefined ? Boolean(is_working_day) : true;
    }

    const updateRes = await pool.query(`
      UPDATE calendar_events
      SET academic_year_id = COALESCE($1, academic_year_id),
          term_id = $2,
          title = $3,
          event_type = COALESCE($4, event_type),
          category = COALESCE($5, category),
          start_date = $6,
          end_date = $7,
          start_time = $8,
          end_time = $9,
          total_days = $10,
          description = $11,
          is_working_day = $12,
          is_active = COALESCE($13, is_active),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $14
      RETURNING *;
    `, [
      academic_year_id,
      term_id || null,
      title.trim(),
      event_type,
      category ? category.trim() : null,
      start_date,
      end_date,
      start_time !== undefined ? (start_time ? start_time.trim() : null) : null,
      end_time !== undefined ? (end_time ? end_time.trim() : null) : null,
      totalDays,
      description ? description.trim() : null,
      isWorking,
      is_active,
      id
    ]);

    if (updateRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Calendar event not found.' });
    }

    const updatedEvent = updateRes.rows[0];

    // Real-time propagation to all connected HRMS clients
    broadcastCalendarChange('UPDATE', updatedEvent);

    res.json({ success: true, message: 'Calendar event updated successfully.', data: updatedEvent });
  } catch (error) {
    console.error('Error updating calendar event:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to update calendar event.' });
  }
});

// PATCH /api/academic-calendar/events/:id/status
router.patch('/events/:id/status', authenticateToken, requirePermission('calendar:manage'), async (req, res) => {
  const { id } = req.params;
  const { is_active } = req.body;
  try {
    const updateRes = await pool.query(`
      UPDATE calendar_events
      SET is_active = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *;
    `, [Boolean(is_active), id]);

    if (updateRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Calendar event not found.' });
    }

    const event = updateRes.rows[0];

    // Real-time propagation (CANCEL / ACTIVATE)
    broadcastCalendarChange(Boolean(is_active) ? 'ACTIVATE' : 'CANCEL', event);

    res.json({ success: true, message: 'Calendar event status updated.', data: event });
  } catch (error) {
    console.error('Error toggling event status:', error);
    res.status(500).json({ success: false, message: 'Failed to update event status.' });
  }
});

// DELETE /api/academic-calendar/events/:id
router.delete('/events/:id', authenticateToken, requirePermission('calendar:manage'), async (req, res) => {
  const { id } = req.params;
  try {
    const deletedRes = await pool.query("DELETE FROM calendar_events WHERE id = $1 RETURNING id, title, start_date;", [id]);
    if (deletedRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Calendar event not found or already deleted.' });
    }

    // Real-time propagation (DELETE)
    broadcastCalendarChange('DELETE', { id, title: deletedRes.rows[0].title });

    res.json({ success: true, message: 'Calendar event deleted successfully.', data: { id } });
  } catch (error) {
    console.error('Error deleting event:', error);
    res.status(500).json({ success: false, message: 'Failed to delete event.' });
  }
});

/**
 * -----------------------------------------------------------------------------
 * 8. REAL CALENDAR SYNCHRONIZATION: iCalendar (.ics) EXPORT & SUBSCRIPTION FEED
 * -----------------------------------------------------------------------------
 * Standards-compliant RFC 5545 iCalendar feed for Google Calendar, Apple Calendar, and Outlook.
 * Supports token via Header OR query parameter for subscription URLs.
 */
const jwt = require('jsonwebtoken');

const authenticateFeed = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const queryToken = req.query.token;
  const token = (authHeader && authHeader.split(' ')[1]) || queryToken;

  if (!token) {
    return res.status(401).json({ success: false, message: 'Authentication required for calendar feed.' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'school_hrms_super_secure_jwt_secret_key_2026_educore', (err, user) => {
    if (err) {
      return res.status(403).json({ success: false, message: 'Invalid or expired calendar feed token.' });
    }
    req.user = user;
    next();
  });
};

// Helper: Format date for iCal all-day events (YYYYMMDD)
function formatIcsDate(dateStr) {
  const d = new Date(dateStr);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

// Helper: Format date plus 1 day for inclusive all-day events
function formatIcsEndDate(dateStr) {
  const d = new Date(dateStr);
  d.setUTCDate(d.getUTCDate() + 1);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

// Helper: Clean text for iCal fields
function escapeIcsText(str) {
  if (!str) return '';
  return str
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

// Shared handler for generating RFC 5545 iCalendar (.ics) string
async function generateIcsCalendar(academicYearId, category) {
  let query = `
    SELECT 
      e.*,
      y.name AS academic_year_name,
      t.name AS term_name
    FROM calendar_events e
    JOIN academic_years y ON e.academic_year_id = y.id
    LEFT JOIN academic_terms t ON e.term_id = t.id
    WHERE e.is_active = true
  `;
  const params = [];
  let pIdx = 1;

  if (academicYearId && academicYearId !== 'ALL') {
    query += ` AND e.academic_year_id = $${pIdx}`;
    params.push(academicYearId);
    pIdx++;
  } else {
    query += ` AND y.is_active = true`;
  }

  if (category && category !== 'ALL') {
    if (category === 'Exams') {
      query += ` AND (e.event_type = 'Non-Instructional' AND (e.category ILIKE '%Exam%' OR e.title ILIKE '%Exam%'))`;
    } else if (category === 'Holidays') {
      query += ` AND e.event_type IN ('Holiday', 'School Closure')`;
    } else {
      query += ` AND e.event_type = $${pIdx}`;
      params.push(category);
      pIdx++;
    }
  }

  query += ` ORDER BY e.start_date ASC;`;

  const result = await pool.query(query, params);
  const events = result.rows;

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//St. Vincent\'s High School//Academic Calendar HRMS//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:St. Vincent\'s Academic Calendar',
    'X-WR-TIMEZONE:Asia/Kolkata',
    'X-WR-CALDESC:Official Academic Calendar, Examination Schedules, and Holidays'
  ];

  const nowStamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  for (const ev of events) {
    const dtStart = formatIcsDate(ev.start_date);
    const dtEnd = formatIcsEndDate(ev.end_date);
    const summary = escapeIcsText(ev.title);
    const description = escapeIcsText(
      `${ev.description || ''}${ev.description ? '\\n\\n' : ''}Classification: ${ev.event_type} (${ev.category || 'General'})\\nDuration: ${ev.total_days || 1} Day(s)\\nAcademic Session: ${ev.academic_year_name || ''}${ev.term_name ? ' • ' + ev.term_name : ''}`
    );
    const categories = escapeIcsText(ev.category || ev.event_type);

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${ev.id}@school-hrms.edu`);
    lines.push(`DTSTAMP:${nowStamp}`);
    lines.push(`DTSTART;VALUE=DATE:${dtStart}`);
    lines.push(`DTEND;VALUE=DATE:${dtEnd}`);
    lines.push(`SUMMARY:${summary}`);
    lines.push(`DESCRIPTION:${description}`);
    lines.push(`CATEGORIES:${categories}`);
    lines.push(`STATUS:CONFIRMED`);
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

// GET /api/academic-calendar/feed.ics (Live Calendar Feed for Google Calendar / Outlook / Apple Calendar)
router.get('/feed.ics', authenticateFeed, async (req, res) => {
  try {
    const { academic_year_id, category } = req.query;
    const icsContent = await generateIcsCalendar(academic_year_id, category);

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'inline; filename="school-calendar.ics"');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.send(icsContent);
  } catch (error) {
    console.error('Error generating calendar feed:', error);
    res.status(500).send('Failed to generate calendar feed.');
  }
});

// GET /api/academic-calendar/export/ical (Downloadable .ics file)
router.get('/export/ical', authenticateToken, async (req, res) => {
  try {
    const { academic_year_id, category } = req.query;
    const icsContent = await generateIcsCalendar(academic_year_id, category);

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="st-vincents-academic-calendar.ics"');
    res.send(icsContent);
  } catch (error) {
    console.error('Error exporting iCal file:', error);
    res.status(500).json({ success: false, message: 'Failed to export calendar file.' });
  }
});

/**
 * -----------------------------------------------------------------------------
 * 9. OFFICIAL PUBLIC & NATIONAL HOLIDAY LIBRARY SYNCHRONIZATION
 * -----------------------------------------------------------------------------
 * POST /api/academic-calendar/sync-official-holidays
 * Pre-populates verified official public and institutional holidays for the academic year.
 */
router.post('/sync-official-holidays', authenticateToken, requirePermission('calendar:manage'), async (req, res) => {
  const { academic_year_id, replace_existing } = req.body;

  try {
    // 1. Resolve Academic Year
    let yearId = academic_year_id;
    let yearName = 'Current Session';
    if (!yearId || yearId === 'ALL') {
      const activeYearRes = await pool.query("SELECT id, name, start_date, end_date FROM academic_years WHERE is_active = true LIMIT 1;");
      if (activeYearRes.rows.length > 0) {
        yearId = activeYearRes.rows[0].id;
        yearName = activeYearRes.rows[0].name;
      } else {
        return res.status(400).json({ success: false, message: 'No active academic year found. Please select an academic year.' });
      }
    } else {
      const yrRes = await pool.query("SELECT id, name, start_date, end_date FROM academic_years WHERE id = $1;", [yearId]);
      if (yrRes.rows.length > 0) {
        yearName = yrRes.rows[0].name;
      }
    }

    // Extract year numbers to compute accurate holiday dates for this academic cycle
    // (e.g. 2026-2027)
    const currentYearNum = new Date().getFullYear();
    const targetYear1 = currentYearNum;
    const targetYear2 = currentYearNum + 1;

    // Verified List of Official Public, National & Academic Holidays
    const officialHolidayLibrary = [
      // National Holidays
      { title: 'Independence Day', event_type: 'Holiday', category: 'National Holiday', start_date: `${targetYear1}-08-15`, end_date: `${targetYear1}-08-15`, desc: 'National celebration of Independence Day.' },
      { title: 'Gandhi Jayanti', event_type: 'Holiday', category: 'National Holiday', start_date: `${targetYear1}-10-02`, end_date: `${targetYear1}-10-02`, desc: 'Mahatma Gandhi Jayanti / International Day of Non-Violence.' },
      { title: 'Republic Day', event_type: 'Holiday', category: 'National Holiday', start_date: `${targetYear2}-01-26`, end_date: `${targetYear2}-01-26`, desc: 'National celebration of Republic Day of India.' },

      // Key Regional & Festival Holidays
      { title: 'Ganesh Chaturthi', event_type: 'Holiday', category: 'Festival Holiday', start_date: `${targetYear1}-09-14`, end_date: `${targetYear1}-09-14`, desc: 'Public festival holiday.' },
      { title: 'Dussehra (Vijayadashami)', event_type: 'Holiday', category: 'Festival Holiday', start_date: `${targetYear1}-10-20`, end_date: `${targetYear1}-10-20`, desc: 'Dussehra institutional holiday.' },
      { title: 'Diwali (Deepavali Break)', event_type: 'Holiday', category: 'Festival Holiday', start_date: `${targetYear1}-11-08`, end_date: `${targetYear1}-11-12`, desc: 'Diwali school vacation and festival holidays.' },
      { title: 'Guru Nanak Jayanti', event_type: 'Holiday', category: 'Public Holiday', start_date: `${targetYear1}-11-24`, end_date: `${targetYear1}-11-24`, desc: 'Guru Nanak Gurpurab public holiday.' },
      { title: 'Christmas Day', event_type: 'Holiday', category: 'Public Holiday', start_date: `${targetYear1}-12-25`, end_date: `${targetYear1}-12-25`, desc: 'Celebration of Christmas.' },
      { title: 'Winter Vacation', event_type: 'Holiday', category: 'School Holiday', start_date: `${targetYear1}-12-26`, end_date: `${targetYear2}-01-02`, desc: 'Winter break for all faculty and students.' },
      { title: 'Maha Shivratri', event_type: 'Holiday', category: 'Festival Holiday', start_date: `${targetYear2}-02-15`, end_date: `${targetYear2}-02-15`, desc: 'Maha Shivratri festival observance.' },
      { title: 'Holi (Festival of Colours)', event_type: 'Holiday', category: 'Festival Holiday', start_date: `${targetYear2}-03-04`, end_date: `${targetYear2}-03-04`, desc: 'Holi festival holiday.' },
      { title: 'Good Friday', event_type: 'Holiday', category: 'Public Holiday', start_date: `${targetYear2}-03-26`, end_date: `${targetYear2}-03-26`, desc: 'Good Friday institutional observance.' },
      { title: 'Eid-ul-Fitr', event_type: 'Holiday', category: 'Public Holiday', start_date: `${targetYear2}-03-20`, end_date: `${targetYear2}-03-20`, desc: 'Eid-ul-Fitr public holiday (subject to moon sighting).' },
      { title: 'Dr. B.R. Ambedkar Jayanti', event_type: 'Holiday', category: 'Public Holiday', start_date: `${targetYear2}-04-14`, end_date: `${targetYear2}-04-14`, desc: 'Dr. B.R. Ambedkar Remembrance Day.' },
      { title: 'Summer Vacation Break', event_type: 'Holiday', category: 'School Holiday', start_date: `${targetYear2}-05-01`, end_date: `${targetYear2}-06-10`, desc: 'Annual summer vacation for students and faculty.' }
    ];

    let insertedCount = 0;
    let skippedCount = 0;

    for (const item of officialHolidayLibrary) {
      // Check if duplicate title + start_date exists in this academic year
      const existCheck = await pool.query(`
        SELECT id FROM calendar_events
        WHERE academic_year_id = $1 AND title = $2 AND start_date = $3
        LIMIT 1;
      `, [yearId, item.title, item.start_date]);

      if (existCheck.rows.length > 0) {
        if (replace_existing) {
          await pool.query(`
            UPDATE calendar_events
            SET end_date = $1, description = $2, category = $3, event_type = $4, is_active = true, updated_at = CURRENT_TIMESTAMP
            WHERE id = $5;
          `, [item.end_date, item.desc, item.category, item.event_type, existCheck.rows[0].id]);
          insertedCount++;
        } else {
          skippedCount++;
        }
      } else {
        const diffDays = Math.ceil(Math.abs(new Date(item.end_date) - new Date(item.start_date)) / (1000 * 60 * 60 * 24)) + 1;
        await pool.query(`
          INSERT INTO calendar_events (
            academic_year_id, title, event_type, category,
            start_date, end_date, total_days, description, is_working_day, is_active, created_by
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false, true, $9);
        `, [
          yearId,
          item.title,
          item.event_type,
          item.category,
          item.start_date,
          item.end_date,
          diffDays,
          item.desc,
          req.user.id
        ]);
        insertedCount++;
      }
    }

    if (insertedCount > 0) {
      broadcastCalendarChange('SYNC_HOLIDAYS', { inserted_count: insertedCount, academic_year_id: yearId });
    }

    res.json({
      success: true,
      message: `Successfully synchronized official holidays for ${yearName}: ${insertedCount} added/updated, ${skippedCount} already up to date.`,
      data: {
        academic_year_id: yearId,
        academic_year_name: yearName,
        inserted_count: insertedCount,
        skipped_count: skippedCount,
        total_holidays: officialHolidayLibrary.length
      }
    });
  } catch (error) {
    console.error('Error syncing official holidays:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to sync official holidays.' });
  }
});

module.exports = router;
