import express from 'express';
import { courseTeacherService } from '../services/courseTeacherService.js';
import { requireSemester } from './requireSemester.js';

const router = express.Router();

router.use(requireSemester);

// GET /api/course-teacher-choices?semesterId=...&courseIds=id1,id2,...
router.get('/', async (req, res) => {
  const { courseIds } = req.query;
  if (!courseIds) return res.json({ success: true, data: [] });

  const ids = courseIds.split(',').map(s => s.trim()).filter(Boolean);
  const result = await courseTeacherService.getChoicesForCourses(req.semesterId, ids);
  if (result.success) return res.json({ success: true, data: result.data });
  res.status(500).json({ success: false, error: result.error });
});

// GET /api/course-teacher-choices/all?semesterId=...
// Every course in this semester with at least one teacher assigned
// (for reverse-mapping in the Teachers page)
router.get('/all', async (req, res) => {
  const result = await courseTeacherService.getAllAssignments(req.semesterId);
  if (result.success) return res.json({ success: true, data: result.data });
  res.status(500).json({ success: false, error: result.error });
});

// PUT /api/course-teacher-choices/:courseId   body: { semesterId, ...choices }
router.put('/:courseId', async (req, res) => {
  const { courseId } = req.params;
  const result = await courseTeacherService.saveChoices(req.semesterId, courseId, req.body);
  if (result.success) return res.json({ success: true });
  res.status(500).json({ success: false, error: result.error });
});

export default router;
