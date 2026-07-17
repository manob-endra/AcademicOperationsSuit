import { supabase } from '../config/supabaseClient.js';

// One row per academic semester. (This table used to hold a single global
// row with id = 1, which is why creating a semester had to clear it.)
export const semesterSelectionService = {

  async getSelectedSemesters(semesterId) {
    try {
      if (!semesterId) return { success: false, error: 'semesterId is required.' };

      const { data, error } = await supabase
        .from('semester_selection')
        .select('selected_semesters')
        .eq('semester_id', semesterId)
        .maybeSingle();

      if (error) throw error;
      return { success: true, data: data?.selected_semesters ?? [] };
    } catch (err) {
      console.error('semesterSelectionService.getSelectedSemesters:', err);
      return { success: false, error: err.message };
    }
  },

  async saveSelectedSemesters(semesterId, semesters) {
    try {
      if (!semesterId) return { success: false, error: 'semesterId is required.' };

      const { error } = await supabase
        .from('semester_selection')
        .upsert(
          { semester_id: semesterId, selected_semesters: semesters },
          { onConflict: 'semester_id' }
        );

      if (error) throw error;
      return { success: true };
    } catch (err) {
      console.error('semesterSelectionService.saveSelectedSemesters:', err);
      return { success: false, error: err.message };
    }
  },
};
