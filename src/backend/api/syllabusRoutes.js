import express from 'express';
import { syllabusService } from '../services/syllabusService.js';

const router = express.Router();

// ── Syllabi ──────────────────────────────────────────────────────────────

// GET /api/syllabus
router.get('/', async (req, res) => {
  const result = await syllabusService.getAllSyllabi();
  if (result.success) return res.json({ success: true, data: result.data, migrationNeeded: result.migrationNeeded || false });
  res.status(500).json({ success: false, error: result.error });
});

// POST /api/syllabus   body: { title, effective_session, starting_year?, notes? }
router.post('/', async (req, res) => {
  const { title, effective_session } = req.body || {};
  if (!title?.trim() || !effective_session?.trim()) {
    return res.status(400).json({ success: false, error: 'title and effective_session are required.' });
  }
  const result = await syllabusService.createSyllabus(req.body);
  if (result.success) return res.status(201).json({ success: true, data: result.data });
  res.status(500).json({ success: false, error: result.error });
});

// ── Option groups (static paths before /:id) ─────────────────────────────

// GET /api/syllabus/option-groups?syllabusId=...
router.get('/option-groups', async (req, res) => {
  const result = await syllabusService.getOptionGroups(req.query.syllabusId || null);
  if (result.success) return res.json({ success: true, data: result.data });
  res.status(500).json({ success: false, error: result.error });
});

// POST /api/syllabus/option-groups   body: { syllabus_id, name, year, semester, choose_count }
router.post('/option-groups', async (req, res) => {
  const { syllabus_id, name, year, semester } = req.body || {};
  if (!syllabus_id || !name?.trim() || !year || !semester) {
    return res.status(400).json({ success: false, error: 'syllabus_id, name, year and semester are required.' });
  }
  const result = await syllabusService.createOptionGroup(req.body);
  if (result.success) return res.status(201).json({ success: true, data: result.data });
  res.status(500).json({ success: false, error: result.error });
});

// PATCH /api/syllabus/option-groups/:id
router.patch('/option-groups/:id', async (req, res) => {
  const result = await syllabusService.updateOptionGroup(req.params.id, req.body || {});
  if (result.success) return res.json({ success: true, data: result.data });
  res.status(500).json({ success: false, error: result.error });
});

// DELETE /api/syllabus/option-groups/:id
router.delete('/option-groups/:id', async (req, res) => {
  const result = await syllabusService.deleteOptionGroup(req.params.id);
  if (result.success) return res.json({ success: true });
  res.status(500).json({ success: false, error: result.error });
});

// ── Batches ──────────────────────────────────────────────────────────────

// GET /api/syllabus/batches
router.get('/batches', async (req, res) => {
  const result = await syllabusService.getAllBatches();
  if (result.success) return res.json({ success: true, data: result.data });
  res.status(500).json({ success: false, error: result.error });
});

// POST /api/syllabus/batches   body: { name, admission_session, syllabus_id }
router.post('/batches', async (req, res) => {
  const { name, admission_session, syllabus_id } = req.body || {};
  if (!name?.trim() || !admission_session?.trim() || !syllabus_id) {
    return res.status(400).json({ success: false, error: 'name, admission_session and syllabus_id are required.' });
  }
  const result = await syllabusService.createBatch(req.body);
  if (result.success) return res.status(201).json({ success: true, data: result.data });
  res.status(500).json({ success: false, error: result.error });
});

// DELETE /api/syllabus/batches/:id
router.delete('/batches/:id', async (req, res) => {
  const result = await syllabusService.deleteBatch(req.params.id);
  if (result.success) return res.json({ success: true });
  res.status(500).json({ success: false, error: result.error });
});

// ── Per-academic-semester batch → syllabus assignment ────────────────────

// GET /api/syllabus/assignments?semesterId=...
router.get('/assignments', async (req, res) => {
  const { semesterId } = req.query;
  if (!semesterId) return res.status(400).json({ success: false, error: 'semesterId is required.' });
  const result = await syllabusService.getSemesterAssignments(semesterId);
  if (result.success) return res.json({ success: true, data: result.data });
  res.status(500).json({ success: false, error: result.error });
});

// PUT /api/syllabus/assignments   body: { semesterId, batchCode, syllabusId | null }
router.put('/assignments', async (req, res) => {
  const { semesterId, batchCode, syllabusId } = req.body || {};
  if (!semesterId || !batchCode) {
    return res.status(400).json({ success: false, error: 'semesterId and batchCode are required.' });
  }
  const result = await syllabusService.assignSyllabus(semesterId, batchCode, syllabusId || null);
  if (result.success) return res.json({ success: true });
  res.status(500).json({ success: false, error: result.error });
});

// ── Course offerings ─────────────────────────────────────────────────────

// GET /api/syllabus/offerings?semesterId=...
router.get('/offerings', async (req, res) => {
  const { semesterId } = req.query;
  if (!semesterId) return res.status(400).json({ success: false, error: 'semesterId is required.' });
  const result = await syllabusService.getOfferings(semesterId);
  if (result.success) return res.json({ success: true, data: result.data });
  res.status(500).json({ success: false, error: result.error });
});

// PUT /api/syllabus/offerings   body: { semesterId, courseId, offered: boolean }
router.put('/offerings', async (req, res) => {
  const { semesterId, courseId, offered } = req.body || {};
  if (!semesterId || !courseId) {
    return res.status(400).json({ success: false, error: 'semesterId and courseId are required.' });
  }
  const result = await syllabusService.setOffering(semesterId, courseId, offered === true);
  if (result.success) return res.json({ success: true });
  res.status(500).json({ success: false, error: result.error });
});

// ── Course equivalences ──────────────────────────────────────────────────

// GET /api/syllabus/equivalences
router.get('/equivalences', async (req, res) => {
  const result = await syllabusService.getEquivalences();
  if (result.success) return res.json({ success: true, data: result.data });
  res.status(500).json({ success: false, error: result.error });
});

// POST /api/syllabus/equivalences   body: { oldCourseId, newCourseId }
router.post('/equivalences', async (req, res) => {
  const { oldCourseId, newCourseId } = req.body || {};
  if (!oldCourseId || !newCourseId) {
    return res.status(400).json({ success: false, error: 'oldCourseId and newCourseId are required.' });
  }
  const result = await syllabusService.addEquivalence(oldCourseId, newCourseId);
  if (result.success) return res.status(201).json({ success: true, data: result.data });
  res.status(500).json({ success: false, error: result.error });
});

// DELETE /api/syllabus/equivalences/:id
router.delete('/equivalences/:id', async (req, res) => {
  const result = await syllabusService.removeEquivalence(req.params.id);
  if (result.success) return res.json({ success: true });
  res.status(500).json({ success: false, error: result.error });
});

// ── Dynamic syllabus routes (LAST — after all static paths) ──────────────

// PATCH /api/syllabus/:id
router.patch('/:id', async (req, res) => {
  const result = await syllabusService.updateSyllabus(req.params.id, req.body || {});
  if (result.success) return res.json({ success: true, data: result.data });
  res.status(500).json({ success: false, error: result.error });
});

// DELETE /api/syllabus/:id
router.delete('/:id', async (req, res) => {
  const result = await syllabusService.deleteSyllabus(req.params.id);
  if (result.success) return res.json({ success: true });
  res.status(500).json({ success: false, error: result.error });
});

export default router;
