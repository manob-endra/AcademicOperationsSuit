import { supabase } from '../config/supabaseClient.js';
import { generateWithGA } from './routineGA/index.js';

// Fixed UUID used as the single-row primary key for routine_storage.
// routine_storage is a purpose-built single-row JSONB table (the original
// `routines` table has a NOT NULL day_of_week constraint that blocks this pattern).
const ROUTINE_ROW_ID = '00000000-0000-0000-0000-000000000001';
const ROUTINE_TABLE  = 'routine_storage';

const WEEK_DAYS = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

// Maps compact semester IDs (stored in semester_selection) to the year/semester
// text values stored in the courses table.
const SEMESTER_MAP = {
  'Y1-S1': { year: '1st Year', semester: '1st Semester' },
  'Y1-S2': { year: '1st Year', semester: '2nd Semester' },
  'Y2-S1': { year: '2nd Year', semester: '1st Semester' },
  'Y2-S2': { year: '2nd Year', semester: '2nd Semester' },
  'Y3-S1': { year: '3rd Year', semester: '1st Semester' },
  'Y3-S2': { year: '3rd Year', semester: '2nd Semester' },
  'Y4-S1': { year: '4th Year', semester: '1st Semester' },
  'Y4-S2': { year: '4th Year', semester: '2nd Semester' },
  'MS-S1': { year: 'Master',   semester: '1st Semester' },
  'MS-S2': { year: 'Master',   semester: '2nd Semester' },
};

// Reverse lookup: "2nd Year|1st Semester" → "Y2-S1"
const REVERSE_SEMESTER_MAP = {};
for (const [id, { year, semester }] of Object.entries(SEMESTER_MAP)) {
  REVERSE_SEMESTER_MAP[`${year}|${semester}`] = id;
}

// Given a course row (has .year and .semester text fields), return the compact ID
function courseToSemId(course) {
  return REVERSE_SEMESTER_MAP[`${course.year}|${course.semester}`] || null;
}

// Filter courses that belong to the given selected semester IDs
function filterCoursesBySemesters(courses, selectedSemesterIds) {
  const pairs = selectedSemesterIds.map(id => SEMESTER_MAP[id]).filter(Boolean);
  if (pairs.length === 0) return [];
  return courses.filter(c =>
    pairs.some(p => c.year === p.year && c.semester === p.semester)
  );
}

// Parse "Sunday-Thursday" → ["Sunday","Monday","Tuesday","Wednesday","Thursday"]
function getWorkingDays(classDayStr) {
  if (!classDayStr || typeof classDayStr !== 'string') return [];
  const parts = classDayStr.split('-').map(s => s.trim());
  if (parts.length < 2) return [];
  const startIdx = WEEK_DAYS.indexOf(parts[0]);
  const endIdx   = WEEK_DAYS.indexOf(parts[1]);
  if (startIdx === -1 || endIdx === -1) return [];
  const days = [];
  let cur = startIdx;
  while (true) {
    days.push(WEEK_DAYS[cur]);
    if (cur === endIdx) break;
    cur = (cur + 1) % WEEK_DAYS.length;
  }
  return days;
}

