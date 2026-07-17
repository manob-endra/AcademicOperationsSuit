-- ============================================================
-- Per-semester routine data
--
-- Run this in the Supabase SQL editor. Safe to run more than once.
--
-- Before: every routine table was global (single rows with id = 1,
-- unique constraints on course_id / teacher_id alone). Creating a new
-- semester had to CLEAR them to make room, destroying the old semester.
--
-- After: each routine table carries semester_id, so semesters coexist.
-- A new semester is empty simply because no rows carry its id yet, and
-- older semesters are never touched.
--
-- Kept global on purpose: courses, teachers, classroom_clusters and
-- cluster_distances (physical campus map, shared by every semester).
-- ============================================================


-- ------------------------------------------------------------
-- 1. Add semester_id to every table that holds routine work
-- ------------------------------------------------------------
ALTER TABLE course_teacher_choices
  ADD COLUMN IF NOT EXISTS semester_id uuid REFERENCES academic_semesters(id) ON DELETE CASCADE;

ALTER TABLE teacher_course_preferences
  ADD COLUMN IF NOT EXISTS semester_id uuid REFERENCES academic_semesters(id) ON DELETE CASCADE;

ALTER TABLE teacher_availability
  ADD COLUMN IF NOT EXISTS semester_id uuid REFERENCES academic_semesters(id) ON DELETE CASCADE;

ALTER TABLE course_durations
  ADD COLUMN IF NOT EXISTS semester_id uuid REFERENCES academic_semesters(id) ON DELETE CASCADE;

ALTER TABLE class_time_settings
  ADD COLUMN IF NOT EXISTS semester_id uuid REFERENCES academic_semesters(id) ON DELETE CASCADE;

ALTER TABLE room_allocation
  ADD COLUMN IF NOT EXISTS semester_id uuid REFERENCES academic_semesters(id) ON DELETE CASCADE;

ALTER TABLE semester_selection
  ADD COLUMN IF NOT EXISTS semester_id uuid REFERENCES academic_semesters(id) ON DELETE CASCADE;

ALTER TABLE routine_storage
  ADD COLUMN IF NOT EXISTS semester_id uuid REFERENCES academic_semesters(id) ON DELETE CASCADE;


-- ------------------------------------------------------------
-- 2. Backfill: existing rows belong to the newest semester
--    (that is the one whose data is currently live).
--
--    Rows are never deleted here. If no semester exists yet the
--    backfill is skipped and the rows keep semester_id = NULL,
--    which simply makes them invisible to the app rather than lost.
-- ------------------------------------------------------------
DO $$
DECLARE
  target_sem uuid;
BEGIN
  SELECT id INTO target_sem
  FROM academic_semesters
  ORDER BY created_at DESC
  LIMIT 1;

  IF target_sem IS NULL THEN
    RAISE NOTICE 'No academic_semesters row found — backfill skipped. Existing routine rows keep semester_id = NULL.';
    RETURN;
  END IF;

  UPDATE course_teacher_choices      SET semester_id = target_sem WHERE semester_id IS NULL;
  UPDATE teacher_course_preferences  SET semester_id = target_sem WHERE semester_id IS NULL;
  UPDATE teacher_availability        SET semester_id = target_sem WHERE semester_id IS NULL;
  UPDATE course_durations            SET semester_id = target_sem WHERE semester_id IS NULL;
  UPDATE class_time_settings         SET semester_id = target_sem WHERE semester_id IS NULL;
  UPDATE room_allocation             SET semester_id = target_sem WHERE semester_id IS NULL;
  UPDATE semester_selection          SET semester_id = target_sem WHERE semester_id IS NULL;
  UPDATE routine_storage             SET semester_id = target_sem WHERE semester_id IS NULL;

  RAISE NOTICE 'Backfilled existing routine data to semester %', target_sem;
END
$$;


-- ------------------------------------------------------------
-- 3. Rewrite unique constraints to include semester_id.
--    Without this, two semesters could not hold a row for the
--    same course/teacher.
-- ------------------------------------------------------------
ALTER TABLE course_teacher_choices
  DROP CONSTRAINT IF EXISTS course_teacher_choices_course_unique;
ALTER TABLE course_teacher_choices
  ADD CONSTRAINT course_teacher_choices_sem_course_unique UNIQUE (semester_id, course_id);

ALTER TABLE teacher_course_preferences
  DROP CONSTRAINT IF EXISTS teacher_course_preferences_teacher_unique;
ALTER TABLE teacher_course_preferences
  ADD CONSTRAINT teacher_course_preferences_sem_teacher_unique UNIQUE (semester_id, teacher_id);

