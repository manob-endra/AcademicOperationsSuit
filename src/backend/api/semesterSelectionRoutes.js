import express from 'express';
import { semesterSelectionService } from '../services/semesterSelectionService.js';
import { requireSemester } from './requireSemester.js';

const router = express.Router();

router.use(requireSemester);

// GET /api/semester-selection?semesterId=...
router.get('/', async (req, res) => {
  const result = await semesterSelectionService.getSelectedSemesters(req.semesterId);
  if (result.success) return res.json({ success: true, data: result.data });
  res.status(500).json({ success: false, error: result.error });
});

// POST /api/semester-selection   body: { semesterId, semesters }
router.post('/', async (req, res) => {
  const { semesters } = req.body;
  if (!Array.isArray(semesters)) {
    return res.status(400).json({ success: false, error: 'semesters must be an array.' });
  }
  const result = await semesterSelectionService.saveSelectedSemesters(req.semesterId, semesters);
  if (result.success) return res.json({ success: true });
  res.status(500).json({ success: false, error: result.error });
});

export default router;
