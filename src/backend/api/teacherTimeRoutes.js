import express from 'express';
import { teacherTimeService } from '../services/teacherTimeService.js';
import { requireSemester } from './requireSemester.js';

const router = express.Router();

// Teacher records are campus-wide, so most endpoints here are global. Only
// weekly load and availability are routine work and take a semesterId.

// GET /api/teachers[?semesterId=...]  — all active teachers.
// semesterId is optional here (global teacher-management pages have no
// semester context); when given, each teacher's weekly_load_hours reflects
// that semester's assignments instead of defaulting to 0.
router.get('/', async (req, res) => {
  const result = await teacherTimeService.getActiveTeachers(req.query.semesterId || null);
  if (result.success) return res.json({ success: true, data: result.data });
  res.status(500).json({ success: false, error: result.error });
});

// GET /api/teachers/removed  — inactive (soft-deleted) teachers (static before /:id)
router.get('/removed', async (req, res) => {
  const result = await teacherTimeService.getInactiveTeachers();
  if (result.success) return res.json({ success: true, data: result.data });
  res.status(500).json({ success: false, error: result.error });
});

// GET /api/teachers/availability?semesterId=...  — availability for one semester (static before /:id)
router.get('/availability', requireSemester, async (req, res) => {
  const result = await teacherTimeService.getAllAvailability(req.semesterId);
  if (result.success) return res.json({ success: true, data: result.data });
  res.status(500).json({ success: false, error: result.error });
});

// POST /api/teachers/import  — bulk import from parsed file (static before /:id)
router.post('/import', async (req, res) => {
  const { teachers } = req.body;
  if (!Array.isArray(teachers) || teachers.length === 0) {
    return res.status(400).json({ success: false, error: 'No teachers provided.' });
  }
  const result = await teacherTimeService.importTeachers(teachers);
  if (result.success) return res.json({ success: true, data: result.data, count: result.count });
  res.status(500).json({ success: false, error: result.error });
});

// POST /api/teachers  — create single teacher
router.post('/', async (req, res) => {
  const { name, initials, department, email, load_limit, designation, joining_date, special_post, contact_number, availability_status } = req.body;
  if (!name?.trim()) {
    return res.status(400).json({ success: false, error: 'Teacher name is required.' });
  }
  const result = await teacherTimeService.createTeacher({ name, initials, department, email, load_limit, designation, joining_date, special_post, contact_number, availability_status });
  if (result.success) return res.status(201).json({ success: true, data: result.data });
  res.status(500).json({ success: false, error: result.error });
});

// PATCH /api/teachers/:id  — update teacher profile fields (must come before /:id/load-limit etc.)
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const result = await teacherTimeService.updateTeacher(id, req.body);
  if (result.success) return res.json({ success: true, data: result.data });
  res.status(500).json({ success: false, error: result.error });
});

// PUT /api/teachers/:id/availability  — save availability for one teacher in one semester
// Body: { semesterId, selectedSlots }
router.put('/:id/availability', requireSemester, async (req, res) => {
  const { id } = req.params;
  const { selectedSlots } = req.body;
  if (!Array.isArray(selectedSlots)) {
    return res.status(400).json({ success: false, error: 'selectedSlots must be an array.' });
  }
  const result = await teacherTimeService.saveTeacherAvailability(req.semesterId, id, selectedSlots);
  if (result.success) return res.json({ success: true });
  res.status(500).json({ success: false, error: result.error });
});

// PATCH /api/teachers/:id/load-limit  — update load limit
router.patch('/:id/load-limit', async (req, res) => {
  const { id } = req.params;
  const { loadLimit } = req.body;
  if (loadLimit === undefined || loadLimit === null) {
    return res.status(400).json({ success: false, error: 'loadLimit is required.' });
  }
  const result = await teacherTimeService.updateLoadLimit(id, loadLimit);
  if (result.success) return res.json({ success: true });
  res.status(500).json({ success: false, error: result.error });
});

// POST /api/teachers/:id/restore  — restore soft-deleted teacher (before DELETE /:id)
router.post('/:id/restore', async (req, res) => {
  const { id } = req.params;
  const result = await teacherTimeService.restoreTeacher(id);
  if (result.success) return res.json({ success: true });
  res.status(500).json({ success: false, error: result.error });
});

// DELETE /api/teachers/:id  — soft delete
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const result = await teacherTimeService.softDeleteTeacher(id);
  if (result.success) return res.json({ success: true });
  res.status(500).json({ success: false, error: result.error });
});

export default router;
