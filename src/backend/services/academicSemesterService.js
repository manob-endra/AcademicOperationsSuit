import { supabase } from '../config/supabaseClient.js';
import { semesterRolloverService } from './semesterRolloverService.js';

// Detect "column does not exist" errors so the app keeps working until
// the semester_rollover.sql migration has been applied.
const isMissingRemovedColumn = (err) =>
  /is_removed|removed_at/.test(err?.message || '') && /column|does not exist/i.test(err?.message || '');

export const academicSemesterService = {

  async getAllSemesters() {
    try {
      const { data, error } = await supabase
        .from('academic_semesters')
        .select('*')
        .eq('is_removed', false)
        .order('created_at', { ascending: false });

      if (error) {
        if (isMissingRemovedColumn(error)) {
          // Migration not applied yet — fall back to unfiltered list
          const { data: all, error: allErr } = await supabase
            .from('academic_semesters')
            .select('*')
            .order('created_at', { ascending: false });
          if (allErr) throw allErr;
          return { success: true, data: all ?? [] };
        }
        throw error;
      }
      return { success: true, data: data ?? [] };
    } catch (err) {
      console.error('academicSemesterService.getAllSemesters:', err);
      return { success: false, error: err.message };
    }
  },

  async getRemovedSemesters() {
    try {
      const { data, error } = await supabase
        .from('academic_semesters')
        .select('*')
        .eq('is_removed', true)
        .order('removed_at', { ascending: false });

      if (error) {
        if (isMissingRemovedColumn(error)) return { success: true, data: [] };
        throw error;
      }
      return { success: true, data: data ?? [] };
    } catch (err) {
      console.error('academicSemesterService.getRemovedSemesters:', err);
      return { success: false, error: err.message };
    }
  },

  async getSemesterById(id) {
    try {
      const { data, error } = await supabase
        .from('academic_semesters')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (err) {
      console.error('academicSemesterService.getSemesterById:', err);
      return { success: false, error: err.message };
    }
  },

  /**
   * Create a semester. When `rollover` is true, the current working data
   * (assignments, preferences, loads, time slots, rooms, selections,
   * generated routine) is archived/refreshed first — past teachers are
   * preserved in course_history under the outgoing semester's label.
   */
  async createSemester(year, name, rollover = false) {
    try {
      let rolloverSummary = null;

      if (rollover) {
        // Label the archive with the most recent existing semester
        const existing = await this.getAllSemesters();
        const latest = existing.success ? existing.data[0] : null;
        const label = latest ? `${latest.name} ${latest.year}` : 'Previous semester';

        const r = await semesterRolloverService.performRollover(label);
        if (!r.success) {
          return { success: false, error: `Rollover failed: ${r.error}` };
        }
        rolloverSummary = { archivedCourses: r.archivedCourses, archivedLabel: label };
      }

      const { data, error } = await supabase
        .from('academic_semesters')
        .insert({ year, name })
        .select()
        .single();

      if (error) throw error;
      return { success: true, data, rollover: rolloverSummary };
    } catch (err) {
      console.error('academicSemesterService.createSemester:', err);
      return { success: false, error: err.message };
    }
  },

  /** Soft-delete: keep the row so it can be recovered from Removed Semesters. */
  async removeSemester(id) {
    try {
      const { data, error } = await supabase
        .from('academic_semesters')
        .update({ is_removed: true, removed_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        if (isMissingRemovedColumn(error)) {
          return { success: false, error: 'Database migration required: run migrations/semester_rollover.sql in Supabase first.' };
        }
        throw error;
      }
      return { success: true, data };
    } catch (err) {
      console.error('academicSemesterService.removeSemester:', err);
      return { success: false, error: err.message };
    }
  },

  /** Recover a semester from the removed list. */
  async restoreSemester(id) {
    try {
      const { data, error } = await supabase
        .from('academic_semesters')
        .update({ is_removed: false, removed_at: null })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (err) {
      console.error('academicSemesterService.restoreSemester:', err);
      return { success: false, error: err.message };
    }
  },

  /** Permanent delete (used from the Removed Semesters list). */
  async deleteSemester(id) {
    try {
      const { error } = await supabase
        .from('academic_semesters')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { success: true };
    } catch (err) {
      console.error('academicSemesterService.deleteSemester:', err);
      return { success: false, error: err.message };
    }
  },
};
