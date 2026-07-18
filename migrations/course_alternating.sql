-- ============================================================
-- Alternating (every-other-week) class frequency
--
-- Run this in the Supabase SQL editor. Safe to run more than once.
--
-- Adds a per-course-per-semester "alternating" flag to course_durations.
-- When true, the course runs one class EVERY OTHER week (weekly_classes is
-- kept at 1). Routine generation schedules a single weekly slot tagged as
-- alternating, the same way alternating-group labs are already shown.
-- ============================================================

ALTER TABLE course_durations
  ADD COLUMN IF NOT EXISTS alternating boolean NOT NULL DEFAULT false;
