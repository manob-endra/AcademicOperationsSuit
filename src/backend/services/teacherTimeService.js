import { supabase } from '../config/supabaseClient.js';

export const teacherTimeService = {

  async getActiveTeachers() {
    try {
      const { data, error } = await supabase
        .from('teachers')
        .select('id, name, initials, department, email, load_limit, weekly_load_hours')
        .eq('is_active', true)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (err) {
      console.error('teacherTimeService.getActiveTeachers:', err);
      return { success: false, error: err.message };
    }
  },

  async getInactiveTeachers() {
    try {
      const { data, error } = await supabase
        .from('teachers')
        .select('id, name, initials, department, email, load_limit, weekly_load_hours')
        .eq('is_active', false)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (err) {
      console.error('teacherTimeService.getInactiveTeachers:', err);
      return { success: false, error: err.message };
    }
  },

  async createTeacher({ name, initials, department, email, load_limit, weekly_load_hours }) {
    try {
      const { data, error } = await supabase
        .from('teachers')
        .insert([{
          name: name.trim(),
          initials: (initials || '').trim(),
          department: department?.trim() || null,
          email: email?.trim() || null,
          load_limit: Number(load_limit) || 20,
          weekly_load_hours: Number(weekly_load_hours) || 0,
          is_active: true,
        }])
        .select()
        .single();
      if (error) throw error;
      return { success: true, data };
    } catch (err) {
      console.error('teacherTimeService.createTeacher:', err);
      return { success: false, error: err.message };
    }
  },

  async softDeleteTeacher(teacherId) {
    try {
      const { error } = await supabase
        .from('teachers')
        .update({ is_active: false })
        .eq('id', teacherId);
      if (error) throw error;
      return { success: true };
    } catch (err) {
      console.error('teacherTimeService.softDeleteTeacher:', err);
      return { success: false, error: err.message };
    }
  },

  async updateLoadLimit(teacherId, loadLimit) {
    try {
      const { error } = await supabase
        .from('teachers')
        .update({ load_limit: Number(loadLimit) })
        .eq('id', teacherId);
      if (error) throw error;
      return { success: true };
    } catch (err) {
      console.error('teacherTimeService.updateLoadLimit:', err);
      return { success: false, error: err.message };
    }
  },

  async restoreTeacher(teacherId) {
    try {
      const { error } = await supabase
        .from('teachers')
        .update({ is_active: true })
        .eq('id', teacherId);
      if (error) throw error;
      return { success: true };
    } catch (err) {
      console.error('teacherTimeService.restoreTeacher:', err);
      return { success: false, error: err.message };
    }
  },

  async importTeachers(teachersArray) {
    try {
      const rows = teachersArray
        .map(t => ({
          name: String(t.name || '').trim(),
          initials: String(t.initials || '').trim(),
          department: t.department?.trim() || null,
          email: t.email?.trim() || null,
          load_limit: Number(t.load_limit) || 20,
          is_active: true,
        }))
        .filter(t => t.name);

      if (rows.length === 0) {
        return { success: false, error: 'No valid teacher records found in the file.' };
      }

      const { data, error } = await supabase
        .from('teachers')
        .insert(rows)
        .select();
      if (error) throw error;
      return { success: true, data, count: data.length };
    } catch (err) {
      console.error('teacherTimeService.importTeachers:', err);
      return { success: false, error: err.message };
    }
  },

  async getAllAvailability() {
    try {
      const { data, error } = await supabase
        .from('teacher_availability')
        .select('teacher_id, day_of_week, slot_id');
      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (err) {
      console.error('teacherTimeService.getAllAvailability:', err);
      return { success: false, error: err.message };
    }
  },

  async saveTeacherAvailability(teacherId, selectedSlots) {
    try {
      const { error: delErr } = await supabase
        .from('teacher_availability')
        .delete()
        .eq('teacher_id', teacherId);
      if (delErr) throw delErr;

      if (selectedSlots.length === 0) return { success: true };

      const rows = selectedSlots.map(slotKey => {
        const dash = slotKey.indexOf('-');
        return {
          teacher_id: teacherId,
          day_of_week: slotKey.slice(0, dash),
          slot_id: slotKey.slice(dash + 1),
        };
      });

      const { error: insErr } = await supabase
        .from('teacher_availability')
        .insert(rows);
      if (insErr) throw insErr;
      return { success: true };
    } catch (err) {
      console.error('teacherTimeService.saveTeacherAvailability:', err);
      return { success: false, error: err.message };
    }
  },
};
