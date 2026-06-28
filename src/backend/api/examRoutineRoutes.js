import express from 'express';
import { examRoutineService } from '../services/examRoutineService.js';
import { notificationCoreService } from '../services/notificationCoreService.js';
import { supabase } from '../config/supabaseClient.js';

const SEMESTER_DISPLAY = {
  'Y1-S1':'1st Year 1st Semester', 'Y1-S2':'1st Year 2nd Semester',
  'Y2-S1':'2nd Year 1st Semester', 'Y2-S2':'2nd Year 2nd Semester',
  'Y3-S1':'3rd Year 1st Semester', 'Y3-S2':'3rd Year 2nd Semester',
  'Y4-S1':'4th Year 1st Semester', 'Y4-S2':'4th Year 2nd Semester',
  'MS-S1':'MS 1st Semester',       'MS-S2':'MS 2nd Semester',
};

const router = express.Router();

// ── Session CRUD ─────────────────────────────────────────────────────────────

// GET /api/exam-routine/:type/session/:semesterId
// Returns or creates session for semester+type, then returns full data
router.get('/:type/session/:semesterId', async (req, res) => {
  const { type, semesterId } = req.params;
  const sess = await examRoutineService.getOrCreateSession(semesterId, type);
  if (!sess.success) return res.status(500).json(sess);

  const full = await examRoutineService.getSessionFull(sess.data.id);
  if (!full.success) return res.status(500).json(full);

  // Load available teachers + build weight map
  const { data: teachers } = await supabase
    .from('teachers')
    .select('id, name, initials, special_post, designation, availability_status')
    .eq('availability_status', 'available')
    .order('name');

  const weightMap = {};
  for (const t of (teachers || [])) {
    weightMap[t.id] = examRoutineService.defaultWeightForTeacher(t);
  }
  // Override with saved weights
  for (const w of (full.data.weights || [])) {
    weightMap[w.teacher_id] = w.weight;
  }

  // Build leave map for exam dates so UI can show "on leave" warnings
  const examDates = [...new Set((full.data.slots || []).map(s => s.exam_date).filter(Boolean))];
  const leaveMap  = await examRoutineService.buildLeaveMap(examDates);
  // Convert Sets to arrays for JSON serialisation
  const leaveMapJson = {};
  for (const [tid, dateSet] of Object.entries(leaveMap)) {
    leaveMapJson[tid] = [...dateSet];
  }

  return res.json({ success: true, data: { ...full.data, weightMap, teachers: teachers || [], leaveMap: leaveMapJson } });
});

// PATCH /api/exam-routine/:type/session/:sessionId/config
router.patch('/:type/session/:sessionId/config', async (req, res) => {
  const result = await examRoutineService.updateSessionConfig(req.params.sessionId, req.body);
  if (!result.success) return res.status(500).json(result);
  return res.json(result);
});

// PUT /api/exam-routine/:type/session/:sessionId/slots
router.put('/:type/session/:sessionId/slots', async (req, res) => {
  const { slots } = req.body;
  if (!Array.isArray(slots)) return res.status(400).json({ success: false, error: 'slots must be an array' });
  const result = await examRoutineService.saveSlots(req.params.sessionId, slots);
  if (!result.success) return res.status(500).json(result);
  return res.json(result);
});

// PUT /api/exam-routine/:type/session/:sessionId/invigilators
router.put('/:type/session/:sessionId/invigilators', async (req, res) => {
  const { invigilatorMap } = req.body;
  if (!invigilatorMap) return res.status(400).json({ success: false, error: 'invigilatorMap required' });
  const result = await examRoutineService.saveAllInvigilators(req.params.sessionId, invigilatorMap);
  if (!result.success) return res.status(500).json(result);
  return res.json(result);
});

