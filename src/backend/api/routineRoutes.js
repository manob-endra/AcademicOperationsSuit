import express from 'express';
import { routineService } from '../services/routineService.js';
import { notificationCoreService } from '../services/notificationCoreService.js';
import { supabase } from '../config/supabaseClient.js';

const router = express.Router();
const ROUTINE_ROW_ID = '00000000-0000-0000-0000-000000000001';

// GET /api/routine/conflicts  — pre-generation conflict check (must come before GET /)
router.get('/conflicts', async (req, res) => {
  const result = await routineService.checkConflicts();
  if (result.success) return res.json({ success: true, conflicts: result.conflicts });
  res.status(500).json({ success: false, error: result.error });
});

// GET /api/routine  — retrieve saved routine
router.get('/', async (req, res) => {
  const result = await routineService.getRoutine();
  if (result.success) {
    return res.json({ success: true, entries: result.entries, generatedAt: result.generatedAt });
  }
  res.status(500).json({ success: false, error: result.error });
});

// POST /api/routine/generate  — run the memetic GA and return a PREVIEW
// Body (optional): { seed: number } for a reproducible run
router.post('/generate', async (req, res) => {
  const seed = Number.isFinite(Number(req.body?.seed)) && req.body.seed !== ''
    ? Number(req.body.seed)
    : undefined;
  const result = await routineService.generateRoutine({ seed });
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
// Body: { entries: [...], generatedAt?: ISO string }
router.post('/save', async (req, res) => {
  const { entries, generatedAt } = req.body || {};
  const result = await routineService.saveRoutine(entries, generatedAt);
  if (result.success) {
    return res.json({ success: true, generatedAt: result.generatedAt });
  }
  res.status(400).json({ success: false, error: result.error });
});

// POST /api/routine/publish  — mark routine as published and enqueue notification job
// Body: { semesterId: 'Y4-S1', semesterLabel: '4th Year 1st Semester Routine 2024-2025' }
router.post('/publish', async (req, res) => {
  try {
    const { semesterId, semesterLabel } = req.body;
    if (!semesterId) return res.status(400).json({ success: false, error: 'semesterId required' });

    const routineResult = await routineService.getRoutine();
    if (!routineResult.success || !routineResult.entries?.length) {
      return res.status(400).json({ success: false, error: 'No routine to publish' });
    }

    // Verify this semester actually has entries
    const semEntries = routineResult.entries.filter(e => e.semester === semesterId);
    if (!semEntries.length) {
      return res.status(400).json({ success: false, error: `No entries for semester ${semesterId}` });
    }

    const publishedAt = new Date().toISOString();
    const label = semesterLabel || semesterId;

    // Stamp the routine row with publish metadata
    await supabase
      .from('routine_storage')
      .update({ published_at: publishedAt, published_label: label })
      .eq('id', ROUTINE_ROW_ID);

    // Idempotency key is per-semester per-minute so re-publishing same semester in same minute is blocked
    const triggerId = `routine_published_${semesterId}_${publishedAt.slice(0, 16).replace(/[T:-]/g, '')}`;
    const jobResult = await notificationCoreService.createJob(
      'routine_published',
      triggerId,
      { label, semesterId, publishedAt, entryCount: semEntries.length }
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

// DELETE /api/routine  — clear saved routine
router.delete('/', async (req, res) => {
  await routineService.clearRoutine();
  res.json({ success: true });
});

export default router;
