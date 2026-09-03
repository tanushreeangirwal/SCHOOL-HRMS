const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const pool = require('../db');

async function setupCalendarDatabase() {
  console.log('=== SETTING UP ACADEMIC CALENDAR TABLES & SEED DATA ===\n');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Create academic_years table
    await client.query(`
      CREATE TABLE IF NOT EXISTS academic_years (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL UNIQUE,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT false,
        status VARCHAR(50) NOT NULL DEFAULT 'Upcoming',
        description TEXT,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT chk_year_dates CHECK (end_date > start_date)
      );
    `);
    console.log('✓ Created/verified academic_years table');

    // 2. Create academic_terms table
    await client.query(`
      CREATE TABLE IF NOT EXISTS academic_terms (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        description TEXT,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT chk_term_dates CHECK (end_date >= start_date),
        CONSTRAINT uq_year_term UNIQUE (academic_year_id, name)
      );
    `);
    console.log('✓ Created/verified academic_terms table');

    // 3. Create calendar_events table
    await client.query(`
      CREATE TABLE IF NOT EXISTS calendar_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
        term_id UUID REFERENCES academic_terms(id) ON DELETE SET NULL,
        title VARCHAR(200) NOT NULL,
        event_type VARCHAR(50) NOT NULL DEFAULT 'Holiday', -- 'Holiday', 'Non-Instructional', 'School Closure', 'Working Day Override'
        category VARCHAR(100) NOT NULL DEFAULT 'Public Holiday', -- 'Public Holiday', 'Festival Holiday', 'School Holiday', 'Staff Training', 'Exam Period', 'Emergency', etc.
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        total_days INTEGER NOT NULL DEFAULT 1,
        description TEXT,
        is_working_day BOOLEAN NOT NULL DEFAULT false,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT chk_event_dates CHECK (end_date >= start_date)
      );
    `);
    console.log('✓ Created/verified calendar_events table');

    // Create indexes for fast date range lookups
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_calendar_events_dates ON calendar_events(start_date, end_date);
      CREATE INDEX IF NOT EXISTS idx_calendar_events_type ON calendar_events(event_type);
      CREATE INDEX IF NOT EXISTS idx_calendar_events_year ON calendar_events(academic_year_id);
    `);

    // 4. Seed Permissions
    const permissionsToSeed = [
      { name: 'calendar:read', description: 'View institutional academic calendar, terms, and holidays' },
      { name: 'calendar:manage', description: 'Create and modify school terms, holidays, and closures' },
      { name: 'calendar:manage_years', description: 'Configure academic years and activate institutional session' }
    ];

    for (const p of permissionsToSeed) {
      await client.query(`
        INSERT INTO permissions (name, description)
        VALUES ($1, $2)
        ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description;
      `, [p.name, p.description]);
    }
    console.log('✓ Seeded calendar permissions');

    // 5. Assign Permissions to Roles
    // Super Admin: all 3
    // Administrator: all 3
    // HR: calendar:read, calendar:manage
    // Manager: calendar:read
    // Employee: calendar:read

    const roleMapping = [
      { role: 'Super Admin', perms: ['calendar:read', 'calendar:manage', 'calendar:manage_years'] },
      { role: 'Administrator', perms: ['calendar:read', 'calendar:manage', 'calendar:manage_years'] },
      { role: 'HR', perms: ['calendar:read', 'calendar:manage'] },
      { role: 'Manager', perms: ['calendar:read'] },
      { role: 'Employee', perms: ['calendar:read'] }
    ];

    for (const rm of roleMapping) {
      const roleRes = await client.query("SELECT id FROM hr_roles WHERE name = $1;", [rm.role]);
      if (roleRes.rows.length > 0) {
        const roleId = roleRes.rows[0].id;
        for (const permName of rm.perms) {
          const permRes = await client.query("SELECT id FROM permissions WHERE name = $1;", [permName]);
          if (permRes.rows.length > 0) {
            const permId = permRes.rows[0].id;
            await client.query(`
              INSERT INTO role_permissions (role_id, permission_id)
              VALUES ($1, $2)
              ON CONFLICT DO NOTHING;
            `, [roleId, permId]);
          }
        }
      }
    }
    console.log('✓ Assigned calendar permissions to roles');

    // 6. Seed Academic Years
    const currentYearRes = await client.query(`
      INSERT INTO academic_years (name, start_date, end_date, is_active, status, description)
      VALUES 
        ('2026–2027', '2026-06-01', '2027-05-31', true, 'Active', 'Official Academic Session 2026–2027 for St. Vincent''s High School'),
        ('2025–2026', '2025-06-01', '2026-05-31', false, 'Completed', 'Previous Academic Session 2025–2026'),
        ('2027–2028', '2027-06-01', '2028-05-31', false, 'Upcoming', 'Planned Academic Session 2027–2028')
      ON CONFLICT (name) DO UPDATE SET is_active = EXCLUDED.is_active, status = EXCLUDED.status
      RETURNING id, name, is_active;
    `);
    console.log('✓ Seeded academic years');

    const activeYearId = (await client.query("SELECT id FROM academic_years WHERE is_active = true LIMIT 1;")).rows[0].id;

    // 7. Seed School Terms for Active Year
    const term1Res = await client.query(`
      INSERT INTO academic_terms (academic_year_id, name, start_date, end_date, description, is_active)
      VALUES 
        ($1, 'Term 1 (Monsoon Term)', '2026-06-01', '2026-09-30', 'First academic term focusing on core curriculum and monsoon sports', true),
        ($1, 'Term 2 (Autumn / Winter Term)', '2026-10-01', '2026-12-23', 'Second term including mid-term evaluations and festive break', true),
        ($1, 'Term 3 (Spring / Annual Term)', '2027-01-04', '2027-05-15', 'Final term culminating in annual examinations and graduation', true)
      ON CONFLICT (academic_year_id, name) DO UPDATE SET start_date = EXCLUDED.start_date, end_date = EXCLUDED.end_date
      RETURNING id, name;
    `, [activeYearId]);
    console.log('✓ Seeded 3 academic terms for 2026–2027');

    const terms = (await client.query("SELECT id, name, start_date, end_date FROM academic_terms WHERE academic_year_id = $1;", [activeYearId])).rows;
    const term1 = terms.find(t => t.name.includes('Term 1'));
    const term2 = terms.find(t => t.name.includes('Term 2'));
    const term3 = terms.find(t => t.name.includes('Term 3'));

    // 8. Seed Holidays & School Events
    const eventsToSeed = [
      // Term 1
      {
        year_id: activeYearId,
        term_id: term1?.id,
        title: 'Staff Professional Development & Orientation',
        event_type: 'Non-Instructional',
        category: 'Staff Training',
        start_date: '2026-06-05',
        end_date: '2026-06-05',
        total_days: 1,
        description: 'Faculty curriculum alignment and pedagogical workshop.',
        is_working_day: false
      },
      {
        year_id: activeYearId,
        term_id: term1?.id,
        title: 'Independence Day',
        event_type: 'Holiday',
        category: 'Public Holiday',
        start_date: '2026-08-15',
        end_date: '2026-08-15',
        total_days: 1,
        description: 'National holiday with flag hoisting ceremony at 8:00 AM.',
        is_working_day: false
      },
      {
        year_id: activeYearId,
        term_id: term1?.id,
        title: 'Janmashtami',
        event_type: 'Holiday',
        category: 'Festival Holiday',
        start_date: '2026-09-04',
        end_date: '2026-09-04',
        total_days: 1,
        description: 'Gazetted festival holiday.',
        is_working_day: false
      },
      {
        year_id: activeYearId,
        term_id: term1?.id,
        title: 'Mid-Term Examinations (Term 1)',
        event_type: 'Non-Instructional',
        category: 'Exam Period',
        start_date: '2026-09-21',
        end_date: '2026-09-26',
        total_days: 6,
        description: 'Classroom teaching suspended; examination duty schedules in effect.',
        is_working_day: true // Staff on exam duty
      },

      // Term 2
      {
        year_id: activeYearId,
        term_id: term2?.id,
        title: 'Mahatma Gandhi Jayanti',
        event_type: 'Holiday',
        category: 'Public Holiday',
        start_date: '2026-10-02',
        end_date: '2026-10-02',
        total_days: 1,
        description: 'National public holiday.',
        is_working_day: false
      },
      {
        year_id: activeYearId,
        term_id: term2?.id,
        title: 'Dussehra / Vijayadashami',
        event_type: 'Holiday',
        category: 'Festival Holiday',
        start_date: '2026-10-20',
        end_date: '2026-10-20',
        total_days: 1,
        description: 'Festival holiday across all school sections.',
        is_working_day: false
      },
      {
        year_id: activeYearId,
        term_id: term2?.id,
        title: 'Diwali & Festive Vacation',
        event_type: 'Holiday',
        category: 'School Holiday',
        start_date: '2026-11-08',
        end_date: '2026-11-12',
        total_days: 5,
        description: 'Diwali break for all faculty, students, and administrative staff.',
        is_working_day: false
      },
      {
        year_id: activeYearId,
        term_id: term2?.id,
        title: 'Guru Nanak Jayanti',
        event_type: 'Holiday',
        category: 'Festival Holiday',
        start_date: '2026-11-24',
        end_date: '2026-11-24',
        total_days: 1,
        description: 'Gazetted holiday.',
        is_working_day: false
      },
      {
        year_id: activeYearId,
        term_id: term2?.id,
        title: 'Annual Sports & Cultural Meet',
        event_type: 'Non-Instructional',
        category: 'School Event',
        start_date: '2026-11-27',
        end_date: '2026-11-28',
        total_days: 2,
        description: 'Inter-house athletic meet and cultural performances on school grounds.',
        is_working_day: true
      },
      {
        year_id: activeYearId,
        term_id: term2?.id,
        title: 'Christmas & Winter Vacation',
        event_type: 'Holiday',
        category: 'School Holiday',
        start_date: '2026-12-24',
        end_date: '2027-01-03',
        total_days: 11,
        description: 'Christmas festival and winter break. School reopens Jan 4, 2027.',
        is_working_day: false
      },

      // Term 3
      {
        year_id: activeYearId,
        term_id: term3?.id,
        title: 'Republic Day',
        event_type: 'Holiday',
        category: 'Public Holiday',
        start_date: '2027-01-26',
        end_date: '2027-01-26',
        total_days: 1,
        description: 'National holiday with ceremonial parade at main sports complex.',
        is_working_day: false
      },
      {
        year_id: activeYearId,
        term_id: term3?.id,
        title: 'Maha Shivratri',
        event_type: 'Holiday',
        category: 'Festival Holiday',
        start_date: '2027-03-06',
        end_date: '2027-03-06',
        total_days: 1,
        description: 'Festival holiday.',
        is_working_day: false
      },
      {
        year_id: activeYearId,
        term_id: term3?.id,
        title: 'Final Annual Board & School Examinations',
        event_type: 'Non-Instructional',
        category: 'Exam Period',
        start_date: '2027-03-10',
        end_date: '2027-03-20',
        total_days: 11,
        description: 'Annual term evaluation and board examinations.',
        is_working_day: true
      },
      {
        year_id: activeYearId,
        term_id: term3?.id,
        title: 'Holi & Spring Break',
        event_type: 'Holiday',
        category: 'Festival Holiday',
        start_date: '2027-03-25',
        end_date: '2027-03-26',
        total_days: 2,
        description: 'Holi festival holiday for all school staff.',
        is_working_day: false
      },
      {
        year_id: activeYearId,
        term_id: term3?.id,
        title: 'Good Friday & Easter Weekend',
        event_type: 'Holiday',
        category: 'Festival Holiday',
        start_date: '2027-04-02',
        end_date: '2027-04-03',
        total_days: 2,
        description: 'Good Friday institutional observance.',
        is_working_day: false
      }
    ];

    for (const ev of eventsToSeed) {
      await client.query(`
        INSERT INTO calendar_events (
          academic_year_id, term_id, title, event_type, category,
          start_date, end_date, total_days, description, is_working_day, is_active
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true)
        ON CONFLICT DO NOTHING;
      `, [
        ev.year_id, ev.term_id, ev.title, ev.event_type, ev.category,
        ev.start_date, ev.end_date, ev.total_days, ev.description, ev.is_working_day
      ]);
    }
    console.log(`✓ Seeded ${eventsToSeed.length} statutory school calendar events and holidays`);

    await client.query('COMMIT');
    console.log('\n=== ACADEMIC CALENDAR DATABASE SETUP COMPLETED SUCCESSFULLY ===\n');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Failed to setup academic calendar database:', err);
    throw err;
  } finally {
    client.release();
    process.exit(0);
  }
}

setupCalendarDatabase().catch(e => { console.error(e); process.exit(1); });
