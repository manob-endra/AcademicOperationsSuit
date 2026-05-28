-- ============================================================
-- SUPABASE DATABASE SCHEMA
-- Run this entire file in the Supabase SQL Editor
-- ============================================================


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
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

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
