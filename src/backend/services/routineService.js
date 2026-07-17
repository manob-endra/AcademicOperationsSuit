import { supabase } from '../config/supabaseClient.js';
import { generateWithGA } from './routineGA/index.js';
import { getSemesterLoads } from './teacherLoadService.js';

// routine_storage holds one JSONB row per academic semester, keyed by
// semester_id. (The original `routines` table has a NOT NULL day_of_week
// constraint that blocks this row-per-semester pattern.)
const ROUTINE_TABLE = 'routine_storage';

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

// Course types that never appear in the class routine — they stay in the
// catalog for credits/results but have no weekly classes to schedule.
const NON_CLASS_TYPES = new Set(['project', 'internship', 'viva']);

/**
 * Filter courses that belong to the given selected semester IDs, honouring
 * the syllabus catalog:
 *   • non-class types (project/internship/viva) are always skipped
 *   • when a batch level has a syllabus assigned (semester_batch_syllabus),
 *     only that syllabus's courses count for it — this is how an old batch
 *     runs 4-1 from the old syllabus while a new batch runs 1-1 from the new
 *   • optional courses (option_group_id set) only run if offered this
 *     semester (course_offerings); compulsory courses always run
 *
 * `syllabusByBatch` maps batch code → syllabus_id; `offeredSet` holds
 * offered course ids. Both may be empty (legacy behaviour: match by
 * year/semester text only, all options included).
 */
