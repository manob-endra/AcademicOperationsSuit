import express from 'express';
import { courseTeacherService } from '../services/courseTeacherService.js';

const router = express.Router();

// GET /api/course-teacher-choices?courseIds=id1,id2,...
router.get('/', async (req, res) => {
  const { courseIds } = req.query;
  if (!courseIds) return res.json({ success: true, data: [] });

  const ids = courseIds.split(',').map(s => s.trim()).filter(Boolean);
  const result = await courseTeacherService.getChoicesForCourses(ids);
  if (result.success) return res.json({ success: true, data: result.data });
  res.status(500).json({ success: false, error: result.error });
});

// PUT /api/course-teacher-choices/:courseId
router.put('/:courseId', async (req, res) => {
  const { courseId } = req.params;
  const result = await courseTeacherService.saveChoices(courseId, req.body);
  if (result.success) return res.json({ success: true });
  res.status(500).json({ success: false, error: result.error });
});

export default router;
