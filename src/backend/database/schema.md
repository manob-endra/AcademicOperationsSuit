-- ============================================================
-- SUPABASE DATABASE SCHEMA
-- Run this entire file in the Supabase SQL Editor
-- ============================================================


-- ============================================================
-- 0e. TEACHER LEAVES TABLE
-- Tracks both admin-added approved leaves and teacher-submitted pending requests.
-- status: 'approved' (admin-added) | 'pending' (teacher request) | 'rejected'
-- ============================================================

CREATE TABLE IF NOT EXISTS teacher_leaves (
  id           UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id   UUID    NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  leave_type   VARCHAR(50)  NOT NULL,  -- study_leave | sick_leave | conference | sabbatical | casual
  start_date   DATE         NOT NULL,
  end_date     DATE         NOT NULL,
  status       VARCHAR(20)  NOT NULL DEFAULT 'approved', -- approved | pending | rejected
  added_by     VARCHAR(20)  NOT NULL DEFAULT 'admin',    -- admin | teacher
  reason       TEXT,
  admin_note   TEXT,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_tl_teacher_id ON teacher_leaves(teacher_id);
CREATE INDEX IF NOT EXISTS idx_tl_status     ON teacher_leaves(status);


-- ============================================================
-- 0f. EXAM ROUTINE TABLES
--     exam_sessions       : one session per semester per type (incourse | final)
--     exam_slots          : one row per course per exam date
--     exam_invigilators   : assigned invigilators per slot
--     teacher_exam_weights: per-teacher per-session weight overrides
-- ============================================================

CREATE TABLE IF NOT EXISTS exam_sessions (
  id                   UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  semester_id          TEXT         NOT NULL,  -- short code e.g. 'Y4-S1'
  session_type         VARCHAR(20)  NOT NULL DEFAULT 'incourse', -- 'incourse' | 'final'
  title                VARCHAR(200),
  teachers_per_exam    INT          NOT NULL DEFAULT 2,
  default_start_time   VARCHAR(10)  DEFAULT '09:00',
  default_duration_mins INT         DEFAULT 60,
  published            BOOLEAN      DEFAULT false,
  published_at         TIMESTAMP,
  created_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_es_semester ON exam_sessions(semester_id);
CREATE INDEX IF NOT EXISTS idx_es_type     ON exam_sessions(session_type);
-- Migration (run if table already exists):
-- ALTER TABLE exam_sessions DROP CONSTRAINT IF EXISTS exam_sessions_semester_id_fkey;
-- ALTER TABLE exam_sessions ALTER COLUMN semester_id TYPE TEXT;

CREATE TABLE IF NOT EXISTS exam_slots (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id   UUID NOT NULL REFERENCES exam_sessions(id) ON DELETE CASCADE,
  course_id    UUID NOT NULL REFERENCES courses(id),
  exam_date    DATE,
  start_time   VARCHAR(10) NOT NULL,
  end_time     VARCHAR(10) NOT NULL,
  rooms        TEXT DEFAULT '',
  slot_order   INT  DEFAULT 0,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_esl_session ON exam_slots(session_id);

CREATE TABLE IF NOT EXISTS exam_invigilators (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slot_id           UUID NOT NULL REFERENCES exam_slots(id) ON DELETE CASCADE,
  teacher_id        UUID NOT NULL REFERENCES teachers(id),
  is_course_teacher BOOLEAN DEFAULT false,
  is_lead           BOOLEAN DEFAULT false,
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(slot_id, teacher_id)
);
CREATE INDEX IF NOT EXISTS idx_ei_slot ON exam_invigilators(slot_id);

CREATE TABLE IF NOT EXISTS teacher_exam_weights (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES exam_sessions(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES teachers(id),
  weight     INT  NOT NULL DEFAULT 2,
  UNIQUE(session_id, teacher_id)
);

-- Add process_after to notification jobs (for 24-hour reminders)
ALTER TABLE email_notification_jobs ADD COLUMN IF NOT EXISTS process_after TIMESTAMP;
CREATE INDEX IF NOT EXISTS idx_enj_process_after ON email_notification_jobs(process_after) WHERE status = 'pending';


-- ============================================================
-- 0d. EMAIL NOTIFICATION SYSTEM TABLES
--
-- email_notification_jobs      : one row per event (idempotency via UNIQUE trigger)
-- email_notification_deliveries: one row per recipient per job
-- email_notification_prefs     : per-email opt-out preferences
--
-- routine_storage additions    : published_at + published_label
-- ============================================================

-- Jobs table — one per trigger event
CREATE TABLE IF NOT EXISTS email_notification_jobs (
  id                UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  type              VARCHAR(50)  NOT NULL,           -- 'routine_published'
  trigger_id        VARCHAR(255) NOT NULL,           -- idempotency key
  trigger_ref       JSONB        NOT NULL DEFAULT '{}', -- extra context (semester label, years …)
  status            VARCHAR(20)  NOT NULL DEFAULT 'pending', -- pending|processing|completed|failed|cancelled
  total_recipients  INT          NOT NULL DEFAULT 0,
  sent_count        INT          NOT NULL DEFAULT 0,
  failed_count      INT          NOT NULL DEFAULT 0,
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  started_at        TIMESTAMP,
  completed_at      TIMESTAMP,
  UNIQUE(type, trigger_id)
);

-- Per-recipient delivery records
CREATE TABLE IF NOT EXISTS email_notification_deliveries (
  id              UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id          UUID    REFERENCES email_notification_jobs(id) ON DELETE CASCADE,
  recipient_type  VARCHAR(20)  NOT NULL,  -- 'student' | 'teacher'
  recipient_id    UUID,
  recipient_email VARCHAR(255) NOT NULL,
  recipient_name  VARCHAR(255),
  subject         VARCHAR(500),
  status          VARCHAR(20)  NOT NULL DEFAULT 'pending', -- pending|sent|failed|bounced|skipped
  attempts        INT          NOT NULL DEFAULT 0,
  last_error      TEXT,
  sent_at         TIMESTAMP,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_end_job_id   ON email_notification_deliveries(job_id);
CREATE INDEX IF NOT EXISTS idx_end_status   ON email_notification_deliveries(status);
CREATE INDEX IF NOT EXISTS idx_end_email    ON email_notification_deliveries(recipient_email);

-- Unsubscribe / opt-out preferences
CREATE TABLE IF NOT EXISTS email_notification_prefs (
  id                UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  email             VARCHAR(255) NOT NULL,
  notification_type VARCHAR(50)  NOT NULL DEFAULT 'all',
  opted_out         BOOLEAN      NOT NULL DEFAULT false,
  unsubscribe_token VARCHAR(100) NOT NULL UNIQUE,
  updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(email, notification_type)
);

-- Extend routine_storage to track publish state
ALTER TABLE routine_storage ADD COLUMN IF NOT EXISTS published_at     TIMESTAMP;
ALTER TABLE routine_storage ADD COLUMN IF NOT EXISTS published_label  VARCHAR(255);


-- ============================================================
-- 0c. STUDENTS TABLE
--     General student registry managed by admin.
--     academic_year : '1st' | '2nd' | '3rd' | '4th' | 'ms'
--     session       : e.g. '2019-20', '2020-21'
--     is_active     : false = soft-deleted (restorable)
-- ============================================================
CREATE TABLE IF NOT EXISTS students (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  registration_no     VARCHAR(50) UNIQUE,
  name                VARCHAR(255) NOT NULL,
  hall                VARCHAR(150),
  date_of_birth       DATE,
  roll                VARCHAR(50),
  email               VARCHAR(255),
  mobile              VARCHAR(20),
  institutional_email VARCHAR(255),
  session             VARCHAR(20),
  academic_year       VARCHAR(10) DEFAULT '1st',
  parents_contact     VARCHAR(20),
  is_active           BOOLEAN DEFAULT true,
  created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- ============================================================
-- 0a. ACADEMIC SEMESTERS TABLE
--     Top-level containers (e.g. "Spring 2026") that group all
--     routine-management work. Created by admin in SemesterHub.
-- ============================================================
CREATE TABLE IF NOT EXISTS academic_semesters (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  year       VARCHAR(10)  NOT NULL,
  name       VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- ============================================================
-- 0b. ACADEMIC CALENDARS TABLE
--     One calendar per academic semester.
--     config   : { startDate, totalWeeks }
--     entries  : { "YYYY-MM-DD": { type, label } }
--     published: false = draft, true = published
-- ============================================================
CREATE TABLE IF NOT EXISTS academic_calendars (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  semester_id  UUID REFERENCES academic_semesters(id) ON DELETE CASCADE UNIQUE,
  config       JSONB NOT NULL DEFAULT '{}',
  entries      JSONB NOT NULL DEFAULT '{}',
  published    BOOLEAN DEFAULT false,
  published_at TIMESTAMP,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Migration (run if table already exists):
-- ALTER TABLE academic_calendars ADD COLUMN IF NOT EXISTS published_at TIMESTAMP;


-- ============================================================
-- 1. USERS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) CHECK (role IN ('admin', 'teacher', 'student')),
  email_verified BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);


-- ============================================================
-- 2. USER_PROFILES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  full_name VARCHAR(255),
  phone VARCHAR(20),
  department VARCHAR(255),
  profile_picture_url TEXT,
  bio TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);


-- ============================================================
-- 3. COURSES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS courses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL,
  year TEXT,
  semester VARCHAR(50) NOT NULL,
  credit_hours INT,
  course_type VARCHAR(50) CHECK (course_type IN ('theory', 'lab', 'mixed')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_courses_code ON courses(code);
CREATE INDEX IF NOT EXISTS idx_courses_semester ON courses(semester);


-- ============================================================
-- 4. TEACHERS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS teachers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  initials VARCHAR(10),
  department VARCHAR(255),
  email VARCHAR(255) UNIQUE,
  weekly_load_hours INT DEFAULT 0,
  load_limit INT DEFAULT 20,
  -- Extended profile fields (added for admin Teacher Management)
  designation VARCHAR(100),
  joining_date DATE,
  special_post VARCHAR(255),
  contact_number VARCHAR(20),
  availability_status VARCHAR(50) DEFAULT 'available',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Run these if the table already exists (adds missing columns):
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS designation VARCHAR(100);
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS joining_date DATE;
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS special_post VARCHAR(255);
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS contact_number VARCHAR(20);
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS availability_status VARCHAR(50) DEFAULT 'available';

CREATE INDEX IF NOT EXISTS idx_teachers_user_id ON teachers(user_id);
CREATE INDEX IF NOT EXISTS idx_teachers_email ON teachers(email);


-- ============================================================
-- 5. TEACHER_PREFERENCES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS teacher_preferences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id UUID REFERENCES teachers(id) ON DELETE CASCADE,
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  preference_type VARCHAR(50) CHECK (preference_type IN ('theory', 'lab', 'time')),
  preference_value TEXT,
  priority INT DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_teacher_preferences_teacher_id ON teacher_preferences(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_preferences_course_id ON teacher_preferences(course_id);


-- ============================================================
-- 6. CLASSROOMS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS classrooms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL,
  building VARCHAR(100),
  floor INT,
  capacity INT NOT NULL,
  facilities TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_classrooms_name ON classrooms(name);


-- ============================================================
-- 7. TIME_SLOTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS time_slots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  day_of_week VARCHAR(20) NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  duration_minutes INT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_time_slots_day ON time_slots(day_of_week);

-- Create Class Time Settings Table
CREATE TABLE IF NOT EXISTS class_time_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  start_time VARCHAR(5) NOT NULL,
  duration VARCHAR(5) NOT NULL,
  classes_before_lunch INT NOT NULL DEFAULT 3,
  lunch_duration VARCHAR(5) NOT NULL,
  classes_after_lunch INT NOT NULL DEFAULT 2,
  class_day VARCHAR(50) NOT NULL,
  skip_time INT NOT NULL DEFAULT 5,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create Index for Active Settings
CREATE INDEX IF NOT EXISTS idx_class_time_settings_active ON class_time_settings(is_active);


-- ============================================================
-- 8. ROUTINES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS routines (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID REFERENCES courses(id),
  teacher_id UUID REFERENCES teachers(id),
  classroom_id UUID REFERENCES classrooms(id),
  time_slot_id UUID REFERENCES time_slots(id),
  day_of_week VARCHAR(20) NOT NULL,
  session_type VARCHAR(50) CHECK (session_type IN ('lecture', 'lab', 'tutorial')),
  semester VARCHAR(50),
  academic_year VARCHAR(20),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_routines_course_id ON routines(course_id);
CREATE INDEX IF NOT EXISTS idx_routines_teacher_id ON routines(teacher_id);
CREATE INDEX IF NOT EXISTS idx_routines_classroom_id ON routines(classroom_id);
CREATE INDEX IF NOT EXISTS idx_routines_semester ON routines(semester);


-- ============================================================
-- 9. EMAIL_VERIFICATIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS email_verifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  code VARCHAR(10) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_email_verifications_user_id ON email_verifications(user_id);


-- ============================================================
-- 10. PASSWORD_RESETS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS password_resets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_password_resets_user_id ON password_resets(user_id);


-- ============================================================
-- 11. AUDIT_LOGS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);


-- ============================================================
-- 12. OPTIONAL: updated_at auto-update trigger
-- Automatically keeps updated_at current on row changes
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all tables that have updated_at
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'users', 'user_profiles', 'courses', 'teachers',
    'classrooms', 'time_slots', 'routines'
  ]
  LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_%s_updated_at
       BEFORE UPDATE ON %I
       FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();',
      t, t
    );
  END LOOP;
END;
$$;


-- ============================================================
-- 13. CLASSROOM_CLUSTERS TABLE
-- Stores named groups of classrooms with soft-delete support
-- ============================================================
CREATE TABLE IF NOT EXISTS classroom_clusters (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  rooms JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  is_deleted BOOLEAN DEFAULT false,
  deleted_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_classroom_clusters_active ON classroom_clusters(is_active);
CREATE INDEX IF NOT EXISTS idx_classroom_clusters_deleted ON classroom_clusters(is_deleted);

CREATE TRIGGER trg_classroom_clusters_updated_at
  BEFORE UPDATE ON classroom_clusters
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================
-- 14. CLUSTER_DISTANCES TABLE
-- Stores walking distance (minutes) between each pair of clusters
-- cluster1_id is always the lexicographically smaller UUID
-- ============================================================
CREATE TABLE IF NOT EXISTS cluster_distances (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cluster1_id UUID REFERENCES classroom_clusters(id) ON DELETE CASCADE,
  cluster2_id UUID REFERENCES classroom_clusters(id) ON DELETE CASCADE,
  distance_minutes INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT cluster_distances_pair_unique UNIQUE (cluster1_id, cluster2_id)
);

CREATE INDEX IF NOT EXISTS idx_cluster_distances_cluster1 ON cluster_distances(cluster1_id);
CREATE INDEX IF NOT EXISTS idx_cluster_distances_cluster2 ON cluster_distances(cluster2_id);

CREATE TRIGGER trg_cluster_distances_updated_at
  BEFORE UPDATE ON cluster_distances
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================
-- 15. COURSE_DURATIONS TABLE
-- Stores the number of class periods assigned to each course
-- for schedule generation (one row per course, upserted by UI)
-- ============================================================
CREATE TABLE IF NOT EXISTS course_durations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  duration_periods INT NOT NULL DEFAULT 1 CHECK (duration_periods > 0),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT course_durations_course_unique UNIQUE (course_id)
);

CREATE INDEX IF NOT EXISTS idx_course_durations_course_id ON course_durations(course_id);

CREATE TRIGGER trg_course_durations_updated_at
  BEFORE UPDATE ON course_durations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================
-- 16. TEACHER_AVAILABILITY TABLE
-- Stores which time slots each teacher is available on each day
-- One row per (teacher, day, slot) combination
-- ============================================================
CREATE TABLE IF NOT EXISTS teacher_availability (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id UUID REFERENCES teachers(id) ON DELETE CASCADE,
  day_of_week VARCHAR(20) NOT NULL,
  slot_id VARCHAR(10) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT teacher_availability_unique UNIQUE (teacher_id, day_of_week, slot_id)
);

CREATE INDEX IF NOT EXISTS idx_teacher_availability_teacher_id ON teacher_availability(teacher_id);


-- ============================================================
-- 17. SEMESTER_SELECTION TABLE
-- Stores the globally selected semesters from the Home page.
-- Always a single row (id = 1), upserted on every change.
-- ============================================================
CREATE TABLE IF NOT EXISTS semester_selection (
  id INTEGER PRIMARY KEY DEFAULT 1,
  selected_semesters JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed the single row so GET never returns empty
INSERT INTO semester_selection (id, selected_semesters)
VALUES (1, '[]'::jsonb)
ON CONFLICT (id) DO NOTHING;

CREATE TRIGGER trg_semester_selection_updated_at
  BEFORE UPDATE ON semester_selection
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================
-- 18. ROOM_ALLOCATION TABLE
-- Stores theory/lab room lists and per-semester theory room
-- assignments. Always a single row (id = 1), upserted on change.
-- ============================================================
CREATE TABLE IF NOT EXISTS room_allocation (
  id INTEGER PRIMARY KEY DEFAULT 1,
  theory_rooms JSONB NOT NULL DEFAULT '[]'::jsonb,
  lab_rooms JSONB NOT NULL DEFAULT '[]'::jsonb,
  semester_theory_rooms JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed the single row so GET never returns empty
INSERT INTO room_allocation (id, theory_rooms, lab_rooms, semester_theory_rooms)
VALUES (1, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

CREATE TRIGGER trg_room_allocation_updated_at
  BEFORE UPDATE ON room_allocation
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================
-- 19. COURSE_TEACHER_CHOICES TABLE
-- Stores teacher preferences and assignments per course.
-- One row per course (upserted). Choice fields reference teachers.
-- ============================================================
CREATE TABLE IF NOT EXISTS course_teacher_choices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  history JSONB NOT NULL DEFAULT '[]'::jsonb,
  first_choice UUID REFERENCES teachers(id) ON DELETE SET NULL,
  second_choice UUID REFERENCES teachers(id) ON DELETE SET NULL,
  third_choice UUID REFERENCES teachers(id) ON DELETE SET NULL,
  other_choices JSONB NOT NULL DEFAULT '[]'::jsonb,
  teacher_assignments JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT course_teacher_choices_course_unique UNIQUE (course_id)
);

CREATE INDEX IF NOT EXISTS idx_course_teacher_choices_course_id ON course_teacher_choices(course_id);

CREATE TRIGGER trg_course_teacher_choices_updated_at
  BEFORE UPDATE ON course_teacher_choices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================
-- 20. TEACHER_COURSE_PREFERENCES TABLE
-- Stores each teacher's theory/lab course preferences.
-- One row per teacher (upserted). Single choices are nullable UUIDs;
-- multi-choices are stored as JSONB arrays of course UUIDs.
-- ============================================================
CREATE TABLE IF NOT EXISTS teacher_course_preferences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id UUID REFERENCES teachers(id) ON DELETE CASCADE,
  first_preference UUID REFERENCES courses(id) ON DELETE SET NULL,
  second_preference UUID REFERENCES courses(id) ON DELETE SET NULL,
  third_preference UUID REFERENCES courses(id) ON DELETE SET NULL,
  other_preferences JSONB NOT NULL DEFAULT '[]'::jsonb,
  lab_preferences JSONB NOT NULL DEFAULT '[]'::jsonb,
  assigned_courses JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT teacher_course_preferences_teacher_unique UNIQUE (teacher_id)
);

CREATE INDEX IF NOT EXISTS idx_teacher_course_preferences_teacher_id ON teacher_course_preferences(teacher_id);

CREATE TRIGGER trg_teacher_course_preferences_updated_at
  BEFORE UPDATE ON teacher_course_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE course_durations
ADD COLUMN IF NOT EXISTS weekly_classes INTEGER;

ALTER TABLE routines ADD COLUMN IF NOT EXISTS entries JSONB DEFAULT '[]'::jsonb;
ALTER TABLE routines ADD COLUMN IF NOT EXISTS generated_at TIMESTAMPTZ;

-- Exceptional courses: when true the course is excluded from routine generation and conflict checks
ALTER TABLE courses ADD COLUMN IF NOT EXISTS is_exceptional BOOLEAN DEFAULT false;


-- ============================================================
-- 21. ROUTINE_STORAGE TABLE
-- Single-row JSONB table for persisting the generated routine.
-- The original `routines` table has a NOT NULL constraint on
-- day_of_week which breaks the single-row upsert pattern.
-- This table is purpose-built for that pattern.
-- ============================================================
CREATE TABLE IF NOT EXISTS routine_storage (
  id UUID PRIMARY KEY,
  entries JSONB NOT NULL DEFAULT '[]'::jsonb,
  generated_at TIMESTAMPTZ
);

-- Seed the fixed primary key row so SELECT always returns a row
INSERT INTO routine_storage (id, entries)
VALUES ('00000000-0000-0000-0000-000000000001', '[]'::jsonb)
ON CONFLICT (id) DO NOTHING;


-- ============================================================
-- 22. NOTIFICATIONS TABLE
-- One row per signup event. Admin sees these as a bell-icon feed.
-- is_handled = true once admin acts (e.g. admitting a teacher).
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type VARCHAR(50) NOT NULL DEFAULT 'signup',
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  user_email VARCHAR(255) NOT NULL,
  user_name VARCHAR(255),
  user_role VARCHAR(50),
  is_read BOOLEAN DEFAULT false,
  is_handled BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_is_read    ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_is_handled ON notifications(is_handled);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);


-- ============================================================
-- 23. NOTICES TABLE
-- Stores notices posted by admin, visible to all teachers.
-- ============================================================
CREATE TABLE IF NOT EXISTS notices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  priority VARCHAR(20) CHECK (priority IN ('normal', 'important', 'urgent')) DEFAULT 'normal',
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notices_is_active ON notices(is_active);
CREATE INDEX IF NOT EXISTS idx_notices_created_at ON notices(created_at);

CREATE TRIGGER trg_notices_updated_at
  BEFORE UPDATE ON notices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================
-- MIGRATION: Email Verification Token Columns
-- Run this in Supabase SQL Editor if the users table already exists.
-- Safe to run multiple times (IF NOT EXISTS / IF EXISTS guards).
-- ============================================================
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS verification_token VARCHAR(6),
  ADD COLUMN IF NOT EXISTS verification_token_expires_at TIMESTAMP WITH TIME ZONE;

-- Make sure email_verified defaults to false for new rows
ALTER TABLE users ALTER COLUMN email_verified SET DEFAULT false;

