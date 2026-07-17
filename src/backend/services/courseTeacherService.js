import { supabase } from '../config/supabaseClient.js';
import { computeWeeklyLoad, saveSemesterLoad } from './teacherLoadService.js';

// Update a single teacher's assigned_courses list and recalculate their load
// for this semester. isAdd=true → add courseId; isAdd=false → remove courseId.
async function syncOneTeacher(semesterId, teacherId, courseId, isAdd) {
  // 1. Read current preferences row for this semester
  const { data: pref } = await supabase
    .from('teacher_course_preferences')
    .select('*')
    .eq('semester_id', semesterId)
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
        semester_id:       semesterId,
        teacher_id:        teacherId,
        first_preference:  pref?.first_preference  ?? null,
        second_preference: pref?.second_preference ?? null,
        third_preference:  pref?.third_preference  ?? null,
        other_preferences: pref?.other_preferences ?? [],
        lab_preferences:   pref?.lab_preferences   ?? [],
        assigned_courses:  next,
      },
      { onConflict: 'semester_id,teacher_id' }
    );

  // 3. Recalculate this semester's load
  const weeklyLoad = await computeWeeklyLoad(next);
  await saveSemesterLoad(semesterId, teacherId, weeklyLoad);
}

export const courseTeacherService = {

  // Returns all rows in this semester that have at least one teacher assigned —
  // used to build the teacher→courses reverse map in the Teachers page.
  async getAllAssignments(semesterId) {
    try {
      if (!semesterId) return { success: false, error: 'semesterId is required.' };

      const { data, error } = await supabase
        .from('course_teacher_choices')
        .select('course_id, teacher_assignments')
        .eq('semester_id', semesterId)
        .neq('teacher_assignments', '[]');
      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (err) {
      console.error('courseTeacherService.getAllAssignments:', err);
      return { success: false, error: err.message };
    }
  },

  async getChoicesForCourses(semesterId, courseIds) {
    try {
      if (!semesterId) return { success: false, error: 'semesterId is required.' };
      if (!courseIds || courseIds.length === 0) {
        return { success: true, data: [] };
      }

      const { data, error } = await supabase
        .from('course_teacher_choices')
        .select('*')
        .eq('semester_id', semesterId)
        .in('course_id', courseIds);

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (err) {
      console.error('courseTeacherService.getChoicesForCourses:', err);
      return { success: false, error: err.message };
    }
  },

  async saveChoices(semesterId, courseId, choices) {
    try {
      if (!semesterId) return { success: false, error: 'semesterId is required.' };

      // 1. Read the current teacher_assignments before overwriting (needed to compute diff)
      const { data: current } = await supabase
        .from('course_teacher_choices')
        .select('teacher_assignments')
        .eq('semester_id', semesterId)
        .eq('course_id', courseId)
        .maybeSingle();

      const oldTeachers = current?.teacher_assignments || [];
      const newTeachers = choices.teacherAssignments   || [];

      // 2. Save the full choices row
      const { error } = await supabase
        .from('course_teacher_choices')
        .upsert(
          {
            semester_id:         semesterId,
            course_id:           courseId,
            history:             choices.history       || [],
            first_choice:        choices.firstChoice   || null,
            second_choice:       choices.secondChoice  || null,
            third_choice:        choices.thirdChoice   || null,
            other_choices:       choices.otherChoices  || [],
            teacher_assignments: newTeachers,
          },
          { onConflict: 'semester_id,course_id' }
        );

      if (error) throw error;

      // 3. Compute which teachers were added / removed
      const added   = newTeachers.filter(id => !oldTeachers.includes(id));
      const removed = oldTeachers.filter(id => !newTeachers.includes(id));

      // 4. Sync teacher_course_preferences + this semester's load for each changed teacher
      await Promise.all([
        ...added.map(tid   => syncOneTeacher(semesterId, tid, courseId, true)),
        ...removed.map(tid => syncOneTeacher(semesterId, tid, courseId, false)),
      ]);

      return { success: true };
    } catch (err) {
      console.error('courseTeacherService.saveChoices:', err);
      return { success: false, error: err.message };
    }
  },
};
