/**
 * Frontend API Service for Courses
 * Handles all HTTP requests to the course backend API
 */

const API_BASE_URL = `${import.meta.env.VITE_API_URL}/courses`;
const HEALTH_CHECK_URL = `${import.meta.env.VITE_API_URL}/health`;

// Check if backend is available
let backendAvailable = true;

const checkBackendConnection = async () => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    
    const response = await fetch(HEALTH_CHECK_URL, {
      method: 'GET',
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    return response.ok;
  } catch (error) {
    console.warn('Backend server is not available. Please start it with: npm run dev (in a separate terminal)');
    return false;
  }
};

export const courseAPI = {
  /**
   * Get all courses
   */
  async getAllCourses() {
    try {
      // Check backend connection first
      if (!backendAvailable) {
        backendAvailable = await checkBackendConnection();
      }

      if (!backendAvailable) {
        return { 
          success: false, 
          error: 'Backend server is not running. Please start it with: npm run dev',
          offline: true
        };
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${API_BASE_URL}`, {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Failed to fetch courses');
      }

      const result = await response.json();
      return { success: true, courses: result.data || [] };
    } catch (error) {
      console.error('Get all courses error:', error);
      
      if (error.name === 'AbortError' || error.message.includes('Failed to fetch')) {
        backendAvailable = false;
        return {
          success: false,
          error: 'Cannot connect to backend server. Make sure it is running on port 3001.\n\nTo start the backend:\n1. Open a terminal\n2. Navigate to your project\n3. Run: npm run dev',
          offline: true
        };
      }
      
      return { success: false, error: error.message || 'Failed to fetch courses' };
    }
  },

  /**
   * Get a single course by ID
   */
  async getCourseById(courseId) {
    try {
      if (!backendAvailable) {
        backendAvailable = await checkBackendConnection();
      }

      if (!backendAvailable) {
        return { 
          success: false, 
          error: 'Backend server is not running.',
          offline: true
        };
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${API_BASE_URL}/${courseId}`, {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Failed to fetch course');
      }

      const result = await response.json();
      return { success: true, course: result.data };
    } catch (error) {
      console.error('Get course by ID error:', error);
      
      if (error.name === 'AbortError' || error.message.includes('Failed to fetch')) {
        backendAvailable = false;
        return { success: false, error: 'Cannot connect to backend server.', offline: true };
      }
      
      return { success: false, error: error.message };
    }
  },

  /**
   * Get teaching history for a course (archived on semester rollover).
   * Returns rows: { semester_label, teacher_ids, teacher_names, archived_at }
   */
  async getCourseHistory(courseId) {
    try {
      if (!backendAvailable) {
        backendAvailable = await checkBackendConnection();
      }

      if (!backendAvailable) {
        return { success: false, error: 'Backend server is not running.', offline: true };
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${API_BASE_URL}/${courseId}/history`, {
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Failed to fetch course history');
      }

      const result = await response.json();
      return { success: true, history: result.data || [] };
    } catch (error) {
      console.error('Get course history error:', error);

      if (error.name === 'AbortError' || error.message.includes('Failed to fetch')) {
        backendAvailable = false;
        return { success: false, error: 'Cannot connect to backend server.', offline: true };
      }

      return { success: false, error: error.message };
    }
  },

  /**
   * Get courses by semester
   */
  async getCoursesBySemester(semester) {
    try {
      if (!backendAvailable) {
        backendAvailable = await checkBackendConnection();
      }

      if (!backendAvailable) {
        return { success: false, error: 'Backend server is not running.', offline: true };
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${API_BASE_URL}/semester/${encodeURIComponent(semester)}`, {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Failed to fetch courses');
      }

      const result = await response.json();
      return { success: true, courses: result.data || [] };
    } catch (error) {
      console.error('Get courses by semester error:', error);
      
      if (error.name === 'AbortError' || error.message.includes('Failed to fetch')) {
        backendAvailable = false;
        return { success: false, error: 'Cannot connect to backend server.', offline: true };
      }
      
      return { success: false, error: error.message };
    }
  },

  /**
   * Create a new course
   * Maps frontend field names to database field names
   */
  async createCourse(courseData) {
    try {
      if (!backendAvailable) {
        backendAvailable = await checkBackendConnection();
      }

      if (!backendAvailable) {
        return { 
          success: false, 
          error: 'Cannot connect to backend server. Please start it with: npm run dev',
          offline: true
        };
      }

      const dbCourseData = {
        code: courseData.code,
        title: courseData.title,
        course_type: courseData.type.toLowerCase(),
        semester: courseData.semester,
        credit_hours: parseFloat(courseData.credit),
        year: courseData.year,
        is_active: true
      };
      if (courseData.weeklyClasses !== undefined && courseData.weeklyClasses !== null) {
        dbCourseData.weekly_classes = parseInt(courseData.weeklyClasses);
      }
      if (courseData.syllabusId !== undefined) dbCourseData.syllabus_id = courseData.syllabusId;
      if (courseData.optionGroupId !== undefined) dbCourseData.option_group_id = courseData.optionGroupId;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${API_BASE_URL}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(dbCourseData),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Failed to create course');
      }

      const result = await response.json();
      return { success: true, course: result.data };
    } catch (error) {
      console.error('Create course error:', error);
      
      if (error.name === 'AbortError' || error.message.includes('Failed to fetch')) {
        backendAvailable = false;
        return { 
          success: false, 
          error: 'Cannot connect to backend server. Please start it with: npm run dev',
          offline: true 
        };
      }
      
      return { success: false, error: error.message || 'Failed to create course' };
    }
  },

  /**
   * Update a course
   */
  async updateCourse(courseId, updates) {
    try {
      if (!backendAvailable) {
        backendAvailable = await checkBackendConnection();
      }

      if (!backendAvailable) {
        return { success: false, error: 'Backend server is not running.', offline: true };
      }

      const dbUpdates = {};

      // Map frontend field names to database field names
      if (updates.code !== undefined) dbUpdates.code = updates.code;
      if (updates.title !== undefined) dbUpdates.title = updates.title;
      if (updates.type !== undefined) dbUpdates.course_type = updates.type.toLowerCase();
      if (updates.semester !== undefined) dbUpdates.semester = updates.semester;
      if (updates.credit !== undefined) dbUpdates.credit_hours = parseFloat(updates.credit);
      if (updates.year !== undefined) dbUpdates.year = updates.year;
      if (updates.weeklyClasses !== undefined) {
        dbUpdates.weekly_classes = updates.weeklyClasses === null ? null : parseInt(updates.weeklyClasses);
      }
      if (updates.syllabusId !== undefined) dbUpdates.syllabus_id = updates.syllabusId;
      if (updates.optionGroupId !== undefined) dbUpdates.option_group_id = updates.optionGroupId;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${API_BASE_URL}/${courseId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(dbUpdates),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Failed to update course');
      }

      const result = await response.json();
      return { success: true, course: result.data };
    } catch (error) {
      console.error('Update course error:', error);
      
      if (error.name === 'AbortError' || error.message.includes('Failed to fetch')) {
        backendAvailable = false;
        return { success: false, error: 'Cannot connect to backend server.', offline: true };
      }
      
      return { success: false, error: error.message };
    }
  },

  /**
   * Delete a course
   */
  async deleteCourse(courseId) {
    try {
      if (!backendAvailable) {
        backendAvailable = await checkBackendConnection();
      }

      if (!backendAvailable) {
        return { success: false, error: 'Backend server is not running.', offline: true };
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${API_BASE_URL}/${courseId}`, {
        method: 'DELETE',
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Failed to delete course');
      }

      return { success: true };
    } catch (error) {
      console.error('Delete course error:', error);
      
      if (error.name === 'AbortError' || error.message.includes('Failed to fetch')) {
        backendAvailable = false;
        return { success: false, error: 'Cannot connect to backend server.', offline: true };
      }
      
      return { success: false, error: error.message };
    }
  },

  /**
   * Import multiple courses. `syllabusId` (optional) attaches every imported
   * course to that syllabus version.
   */
  async importCourses(coursesData, syllabusId = null) {
    try {
      if (!backendAvailable) {
        backendAvailable = await checkBackendConnection();
      }

      if (!backendAvailable) {
        return { 
          success: false, 
          error: 'Backend server is not running. Please start it with: npm run dev',
          offline: true 
        };
      }

      // Map frontend field names to database field names
      const dbCoursesData = coursesData.map(course => {
        const row = {
          code: course.code,
          title: course.title,
          course_type: course.type.toLowerCase(),
          semester: course.semester,
          credit_hours: parseFloat(course.credit),
          year: course.year,
          is_active: true
        };
        if (course.weeklyClasses !== undefined && course.weeklyClasses !== null) {
          row.weekly_classes = parseInt(course.weeklyClasses);
        }
        const sid = course.syllabusId || syllabusId;
        if (sid) row.syllabus_id = sid;
        return row;
      });

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${API_BASE_URL}/import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ courses: dbCoursesData }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Failed to import courses');
      }

      const result = await response.json();
      return { success: true, courses: result.data || [] };
    } catch (error) {
      console.error('Import courses error:', error);
      
      if (error.name === 'AbortError' || error.message.includes('Failed to fetch')) {
        backendAvailable = false;
        return { success: false, error: 'Cannot connect to backend server.', offline: true };
      }
      
      return { success: false, error: error.message || 'Failed to import courses' };
    }
  },

  /**
   * Search courses by code or title
   */
  async searchCourses(searchTerm) {
    try {
      if (!backendAvailable) {
        backendAvailable = await checkBackendConnection();
      }

      if (!backendAvailable) {
        return { success: false, error: 'Backend server is not running.', offline: true };
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${API_BASE_URL}/search/${encodeURIComponent(searchTerm)}`, {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Failed to search courses');
      }

      const result = await response.json();
      return { success: true, courses: result.data || [] };
    } catch (error) {
      console.error('Search courses error:', error);
      
      if (error.name === 'AbortError' || error.message.includes('Failed to fetch')) {
        backendAvailable = false;
        return { success: false, error: 'Cannot connect to backend server.', offline: true };
      }
      
      return { success: false, error: error.message };
    }
  },

  /**
   * Get all removed courses (is_active = false)
   */
  async getRemovedCourses() {
    try {
      if (!backendAvailable) {
        backendAvailable = await checkBackendConnection();
      }

      if (!backendAvailable) {
        return { success: false, error: 'Backend server is not running.', offline: true };
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${API_BASE_URL}?status=removed`, {
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Failed to fetch removed courses');
      }

      const result = await response.json();
      return { success: true, courses: result.data || [] };
    } catch (error) {
      console.error('Get removed courses error:', error);

      if (error.name === 'AbortError' || error.message.includes('Failed to fetch')) {
        backendAvailable = false;
        return { success: false, error: 'Cannot connect to backend server.', offline: true };
      }

      return { success: false, error: error.message };
    }
  },

  /**
   * Soft delete a course (set is_active to false)
   */
  async removeCourse(courseId) {
    try {
      if (!backendAvailable) {
        backendAvailable = await checkBackendConnection();
      }

      if (!backendAvailable) {
        return { success: false, error: 'Backend server is not running.', offline: true };
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${API_BASE_URL}/${courseId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ is_active: false }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Failed to remove course');
      }

      const result = await response.json();
      return { success: true, course: result.data };
    } catch (error) {
      console.error('Remove course error:', error);

      if (error.name === 'AbortError' || error.message.includes('Failed to fetch')) {
        backendAvailable = false;
        return { success: false, error: 'Cannot connect to backend server.', offline: true };
      }

      return { success: false, error: error.message };
    }
  },

  /**
   * Restore a course (set is_active to true)
   */
  async restoreCourse(courseId) {
    try {
      if (!backendAvailable) {
        backendAvailable = await checkBackendConnection();
      }

      if (!backendAvailable) {
        return { success: false, error: 'Backend server is not running.', offline: true };
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${API_BASE_URL}/${courseId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ is_active: true }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Failed to restore course');
      }

      const result = await response.json();
      return { success: true, course: result.data };
    } catch (error) {
      console.error('Restore course error:', error);

      if (error.name === 'AbortError' || error.message.includes('Failed to fetch')) {
        backendAvailable = false;
        return { success: false, error: 'Cannot connect to backend server.', offline: true };
      }

      return { success: false, error: error.message };
    }
  },

  /**
   * Soft delete multiple courses (set is_active to false for multiple)
   */
  async removeCourses(courseIds) {
    try {
      if (!backendAvailable) {
        backendAvailable = await checkBackendConnection();
      }

      if (!backendAvailable) {
        return { success: false, error: 'Backend server is not running.', offline: true };
      }

      if (!Array.isArray(courseIds) || courseIds.length === 0) {
        return { success: false, error: 'Invalid course IDs' };
      }

      const removedCourses = [];

      // Remove each course individually using the single course update endpoint
      for (const courseId of courseIds) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(`${API_BASE_URL}/${courseId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ is_active: false }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const result = await response.json();
          throw new Error(result.error || `Failed to remove course ${courseId}`);
        }

        const result = await response.json();
        if (result.data) {
          removedCourses.push(result.data);
        }
      }

      return { success: true, courses: removedCourses };
    } catch (error) {
      console.error('Remove courses error:', error);

      if (error.name === 'AbortError' || error.message.includes('Failed to fetch')) {
        backendAvailable = false;
        return { success: false, error: 'Cannot connect to backend server.', offline: true };
      }

      return { success: false, error: error.message };
    }
  },

  /**
   * Get all exceptional courses (is_exceptional = true)
   */
  async getExceptionalCourses() {
    try {
      if (!backendAvailable) backendAvailable = await checkBackendConnection();
      if (!backendAvailable) return { success: false, error: 'Backend server is not running.', offline: true };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      const response = await fetch(`${API_BASE_URL}?status=exceptional`, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) { const r = await response.json(); throw new Error(r.error || 'Failed to fetch exceptional courses'); }
      const result = await response.json();
      return { success: true, courses: result.data || [] };
    } catch (error) {
      if (error.name === 'AbortError' || error.message.includes('Failed to fetch')) {
        backendAvailable = false;
        return { success: false, error: 'Cannot connect to backend server.', offline: true };
      }
      return { success: false, error: error.message };
    }
  },

  /**
   * Batch mark/unmark courses as exceptional
   * @param {string[]} courseIds
   * @param {boolean} isExceptional
   */
  async setExceptional(courseIds, isExceptional) {
    try {
      if (!backendAvailable) backendAvailable = await checkBackendConnection();
      if (!backendAvailable) return { success: false, error: 'Backend server is not running.', offline: true };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      const response = await fetch(`${API_BASE_URL}/set-exceptional`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseIds, isExceptional }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) { const r = await response.json(); throw new Error(r.error || 'Failed to update courses'); }
      const result = await response.json();
      return { success: true, courses: result.data || [] };
    } catch (error) {
      if (error.name === 'AbortError' || error.message.includes('Failed to fetch')) {
        backendAvailable = false;
        return { success: false, error: 'Cannot connect to backend server.', offline: true };
      }
      return { success: false, error: error.message };
    }
  },

  /**
   * Restore multiple courses (set is_active to true for multiple)
   */
  async restoreCourses(courseIds) {
    try {
      if (!backendAvailable) {
        backendAvailable = await checkBackendConnection();
      }

      if (!backendAvailable) {
        return { success: false, error: 'Backend server is not running.', offline: true };
      }

      if (!Array.isArray(courseIds) || courseIds.length === 0) {
        return { success: false, error: 'Invalid course IDs' };
      }

      const restoredCourses = [];

      // Restore each course individually using the single course update endpoint
      for (const courseId of courseIds) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(`${API_BASE_URL}/${courseId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ is_active: true }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const result = await response.json();
          throw new Error(result.error || `Failed to restore course ${courseId}`);
        }

        const result = await response.json();
        if (result.data) {
          restoredCourses.push(result.data);
        }
      }

      return { success: true, courses: restoredCourses };
    } catch (error) {
      console.error('Restore courses error:', error);

      if (error.name === 'AbortError' || error.message.includes('Failed to fetch')) {
        backendAvailable = false;
        return { success: false, error: 'Cannot connect to backend server.', offline: true };
      }

      return { success: false, error: error.message };
    }
  }
};
