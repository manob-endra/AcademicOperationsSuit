-- ============================================================
-- Fractional course credits
--
-- Run this in the Supabase SQL editor. Safe to run more than once.
--
-- courses.credit_hours was INT, so a 0.75 or 1.5 credit course silently
-- rounded on save. NUMERIC(4,2) stores credits exactly (up to 99.99 with
-- two decimals), which covers 0.5 / 0.75 / 1.5 / 2.25 style credits.
--
-- Widening INT -> NUMERIC is lossless, so existing whole-number credits
-- carry over untouched.
-- ============================================================

ALTER TABLE courses
  ALTER COLUMN credit_hours TYPE numeric(4,2) USING credit_hours::numeric;
