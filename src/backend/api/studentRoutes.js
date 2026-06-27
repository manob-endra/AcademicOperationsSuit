import express from 'express';
import { studentService } from '../services/studentService.js';

const router = express.Router();

// GET /api/students
router.get('/', async (req, res) => {
  const result = await studentService.getActiveStudents();
  if (result.success) return res.json({ success: true, data: result.data });
  res.status(500).json({ success: false, error: result.error });
});

// GET /api/students/removed
router.get('/removed', async (req, res) => {
  const result = await studentService.getInactiveStudents();
  if (result.success) return res.json({ success: true, data: result.data });
  res.status(500).json({ success: false, error: result.error });
});

// POST /api/students/import
router.post('/import', async (req, res) => {
  const { students } = req.body;
  if (!Array.isArray(students) || !students.length) {
    return res.status(400).json({ success: false, error: 'No students provided.' });
  }
  const result = await studentService.importStudents(students);
  if (result.success) return res.json({ success: true, data: result.data, count: result.count });
  res.status(500).json({ success: false, error: result.error });
});

// POST /api/students/promote-batch  — promote all in fromYear → toYear
router.post('/promote-batch', async (req, res) => {
  const { fromYear, toYear } = req.body;
  if (!fromYear || !toYear) {
    return res.status(400).json({ success: false, error: 'fromYear and toYear are required.' });
  }
  const result = await studentService.promoteBatch(fromYear, toYear);
  if (result.success) return res.json({ success: true, count: result.count });
  res.status(500).json({ success: false, error: result.error });
});

// POST /api/students
router.post('/', async (req, res) => {
  if (!req.body.name?.trim()) {
    return res.status(400).json({ success: false, error: 'Student name is required.' });
  }
  const result = await studentService.createStudent(req.body);
  if (result.success) return res.status(201).json({ success: true, data: result.data });
  res.status(500).json({ success: false, error: result.error });
});

// PATCH /api/students/:id
router.patch('/:id', async (req, res) => {
  const result = await studentService.updateStudent(req.params.id, req.body);
  if (result.success) return res.json({ success: true, data: result.data });
  res.status(500).json({ success: false, error: result.error });
});

// POST /api/students/:id/restore
router.post('/:id/restore', async (req, res) => {
  const result = await studentService.restore(req.params.id);
  if (result.success) return res.json({ success: true });
  res.status(500).json({ success: false, error: result.error });
});

// DELETE /api/students/:id
router.delete('/:id', async (req, res) => {
  const result = await studentService.softDelete(req.params.id);
  if (result.success) return res.json({ success: true });
  res.status(500).json({ success: false, error: result.error });
});

export default router;
