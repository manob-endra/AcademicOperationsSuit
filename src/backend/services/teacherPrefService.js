import { supabase } from '../config/supabaseClient.js';

export const teacherPrefService = {

  async getAllPreferences() {
    try {
      const { data, error } = await supabase
        .from('teacher_course_preferences')
        .select('*');
      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (err) {
      console.error('teacherPrefService.getAllPreferences:', err);
      return { success: false, error: err.message };
    }
  },

  async savePreferences(teacherId, prefs) {
    try {
      // 1. Upsert the preferences row
      const { error: prefError } = await supabase
        .from('teacher_course_preferences')
        .upsert(
          {
            teacher_id:        teacherId,
            first_preference:  prefs.firstPreference  || null,
            second_preference: prefs.secondPreference || null,
            third_preference:  prefs.thirdPreference  || null,
            other_preferences: prefs.otherPreferences || [],
            lab_preferences:   prefs.labPreferences   || [],
            assigned_courses:  prefs.assignedCourses  || [],
          },
          { onConflict: 'teacher_id' }
        );
      if (prefError) throw prefError;

      // 2. Recalculate weekly load from assigned courses
      const assignedIds = prefs.assignedCourses || [];
      let weeklyLoad = 0;
      if (assignedIds.length > 0) {
        const { data: courseData, error: courseError } = await supabase
          .from('courses')
          .select('id, credit_hours, course_type')
          .in('id', assignedIds);
        if (courseError) throw courseError;
        weeklyLoad = (courseData || []).reduce((sum, c) => {
          const hrs = c.credit_hours || 0;
          return sum + (c.course_type === 'lab' ? hrs * 4 : hrs);
        }, 0);
      }

      // 3. Persist the computed load to the teachers table
      const { error: loadError } = await supabase
        .from('teachers')
        .update({ weekly_load_hours: weeklyLoad })
        .eq('id', teacherId);
      if (loadError) throw loadError;

      return { success: true, weeklyLoad };
    } catch (err) {
      console.error('teacherPrefService.savePreferences:', err);
      return { success: false, error: err.message };
    }
  },
};
