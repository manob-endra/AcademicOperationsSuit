import { supabase } from '../config/supabaseClient.js';

// The table always holds exactly one row with id = 1.
const ROW_ID = 1;

export const semesterSelectionService = {

  async getSelectedSemesters() {
    try {
      const { data, error } = await supabase
        .from('semester_selection')
        .select('selected_semesters')
        .eq('id', ROW_ID)
        .maybeSingle();

      if (error) throw error;
      return { success: true, data: data?.selected_semesters ?? [] };
    } catch (err) {
      console.error('semesterSelectionService.getSelectedSemesters:', err);
      return { success: false, error: err.message };
    }
  },

  async saveSelectedSemesters(semesters) {
    try {
      const { error } = await supabase
        .from('semester_selection')
        .upsert({ id: ROW_ID, selected_semesters: semesters }, { onConflict: 'id' });

      if (error) throw error;
      return { success: true };
    } catch (err) {
      console.error('semesterSelectionService.saveSelectedSemesters:', err);
      return { success: false, error: err.message };
    }
  },
};
