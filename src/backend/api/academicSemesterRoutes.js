import express from 'express';
import { academicSemesterService } from '../services/academicSemesterService.js';

const router = express.Router();

// GET /api/academic-semesters
router.get('/', async (req, res) => {
  const result = await academicSemesterService.getAllSemesters();
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
router.post('/', async (req, res) => {
  const { year, name } = req.body;
  if (!year || !name) {
    return res.status(400).json({ success: false, error: 'year and name are required.' });
  }
  const result = await academicSemesterService.createSemester(year.trim(), name.trim());
  if (result.success) return res.status(201).json({ success: true, data: result.data });
  res.status(500).json({ success: false, error: result.error });
});

// DELETE /api/academic-semesters/:id
router.delete('/:id', async (req, res) => {
  const result = await academicSemesterService.deleteSemester(req.params.id);
  if (result.success) return res.json({ success: true });
  res.status(500).json({ success: false, error: result.error });
});

export default router;
