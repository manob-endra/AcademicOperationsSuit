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
   * Get the durations set within one semester.
   * Returns { course_id, duration_periods, weekly_classes } per course.
   */
  async getDurations(semesterId) {
    try {
      if (!semesterId) return { success: false, error: 'semesterId is required.' };

      const { data, error } = await supabase
        .from('course_durations')
        .select('course_id, duration_periods, weekly_classes')
        .eq('semester_id', semesterId);

      if (error) throw error;
      return { success: true, durations: data || [] };
    } catch (error) {
      console.error('courseTimeService.getDurations error:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Upsert the duration (and optionally weekly_classes) for a single course
   * within one semester.
   */
  async upsertDuration(semesterId, courseId, durationPeriods, weeklyClasses = null) {
    try {
      if (!semesterId) return { success: false, error: 'semesterId is required.' };

      const row = {
        semester_id:      semesterId,
        course_id:        courseId,
        duration_periods: Number(durationPeriods),
      };
      if (weeklyClasses !== null && weeklyClasses !== undefined) {
        row.weekly_classes = Number(weeklyClasses);
      }

      const { data, error } = await supabase
        .from('course_durations')
        .upsert(row, { onConflict: 'semester_id,course_id' })
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
  async upsertWeeklyClasses(semesterId, courseId, weeklyClasses) {
    try {
      if (!semesterId) return { success: false, error: 'semesterId is required.' };

      const { data, error } = await supabase
        .from('course_durations')
        .upsert(
          { semester_id: semesterId, course_id: courseId, weekly_classes: Number(weeklyClasses) },
          { onConflict: 'semester_id,course_id' }
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
   * Upsert durations for many courses at once within one semester.
   * @param {Array<{courseId: string, durationPeriods: number, weeklyClasses?: number}>} durations
   */
  async upsertBulkDurations(semesterId, durations) {
    try {
      if (!semesterId) return { success: false, error: 'semesterId is required.' };

      const rows = durations.map((d) => {
        const row = {
          semester_id:      semesterId,
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
        .upsert(rows, { onConflict: 'semester_id,course_id' })
        .select();

      if (error) throw error;
      return { success: true, durations: data || [] };
    } catch (error) {
      console.error('courseTimeService.upsertBulkDurations error:', error);
      return { success: false, error: error.message };
    }
  },
};