export const routineService = {

  async _loadData() {
    const [
      settingsRes,
      semRes,
      coursesRes,
      durRes,
      roomsRes,
      teachersRes,
      availRes,
      ctChoicesRes,
    ] = await Promise.all([
      supabase.from('class_time_settings').select('*').eq('is_active', true).maybeSingle(),
      supabase.from('semester_selection').select('selected_semesters').eq('id', 1).maybeSingle(),
      supabase.from('courses').select('id,code,title,course_type,year,semester,credit_hours,is_exceptional').eq('is_active', true),
      supabase.from('course_durations').select('course_id,duration_periods,weekly_classes'),
      supabase.from('room_allocation').select('theory_rooms,lab_rooms,semester_theory_rooms').eq('id', 1).maybeSingle(),
      supabase.from('teachers').select('id,name,initials,designation,load_limit,weekly_load_hours').eq('is_active', true),
      supabase.from('teacher_availability').select('teacher_id,day_of_week,slot_id'),
      supabase.from('course_teacher_choices').select('course_id,teacher_assignments'),
    ]);

    return {
      settings: settingsRes.data || null,
      selectedSemesters: semRes.data?.selected_semesters ?? [],
      courses: coursesRes.data || [],
      durations: durRes.data || [],
      rooms: roomsRes.data || { theory_rooms: [], lab_rooms: [], semester_theory_rooms: {} },
      teachers: teachersRes.data || [],
      availability: availRes.data || [],
      courseTeacherChoices: ctChoicesRes.data || [],
    };
  },

  async checkConflicts() {
    try {
      const d = await this._loadData();
      const conflicts = [];

      // 1. No class time settings
      if (!d.settings) {
        conflicts.push({
          id: 'no_settings',
          severity: 'error',
          message: 'No class time settings configured.',
          hint: 'Configure class periods in Time Slot Settings.',
          navigateTo: 'timeslot',
        });
        return { success: true, conflicts };
      }

      const classesBeforeLunch = d.settings.classes_before_lunch || 0;
      const classesAfterLunch  = d.settings.classes_after_lunch  || 0;
      const classDay           = d.settings.class_day;

      // class_day is stored as "Sunday-Thursday" — derive the actual day list
      const activeDays = getWorkingDays(classDay);
      const slotCount  = classesBeforeLunch + classesAfterLunch;
      const totalAvailableSlots = activeDays.length * slotCount;

      if (activeDays.length === 0) {
        conflicts.push({
          id: 'no_days',
          severity: 'error',
          message: `Working days could not be determined from class time settings (got: "${classDay || 'none'}").`,
          hint: 'Set the Class Day range (e.g. Sunday-Thursday) in Time Slot Settings.',
          navigateTo: 'timeslot',
        });
      }

      if (slotCount === 0) {
        conflicts.push({
          id: 'no_periods',
          severity: 'error',
          message: 'No class periods configured (classes before + after lunch = 0).',
          hint: 'Set class periods in Time Slot Settings.',
          navigateTo: 'timeslot',
        });
      }

      // 2. No semesters selected
      if (!d.selectedSemesters.length) {
        conflicts.push({
          id: 'no_semesters',
          severity: 'error',
          message: 'No semesters selected for routine generation.',
          hint: 'Go to Home page to select semesters.',
          navigateTo: 'home',
        });
      }

      // Match courses by year+semester text, excluding exceptional courses
      const selCourses = filterCoursesBySemesters(d.courses, d.selectedSemesters)
        .filter(c => !c.is_exceptional);

      if (d.selectedSemesters.length > 0 && selCourses.length === 0) {
        const labels = d.selectedSemesters.map(id => {
          const p = SEMESTER_MAP[id];
          return p ? `${p.year} • ${p.semester}` : id;
        });
        conflicts.push({
          id: 'no_courses',
          severity: 'error',
          message: `No active courses found for: ${labels.join(', ')}.`,
          hint: 'Add courses in Course Management and mark them active. Course year/semester must match the selection.',
          navigateTo: 'courses',
        });
      }

      // Build lookup maps
      // weeklyMap = weekly_classes (how many times/week to schedule); falls back to duration_periods
      const durMap     = {};
      const weeklyMap  = {};
      d.durations.forEach(x => {
        durMap[x.course_id]    = x.duration_periods;
        weeklyMap[x.course_id] = x.weekly_classes ?? x.duration_periods;
      });

      const ctMap = {};
      d.courseTeacherChoices.forEach(x => { ctMap[x.course_id] = x.teacher_assignments || []; });

      const teacherMap = {};
      d.teachers.forEach(t => { teacherMap[t.id] = t; });

      const availMap = {};
      d.availability.forEach(a => {
        if (!availMap[a.teacher_id]) availMap[a.teacher_id] = new Set();
        availMap[a.teacher_id].add(`${a.day_of_week}-${a.slot_id}`);
      });

      const theoryRooms        = d.rooms.theory_rooms        || [];
      const labRooms           = d.rooms.lab_rooms           || [];
      const semesterTheoryRooms = d.rooms.semester_theory_rooms || {};

      const hasLabCourses    = selCourses.some(c => c.course_type === 'lab');
      const hasTheoryCourses = selCourses.some(c => c.course_type !== 'lab');

      if (hasTheoryCourses && theoryRooms.length === 0) {
        conflicts.push({
          id: 'no_theory_rooms',
          severity: 'error',
          message: 'No theory rooms configured but theory courses exist.',
          hint: 'Add theory rooms in Room Allocation.',
          navigateTo: 'allocation',
        });
      }

      if (hasLabCourses && labRooms.length === 0) {
        conflicts.push({
          id: 'no_lab_rooms',
          severity: 'error',
          message: 'No lab rooms configured but lab courses exist.',
          hint: 'Add lab rooms in Room Allocation.',
          navigateTo: 'allocation',
        });
      }

      const periodsPerSem  = {}; // semId → total weekly periods needed
      const teacherPeriods = {};
      const seenSemRooms   = new Set();
      const seenNoAvail    = new Set();

      for (const course of selCourses) {
        // Credit hours
        if (!course.credit_hours) {
          conflicts.push({
            id: `no_credit_${course.id}`,
            severity: 'warning',
            message: `"${course.code} – ${course.title}" has no credit hours set.`,
            hint: 'Edit the course to add credit hours.',
            navigateTo: 'courses',
          });
        }

        // Weekly classes / duration
        if (!weeklyMap[course.id]) {
          conflicts.push({
            id: `no_weekly_${course.id}`,
            severity: 'error',
            message: `"${course.code} – ${course.title}" has no weekly classes set.`,
            hint: 'Set weekly classes (and duration) in Time Slot → Course Duration.',
            navigateTo: 'timeslot',
          });
        } else {
          // Accumulate per-semester period totals
          const semKey = courseToSemId(course) || `${course.year}|${course.semester}`;
          periodsPerSem[semKey] = (periodsPerSem[semKey] || 0) + weeklyMap[course.id];
        }

        // Teacher assignment
        const assignedTeachers = ctMap[course.id] || [];
        if (assignedTeachers.length === 0) {
          conflicts.push({
            id: `no_teacher_${course.id}`,
            severity: 'error',
            message: `[${course.semester}] "${course.code} – ${course.title}" has no teacher assigned.`,
            hint: 'Go to Allocation → Course Teacher and assign a teacher to this course.',
            navigateTo: 'allocation',
          });
        } else {
          const tid = assignedTeachers[0];
          if (!teacherMap[tid]) {
            conflicts.push({
              id: `teacher_inactive_${course.id}`,
              severity: 'error',
              message: `[${course.semester}] "${course.code} – ${course.title}" — assigned teacher is inactive or deleted.`,
              hint: 'Re-assign an active teacher to this course in Course Teacher Allocation.',
              navigateTo: 'allocation',
            });
          } else {
            if (!teacherPeriods[tid]) teacherPeriods[tid] = 0;
            teacherPeriods[tid] += weeklyMap[course.id] || 0;

            // Teacher availability
            const avail = availMap[tid];
            if ((!avail || avail.size === 0) && !seenNoAvail.has(tid)) {
              seenNoAvail.add(tid);
              conflicts.push({
                id: `teacher_no_avail_${tid}`,
                severity: 'error',
                message: `Teacher "${teacherMap[tid].name}" has no available time slots configured.`,
                hint: 'Go to Teachers → select teacher → set their available days and slots.',
                navigateTo: 'teacher',
              });
            }
          }
        }

        // Semester room (theory only) — room_allocation uses compact IDs as keys
        if (course.course_type !== 'lab' && theoryRooms.length > 0) {
          const semId = courseToSemId(course);
          const semKey = semId || `${course.year}|${course.semester}`;
          if (!semesterTheoryRooms[semId] && !seenSemRooms.has(semKey)) {
            seenSemRooms.add(semKey);
            conflicts.push({
              id: `no_sem_room_${semKey}`,
              severity: 'error',
              message: `"${course.year} • ${course.semester}" has no theory room assigned.`,
              hint: 'Assign a classroom to this semester in Allocation → Room Allocation.',
              navigateTo: 'allocation',
            });
          }
        }
      }

      // Teacher overload (periods needed vs available slots)
      for (const [tid, needed] of Object.entries(teacherPeriods)) {
        const avail = availMap[tid]?.size || 0;
        if (avail > 0 && needed > avail) {
          conflicts.push({
            id: `teacher_overloaded_${tid}`,
            severity: 'error',
            message: `Teacher "${teacherMap[tid]?.name}" needs ${needed} periods but only has ${avail} available slots.`,
            hint: 'Add more availability slots or reassign some courses.',
            navigateTo: 'teacher',
          });
        }
      }

      // Per-semester slot capacity check
      // Each semester runs in its own room, so each must independently fit within
      // the weekly slot capacity (activeDays × slotCount).
      if (totalAvailableSlots > 0) {
        for (const [semKey, needed] of Object.entries(periodsPerSem)) {
          const p     = SEMESTER_MAP[semKey];
          const label = p ? `${p.year} • ${p.semester}` : semKey;

          if (needed > totalAvailableSlots) {
            conflicts.push({
              id:       `sem_overloaded_${semKey}`,
              severity: 'error',
              message:  `"${label}" requires ${needed} periods/week but only ${totalAvailableSlots} slots are available (${activeDays.length} day${activeDays.length !== 1 ? 's' : ''} × ${slotCount} period${slotCount !== 1 ? 's' : ''}).`,
              hint:     `Reduce weekly classes for courses in this semester, or increase working days/periods in Time Slot Settings.`,
              navigateTo: 'timeslot',
            });
          } else {
            conflicts.push({
              id:       `sem_capacity_ok_${semKey}`,
              severity: 'info',
              message:  `"${label}" uses ${needed} of ${totalAvailableSlots} available slots/week.`,
            });
          }
        }
      }

      return { success: true, conflicts };
    } catch (err) {
      console.error('routineService.checkConflicts:', err);
      return { success: false, error: err.message };
    }
  },

  /**
   * Generate a routine PREVIEW with the memetic GA (does NOT persist —
   * the admin reviews the preview and saves it explicitly via saveRoutine).
   * `options.seed` makes a run reproducible.
   */
  async generateRoutine(options = {}) {
    try {
      const d = await this._loadData();

      if (!d.settings) {
        return { success: false, error: 'No class time settings configured.' };
      }
      if (!d.selectedSemesters.length) {
        return { success: false, error: 'No semesters selected for routine generation.' };
      }

      let { entries, report } = generateWithGA(d, { seed: options.seed });

      // Stochastic search: if an unseeded run still has hard violations,
      // try once more and keep the better result. (Explicit seeds are never
      // retried — reproducibility wins.)
      if (!report.feasible && options.seed === undefined) {
        const retry = generateWithGA(d, {});
        const better =
          retry.report.hardCount < report.hardCount ||
          (retry.report.hardCount === report.hardCount && retry.report.softCost < report.softCost);
        if (better) ({ entries, report } = retry);
      }

      // Keep legacy warnings field so older UI pieces continue to work
      const warnings = [
        ...report.inputProblems,
        ...report.hardViolations.map(v => v.message),
      ];

      return {
        success: true,
        entries,
        warnings,
        report,
        generatedAt: new Date().toISOString(),
        saved: false,
      };
    } catch (err) {
      console.error('routineService.generateRoutine:', err);
      return { success: false, error: err.message };
    }
  },

  /** Persist a previewed routine (single JSONB row, fixed UUID primary key). */
  async saveRoutine(entries, generatedAt) {
    try {
      if (!Array.isArray(entries) || entries.length === 0) {
        return { success: false, error: 'No routine entries to save.' };
      }
      const ts = generatedAt || new Date().toISOString();
      const { error } = await supabase
        .from(ROUTINE_TABLE)
        .upsert({ id: ROUTINE_ROW_ID, entries, generated_at: ts }, { onConflict: 'id' });
      if (error) throw error;
      return { success: true, generatedAt: ts };
    } catch (err) {
      console.error('routineService.saveRoutine:', err);
      return { success: false, error: err.message };
    }
  },

  async getRoutine() {
    try {
      const { data, error } = await supabase
        .from(ROUTINE_TABLE)
        .select('entries,generated_at')
        .eq('id', ROUTINE_ROW_ID)
        .maybeSingle();

      if (error) throw error;
      return {
        success: true,
        entries:     data?.entries     || [],
        generatedAt: data?.generated_at || null,
      };
    } catch (err) {
      // 42P01 = table does not exist yet (routine_storage not created) — treat as empty
      if (err?.code !== '42P01') console.error('routineService.getRoutine:', err);
      return { success: true, entries: [], generatedAt: null };
    }
  },

  async clearRoutine() {
    try {
      await supabase.from(ROUTINE_TABLE).delete().eq('id', ROUTINE_ROW_ID);
      return { success: true };
    } catch {
      return { success: true };
    }
  },
};
