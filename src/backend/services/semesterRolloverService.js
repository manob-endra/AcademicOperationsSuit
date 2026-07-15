import { supabase } from '../config/supabaseClient.js';

/**
 * Semester Rollover Service
 *
 * When the admin creates a new academic semester with rollover enabled,
 * the current working data is refreshed for the new semester:
 *   • course→teacher assignments are archived to course_history (so past
 *     teachers keep showing in each course's history) and merged into the
 *     allocation page's "History" tag list
 *   • teacher choices/preferences, teacher weekly loads, teacher time
 *     slots, course durations, class time settings, classroom clusters,
 *     room allocation, the home-page semester selection and the generated
 *     routine are all cleared
 *
 * The course catalog and teacher records themselves are kept.
 */

// Archive current course→teacher assignments into course_history and
// reset course_teacher_choices for the new semester.
async function archiveCourseAssignments(semesterLabel) {
  const { data: choices, error: choicesErr } = await supabase
    .from('course_teacher_choices')
    .select('course_id, history, teacher_assignments');
  if (choicesErr) throw choicesErr;

  const rows = choices || [];
  const assignedRows = rows.filter(
    r => Array.isArray(r.teacher_assignments) && r.teacher_assignments.length > 0
  );

  // Look up course + teacher display data for the archive (denormalized)
  const courseIds  = assignedRows.map(r => r.course_id);
  const teacherIds = [...new Set(assignedRows.flatMap(r => r.teacher_assignments))];

  const [coursesRes, teachersRes] = await Promise.all([
    courseIds.length
      ? supabase.from('courses').select('id, code, title').in('id', courseIds)
      : Promise.resolve({ data: [] }),
    teacherIds.length
      ? supabase.from('teachers').select('id, name, initials').in('id', teacherIds)
      : Promise.resolve({ data: [] }),
  ]);

  const courseMap  = new Map((coursesRes.data  || []).map(c => [c.id, c]));
  const teacherMap = new Map((teachersRes.data || []).map(t => [t.id, t]));

  // 1. Write one history row per course that had assigned teachers
  if (assignedRows.length > 0) {
    const historyRows = assignedRows.map(r => ({
      course_id:      String(r.course_id),
      course_code:    courseMap.get(r.course_id)?.code  ?? null,
      course_title:   courseMap.get(r.course_id)?.title ?? null,
      semester_label: semesterLabel,
      teacher_ids:    r.teacher_assignments,
      teacher_names:  r.teacher_assignments.map(id => {
        const t = teacherMap.get(id);
        return t ? (t.name || t.initials || id) : id;
      }),
    }));

    const { error: histErr } = await supabase
      .from('course_history')
      .insert(historyRows);
    if (histErr) throw histErr;
  }

  // 2. Reset every choices row: past teachers merge into the "History"
  //    tag list, all choices and assignments are cleared
  if (rows.length > 0) {
    const resetRows = rows.map(r => ({
      course_id:           r.course_id,
      history:             [...new Set([...(r.history || []), ...(r.teacher_assignments || [])])],
      first_choice:        null,
      second_choice:       null,
      third_choice:        null,
      other_choices:       [],
      teacher_assignments: [],
    }));

    const { error: resetErr } = await supabase
      .from('course_teacher_choices')
      .upsert(resetRows, { onConflict: 'course_id' });
    if (resetErr) throw resetErr;
  }

  return assignedRows.length;
}

// Clear a whole table (supabase requires a filter on delete)
async function clearTable(table, keyColumn) {
  const { error } = await supabase
    .from(table)
    .delete()
    .not(keyColumn, 'is', null);
  if (error) throw new Error(`${table}: ${error.message}`);
}

export const semesterRolloverService = {

  /**
   * Perform the full rollover. `semesterLabel` names the period being
   * archived (the outgoing semester), e.g. 'Spring 2026'.
   * Returns a summary of what was archived/reset.
   */
  async performRollover(semesterLabel) {
    try {
      // Fail fast if the migration hasn't been applied — never start
      // clearing data unless the archive table is available.
      const { error: probeErr } = await supabase
        .from('course_history')
        .select('id')
        .limit(1);
      if (probeErr) {
        return {
          success: false,
          error: 'Database migration required: run migrations/semester_rollover.sql in the Supabase SQL editor first.',
        };
      }

      const archivedCourses = await archiveCourseAssignments(semesterLabel);

      // Teacher-side resets
      await clearTable('teacher_course_preferences', 'teacher_id'); // teacher preferences
      await clearTable('teacher_availability', 'teacher_id');       // teacher time slots

      const { error: loadErr } = await supabase                     // teacher load
        .from('teachers')
        .update({ weekly_load_hours: 0 })
        .not('id', 'is', null);
      if (loadErr) throw new Error(`teachers: ${loadErr.message}`);

      // Course/timing resets
      await clearTable('course_durations', 'course_id');            // course time
      await clearTable('class_time_settings', 'id');                // time slot settings

      // Room resets
      await clearTable('cluster_distances', 'cluster1_id');         // classroom distances
      await clearTable('classroom_clusters', 'id');                 // classrooms
      await clearTable('room_allocation', 'id');                    // room allocation

      // Workspace resets
      await clearTable('semester_selection', 'id');                 // selected semesters
      await clearTable('routine_storage', 'id');                    // generated routine

      return { success: true, archivedCourses, semesterLabel };
    } catch (err) {
      console.error('semesterRolloverService.performRollover:', err);
      return { success: false, error: err.message };
    }
  },
};
