import express from 'express';
import { academicSemesterService } from '../services/academicSemesterService.js';

const router = express.Router();

// GET /api/academic-semesters
router.get('/', async (req, res) => {
  const result = await academicSemesterService.getAllSemesters();
  if (result.success) return res.json({ success: true, data: result.data });
  res.status(500).json({ success: false, error: result.error });
});

// GET /api/academic-semesters/removed — recoverable (soft-deleted) semesters
router.get('/removed', async (req, res) => {
  const result = await academicSemesterService.getRemovedSemesters();
  if (result.success) return res.json({ success: true, data: result.data });
  res.status(500).json({ success: false, error: result.error });
});

// GET /api/academic-semesters/:id
router.get('/:id', async (req, res) => {
  const result = await academicSemesterService.getSemesterById(req.params.id);
  if (result.success) return res.json({ success: true, data: result.data });
  res.status(404).json({ success: false, error: result.error });
});

// POST /api/academic-semesters
// Body: { year, name, rollover?: boolean }
router.post('/', async (req, res) => {
  const { year, name, rollover } = req.body;
  if (!year || !name) {
    return res.status(400).json({ success: false, error: 'year and name are required.' });
  }
  const result = await academicSemesterService.createSemester(
    String(year).trim(),
    String(name).trim(),
    rollover === true
  );
  if (result.success) {
    return res.status(201).json({ success: true, data: result.data, rollover: result.rollover });
  }
  res.status(500).json({ success: false, error: result.error });
});

// PATCH /api/academic-semesters/:id/remove — soft delete (recoverable)
router.patch('/:id/remove', async (req, res) => {
  const result = await academicSemesterService.removeSemester(req.params.id);
  if (result.success) return res.json({ success: true, data: result.data });
  res.status(500).json({ success: false, error: result.error });
});

// PATCH /api/academic-semesters/:id/restore — recover a removed semester
router.patch('/:id/restore', async (req, res) => {
  const result = await academicSemesterService.restoreSemester(req.params.id);
  if (result.success) return res.json({ success: true, data: result.data });
  res.status(500).json({ success: false, error: result.error });
});

// DELETE /api/academic-semesters/:id — permanent delete
router.delete('/:id', async (req, res) => {
  const result = await academicSemesterService.deleteSemester(req.params.id);
  if (result.success) return res.json({ success: true });
  res.status(500).json({ success: false, error: result.error });
});

export default router;
