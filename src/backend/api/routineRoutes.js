import express from 'express';
import { routineService } from '../services/routineService.js';

const router = express.Router();

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

// POST /api/routine/generate  — run generation algorithm and save
router.post('/generate', async (req, res) => {
  const result = await routineService.generateRoutine();
  if (result.success) {
    return res.json({
      success: true,
      entries:     result.entries,
      warnings:    result.warnings,
      generatedAt: result.generatedAt,
    });
  }
  res.status(500).json({ success: false, error: result.error });
});

// DELETE /api/routine  — clear saved routine
router.delete('/', async (req, res) => {
  await routineService.clearRoutine();
  res.json({ success: true });
});

export default router;
