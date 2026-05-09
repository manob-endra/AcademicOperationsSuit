import { supabase } from '../config/supabaseClient.js';

/**
 * Teacher Service
 * 
 * Handles all teacher management operations:
 * - Create, read, update, delete teachers
 * - Teacher preferences management
 * - Load tracking
 */

export const teacherService = {

  /**
   * Get all teachers
   * @returns {Promise<{success: boolean, teachers?: array, error?: string}>}
   */
  async getAllTeachers() {
    try {
      const { data, error } = await supabase
        .from('teachers')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      return { success: true, teachers: data };
    } catch (error) {
      console.error('Get teachers error:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Get teacher by ID
   * @param {string} teacherId - Teacher ID
   * @returns {Promise<{success: boolean, teacher?: object, error?: string}>}
   */
  async getTeacherById(teacherId) {
    try {
      const { data, error } = await supabase
        .from('teachers')
        .select('*')
        .eq('id', teacherId)
        .single();

      if (error) throw error;
      return { success: true, teacher: data };
    } catch (error) {
      console.error('Get teacher error:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Create new teacher
   * @param {object} teacherData - Teacher details
   * @returns {Promise<{success: boolean, teacher?: object, error?: string}>}
   */
  async createTeacher(teacherData) {
    try {
      const { data, error } = await supabase
        .from('teachers')
        .insert([teacherData])
        .select()
        .single();

      if (error) throw error;
      return { success: true, teacher: data };
    } catch (error) {
      console.error('Create teacher error:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Update teacher
   * @param {string} teacherId - Teacher ID
   * @param {object} updates - Teacher updates
   * @returns {Promise<{success: boolean, teacher?: object, error?: string}>}
   */
  async updateTeacher(teacherId, updates) {
    try {
      const { data, error } = await supabase
        .from('teachers')
        .update(updates)
        .eq('id', teacherId)
        .select()
        .single();

      if (error) throw error;
      return { success: true, teacher: data };
    } catch (error) {
      console.error('Update teacher error:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Delete teacher
   * @param {string} teacherId - Teacher ID
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async deleteTeacher(teacherId) {
    try {
      const { error } = await supabase
        .from('teachers')
        .delete()
        .eq('id', teacherId);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Delete teacher error:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Get teacher preferences
   * @param {string} teacherId - Teacher ID
   * @returns {Promise<{success: boolean, preferences?: array, error?: string}>}
   */
  async getTeacherPreferences(teacherId) {
    try {
      const { data, error } = await supabase
        .from('teacher_preferences')
        .select('*')
        .eq('teacher_id', teacherId);

      if (error) throw error;
      return { success: true, preferences: data };
    } catch (error) {
      console.error('Get preferences error:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Add teacher preference
   * @param {string} teacherId - Teacher ID
   * @param {object} preferenceData - Preference details
   * @returns {Promise<{success: boolean, preference?: object, error?: string}>}
   */
  async addTeacherPreference(teacherId, preferenceData) {
    try {
      const { data, error } = await supabase
        .from('teacher_preferences')
        .insert([{
          teacher_id: teacherId,
          ...preferenceData
        }])
        .select()
        .single();

      if (error) throw error;
      return { success: true, preference: data };
    } catch (error) {
      console.error('Add preference error:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Get overloaded teachers (load > limit)
   * @returns {Promise<{success: boolean, teachers?: array, error?: string}>}
   */
  async getOverloadedTeachers() {
    try {
      const { data, error } = await supabase
        .from('teachers')
        .select('*')
        .gt('weekly_load_hours', 'load_limit');

      if (error) throw error;
      return { success: true, teachers: data };
    } catch (error) {
      console.error('Get overloaded teachers error:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Bulk import teachers
   * @param {array} teachersData - Array of teacher objects
   * @returns {Promise<{success: boolean, teachers?: array, error?: string}>}
   */
  async importTeachers(teachersData) {
    try {
      const { data, error } = await supabase
        .from('teachers')
        .insert(teachersData)
        .select();

      if (error) throw error;
      return { success: true, teachers: data };
    } catch (error) {
      console.error('Import teachers error:', error);
      return { success: false, error: error.message };
    }
  }
};
