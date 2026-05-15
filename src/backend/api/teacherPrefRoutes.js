import express from 'express';
import { teacherPrefService } from '../services/teacherPrefService.js';

const router = express.Router();

// GET /api/teacher-preferences
router.get('/', async (req, res) => {
  const result = await teacherPrefService.getAllPreferences();
  if (result.success) return res.json({ success: true, data: result.data });
  res.status(500).json({ success: false, error: result.error });
});

// PUT /api/teacher-preferences/:teacherId
router.put('/:teacherId', async (req, res) => {
  const { teacherId } = req.params;
  const result = await teacherPrefService.savePreferences(teacherId, req.body);
  if (result.success) return res.json({ success: true });
  res.status(500).json({ success: false, error: result.error });
});

export default router;
