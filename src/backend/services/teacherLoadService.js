import { supabase } from '../config/supabaseClient.js';

/**
 * Per-semester teacher load.
 *
 * teachers.weekly_load_hours is a single column and cannot hold a different
 * value per semester — that is why rollover used to zero it out. Load now
 * lives in teacher_semester_load, one row per (teacher, semester), so each
 * semester carries its own figure and creating a new semester never disturbs
 * an older one's numbers.
 */

// Theory counts its credit hours; a lab period runs four times as long.
export async function computeWeeklyLoad(courseIds) {
  if (!courseIds || courseIds.length === 0) return 0;

  const { data, error } = await supabase
    .from('courses')
    .select('id, credit_hours, course_type')
    .in('id', courseIds);
  if (error) throw error;

  // credit_hours is NUMERIC (may arrive as a string) and can be fractional.
  // Round the aggregate load up: a partial credit hour still fills a slot,
  // and teacher_semester_load stores whole hours.
  const total = (data || []).reduce((sum, c) => {
    const hrs = Number(c.credit_hours) || 0;
    return sum + (c.course_type === 'lab' ? hrs * 4 : hrs);
  }, 0);
  return Math.ceil(total);
}

export async function saveSemesterLoad(semesterId, teacherId, weeklyLoad) {
  const { error } = await supabase
    .from('teacher_semester_load')
    .upsert(
      {
        semester_id:       semesterId,
        teacher_id:        teacherId,
        weekly_load_hours: weeklyLoad,
        updated_at:        new Date().toISOString(),
      },
      { onConflict: 'teacher_id,semester_id' }
    );
  if (error) throw error;
}

// teacher_id → weekly_load_hours for one semester. Teachers with no row yet
// are simply absent; callers default them to 0.
export async function getSemesterLoads(semesterId) {
  const { data, error } = await supabase
    .from('teacher_semester_load')
    .select('teacher_id, weekly_load_hours')
    .eq('semester_id', semesterId);
  if (error) throw error;

  const map = {};
  (data || []).forEach(r => { map[r.teacher_id] = r.weekly_load_hours || 0; });
  return map;
}
