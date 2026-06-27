import express from 'express';
import { academicCalendarService } from '../services/academicCalendarService.js';

const router = express.Router();

// GET /api/academic-calendars/:semesterId
router.get('/:semesterId', async (req, res) => {
  const result = await academicCalendarService.getCalendar(req.params.semesterId);
  if (result.success) return res.json({ success: true, data: result.data });
  res.status(500).json({ success: false, error: result.error });
});

// POST /api/academic-calendars/:semesterId
router.post('/:semesterId', async (req, res) => {
  const { config, entries, published } = req.body;
  if (!config || entries === undefined) {
    return res.status(400).json({ success: false, error: 'config and entries are required.' });
  }
  const result = await academicCalendarService.saveCalendar(
    req.params.semesterId,
    config,
    entries,
    published
  );
  if (result.success) return res.json({ success: true, data: result.data });
  res.status(500).json({ success: false, error: result.error });
});

export default router;
