-- ============================================================
-- Fix: course code is NOT unique within a syllabus
--
-- Run this in the Supabase SQL editor. Safe to run more than once.
--
-- The syllabus_catalog migration added a unique index on
-- (syllabus_id, code). That was wrong: a syllabus legitimately holds
-- several optional / elective slots that share a placeholder code
-- (e.g. 'CSE-4XXX' for an Option-A basket), so importing them fails
-- with "duplicate key value violates unique constraint".
--
-- Course code is not a reliable unique key in this domain — the UUID
-- primary key is. Replace the unique indexes with plain lookup indexes.
-- ============================================================

DROP INDEX IF EXISTS idx_courses_syllabus_code;
DROP INDEX IF EXISTS idx_courses_code_no_syllabus;

-- Non-unique lookup indexes (keep query performance, drop the constraint)
CREATE INDEX IF NOT EXISTS idx_courses_syllabus_code
  ON courses (syllabus_id, code);
CREATE INDEX IF NOT EXISTS idx_courses_code
  ON courses (code);
