import { supabase } from '../config/supabaseClient.js';

/**
 * Semester Rollover Service
 *
 * Rollover prepares a NEW semester. It never modifies the semesters that
 * came before it — routine generation runs for months (teachers submit
 * choices, allocation is negotiated), so an admin must be able to start
 * next semester's routine while the current one is still in use.
 *
 * Every routine table is scoped by semester_id, so the new semester starts
 * empty by construction: no rows carry its id yet. Rollover only ADDS rows:
 *
 *   • course_history        — a snapshot of who taught what in the previous
 *                             semester (denormalized, survives deletions)
 *   • course_teacher_choices— one row per course for the new semester, with
 *                             past teachers carried in `history` (the tags
 *                             the allocation page shows) and choices empty
 *   • class_time_settings   — copied from the previous semester
 *   • course_durations      — copied from the previous semester
 *   • room_allocation       — copied from the previous semester
 *
 * Settings are copied because they rarely change between semesters and
 * re-entering them every time is pure toil. Anything representing actual
 * routine work — teacher preferences, availability, assignments, the
 * generated routine — is deliberately NOT copied and starts empty.
 */

// Snapshot the previous semester's assignments into course_history.
// Reads only; the source rows stay exactly as they are.
async function archivePreviousAssignments(prevSemesterId, semesterLabel) {
  const { data: choices, error } = await supabase
    .from('course_teacher_choices')
    .select('course_id, history, teacher_assignments')
    .eq('semester_id', prevSemesterId);
  if (error) throw error;

  const rows = choices || [];
  const assignedRows = rows.filter(
    r => Array.isArray(r.teacher_assignments) && r.teacher_assignments.length > 0
  );
  if (assignedRows.length === 0) return { archived: 0, rows };

  // Denormalize course + teacher display data so history survives deletions
  const courseIds  = assignedRows.map(r => r.course_id);
  const teacherIds = [...new Set(assignedRows.flatMap(r => r.teacher_assignments))];

  const [coursesRes, teachersRes] = await Promise.all([
    supabase.from('courses').select('id, code, title').in('id', courseIds),
    supabase.from('teachers').select('id, name, initials').in('id', teacherIds),
  ]);

  const courseMap  = new Map((coursesRes.data  || []).map(c => [c.id, c]));
  const teacherMap = new Map((teachersRes.data || []).map(t => [t.id, t]));

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

  const { error: histErr } = await supabase.from('course_history').insert(historyRows);
  if (histErr) throw histErr;

  return { archived: historyRows.length, rows };
}

// Seed the new semester's choices rows: teachers who taught the course
// before are merged into `history` (shown as tags on the allocation page),
// while the choices and assignments themselves start empty.
async function seedChoices(newSemesterId, prevRows) {
  if (!prevRows.length) return 0;

  const seeded = prevRows.map(r => ({
    semester_id:         newSemesterId,
    course_id:           r.course_id,
    history:             [...new Set([...(r.history || []), ...(r.teacher_assignments || [])])],
    first_choice:        null,
    second_choice:       null,
    third_choice:        null,
    other_choices:       [],
    teacher_assignments: [],
  }));

  const { error } = await supabase
    .from('course_teacher_choices')
    .upsert(seeded, { onConflict: 'semester_id,course_id' });
  if (error) throw error;
  return seeded.length;
}

// Copy rows of `table` from one semester to another, dropping the primary
// key so the database generates a fresh one. `onlyActive` restricts to
// is_active rows — class_time_settings keeps deactivated history rows
// around, and only the live one should carry forward.
async function copyRows(table, prevSemesterId, newSemesterId, conflictKey, onlyActive = false) {
  let query = supabase.from(table).select('*').eq('semester_id', prevSemesterId);
  if (onlyActive) query = query.eq('is_active', true);
  const { data, error } = await query;
  if (error) throw new Error(`${table}: ${error.message}`);
  if (!data || data.length === 0) return 0;

  const rows = data.map(({ id, created_at, updated_at, ...rest }) => ({
    ...rest,
    semester_id: newSemesterId,
  }));

  const { error: insErr } = await supabase
    .from(table)
    .upsert(rows, { onConflict: conflictKey });
  if (insErr) throw new Error(`${table}: ${insErr.message}`);
  return rows.length;
}

export const semesterRolloverService = {

  /**
   * Seed `newSemesterId` from `prevSemesterId`.
   *
   * `semesterLabel` names the semester being archived FROM (e.g. 'Spring 2026')
   * and is what appears in each course's History.
   *
   * Nothing belonging to prevSemesterId is written to.
   */
  async performRollover(newSemesterId, prevSemesterId, semesterLabel) {
    try {
      // Fail before writing anything if the archive table is missing.
      const { error: probeErr } = await supabase
        .from('course_history')
        .select('id')
        .limit(1);
      if (probeErr) {
        return {
          success: false,
          error: 'Database migration required: run migrations/semester_rollover.sql and migrations/per_semester_routine.sql in the Supabase SQL editor first.',
        };
      }

      // First semester ever — nothing to carry forward, and that is fine.
      if (!prevSemesterId) {
        return { success: true, archivedCourses: 0, seededCourses: 0, copiedSettings: false, semesterLabel };
      }

      const { archived, rows } = await archivePreviousAssignments(prevSemesterId, semesterLabel);
      const seededCourses = await seedChoices(newSemesterId, rows);

      // Settings carried forward as a starting point (rarely change).
      const copied = await Promise.all([
        copyRows('class_time_settings', prevSemesterId, newSemesterId, 'id', true),
        copyRows('course_durations',    prevSemesterId, newSemesterId, 'semester_id,course_id'),
        copyRows('room_allocation',     prevSemesterId, newSemesterId, 'semester_id'),
      ]);

      return {
        success: true,
        archivedCourses: archived,
        seededCourses,
        copiedSettings: copied.some(n => n > 0),
        semesterLabel,
      };
    } catch (err) {
      console.error('semesterRolloverService.performRollover:', err);
      return { success: false, error: err.message };
    }
  },
};
