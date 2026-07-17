-- ============================================================
-- Optional document attachment on notices
--
-- Run this in the Supabase SQL editor. Safe to run more than once.
--
-- Adds an OPTIONAL document (PDF or any file up to 15 MB) to a notice.
-- The file itself lives in a Supabase Storage bucket ("notice-documents");
-- the notices row only keeps its public URL, original filename and size.
-- Existing notices (no attachment) keep working — all three columns are
-- nullable.
-- ============================================================

-- 1. Columns on notices ---------------------------------------
ALTER TABLE notices ADD COLUMN IF NOT EXISTS document_url  text;
ALTER TABLE notices ADD COLUMN IF NOT EXISTS document_name text;
ALTER TABLE notices ADD COLUMN IF NOT EXISTS document_size bigint;   -- bytes


-- 2. Storage bucket -------------------------------------------
--    Public read (so students/teachers can view & download via URL),
--    15 MB per-file hard cap enforced by Storage itself.
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('notice-documents', 'notice-documents', true, 15728640)  -- 15 * 1024 * 1024
ON CONFLICT (id) DO UPDATE
  SET public = true, file_size_limit = 15728640;


-- 3. Storage RLS policies -------------------------------------
--    Anyone may READ (bucket is public); the browser uploads with the
--    anon key, so allow anon INSERT/UPDATE/DELETE scoped to this bucket.
--    (Notice posting is already gated behind the admin UI.)
DO $$
BEGIN
  -- public read
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'notice_docs_read'
  ) THEN
    CREATE POLICY notice_docs_read ON storage.objects
      FOR SELECT USING (bucket_id = 'notice-documents');
  END IF;

  -- upload
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'notice_docs_insert'
  ) THEN
    CREATE POLICY notice_docs_insert ON storage.objects
      FOR INSERT WITH CHECK (bucket_id = 'notice-documents');
  END IF;

  -- overwrite (upsert)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'notice_docs_update'
  ) THEN
    CREATE POLICY notice_docs_update ON storage.objects
      FOR UPDATE USING (bucket_id = 'notice-documents');
  END IF;

  -- delete (cleanup)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'notice_docs_delete'
  ) THEN
    CREATE POLICY notice_docs_delete ON storage.objects
      FOR DELETE USING (bucket_id = 'notice-documents');
  END IF;
END $$;
