import express from 'express';
import { routineService } from '../services/routineService.js';
import { notificationCoreService } from '../services/notificationCoreService.js';
import { requireSemester } from './requireSemester.js';
import { supabase } from '../config/supabaseClient.js';

const router = express.Router();

// GET /api/routine/published  — the most recently published routine, for
// viewers with no semester context of their own (student/teacher routine
// pages). Must come before requireSemester and before GET /.
router.get('/published', async (req, res) => {
  const result = await routineService.getPublishedRoutine();
  if (result.success) {
    return res.json({
      success: true,
      entries: result.entries,
      generatedAt: result.generatedAt,
      semesterId: result.semesterId,
      semesterLabel: result.semesterLabel,
    });
  }
  res.status(500).json({ success: false, error: result.error });
});

router.use(requireSemester);

// GET /api/routine/conflicts?semesterId=...  — pre-generation conflict check (must come before GET /)
router.get('/conflicts', async (req, res) => {
  const result = await routineService.checkConflicts(req.semesterId);
  if (result.success) return res.json({ success: true, conflicts: result.conflicts });
  res.status(500).json({ success: false, error: result.error });
});

// GET /api/routine?semesterId=...  — retrieve saved routine
router.get('/', async (req, res) => {
  const result = await routineService.getRoutine(req.semesterId);
  if (result.success) {
    return res.json({ success: true, entries: result.entries, generatedAt: result.generatedAt });
  }
  res.status(500).json({ success: false, error: result.error });
});

// POST /api/routine/generate  — run the memetic GA and return a PREVIEW
// Body: { semesterId, seed?: number }  (seed makes a run reproducible)
router.post('/generate', async (req, res) => {
  const seed = Number.isFinite(Number(req.body?.seed)) && req.body.seed !== ''
    ? Number(req.body.seed)
    : undefined;
  const result = await routineService.generateRoutine(req.semesterId, { seed });
  if (result.success) {
    return res.json({
      success: true,
      entries:     result.entries,
      warnings:    result.warnings,
      report:      result.report,
      generatedAt: result.generatedAt,
      saved:       false,
    });
  }
  res.status(500).json({ success: false, error: result.error });
});

// POST /api/routine/save  — persist a previewed routine
// Body: { semesterId, entries: [...], generatedAt?: ISO string }
router.post('/save', async (req, res) => {
  const { entries, generatedAt } = req.body || {};
  const result = await routineService.saveRoutine(req.semesterId, entries, generatedAt);
  if (result.success) {
    return res.json({ success: true, generatedAt: result.generatedAt });
  }
  res.status(400).json({ success: false, error: result.error });
});

// POST /api/routine/publish  — mark routine as published and enqueue notification job
// Body: { semesterId, batchId: 'Y4-S1', semesterLabel: '4th Year 1st Semester Routine 2024-2025' }
//
// Two different ids are in play: `semesterId` is the academic semester (a
// UUID from academic_semesters) that scopes the data, while `batchId` is the
// student batch short code (Y4-S1) that identifies which entries to publish.
router.post('/publish', async (req, res) => {
  try {
    const { batchId, semesterLabel } = req.body;
    if (!batchId) return res.status(400).json({ success: false, error: 'batchId required' });

    const routineResult = await routineService.getRoutine(req.semesterId);
    if (!routineResult.success || !routineResult.entries?.length) {
      return res.status(400).json({ success: false, error: 'No routine to publish' });
    }

    // Verify this batch actually has entries
    const batchEntries = routineResult.entries.filter(e => e.semester === batchId);
    if (!batchEntries.length) {
      return res.status(400).json({ success: false, error: `No entries for semester ${batchId}` });
    }

    const publishedAt = new Date().toISOString();
    const label = semesterLabel || batchId;

    // Stamp this semester's routine row with publish metadata
    await supabase
      .from('routine_storage')
      .update({ published_at: publishedAt, published_label: label })
      .eq('semester_id', req.semesterId);

    // Idempotency key is per-batch per-minute so re-publishing the same batch in the same minute is blocked
    const triggerId = `routine_published_${batchId}_${publishedAt.slice(0, 16).replace(/[T:-]/g, '')}`;
    const jobResult = await notificationCoreService.createJob(
      'routine_published',
      triggerId,
      { label, semesterId: batchId, publishedAt, entryCount: batchEntries.length }
    );

    if (jobResult.duplicate) {
      return res.json({ success: true, published: true, duplicate: true, publishedAt });
    }

    res.json({ success: true, published: true, publishedAt, jobId: jobResult.job?.id });
  } catch (err) {
    console.error('publish error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/routine?semesterId=...  — clear saved routine
router.delete('/', async (req, res) => {
  await routineService.clearRoutine(req.semesterId);
  res.json({ success: true });
});

export default router;
