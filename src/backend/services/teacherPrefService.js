import { supabase } from '../config/supabaseClient.js';

// Update a single course's teacher_assignments list when a teacher is added/removed
// via the Teacher Preferences page. isAdd=true → add teacher; isAdd=false → remove.
async function syncOneCourse(courseId, teacherId, isAdd) {
  const { data: current } = await supabase
    .from('course_teacher_choices')
    .select('*')
    .eq('course_id', courseId)
    .maybeSingle();

  const oldAssigned = current?.teacher_assignments || [];
  const newAssigned = isAdd
    ? [...new Set([...oldAssigned, teacherId])]
    : oldAssigned.filter(id => id !== teacherId);

  await supabase
    .from('course_teacher_choices')
    .upsert(
      {
        course_id:           courseId,
        history:             current?.history       || [],
        first_choice:        current?.first_choice  ?? null,
        second_choice:       current?.second_choice ?? null,
        third_choice:        current?.third_choice  ?? null,
        other_choices:       current?.other_choices || [],
        teacher_assignments: newAssigned,
      },
      { onConflict: 'course_id' }
    );
}

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
      // 1. Read old assigned_courses before overwriting (needed to compute diff)
      const { data: existing } = await supabase
        .from('teacher_course_preferences')
        .select('assigned_courses')
        .eq('teacher_id', teacherId)
        .maybeSingle();

      const oldCourses = existing?.assigned_courses || [];
      const newCourses = prefs.assignedCourses      || [];

      // 2. Upsert the preferences row
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
            assigned_courses:  newCourses,
          },
          { onConflict: 'teacher_id' }
        );
      if (prefError) throw prefError;

      // 3. Recalculate weekly load from assigned courses
      let weeklyLoad = 0;
      if (newCourses.length > 0) {
        const { data: courseData, error: courseError } = await supabase
          .from('courses')
          .select('id, credit_hours, course_type')
          .in('id', newCourses);
        if (courseError) throw courseError;
        weeklyLoad = (courseData || []).reduce((sum, c) => {
          const hrs = c.credit_hours || 0;
          return sum + (c.course_type === 'lab' ? hrs * 4 : hrs);
        }, 0);
      }

      // 4. Persist the computed load to the teachers table
      const { error: loadError } = await supabase
        .from('teachers')
        .update({ weekly_load_hours: weeklyLoad })
        .eq('id', teacherId);
      if (loadError) throw loadError;

      // 5. Sync course_teacher_choices.teacher_assignments for changed courses
      const added   = newCourses.filter(id => !oldCourses.includes(id));
      const removed = oldCourses.filter(id => !newCourses.includes(id));

      await Promise.all([
        ...added.map(cid   => syncOneCourse(cid, teacherId, true)),
        ...removed.map(cid => syncOneCourse(cid, teacherId, false)),
      ]);

      return { success: true, weeklyLoad };
    } catch (err) {
      console.error('teacherPrefService.savePreferences:', err);
      return { success: false, error: err.message };
    }
  },
};
