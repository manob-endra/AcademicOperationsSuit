-- ============================================================
-- Routine course participation (opt-in)
--
-- Run this in the Supabase SQL editor. Safe to run more than once.
--
-- Replaces the old "exceptional" model (a course was EXCLUDED from the
-- routine when is_exceptional = true) with an explicit opt-in: only
-- courses flagged in_routine = true take part in routine generation and
-- conflict checks. Admins pick them per type in the new "Routine Courses"
-- tab of the Courses page.
--
-- Default is false — a course does not participate until explicitly added.
--
-- is_exceptional is left in place (now unused) so nothing breaks mid-deploy;
-- it can be dropped later once every environment is on the new model.
-- ============================================================

ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS in_routine boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_courses_in_routine
  ON courses (in_routine) WHERE in_routine = true;

-- Optional convenience: seed the new flag from prior behaviour so an existing
-- deployment keeps scheduling the same theory/lab courses it did before.
-- Everything that was NOT exceptional and IS a class-type course opts in.
-- Comment this out if you would rather start from an empty routine set.
UPDATE courses
   SET in_routine = true
 WHERE is_active = true
   AND COALESCE(is_exceptional, false) = false
   AND course_type IN ('theory', 'lab', 'mixed');