// PATCH /api/exam-routine/:type/session/:sessionId/weight
router.patch('/:type/session/:sessionId/weight', async (req, res) => {
  const { teacher_id, weight } = req.body;
  if (!teacher_id || weight === undefined) return res.status(400).json({ success: false, error: 'teacher_id and weight required' });
  const result = await examRoutineService.setWeight(req.params.sessionId, teacher_id, weight);
  if (!result.success) return res.status(500).json(result);
  return res.json(result);
});

// POST /api/exam-routine/:type/session/:sessionId/auto-assign
router.post('/:type/session/:sessionId/auto-assign', async (req, res) => {
  const { semesterId, weightMap, teachersPerExam } = req.body;
  if (!semesterId) return res.status(400).json({ success: false, error: 'semesterId required' });

  // Load current slots
  const full = await examRoutineService.getSessionFull(req.params.sessionId);
  if (!full.success || !full.data.slots?.length) {
    return res.status(400).json({ success: false, error: 'No slots saved yet. Save slots first.' });
  }

  // Load routine entries for semester (single-row JSONB table, filter in JS)
  const ROUTINE_ROW_ID = '00000000-0000-0000-0000-000000000001';
  const { data: routineRow } = await supabase
    .from('routine_storage')
    .select('entries')
    .eq('id', ROUTINE_ROW_ID)
    .maybeSingle();
  const routineEntries = (routineRow?.entries || []).filter(e => e.semester === semesterId);

  // Load available teachers
  const { data: teachers } = await supabase
    .from('teachers')
    .select('id, name, initials, special_post')
    .eq('availability_status', 'available')
    .order('name');

  const effectiveWeightMap = { ...weightMap };
  for (const t of (teachers || [])) {
    if (effectiveWeightMap[t.id] === undefined) {
      effectiveWeightMap[t.id] = examRoutineService.defaultWeightForTeacher(t);
    }
  }

  // Build leave map: which teachers are on approved leave on each exam date
  const examDates = [...new Set(full.data.slots.map(s => s.exam_date).filter(Boolean))];
  const leaveMap  = await examRoutineService.buildLeaveMap(examDates);

  const assignments = examRoutineService.autoAssign({
    slots: full.data.slots,
    teachers: teachers || [],
    routineEntries,
    weightMap: effectiveWeightMap,
    teachersPerExam: parseInt(teachersPerExam) || full.data.teachers_per_exam || 2,
    leaveMap,
  });

  // Persist assignments
  await examRoutineService.saveAllInvigilators(req.params.sessionId, assignments);

  return res.json({ success: true, data: assignments });
});

// POST /api/exam-routine/:type/session/:sessionId/publish
router.post('/:type/session/:sessionId/publish', async (req, res) => {
  const { sessionId, type } = req.params;

  const pubResult = await examRoutineService.publishSession(sessionId);
  if (!pubResult.success) return res.status(500).json(pubResult);

  // Resolve semester display name from short-code map (semester_id is now a short code e.g. 'Y4-S1')
  const semesterId = pubResult.data.semester_id;
  const semesterName = SEMESTER_DISPLAY[semesterId] || semesterId;

  const ts = Math.floor(Date.now() / 60000);
  const triggerId = `exam_routine_${type}_${semesterId}_${ts}`;

  await notificationCoreService.createJob(`exam_routine_published`, triggerId, {
    sessionId,
    sessionType: type,
    semesterId,
    semesterName,
    publishedAt: new Date().toISOString(),
  });

  return res.json({ success: true, data: pubResult.data });
});

// ── Public views ─────────────────────────────────────────────────────────────

// GET /api/exam-routine/:type/published/:semesterId
router.get('/:type/published/:semesterId', async (req, res) => {
  const result = await examRoutineService.getPublishedSession(req.params.semesterId, req.params.type);
  if (!result.success) return res.status(500).json(result);
  return res.json(result);
});

// GET /api/exam-routine/:type/all-published
router.get('/:type/all-published', async (req, res) => {
  const result = await examRoutineService.getAllPublished(req.params.type);
  if (!result.success) return res.status(500).json(result);
  return res.json(result);
});

export default router;