ALTER TABLE teacher_availability
  DROP CONSTRAINT IF EXISTS teacher_availability_unique;
ALTER TABLE teacher_availability
  ADD CONSTRAINT teacher_availability_sem_unique UNIQUE (semester_id, teacher_id, day_of_week, slot_id);

ALTER TABLE course_durations
  DROP CONSTRAINT IF EXISTS course_durations_course_unique;
ALTER TABLE course_durations
  ADD CONSTRAINT course_durations_sem_course_unique UNIQUE (semester_id, course_id);


-- ------------------------------------------------------------
-- 4. Retire the singleton pattern on the three single-row tables.
--    Their id columns defaulted to a fixed value (1 / a fixed UUID)
--    so a second row could never be inserted. Give them real
--    generated ids and make semester_id the key the app upserts on.
-- ------------------------------------------------------------

-- room_allocation: id INTEGER PRIMARY KEY DEFAULT 1
CREATE SEQUENCE IF NOT EXISTS room_allocation_id_seq OWNED BY room_allocation.id;
SELECT setval('room_allocation_id_seq', COALESCE((SELECT MAX(id) FROM room_allocation), 1));
ALTER TABLE room_allocation ALTER COLUMN id SET DEFAULT nextval('room_allocation_id_seq');
ALTER TABLE room_allocation DROP CONSTRAINT IF EXISTS room_allocation_semester_unique;
ALTER TABLE room_allocation ADD CONSTRAINT room_allocation_semester_unique UNIQUE (semester_id);

-- semester_selection: id INTEGER PRIMARY KEY DEFAULT 1
CREATE SEQUENCE IF NOT EXISTS semester_selection_id_seq OWNED BY semester_selection.id;
SELECT setval('semester_selection_id_seq', COALESCE((SELECT MAX(id) FROM semester_selection), 1));
ALTER TABLE semester_selection ALTER COLUMN id SET DEFAULT nextval('semester_selection_id_seq');
ALTER TABLE semester_selection DROP CONSTRAINT IF EXISTS semester_selection_semester_unique;
ALTER TABLE semester_selection ADD CONSTRAINT semester_selection_semester_unique UNIQUE (semester_id);

-- routine_storage: id UUID PRIMARY KEY with no default (app supplied a fixed UUID)
ALTER TABLE routine_storage ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE routine_storage DROP CONSTRAINT IF EXISTS routine_storage_semester_unique;
ALTER TABLE routine_storage ADD CONSTRAINT routine_storage_semester_unique UNIQUE (semester_id);


-- ------------------------------------------------------------
-- 5. Per-semester teacher load.
--    teachers.weekly_load_hours is a single column and cannot hold a
--    different value per semester — that is why rollover used to zero
--    it. Load now lives here, one row per (teacher, semester), and the
--    teachers column is left alone.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS teacher_semester_load (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id        uuid NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  semester_id       uuid NOT NULL REFERENCES academic_semesters(id) ON DELETE CASCADE,
  weekly_load_hours int  NOT NULL DEFAULT 0,
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT teacher_semester_load_unique UNIQUE (teacher_id, semester_id)
);

CREATE INDEX IF NOT EXISTS idx_tsl_semester ON teacher_semester_load (semester_id);

-- Seed the newest semester's loads from the existing global column so
-- nothing appears to reset the first time this runs.
DO $$
DECLARE
  target_sem uuid;
BEGIN
  SELECT id INTO target_sem
  FROM academic_semesters
  ORDER BY created_at DESC
  LIMIT 1;

  IF target_sem IS NULL THEN RETURN; END IF;

  INSERT INTO teacher_semester_load (teacher_id, semester_id, weekly_load_hours)
  SELECT id, target_sem, COALESCE(weekly_load_hours, 0)
  FROM teachers
  ON CONFLICT (teacher_id, semester_id) DO NOTHING;
END
$$;


-- ------------------------------------------------------------
-- 6. Lookup indexes for the new scope column
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_ctc_semester  ON course_teacher_choices (semester_id);
CREATE INDEX IF NOT EXISTS idx_tcp_semester  ON teacher_course_preferences (semester_id);
CREATE INDEX IF NOT EXISTS idx_ta_semester   ON teacher_availability (semester_id);
CREATE INDEX IF NOT EXISTS idx_cd_semester   ON course_durations (semester_id);
CREATE INDEX IF NOT EXISTS idx_cts_semester  ON class_time_settings (semester_id);
CREATE INDEX IF NOT EXISTS idx_rs_semester   ON routine_storage (semester_id);
