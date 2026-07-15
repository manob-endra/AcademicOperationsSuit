import express from 'express';
import { courseService } from '../services/courseService.js';

const router = express.Router();

/**
 * GET /api/courses
 * Get courses (supports status filter: "active" or "removed")
 * Query params: status=active|removed
 */
router.get('/', async (req, res) => {
  try {
    const { status } = req.query;
    
    let result;
    if (status === 'removed') {
      result = await courseService.getRemovedCourses();
    } else if (status === 'active') {
      result = await courseService.getActiveCourses();
    } else if (status === 'exceptional') {
      result = await courseService.getExceptionalCourses();
    } else {
      result = await courseService.getAllCourses();
    }
    
    if (result.success) {
      res.json({ success: true, data: result.courses });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('Error fetching courses:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch courses' });
  }
});

/**
 * POST /api/courses/import
 * Bulk import courses
 */
router.post('/import', async (req, res) => {
  try {
    const { courses } = req.body;

    if (!Array.isArray(courses) || courses.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid courses data. Expected non-empty array'
      });
    }

    const result = await courseService.importCourses(courses);
    if (result.success) {
      res.status(201).json({
        success: true,
        message: `${result.courses.length} courses imported successfully`,
        data: result.courses
      });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('Error importing courses:', error);
    res.status(500).json({ success: false, error: 'Failed to import courses' });
  }
});

/**
 * PUT /api/courses/set-exceptional
 * Batch mark/unmark courses as exceptional
 */
router.put('/set-exceptional', async (req, res) => {
  try {
    const { courseIds, isExceptional } = req.body;
    if (!Array.isArray(courseIds) || courseIds.length === 0) {
      return res.status(400).json({ success: false, error: 'courseIds array is required' });
    }
    const result = await courseService.setExceptionalCourses(courseIds, !!isExceptional);
    if (result.success) return res.json({ success: true, data: result.courses });
    res.status(500).json({ success: false, error: result.error });
  } catch (error) {
    console.error('Error setting exceptional courses:', error);
    res.status(500).json({ success: false, error: 'Failed to update courses' });
  }
});

/**
 * GET /api/courses/search/:searchTerm
 * Search courses by code or title
 */
router.get('/search/:searchTerm', async (req, res) => {
  try {
    const { searchTerm } = req.params;

    if (!searchTerm || searchTerm.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Search term is required'
      });
    }

    const result = await courseService.searchCourses(searchTerm);
    if (result.success) {
      res.json({ success: true, data: result.courses });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('Error searching courses:', error);
    res.status(500).json({ success: false, error: 'Failed to search courses' });
  }
});

/**
 * GET /api/courses/semester/:semester
 * Get courses by semester
 */
router.get('/semester/:semester', async (req, res) => {
  try {
    const { semester } = req.params;
    const result = await courseService.getCoursesBySemester(semester);
    if (result.success) {
      res.json({ success: true, data: result.courses });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('Error fetching courses by semester:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch courses' });
  }
});

/**
 * GET /api/courses/:id/history
 * Teaching history for a course (archived on semester rollover)
 */
router.get('/:id/history', async (req, res) => {
  try {
    const result = await courseService.getCourseHistory(req.params.id);
    if (result.success) {
      res.json({ success: true, data: result.history });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('Error fetching course history:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch course history' });
  }
});

/**
 * GET /api/courses/:id
 * Get a single course by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await courseService.getCourseById(id);
    if (result.success) {
      res.json({ success: true, data: result.course });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('Error fetching course:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch course' });
  }
});

/**
 * POST /api/courses
 * Create a new course
 */
router.post('/', async (req, res) => {
  try {
    const courseData = req.body;

    // Validate required fields
    const requiredFields = ['code', 'title', 'course_type', 'semester', 'credit_hours'];
    const missingFields = requiredFields.filter(field => !courseData[field]);

    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Missing required fields: ${missingFields.join(', ')}`
      });
    }

    const result = await courseService.createCourse(courseData);
    if (result.success) {
      res.status(201).json({ success: true, data: result.course });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('Error creating course:', error);
    res.status(500).json({ success: false, error: 'Failed to create course' });
  }
});

/**
 * PUT /api/courses/:id
 * Update a course
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No fields to update'
      });
    }

    const result = await courseService.updateCourse(id, updates);
    if (result.success) {
      res.json({ success: true, data: result.course });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('Error updating course:', error);
    res.status(500).json({ success: false, error: 'Failed to update course' });
  }
});

/**
 * DELETE /api/courses/:id
 * Delete a course
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await courseService.deleteCourse(id);
    if (result.success) {
      res.json({ success: true, message: 'Course deleted successfully' });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('Error deleting course:', error);
    res.status(500).json({ success: false, error: 'Failed to delete course' });
  }
});

/**
 * PUT /api/courses/batch-update
 * Batch update multiple courses (e.g., for soft delete/restore)
 */
router.put('/batch-update', async (req, res) => {
  try {
    const { ids, is_active } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid ids array'
      });
    }

    if (is_active === undefined) {
      return res.status(400).json({
        success: false,
        error: 'is_active field is required'
      });
    }

    const result = await courseService.batchUpdateCourses(ids, { is_active });
    if (result.success) {
      res.json({ success: true, data: result.courses });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('Error batch updating courses:', error);
    res.status(500).json({ success: false, error: 'Failed to batch update courses' });
  }
});

export default router;
