import { supabase } from '../config/supabaseClient.js';

/**
 * Course Service
 * 
 * Handles all course management operations:
 * - Create, read, update, delete courses
 * - Course filtering and search
 * - Course history tracking
 */

export const courseService = {

  /**
   * Get all courses (returns both active and inactive for backward compatibility)
   * @param {string|null} syllabusId - optional: restrict to one syllabus version
   * @returns {Promise<{success: boolean, courses?: array, error?: string}>}
   */
  async getAllCourses(syllabusId = null) {
    try {
      let query = supabase
        .from('courses')
        .select('*')
        .order('code', { ascending: true });
      if (syllabusId) query = query.eq('syllabus_id', syllabusId);

      const { data, error } = await query;

      if (error) throw error;
      return { success: true, courses: data };
    } catch (error) {
      console.error('Get courses error:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Get all active courses (is_active = true)
   * @returns {Promise<{success: boolean, courses?: array, error?: string}>}
   */
  async getActiveCourses() {
    try {
      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .eq('is_active', true)
        .order('code', { ascending: true });

      if (error) throw error;
      return { success: true, courses: data };
    } catch (error) {
      console.error('Get active courses error:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Get all removed courses (is_active = false)
   * @returns {Promise<{success: boolean, courses?: array, error?: string}>}
   */
  async getRemovedCourses() {
    try {
      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .eq('is_active', false)
        .order('code', { ascending: true });

      if (error) throw error;
      return { success: true, courses: data };
    } catch (error) {
      console.error('Get removed courses error:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Get courses by semester
   * @param {string} semester - Semester identifier (e.g., 'A1', '1st semester')
   * @returns {Promise<{success: boolean, courses?: array, error?: string}>}
   */
  async getCoursesBySemester(semester) {
    try {
      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .eq('semester', semester)
        .eq('is_active', true)
        .order('code', { ascending: true });

      if (error) throw error;
      return { success: true, courses: data };
    } catch (error) {
      console.error('Get courses by semester error:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Create a new course
   * @param {object} courseData - Course details
   * @returns {Promise<{success: boolean, course?: object, error?: string}>}
   */
  async createCourse(courseData) {
    try {
      const { data, error } = await supabase
        .from('courses')
        .insert([courseData])
        .select()
        .single();

      if (error) throw error;
      return { success: true, course: data };
    } catch (error) {
      console.error('Create course error:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Update course
   * @param {string} courseId - Course ID
   * @param {object} updates - Course updates
   * @returns {Promise<{success: boolean, course?: object, error?: string}>}
   */
  async updateCourse(courseId, updates) {
    try {
      const { data, error } = await supabase
        .from('courses')
        .update(updates)
        .eq('id', courseId)
        .select()
        .single();

      if (error) throw error;
      return { success: true, course: data };
    } catch (error) {
      console.error('Update course error:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Delete course
   * @param {string} courseId - Course ID
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async deleteCourse(courseId) {
    try {
      const { error } = await supabase
        .from('courses')
        .delete()
        .eq('id', courseId);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Delete course error:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Bulk import courses
   * @param {array} coursesData - Array of course objects
   * @returns {Promise<{success: boolean, courses?: array, error?: string}>}
   */
  async importCourses(coursesData) {
    try {
      const { data, error } = await supabase
        .from('courses')
        .insert(coursesData)
        .select();

      if (error) throw error;
      return { success: true, courses: data };
    } catch (error) {
      console.error('Import courses error:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Get a course by ID
   * @param {string} courseId - Course ID
   * @returns {Promise<{success: boolean, course?: object, error?: string}>}
   */
  async getCourseById(courseId) {
    try {
      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .eq('id', courseId)
        .single();

      if (error) throw error;
      return { success: true, course: data };
    } catch (error) {
      console.error('Get course by ID error:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Batch update multiple courses
   * @param {array} courseIds - Array of course IDs
   * @param {object} updates - Updates to apply
   * @returns {Promise<{success: boolean, courses?: array, error?: string}>}
   */
  async batchUpdateCourses(courseIds, updates) {
    try {
      if (!Array.isArray(courseIds) || courseIds.length === 0) {
        return { success: false, error: 'Invalid course IDs array' };
      }

      const updatedCourses = [];

      // Update each course individually
      for (const courseId of courseIds) {
        const { data, error } = await supabase
          .from('courses')
          .update(updates)
          .eq('id', courseId)
          .select();

        if (error) throw error;
        if (data && data.length > 0) {
          updatedCourses.push(data[0]);
        }
      }

      return { success: true, courses: updatedCourses };
    } catch (error) {
      console.error('Batch update courses error:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Get all exceptional courses (is_exceptional = true, is_active = true)
   */
  async getExceptionalCourses() {
    try {
      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .eq('is_exceptional', true)
        .eq('is_active', true)
        .order('code', { ascending: true });
      if (error) throw error;
      return { success: true, courses: data };
    } catch (error) {
      console.error('Get exceptional courses error:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Batch set is_exceptional on a list of courses
   * @param {string[]} courseIds
   * @param {boolean} isExceptional
   */
  async setExceptionalCourses(courseIds, isExceptional) {
    try {
      const { data, error } = await supabase
        .from('courses')
        .update({ is_exceptional: isExceptional })
        .in('id', courseIds)
        .select();
      if (error) throw error;
      return { success: true, courses: data };
    } catch (error) {
      console.error('Set exceptional courses error:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Batch set routine participation on a list of courses. Only courses with
   * in_routine = true take part in routine generation / conflict checks.
   * @param {string[]} courseIds
   * @param {boolean} inRoutine
   */
  async setCoursesInRoutine(courseIds, inRoutine) {
    try {
      if (!Array.isArray(courseIds) || courseIds.length === 0) {
        return { success: false, error: 'courseIds array is required' };
      }
      const { data, error } = await supabase
        .from('courses')
        .update({ in_routine: !!inRoutine })
        .in('id', courseIds)
        .select();
      if (error) throw error;
      return { success: true, courses: data };
    } catch (error) {
      console.error('Set courses in-routine error:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Assign a list of courses to an option group (or clear it with null).
   * @param {string[]} courseIds
   * @param {string|null} optionGroupId
   */
  async assignCoursesToGroup(courseIds, optionGroupId) {
    try {
      if (!Array.isArray(courseIds) || courseIds.length === 0) {
        return { success: false, error: 'courseIds array is required' };
      }
      const { data, error } = await supabase
        .from('courses')
        .update({ option_group_id: optionGroupId || null })
        .in('id', courseIds)
        .select();
      if (error) throw error;
      return { success: true, courses: data };
    } catch (error) {
      console.error('Assign courses to group error:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Get teaching history for a course (archived on semester rollover).
   * Rows: { semester_label, teacher_ids, teacher_names, archived_at }
   * @param {string} courseId - Course ID
   */
  async getCourseHistory(courseId) {
    try {
      const { data, error } = await supabase
        .from('course_history')
        .select('semester_label, teacher_ids, teacher_names, archived_at')
        .eq('course_id', String(courseId))
        .order('archived_at', { ascending: false });

      if (error) {
        // Table missing until the semester_rollover.sql migration runs
        if (/course_history/.test(error.message) && /does not exist|not find/i.test(error.message)) {
          return { success: true, history: [] };
        }
        throw error;
      }
      return { success: true, history: data || [] };
    } catch (error) {
      console.error('Get course history error:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Search courses by code or title
   * @param {string} searchTerm - Search term
   * @returns {Promise<{success: boolean, courses?: array, error?: string}>}
   */
  async searchCourses(searchTerm) {
    try {
      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .or(`code.ilike.%${searchTerm}%,title.ilike.%${searchTerm}%`)
        .eq('is_active', true);

      if (error) throw error;
      return { success: true, courses: data };
    } catch (error) {
      console.error('Search courses error:', error);
      return { success: false, error: error.message };
    }
  }
};
