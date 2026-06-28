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

  async getPublishedCalendars() {
    try {
      const { data, error } = await supabase
        .from('academic_calendars')
        .select('semester_id, config, entries, updated_at, published_at')
        .eq('published', true)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (err) {
      console.error('academicCalendarService.getPublishedCalendars:', err);
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

  async publishCalendar(semesterId, config, entries) {
    try {
      const { data, error } = await supabase
        .from('academic_calendars')
        .upsert(
          {
            semester_id: semesterId,
            config,
            entries,
            published: true,
            published_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'semester_id' }
        )
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (err) {
      console.error('academicCalendarService.publishCalendar:', err);
      return { success: false, error: err.message };
    }
  },
};
