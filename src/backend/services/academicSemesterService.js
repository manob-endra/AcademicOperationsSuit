import { supabase } from '../config/supabaseClient.js';

export const academicSemesterService = {

  async getAllSemesters() {
    try {
      const { data, error } = await supabase
        .from('academic_semesters')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return { success: true, data: data ?? [] };
    } catch (err) {
      console.error('academicSemesterService.getAllSemesters:', err);
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

  async createSemester(year, name) {
    try {
      const { data, error } = await supabase
        .from('academic_semesters')
        .insert({ year, name })
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (err) {
      console.error('academicSemesterService.createSemester:', err);
      return { success: false, error: err.message };
    }
  },

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
