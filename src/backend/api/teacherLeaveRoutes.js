import express from 'express';
import { teacherLeaveService } from '../services/teacherLeaveService.js';
import { supabase } from '../config/supabaseClient.js';

const router = express.Router();

const wrap = fn => async (req, res) => {
  try {
    const result = await fn(req, res);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// GET /api/teacher-leaves           — all leaves (admin)
router.get('/', wrap(async () => {
  const data = await teacherLeaveService.getAllLeaves();
  return { data };
}));

// GET /api/teacher-leaves/requests  — pending requests (admin)
router.get('/requests', wrap(async () => {
  const data = await teacherLeaveService.getPendingRequests();
  return { data };
}));

// GET /api/teacher-leaves/by-email?email=xxx  — teacher sees own leaves by email lookup
router.get('/by-email', wrap(async (req) => {
  const { email } = req.query;
  if (!email) throw new Error('email required');
  // Find teacher by email
  const { data: teacher } = await supabase
    .from('teachers')
    .select('id')
    .ilike('email', email.trim())
    .maybeSingle();
  if (!teacher) return { data: [] };
  const data = await teacherLeaveService.getLeavesForTeacher(teacher.id);
  return { data };
}));

// GET /api/teacher-leaves/teacher/:teacherId  — leaves for a specific teacher (admin)
router.get('/teacher/:teacherId', wrap(async (req) => {
  const data = await teacherLeaveService.getLeavesForTeacher(req.params.teacherId);
  return { data };
}));

// POST /api/teacher-leaves          — admin adds approved leave
router.post('/', wrap(async (req) => {
  const { teacher_id, leave_type, start_date, end_date, reason } = req.body;
  if (!teacher_id || !leave_type || !start_date || !end_date) throw new Error('teacher_id, leave_type, start_date, end_date required');
  return teacherLeaveService.addLeave({ teacher_id, leave_type, start_date, end_date, reason });
}));

// POST /api/teacher-leaves/request  — teacher submits leave request
router.post('/request', wrap(async (req) => {
  const { teacher_id, leave_type, start_date, end_date, reason } = req.body;
  if (!teacher_id || !leave_type || !start_date || !end_date) throw new Error('teacher_id, leave_type, start_date, end_date required');
  return teacherLeaveService.submitRequest({ teacher_id, leave_type, start_date, end_date, reason });
}));

// PATCH /api/teacher-leaves/:id/approve
router.patch('/:id/approve', wrap(async (req) => {
  return teacherLeaveService.approveRequest(req.params.id, req.body.admin_note || '');
}));

// PATCH /api/teacher-leaves/:id/reject
router.patch('/:id/reject', wrap(async (req) => {
  return teacherLeaveService.rejectRequest(req.params.id, req.body.admin_note || '');
}));

// DELETE /api/teacher-leaves/:id
router.delete('/:id', wrap(async (req) => {
  return teacherLeaveService.deleteLeave(req.params.id);
}));

export default router;
