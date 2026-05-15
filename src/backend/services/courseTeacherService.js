import { supabase } from '../config/supabaseClient.js';

export const courseTeacherService = {

  async getChoicesForCourses(courseIds) {
    try {
      if (!courseIds || courseIds.length === 0) {
        return { success: true, data: [] };
      }
      const { data, error } = await supabase
        .from('course_teacher_choices')
        .select('*')
        .in('course_id', courseIds);

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (err) {
      console.error('courseTeacherService.getChoicesForCourses:', err);
      return { success: false, error: err.message };
    }
  },

  async saveChoices(courseId, choices) {
    try {
      const { error } = await supabase
        .from('course_teacher_choices')
        .upsert(
          {
            course_id: courseId,
            history: choices.history || [],
            first_choice: choices.firstChoice || null,
            second_choice: choices.secondChoice || null,
            third_choice: choices.thirdChoice || null,
            other_choices: choices.otherChoices || [],
            teacher_assignments: choices.teacherAssignments || [],
          },
          { onConflict: 'course_id' }
        );

      if (error) throw error;
      return { success: true };
    } catch (err) {
      console.error('courseTeacherService.saveChoices:', err);
      return { success: false, error: err.message };
    }
  },
};
