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
   * Returns { course_id, duration_periods, weekly_classes } for every course that has one set.
   */
  async getDurations() {
    try {
      const { data, error } = await supabase
        .from('course_durations')
        .select('course_id, duration_periods, weekly_classes');

      if (error) throw error;
      return { success: true, durations: data || [] };
    } catch (error) {
      console.error('courseTimeService.getDurations error:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Upsert the duration (and optionally weekly_classes) for a single course.
   */
  async upsertDuration(courseId, durationPeriods, weeklyClasses = null) {
    try {
      const row = {
        course_id:        courseId,
        duration_periods: Number(durationPeriods),
      };
      if (weeklyClasses !== null && weeklyClasses !== undefined) {
        row.weekly_classes = Number(weeklyClasses);
      }

      const { data, error } = await supabase
        .from('course_durations')
        .upsert(row, { onConflict: 'course_id' })
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
   * Upsert only the weekly_classes for a single course (duration_periods not changed).
   */
  async upsertWeeklyClasses(courseId, weeklyClasses) {
    try {
      const { data, error } = await supabase
        .from('course_durations')
        .upsert(
          { course_id: courseId, weekly_classes: Number(weeklyClasses) },
          { onConflict: 'course_id' }
        )
        .select()
        .single();

      if (error) throw error;
      return { success: true, duration: data };
    } catch (error) {
      console.error('courseTimeService.upsertWeeklyClasses error:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Upsert durations for many courses at once.
   * @param {Array<{courseId: string, durationPeriods: number, weeklyClasses?: number}>} durations
   */
  async upsertBulkDurations(durations) {
    try {
      const rows = durations.map((d) => {
        const row = {
          course_id:        d.courseId,
          duration_periods: Number(d.durationPeriods),
        };
        if (d.weeklyClasses !== undefined && d.weeklyClasses !== null) {
          row.weekly_classes = Number(d.weeklyClasses);
        }
        return row;
      });

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
