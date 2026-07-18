import express from 'express';
import { courseTimeService } from '../services/courseTimeService.js';
import { requireSemester } from './requireSemester.js';

const router = express.Router();

/**
 * GET /api/course-time/courses
 * Returns all active courses (id, code, title, course_type, year, semester, credit_hours).
 * The course catalog is campus-wide, so this one is not semester-scoped.
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

// Durations are routine work, so everything below is scoped to one semester.
router.use(requireSemester);

/**
 * GET /api/course-time/durations?semesterId=...
 * Returns { course_id, duration_periods } for every course that has a duration set
 */
router.get('/durations', async (req, res) => {
  try {
    const result = await courseTimeService.getDurations(req.semesterId);
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
 * Body: { durations: [{ courseId, durationPeriods, weeklyClasses? }] }
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

    const result = await courseTimeService.upsertBulkDurations(req.semesterId, durations);
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
 * POST /api/course-time/durations/apply
 * Body: { courseIds: string[], durationPeriods, weeklyClasses, alternating? }
 * Apply duration + weekly frequency (+ alternating flag) to many courses at
 * once — used by the "Apply by Credit" control. Must precede /:courseId.
 */
router.post('/durations/apply', async (req, res) => {
  try {
    const { courseIds, durationPeriods, weeklyClasses, alternating } = req.body;
    if (!Array.isArray(courseIds) || courseIds.length === 0) {
      return res.status(400).json({ success: false, error: 'courseIds array is required' });
    }
    if (!durationPeriods || Number(durationPeriods) < 1) {
      return res.status(400).json({ success: false, error: 'durationPeriods must be >= 1' });
    }
    if (!weeklyClasses || Number(weeklyClasses) < 1) {
      return res.status(400).json({ success: false, error: 'weeklyClasses must be >= 1' });
    }
    const result = await courseTimeService.applyToCourses(req.semesterId, courseIds, {
      durationPeriods, weeklyClasses, alternating,
    });
    if (result.success) return res.json({ success: true, data: result.durations });
    res.status(400).json({ success: false, error: result.error });
  } catch (error) {
    console.error('POST /course-time/durations/apply error:', error);
    res.status(500).json({ success: false, error: 'Failed to apply durations' });
  }
});

/**
 * POST /api/course-time/weekly-classes/bulk
 * Body: { courseIds: string[], weeklyClasses: number }
 * Bulk-set weekly_classes for many courses at once.
 */
router.post('/weekly-classes/bulk', async (req, res) => {
  try {
    const { courseIds, weeklyClasses } = req.body;
    if (!Array.isArray(courseIds) || courseIds.length === 0) {
      return res.status(400).json({ success: false, error: 'courseIds array is required' });
    }
    if (!weeklyClasses || Number(weeklyClasses) < 1) {
      return res.status(400).json({ success: false, error: 'weeklyClasses must be >= 1' });
    }
    const results = await Promise.allSettled(
      courseIds.map(id => courseTimeService.upsertWeeklyClasses(req.semesterId, id, Number(weeklyClasses)))
    );
    const failed = results.filter(r => r.status === 'rejected' || !r.value?.success);
    if (failed.length > 0) {
      return res.status(500).json({ success: false, error: 'Some courses failed to update' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('POST /course-time/weekly-classes/bulk error:', error);
    res.status(500).json({ success: false, error: 'Failed to save weekly classes' });
  }
});

/**
 * POST /api/course-time/weekly-classes/:courseId
 * Body: { weeklyClasses: number }
 */
router.post('/weekly-classes/:courseId', async (req, res) => {
  try {
    const { courseId } = req.params;
    const { weeklyClasses } = req.body;
    if (!weeklyClasses || Number(weeklyClasses) < 1) {
      return res.status(400).json({ success: false, error: 'weeklyClasses must be a positive integer' });
    }
    const result = await courseTimeService.upsertWeeklyClasses(req.semesterId, courseId, weeklyClasses);
    if (result.success) {
      res.json({ success: true, data: result.duration });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('POST /course-time/weekly-classes/:courseId error:', error);
    res.status(500).json({ success: false, error: 'Failed to save weekly classes' });
  }
});

/**
 * POST /api/course-time/durations/:courseId
 * Body: { durationPeriods: number, weeklyClasses?: number }
 */
router.post('/durations/:courseId', async (req, res) => {
  try {
    const { courseId } = req.params;
    const { durationPeriods, weeklyClasses } = req.body;

    if (!durationPeriods || Number(durationPeriods) < 1) {
      return res.status(400).json({
        success: false,
        error: 'durationPeriods must be a positive integer',
      });
    }

    const result = await courseTimeService.upsertDuration(req.semesterId, courseId, durationPeriods, weeklyClasses ?? null);
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