function filterCoursesBySemesters(courses, selectedSemesterIds, syllabusByBatch = {}, offeredSet = new Set()) {
  const pairs = selectedSemesterIds
    .map(id => ({ id, ...SEMESTER_MAP[id] }))
    .filter(p => p.year);
  if (pairs.length === 0) return [];

  return courses.filter(c => {
    if (NON_CLASS_TYPES.has(c.course_type)) return false;

    const pair = pairs.find(p => c.year === p.year && c.semester === p.semester);
    if (!pair) return false;

    // Syllabus scoping: if this batch level is pinned to a syllabus, only
    // that syllabus's courses run for it. Courses without any syllabus
    // (legacy rows) stay visible so pre-catalog data keeps working.
    const assignedSyllabus = syllabusByBatch[pair.id];
    if (assignedSyllabus && c.syllabus_id && c.syllabus_id !== assignedSyllabus) return false;

    // Optional course: runs only when the department offered it
    if (c.option_group_id && !offeredSet.has(c.id)) return false;

    return true;
  });
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

  // Every routine input is read within one academic semester. Courses and
  // teachers are the exception: those catalogs are shared campus-wide.
  async _loadData(semesterId) {
    const [
      settingsRes,
      semRes,
      coursesRes,
      durRes,
      roomsRes,
      teachersRes,
      availRes,
      ctChoicesRes,
      loadMap,
    ] = await Promise.all([
      supabase.from('class_time_settings').select('*').eq('semester_id', semesterId).eq('is_active', true).maybeSingle(),
      supabase.from('semester_selection').select('selected_semesters').eq('semester_id', semesterId).maybeSingle(),
      supabase.from('courses').select('id,code,title,course_type,year,semester,credit_hours,is_exceptional,syllabus_id,option_group_id,weekly_classes').eq('is_active', true),
      supabase.from('course_durations').select('course_id,duration_periods,weekly_classes').eq('semester_id', semesterId),
      supabase.from('room_allocation').select('theory_rooms,lab_rooms,semester_theory_rooms').eq('semester_id', semesterId).maybeSingle(),
      supabase.from('teachers').select('id,name,initials,designation,load_limit').eq('is_active', true),
      supabase.from('teacher_availability').select('teacher_id,day_of_week,slot_id').eq('semester_id', semesterId),
      supabase.from('course_teacher_choices').select('course_id,teacher_assignments').eq('semester_id', semesterId),
      getSemesterLoads(semesterId),
    ]);

    // Syllabus catalog context (tables may not exist until syllabus_catalog.sql runs)
    let syllabusByBatch = {};
    let offeredSet = new Set();
    try {
      const [sbsRes, offRes] = await Promise.all([
        supabase.from('semester_batch_syllabus').select('batch_code,syllabus_id').eq('semester_id', semesterId),
        supabase.from('course_offerings').select('course_id').eq('semester_id', semesterId),
      ]);
      (sbsRes.data || []).forEach(r => { syllabusByBatch[r.batch_code] = r.syllabus_id; });
      offeredSet = new Set((offRes.data || []).map(r => r.course_id));
    } catch { /* catalog migration not applied yet — legacy behaviour */ }

    // Attach this semester's load to each teacher — the GA reads
    // weekly_load_hours, which is no longer a column on teachers.
    const teachers = (teachersRes.data || []).map(t => ({
      ...t,
      weekly_load_hours: loadMap[t.id] || 0,
    }));

    return {
      settings: settingsRes.data || null,
      selectedSemesters: semRes.data?.selected_semesters ?? [],
      courses: coursesRes.data || [],
      durations: durRes.data || [],
      rooms: roomsRes.data || { theory_rooms: [], lab_rooms: [], semester_theory_rooms: {} },
      teachers,
      availability: availRes.data || [],
      courseTeacherChoices: ctChoicesRes.data || [],
      syllabusByBatch,
      offeredSet,
    };
  },

  async checkConflicts(semesterId) {
    try {
      if (!semesterId) return { success: false, error: 'semesterId is required.' };

      const d = await this._loadData(semesterId);
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
      const selCourses = filterCoursesBySemesters(d.courses, d.selectedSemesters, d.syllabusByBatch, d.offeredSet)
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
      // weeklyMap = weekly_classes (how many times/week to schedule); falls back
      // to duration_periods, then to the syllabus catalog default on the course.
      const durMap     = {};
      const weeklyMap  = {};
      d.durations.forEach(x => {
        durMap[x.course_id]    = x.duration_periods;
        weeklyMap[x.course_id] = x.weekly_classes ?? x.duration_periods;
      });
      selCourses.forEach(c => {
        if (weeklyMap[c.id] == null && c.weekly_classes) weeklyMap[c.id] = c.weekly_classes;
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
  async generateRoutine(semesterId, options = {}) {
    try {
      if (!semesterId) return { success: false, error: 'semesterId is required.' };

      const d = await this._loadData(semesterId);

      if (!d.settings) {
        return { success: false, error: 'No class time settings configured.' };
      }
      if (!d.selectedSemesters.length) {
        return { success: false, error: 'No semesters selected for routine generation.' };
      }

      // Apply the syllabus catalog rules before the GA sees the courses:
      // drop project/internship/viva, respect per-batch syllabus assignment,
      // and include optional courses only when offered. The GA's own filter
      // (year/semester + exceptional) then runs on this reduced list.
      d.courses = filterCoursesBySemesters(d.courses, d.selectedSemesters, d.syllabusByBatch, d.offeredSet);

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

  /** Persist a previewed routine (one JSONB row per semester). */
  async saveRoutine(semesterId, entries, generatedAt) {
    try {
      if (!semesterId) return { success: false, error: 'semesterId is required.' };
      if (!Array.isArray(entries) || entries.length === 0) {
        return { success: false, error: 'No routine entries to save.' };
      }
      const ts = generatedAt || new Date().toISOString();
      const { error } = await supabase
        .from(ROUTINE_TABLE)
        .upsert({ semester_id: semesterId, entries, generated_at: ts }, { onConflict: 'semester_id' });
      if (error) throw error;
      return { success: true, generatedAt: ts };
    } catch (err) {
      console.error('routineService.saveRoutine:', err);
      return { success: false, error: err.message };
    }
  },

  async getRoutine(semesterId) {
    try {
      if (!semesterId) return { success: true, entries: [], generatedAt: null };

      const { data, error } = await supabase
        .from(ROUTINE_TABLE)
        .select('entries,generated_at')
        .eq('semester_id', semesterId)
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

  /**
   * The routine shown to students/teachers who have no semester context of
   * their own (StudentRoutine, MyRoutine, BatchWiseRoutine) — the semester
   * whose routine was published most recently. Each academic semester keeps
   * its own row now, so "the routine" is no longer a single global thing;
   * this picks the one an outside viewer should reasonably see.
   */
  async getPublishedRoutine() {
    try {
      const { data, error } = await supabase
        .from(ROUTINE_TABLE)
        .select('semester_id,entries,generated_at,published_at,published_label')
        .not('published_at', 'is', null)
        .order('published_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data) return { success: true, entries: [], generatedAt: null, semesterId: null, semesterLabel: null };
      return {
        success: true,
        entries: data.entries || [],
        generatedAt: data.generated_at || null,
        semesterId: data.semester_id,
        semesterLabel: data.published_label || null,
      };
    } catch (err) {
      if (err?.code !== '42P01') console.error('routineService.getPublishedRoutine:', err);
      return { success: true, entries: [], generatedAt: null, semesterId: null, semesterLabel: null };
    }
  },

  async clearRoutine(semesterId) {
    try {
      if (!semesterId) return { success: true };
      await supabase.from(ROUTINE_TABLE).delete().eq('semester_id', semesterId);
      return { success: true };
    } catch {
      return { success: true };
    }
  },
};
