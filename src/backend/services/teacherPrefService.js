import { supabase } from '../config/supabaseClient.js';
import { computeWeeklyLoad, saveSemesterLoad } from './teacherLoadService.js';

// Update a single course's teacher_assignments list when a teacher is added/removed
// via the Teacher Preferences page. isAdd=true → add teacher; isAdd=false → remove.
async function syncOneCourse(semesterId, courseId, teacherId, isAdd) {
  const { data: current } = await supabase
    .from('course_teacher_choices')
    .select('*')
    .eq('semester_id', semesterId)
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
        semester_id:         semesterId,
        course_id:           courseId,
        history:             current?.history       || [],
        first_choice:        current?.first_choice  ?? null,
        second_choice:       current?.second_choice ?? null,
        third_choice:        current?.third_choice  ?? null,
        other_choices:       current?.other_choices || [],
        teacher_assignments: newAssigned,
      },
      { onConflict: 'semester_id,course_id' }
    );
}

export const teacherPrefService = {

  async getAllPreferences(semesterId) {
    try {
      if (!semesterId) return { success: false, error: 'semesterId is required.' };

      const { data, error } = await supabase
        .from('teacher_course_preferences')
        .select('*')
        .eq('semester_id', semesterId);
      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (err) {
      console.error('teacherPrefService.getAllPreferences:', err);
      return { success: false, error: err.message };
    }
  },

  async savePreferences(semesterId, teacherId, prefs) {
    try {
      if (!semesterId) return { success: false, error: 'semesterId is required.' };

      // 1. Read old assigned_courses before overwriting (needed to compute diff)
      const { data: existing } = await supabase
        .from('teacher_course_preferences')
        .select('assigned_courses')
        .eq('semester_id', semesterId)
        .eq('teacher_id', teacherId)
        .maybeSingle();

      const oldCourses = existing?.assigned_courses || [];
      const newCourses = prefs.assignedCourses      || [];

      // 2. Upsert the preferences row
      const { error: prefError } = await supabase
        .from('teacher_course_preferences')
        .upsert(
          {
            semester_id:       semesterId,
            teacher_id:        teacherId,
            first_preference:  prefs.firstPreference  || null,
            second_preference: prefs.secondPreference || null,
            third_preference:  prefs.thirdPreference  || null,
            other_preferences: prefs.otherPreferences || [],
            lab_preferences:   prefs.labPreferences   || [],
            assigned_courses:  newCourses,
          },
          { onConflict: 'semester_id,teacher_id' }
        );
      if (prefError) throw prefError;

      // 3. Recalculate this semester's load from the assigned courses
      const weeklyLoad = await computeWeeklyLoad(newCourses);
      await saveSemesterLoad(semesterId, teacherId, weeklyLoad);

      // 4. Sync course_teacher_choices.teacher_assignments for changed courses
      const added   = newCourses.filter(id => !oldCourses.includes(id));
      const removed = oldCourses.filter(id => !newCourses.includes(id));

      await Promise.all([
        ...added.map(cid   => syncOneCourse(semesterId, cid, teacherId, true)),
        ...removed.map(cid => syncOneCourse(semesterId, cid, teacherId, false)),
      ]);

      return { success: true, weeklyLoad };
    } catch (err) {
      console.error('teacherPrefService.savePreferences:', err);
      return { success: false, error: err.message };
    }
  },
};
