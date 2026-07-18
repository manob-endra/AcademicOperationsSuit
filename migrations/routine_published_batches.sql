-- ============================================================
-- Per-batch publish tracking for class routines
--
-- Run this in the Supabase SQL editor. Safe to run more than once.
--
-- A semester's routine row covers several student batches (Y1-S1, Y4-S1, …)
-- and each batch is published separately. `published_at` on the row can only
-- record "something was published last at X" — it cannot say WHICH batch, nor
-- whether a batch has been edited since it was published.
--
-- published_batches stores, per batch code:
--   { "Y4-S1": { "publishedAt": "2026-07-18T…", "fingerprint": "…" } }
-- The fingerprint is a hash of that batch's entries at publish time, so the
-- UI can tell "Published" from "Published, then edited".
-- ============================================================

ALTER TABLE routine_storage
  ADD COLUMN IF NOT EXISTS published_batches jsonb NOT NULL DEFAULT '{}'::jsonb;
