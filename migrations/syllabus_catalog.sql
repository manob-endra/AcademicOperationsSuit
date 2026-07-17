-- ============================================================
-- Syllabus catalog migration
--
-- Run this in the Supabase SQL editor (after per_semester_routine.sql).
-- Safe to run more than once.
--
-- What it adds:
--   • syllabi            — versioned syllabus records ("2023-24 and onward").
--                          A syllabus is never edited into a new one: a new
--                          version is a NEW row with its own course rows,
--                          even when most courses look identical.
--   • option_groups      — "Option-A", "Elective II" … within one syllabus
--                          semester; choose_count says how many are taken.
--   • courses extensions — syllabus_id, option_group_id (NULL = compulsory),
--                          weekly_classes, and new course types
--                          project / internship / viva (no routine classes).
--   • batches            — admitted batch → its syllabus, set once.
--   • semester_batch_syllabus — which syllabus each running batch level
--                          (Y1-S1 … MS-S2) follows in one academic semester.
--                          This is what routine generation reads.
--   • course_offerings   — which optional (option-group) courses actually
--                          run in one academic semester. Compulsory courses
--                          always run; optional ones only if offered.
--   • course_equivalences — old course ↔ new course mapping across syllabus
--                          versions (for retakes/results when a syllabus is
--                          phased out). Same code in two syllabi is still
--                          two rows — matched only through this table.
-- ============================================================


-- ------------------------------------------------------------
-- 1. Syllabi
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS syllabi (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title             varchar(200) NOT NULL,          -- e.g. 'BSc Hons Syllabus 2023'
  effective_session varchar(50)  NOT NULL,          -- e.g. '2023-24 and onward'
  starting_year     varchar(10),                    -- e.g. '2023'
  notes             text,
  is_active         boolean      NOT NULL DEFAULT true,
  created_at        timestamptz  NOT NULL DEFAULT now(),
  updated_at        timestamptz  NOT NULL DEFAULT now()
);


-- ------------------------------------------------------------
-- 2. Option groups (per syllabus, per year+semester)
--    year/semester use the same text values as courses.year /
--    courses.semester ('4th Year', '1st Semester') so groups line
--    up with the existing batch matching.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS option_groups (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  syllabus_id  uuid NOT NULL REFERENCES syllabi(id) ON DELETE CASCADE,
  name         varchar(100) NOT NULL,               -- 'Option-A', 'Elective II'
  year         varchar(20)  NOT NULL,               -- '4th Year'
  semester     varchar(50)  NOT NULL,               -- '1st Semester'
  choose_count int          NOT NULL DEFAULT 1 CHECK (choose_count > 0),
  created_at   timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT option_groups_unique UNIQUE (syllabus_id, year, semester, name)
);

CREATE INDEX IF NOT EXISTS idx_og_syllabus ON option_groups (syllabus_id);


-- ------------------------------------------------------------
-- 3. Courses extensions
-- ------------------------------------------------------------
ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS syllabus_id uuid REFERENCES syllabi(id) ON DELETE SET NULL;

ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS option_group_id uuid REFERENCES option_groups(id) ON DELETE SET NULL;

-- Catalog default for weekly classes (3 theory / 1 lab / 0 project…).
-- Per-academic-semester overrides still live in course_durations.
ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS weekly_classes int;

-- Allow the non-class course types. Project/internship/viva stay in the
-- catalog (credits, results, transcripts) but never get routine classes.
ALTER TABLE courses DROP CONSTRAINT IF EXISTS courses_course_type_check;
ALTER TABLE courses
  ADD CONSTRAINT courses_course_type_check
  CHECK (course_type IN ('theory', 'lab', 'mixed', 'project', 'internship', 'viva'));

-- Course code is NOT unique — the same code appears across syllabus versions
-- (CSE 1101 in both old and new), and within one syllabus several optional /
-- elective slots share a placeholder code (e.g. 'CSE-4XXX' for an Option-A
-- basket). The UUID primary key is the real identity; code is lookup-only.
ALTER TABLE courses DROP CONSTRAINT IF EXISTS courses_code_key;
CREATE INDEX IF NOT EXISTS idx_courses_syllabus_code ON courses (syllabus_id, code);
CREATE INDEX IF NOT EXISTS idx_courses_code ON courses (code);

CREATE INDEX IF NOT EXISTS idx_courses_syllabus ON courses (syllabus_id);
CREATE INDEX IF NOT EXISTS idx_courses_option_group ON courses (option_group_id);


-- ------------------------------------------------------------
-- 4. Batches (admitted batch → syllabus, set ONCE at admission)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS batches (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name              varchar(100) NOT NULL,          -- 'Batch 29'
  admission_session varchar(20)  NOT NULL UNIQUE,   -- '2023-24'
  syllabus_id       uuid NOT NULL REFERENCES syllabi(id),
  created_at        timestamptz  NOT NULL DEFAULT now()
);


-- ------------------------------------------------------------
-- 5. Per-academic-semester batch → syllabus assignment.
--    batch_code is the running level short code ('Y4-S1'), matching
--    semester_selection / routine entries. Routine generation uses
--    this to pick each batch's courses from the right syllabus.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS semester_batch_syllabus (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  semester_id uuid NOT NULL REFERENCES academic_semesters(id) ON DELETE CASCADE,
  batch_code  text NOT NULL,                        -- 'Y4-S1'
  syllabus_id uuid NOT NULL REFERENCES syllabi(id) ON DELETE CASCADE,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT semester_batch_syllabus_unique UNIQUE (semester_id, batch_code)
);

CREATE INDEX IF NOT EXISTS idx_sbs_semester ON semester_batch_syllabus (semester_id);


-- ------------------------------------------------------------
-- 6. Course offerings — which OPTIONAL courses run this semester.
--    Only option-group courses need a row; compulsory courses
--    (option_group_id IS NULL) always run. The syllabus itself is
--    never changed by this decision.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS course_offerings (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  semester_id uuid NOT NULL REFERENCES academic_semesters(id) ON DELETE CASCADE,
  course_id   uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT course_offerings_unique UNIQUE (semester_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_co_semester ON course_offerings (semester_id);


-- ------------------------------------------------------------
-- 7. Course equivalences across syllabus versions.
--    Needed when a student retakes a phased-out course: results map
--    old_course → new_course. Never assume same code = same course.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS course_equivalences (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  old_course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  new_course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT course_equivalences_unique UNIQUE (old_course_id, new_course_id)
);
