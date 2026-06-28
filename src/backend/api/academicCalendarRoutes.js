import express from 'express';
import { academicCalendarService } from '../services/academicCalendarService.js';
import { notificationCoreService } from '../services/notificationCoreService.js';
import { supabase } from '../config/supabaseClient.js';

const router = express.Router();

// GET /api/academic-calendars — list all published calendars
router.get('/', async (req, res) => {
  const result = await academicCalendarService.getPublishedCalendars();
  if (result.success) return res.json({ success: true, data: result.data });
  res.status(500).json({ success: false, error: result.error });
});

// GET /api/academic-calendars/:semesterId
router.get('/:semesterId', async (req, res) => {
  const result = await academicCalendarService.getCalendar(req.params.semesterId);
  if (result.success) return res.json({ success: true, data: result.data });
  res.status(500).json({ success: false, error: result.error });
});

// POST /api/academic-calendars/:semesterId — save draft or publish (legacy)
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

// POST /api/academic-calendars/:semesterId/publish — publish and queue notification
router.post('/:semesterId/publish', async (req, res) => {
  const { semesterId } = req.params;
  const { config, entries } = req.body;
  if (!config || entries === undefined) {
    return res.status(400).json({ success: false, error: 'config and entries are required.' });
  }

  const saveResult = await academicCalendarService.publishCalendar(semesterId, config, entries);
  if (!saveResult.success) {
    return res.status(500).json({ success: false, error: saveResult.error });
  }

  // Resolve semester display name
  let semesterName = semesterId;
  try {
    const { data: sem } = await supabase
      .from('academic_semesters')
      .select('name, year')
      .eq('id', semesterId)
      .maybeSingle();
    if (sem) semesterName = `${sem.name} ${sem.year}`;
  } catch {}

  // Minute-truncated trigger_id → re-publish after edits still sends a new email
  const ts = Math.floor(Date.now() / 60000);
  const triggerId = `academic_calendar_${semesterId}_${ts}`;

  await notificationCoreService.createJob('academic_calendar_published', triggerId, {
    semesterId,
    semesterName,
    publishedAt: new Date().toISOString(),
    startDate:  config.startDate,
    totalWeeks: config.totalWeeks,
    entryCount: Object.keys(entries).length,
  });

  return res.json({ success: true, data: saveResult.data });
});

export default router;
