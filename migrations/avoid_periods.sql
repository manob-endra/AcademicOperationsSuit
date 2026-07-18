-- ============================================================
-- Avoided periods on class time settings
--
-- Run this in the Supabase SQL editor. Safe to run more than once.
--
-- Lets a department block specific (day, period) cells from routine
-- generation — e.g. "Monday after lunch". Stored as a JSON array of
-- "Day-sN" strings (e.g. ["Monday-s4","Monday-s5"]), the same slot id
-- format teacher availability uses.
-- ============================================================

ALTER TABLE class_time_settings
  ADD COLUMN IF NOT EXISTS avoid_periods jsonb NOT NULL DEFAULT '[]'::jsonb;
