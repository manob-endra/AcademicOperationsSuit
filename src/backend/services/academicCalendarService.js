import { supabase } from '../config/supabaseClient.js';

export const academicCalendarService = {

  async getCalendar(semesterId) {
    try {
      const { data, error } = await supabase
        .from('academic_calendars')
        .select('*')
        .eq('semester_id', semesterId)
        .maybeSingle();

      if (error) throw error;
      return { success: true, data };
    } catch (err) {
      console.error('academicCalendarService.getCalendar:', err);
      return { success: false, error: err.message };
    }
  },

  async saveCalendar(semesterId, config, entries, published) {
    try {
      const { data, error } = await supabase
        .from('academic_calendars')
        .upsert(
          {
            semester_id: semesterId,
            config,
            entries,
            published: published ?? false,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'semester_id' }
        )
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (err) {
      console.error('academicCalendarService.saveCalendar:', err);
      return { success: false, error: err.message };
    }
  },
};
