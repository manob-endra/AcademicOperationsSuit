import { supabase } from '../config/supabaseClient.js';

/**
 * Class Time Settings Service
 * 
 * Handles all class time settings operations:
 * - Get settings
 * - Create settings
 * - Update settings
 */

export const classTimeSettingsService = {

  /**
   * Get the active class time settings for one semester
   * @returns {Promise<{success: boolean, settings?: object, error?: string}>}
   */
  async getSettings(semesterId) {
    try {
      if (!semesterId) return { success: false, error: 'semesterId is required.' };

      const { data, error } = await supabase
        .from('class_time_settings')
        .select('*')
        .eq('semester_id', semesterId)
        .eq('is_active', true)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      // If no settings exist, return null (not an error)
      if (!data) {
        return { success: true, settings: null };
      }

      // Transform database format to frontend format
      const settings = {
        startTime: data.start_time,
        duration: data.duration,
        classesBeforeLunch: data.classes_before_lunch,
        lunchDuration: data.lunch_duration,
        classesAfterLunch: data.classes_after_lunch,
        classDay: data.class_day,
        skipTime: `${data.skip_time} mins`,
        id: data.id
      };

      return { success: true, settings };
    } catch (error) {
      console.error('Get class time settings error:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Create or update class time settings for one semester
   * @param {object} settingsData - Settings data
   * @returns {Promise<{success: boolean, settings?: object, error?: string}>}
   */
  async saveSettings(semesterId, settingsData) {
    try {
      if (!semesterId) return { success: false, error: 'semesterId is required.' };

      // Use skipTime value as-is
      const skipTimeValue = typeof settingsData.skipTime === 'string'
        ? parseInt(settingsData.skipTime)
        : settingsData.skipTime;

      // Deactivate this semester's previous settings only — other semesters
      // keep their own active row.
      const { error: deactivateError } = await supabase
        .from('class_time_settings')
        .update({ is_active: false })
        .eq('semester_id', semesterId)
        .eq('is_active', true);

      if (deactivateError) throw deactivateError;

      // Transform frontend format to database format
      const dbData = {
        semester_id: semesterId,
        start_time: settingsData.startTime,
        duration: settingsData.duration,
        classes_before_lunch: settingsData.classesBeforeLunch,
        lunch_duration: settingsData.lunchDuration,
        classes_after_lunch: settingsData.classesAfterLunch,
        class_day: settingsData.classDay,
        skip_time: skipTimeValue,
        is_active: true
      };

      // Insert new settings
      const { data, error } = await supabase
        .from('class_time_settings')
        .insert([dbData])
        .select()
        .single();

      if (error) throw error;

      // Transform back to frontend format
      const settings = {
        startTime: data.start_time,
        duration: data.duration,
        classesBeforeLunch: data.classes_before_lunch,
        lunchDuration: data.lunch_duration,
        classesAfterLunch: data.classes_after_lunch,
        classDay: data.class_day,
        skipTime: `${data.skip_time} mins`,
        id: data.id
      };

      return { success: true, settings };
    } catch (error) {
      console.error('Save class time settings error:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Update existing settings
   * @param {string} settingsId - Settings ID
   * @param {object} updates - Settings updates
   * @returns {Promise<{success: boolean, settings?: object, error?: string}>}
   */
  async updateSettings(settingsId, updates) {
    try {
      // Transform frontend format to database format
      const dbUpdates = {};
      
      if (updates.startTime !== undefined) dbUpdates.start_time = updates.startTime;
      if (updates.duration !== undefined) dbUpdates.duration = updates.duration;
      if (updates.classesBeforeLunch !== undefined) dbUpdates.classes_before_lunch = updates.classesBeforeLunch;
      if (updates.lunchDuration !== undefined) dbUpdates.lunch_duration = updates.lunchDuration;
      if (updates.classesAfterLunch !== undefined) dbUpdates.classes_after_lunch = updates.classesAfterLunch;
      if (updates.classDay !== undefined) dbUpdates.class_day = updates.classDay;
      
      // Handle skipTime - save as-is
      if (updates.skipTime !== undefined && updates.skipTime !== null) {
        dbUpdates.skip_time = typeof updates.skipTime === 'string' 
          ? parseInt(updates.skipTime) 
          : updates.skipTime;
      }

      console.log('Service: updateSettings received skipTime:', {
        input: updates.skipTime,
        saving: dbUpdates.skip_time
      });
      console.log('Service: Updating class time settings:', dbUpdates);

      const { data, error } = await supabase
        .from('class_time_settings')
        .update(dbUpdates)
        .eq('id', settingsId)
        .select()
        .single();

      if (error) throw error;

      console.log('Service: Settings updated successfully:', data);

      // Transform back to frontend format
      const settings = {
        startTime: data.start_time,
        duration: data.duration,
        classesBeforeLunch: data.classes_before_lunch,
        lunchDuration: data.lunch_duration,
        classesAfterLunch: data.classes_after_lunch,
        classDay: data.class_day,
        skipTime: `${data.skip_time} mins`,
        id: data.id
      };

      console.log('Service: Returning updated settings:', settings);
      return { success: true, settings };
    } catch (error) {
      console.error('Update class time settings error:', error);
      return { success: false, error: error.message };
    }
  }
};
