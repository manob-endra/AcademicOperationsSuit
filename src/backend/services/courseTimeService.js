import { supabase } from '../config/supabaseClient.js';

export const courseTimeService = {

  /**
   * Get all active courses ordered by code.
   * Returns id, code, title, course_type, year, semester, credit_hours.
   */
  async getCourses() {
    try {
      const { data, error } = await supabase
        .from('courses')
        .select('id, code, title, course_type, year, semester, credit_hours')
        .eq('is_active', true)
        .order('code', { ascending: true });

      if (error) throw error;
      return { success: true, courses: data || [] };
    } catch (error) {
      console.error('courseTimeService.getCourses error:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Get all rows from course_durations.
   * Returns { course_id, duration_periods } for every course that has one set.
   */
  async getDurations() {
    try {
      const { data, error } = await supabase
        .from('course_durations')
        .select('course_id, duration_periods');

      if (error) throw error;
      return { success: true, durations: data || [] };
    } catch (error) {
      console.error('courseTimeService.getDurations error:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Upsert the duration for a single course.
   * If a row for course_id already exists it is updated; otherwise inserted.
   */
  async upsertDuration(courseId, durationPeriods) {
    try {
      const { data, error } = await supabase
        .from('course_durations')
        .upsert(
          { course_id: courseId, duration_periods: Number(durationPeriods) },
          { onConflict: 'course_id' }
        )
        .select()
        .single();

      if (error) throw error;
      return { success: true, duration: data };
    } catch (error) {
      console.error('courseTimeService.upsertDuration error:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Upsert durations for many courses at once.
   * @param {Array<{courseId: string, durationPeriods: number}>} durations
   */
  async upsertBulkDurations(durations) {
    try {
      const rows = durations.map((d) => ({
        course_id: d.courseId,
        duration_periods: Number(d.durationPeriods),
      }));

      const { data, error } = await supabase
        .from('course_durations')
        .upsert(rows, { onConflict: 'course_id' })
        .select();

      if (error) throw error;
      return { success: true, durations: data || [] };
    } catch (error) {
      console.error('courseTimeService.upsertBulkDurations error:', error);
      return { success: false, error: error.message };
    }
  },
};
