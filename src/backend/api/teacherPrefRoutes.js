import express from 'express';
import { teacherPrefService } from '../services/teacherPrefService.js';
import { requireSemester } from './requireSemester.js';

const router = express.Router();

router.use(requireSemester);

// GET /api/teacher-preferences?semesterId=...
router.get('/', async (req, res) => {
  const result = await teacherPrefService.getAllPreferences(req.semesterId);
  if (result.success) return res.json({ success: true, data: result.data });
  res.status(500).json({ success: false, error: result.error });
});

// PUT /api/teacher-preferences/:teacherId   body: { semesterId, ...prefs }
router.put('/:teacherId', async (req, res) => {
  const { teacherId } = req.params;
  const result = await teacherPrefService.savePreferences(req.semesterId, teacherId, req.body);
  if (result.success) return res.json({ success: true });
  res.status(500).json({ success: false, error: result.error });
});

export default router;
