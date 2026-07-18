import express from 'express';
import { examRoutineService } from '../services/examRoutineService.js';
import { notificationCoreService } from '../services/notificationCoreService.js';
import { generateSlots, assignInvigilators, shiftOfBatch } from '../services/incourseGenerator.js';
import { supabase } from '../config/supabaseClient.js';

const SEMESTER_DISPLAY = {
  'Y1-S1':'1st Year 1st Semester', 'Y1-S2':'1st Year 2nd Semester',
  'Y2-S1':'2nd Year 1st Semester', 'Y2-S2':'2nd Year 2nd Semester',
  'Y3-S1':'3rd Year 1st Semester', 'Y3-S2':'3rd Year 2nd Semester',
  'Y4-S1':'4th Year 1st Semester', 'Y4-S2':'4th Year 2nd Semester',
  'MS-S1':'MS 1st Semester',       'MS-S2':'MS 2nd Semester',
};

// Batch code → the year/semester text stored on courses
const SEMESTER_YEAR_MAP = {
  'Y1-S1': { year: '1st Year', semester: '1st Semester' },
  'Y1-S2': { year: '1st Year', semester: '2nd Semester' },
  'Y2-S1': { year: '2nd Year', semester: '1st Semester' },
  'Y2-S2': { year: '2nd Year', semester: '2nd Semester' },
  'Y3-S1': { year: '3rd Year', semester: '1st Semester' },
  'Y3-S2': { year: '3rd Year', semester: '2nd Semester' },
  'Y4-S1': { year: '4th Year', semester: '1st Semester' },
  'Y4-S2': { year: '4th Year', semester: '2nd Semester' },
  'MS-S1': { year: 'Master',   semester: '1st Semester' },
  'MS-S2': { year: 'Master',   semester: '2nd Semester' },
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

/**
 * POST /api/exam-routine/incourse/session/:sessionId/generate
 *
 * Generate the whole incourse routine for ONE batch: exam dates (from the
 * confirmed start date, skipping Tuesday when there are fewer than 5 courses),
 * the batch's fixed shift time + rooms, and rank-balanced invigilators.
 *
 * Body: {
 *   academicSemesterId, batchId, startDate, shiftTimes:{1,2}, rooms,
 *   durationMins, perExam, weightMap, allowedDays
 * }
 * Returns the generated slots + invigilator map as a PREVIEW (nothing saved).
 */
router.post('/incourse/session/:sessionId/generate', async (req, res) => {
  try {
    const {
      academicSemesterId, batchId, startDate, shiftTimes = {}, rooms = '',
      durationMins = 60, perExam = 3, weightMap = {}, allowedDays,
    } = req.body || {};

    if (!academicSemesterId) return res.status(400).json({ success: false, error: 'academicSemesterId required' });
    if (!batchId)   return res.status(400).json({ success: false, error: 'batchId required' });
    if (!startDate) return res.status(400).json({ success: false, error: 'startDate required' });

    // Exactly the courses checked in Courses → Routine Courses for this batch:
    //   • in_routine = true (opt-in; null/undefined must NOT slip through)
    //   • from the syllabus assigned to this batch this semester
    //   • optional (grouped) courses only when offered this semester
    const pair = SEMESTER_YEAR_MAP[batchId];
    if (!pair) return res.status(400).json({ success: false, error: `Unknown batch ${batchId}` });

    const [{ data: courses }, { data: assignRows }, { data: offerRows }] = await Promise.all([
      supabase
        .from('courses')
        .select('id, code, title, course_type, year, semester, in_routine, is_active, syllabus_id, option_group_id')
        .eq('is_active', true)
        .eq('in_routine', true)
        .eq('year', pair.year)
        .eq('semester', pair.semester),
      supabase
        .from('semester_batch_syllabus')
        .select('batch_code, syllabus_id')
        .eq('semester_id', academicSemesterId)
        .eq('batch_code', batchId),
      supabase
        .from('course_offerings')
        .select('course_id')
        .eq('semester_id', academicSemesterId),
    ]);

    const assignedSyllabus = assignRows?.[0]?.syllabus_id || null;
    const offeredSet = new Set((offerRows || []).map(r => r.course_id));

    const eligible = (courses || []).filter(c => {
      // A batch pinned to a syllabus only sits that syllabus's courses.
      if (assignedSyllabus && c.syllabus_id && c.syllabus_id !== assignedSyllabus) return false;
      // Optional courses need to have been offered this semester.
      if (c.option_group_id && !offeredSet.has(c.id)) return false;
      return true;
    });

    // Slots: dates + fixed shift time + fixed rooms for this batch.
    const slots = generateSlots({
      batchId,
      courses: eligible,
      startDate,
      allowedDays,
      shiftTimes,
      rooms,
      durationMins,
    });
    if (!slots.length) {
      return res.status(400).json({ success: false, error: 'No theory courses found for this batch.' });
    }

    // Course → teachers, from this academic semester's allocation.
    const { data: choices } = await supabase
      .from('course_teacher_choices')
      .select('course_id, teacher_assignments')
      .eq('semester_id', academicSemesterId);
    const courseTeachers = {};
    for (const row of (choices || [])) {
      courseTeachers[row.course_id] = row.teacher_assignments || [];
    }

    const { data: teachers } = await supabase
      .from('teachers')
      .select('id, name, initials, designation, special_post, availability_status')
      .eq('is_active', true)
      .eq('availability_status', 'available')
      .order('name');

    // Default weights (Dean/Chairman = 1) unless the admin overrode them.
    const effectiveWeights = {};
    for (const t of (teachers || [])) {
      effectiveWeights[t.id] = weightMap[t.id] ?? examRoutineService.defaultWeightForTeacher(t);
    }

    const examDates = [...new Set(slots.map(s => s.exam_date).filter(Boolean))];
    const leaveMap  = await examRoutineService.buildLeaveMap(examDates);

    // Invigilators need slot ids — use the index as a temporary id; the client
    // maps them onto the real ids after saving the slots.
    const tempSlots = slots.map((s, i) => ({ ...s, id: `tmp-${i}` }));
    const invigilatorMap = assignInvigilators({
      slots: tempSlots,
      teachers: teachers || [],
      courseTeachers,
      weightMap: effectiveWeights,
      perExam: parseInt(perExam) || 3,
      leaveMap,
    });

    return res.json({
      success: true,
      data: {
        slots,                       // in slot_order; index ↔ `tmp-i`
        invigilatorMap,              // { 'tmp-i': [...] }
        shift: shiftOfBatch(batchId),
        examDates,
        courseCount: slots.length,
        skippedTuesday: slots.length < 5,
      },
    });
  } catch (err) {
    console.error('incourse generate error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
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

  // Include the teachers referenced by the invigilator assignments so the
  // student/teacher views can render (and download) real names.
  if (result.data?.slots?.length) {
    const ids = [...new Set(
      result.data.slots.flatMap(s => (s.invigilators || []).map(i => i.teacher_id)).filter(Boolean)
    )];
    if (ids.length) {
      const { data: teachers } = await supabase
        .from('teachers')
        .select('id, name, initials, designation')
        .in('id', ids);
      result.data = { ...result.data, teachers: teachers || [] };
    }
  }
  return res.json(result);
});

// GET /api/exam-routine/:type/all-published
router.get('/:type/all-published', async (req, res) => {
  const result = await examRoutineService.getAllPublished(req.params.type);
  if (!result.success) return res.status(500).json(result);
  return res.json(result);
});

export default router;
