import { supabase } from '../config/supabaseClient.js';

// Update a single teacher's assigned_courses list and recalculate weekly_load_hours.
// isAdd=true → add courseId; isAdd=false → remove courseId.
async function syncOneTeacher(teacherId, courseId, isAdd) {
  // 1. Read current preferences row
  const { data: pref } = await supabase
    .from('teacher_course_preferences')
    .select('*')
    .eq('teacher_id', teacherId)
    .maybeSingle();

  const prev = pref?.assigned_courses || [];
  const next = isAdd
    ? [...new Set([...prev, courseId])]
    : prev.filter(id => id !== courseId);

  // 2. Upsert preferences with the updated course list
  await supabase
    .from('teacher_course_preferences')
    .upsert(
      {
        teacher_id:        teacherId,
        first_preference:  pref?.first_preference  ?? null,
        second_preference: pref?.second_preference ?? null,
        third_preference:  pref?.third_preference  ?? null,
        other_preferences: pref?.other_preferences ?? [],
        lab_preferences:   pref?.lab_preferences   ?? [],
        assigned_courses:  next,
      },
      { onConflict: 'teacher_id' }
    );

  // 3. Recalculate weekly load from all assigned courses
  let weeklyLoad = 0;
  if (next.length > 0) {
    const { data: courseData } = await supabase
      .from('courses')
      .select('id, credit_hours, course_type')
      .in('id', next);
    weeklyLoad = (courseData || []).reduce((sum, c) => {
      const hrs = c.credit_hours || 0;
      return sum + (c.course_type === 'lab' ? hrs * 4 : hrs);
    }, 0);
  }

  // 4. Persist the computed load to teachers table
  await supabase
    .from('teachers')
    .update({ weekly_load_hours: weeklyLoad })
    .eq('id', teacherId);
}

export const courseTeacherService = {

  // Returns all rows that have at least one teacher assigned — used to build
  // the teacher→courses reverse map in the Teachers page.
  async getAllAssignments() {
    try {
      const { data, error } = await supabase
        .from('course_teacher_choices')
        .select('course_id, teacher_assignments')
        .neq('teacher_assignments', '[]');
      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (err) {
      console.error('courseTeacherService.getAllAssignments:', err);
      return { success: false, error: err.message };
    }
  },

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
      // 1. Read the current teacher_assignments before overwriting (needed to compute diff)
      const { data: current } = await supabase
        .from('course_teacher_choices')
        .select('teacher_assignments')
        .eq('course_id', courseId)
        .maybeSingle();

      const oldTeachers = current?.teacher_assignments || [];
      const newTeachers = choices.teacherAssignments   || [];

      // 2. Save the full choices row
      const { error } = await supabase
        .from('course_teacher_choices')
        .upsert(
          {
            course_id:           courseId,
            history:             choices.history       || [],
            first_choice:        choices.firstChoice   || null,
            second_choice:       choices.secondChoice  || null,
            third_choice:        choices.thirdChoice   || null,
            other_choices:       choices.otherChoices  || [],
            teacher_assignments: newTeachers,
          },
          { onConflict: 'course_id' }
        );

      if (error) throw error;

      // 3. Compute which teachers were added / removed
      const added   = newTeachers.filter(id => !oldTeachers.includes(id));
      const removed = oldTeachers.filter(id => !newTeachers.includes(id));

      // 4. Sync teacher_course_preferences + weekly_load_hours for each changed teacher
      await Promise.all([
        ...added.map(tid   => syncOneTeacher(tid, courseId, true)),
        ...removed.map(tid => syncOneTeacher(tid, courseId, false)),
      ]);

      return { success: true };
    } catch (err) {
      console.error('courseTeacherService.saveChoices:', err);
      return { success: false, error: err.message };
    }
  },
};
