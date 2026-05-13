import express from 'express';
import { courseTimeService } from '../services/courseTimeService.js';

const router = express.Router();

/**
 * GET /api/course-time/courses
 * Returns all active courses (id, code, title, course_type, year, semester, credit_hours)
 */
router.get('/courses', async (req, res) => {
  try {
    const result = await courseTimeService.getCourses();
    if (result.success) {
      res.json({ success: true, data: result.courses });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('GET /course-time/courses error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch courses' });
  }
});

/**
 * GET /api/course-time/durations
 * Returns { course_id, duration_periods } for every course that has a duration set
 */
router.get('/durations', async (req, res) => {
  try {
    const result = await courseTimeService.getDurations();
    if (result.success) {
      res.json({ success: true, data: result.durations });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('GET /course-time/durations error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch durations' });
  }
});

/**
 * POST /api/course-time/durations/bulk
 * Body: { durations: [{ courseId, durationPeriods }] }
 * Must be defined before /:courseId to avoid route conflict
 */
router.post('/durations/bulk', async (req, res) => {
  try {
    const { durations } = req.body;

    if (!Array.isArray(durations) || durations.length === 0) {
      return res.status(400).json({ success: false, error: 'durations array is required' });
    }

    const invalid = durations.find(
      (d) => !d.courseId || !d.durationPeriods || Number(d.durationPeriods) < 1
    );
    if (invalid) {
      return res.status(400).json({
        success: false,
        error: 'Each entry must have courseId and durationPeriods >= 1',
      });
    }

    const result = await courseTimeService.upsertBulkDurations(durations);
    if (result.success) {
      res.json({ success: true, data: result.durations });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('POST /course-time/durations/bulk error:', error);
    res.status(500).json({ success: false, error: 'Failed to save durations' });
  }
});

/**
 * POST /api/course-time/durations/:courseId
 * Body: { durationPeriods: number }
 */
router.post('/durations/:courseId', async (req, res) => {
  try {
    const { courseId } = req.params;
    const { durationPeriods } = req.body;

    if (!durationPeriods || Number(durationPeriods) < 1) {
      return res.status(400).json({
        success: false,
        error: 'durationPeriods must be a positive integer',
      });
    }

    const result = await courseTimeService.upsertDuration(courseId, durationPeriods);
    if (result.success) {
      res.json({ success: true, data: result.duration });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('POST /course-time/durations/:courseId error:', error);
    res.status(500).json({ success: false, error: 'Failed to save duration' });
  }
});

export default router;
