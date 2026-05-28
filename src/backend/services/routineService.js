import { supabase } from '../config/supabaseClient.js';

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
      supabase.from('teachers').select('id,name,initials,load_limit,weekly_load_hours').eq('is_active', true),
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
      const slotIds    = Array.from({ length: slotCount }, (_, i) => `s${i + 1}`);
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

  async generateRoutine() {
    try {
      const d = await this._loadData();

      if (!d.settings) {
        return { success: false, error: 'No class time settings configured.' };
      }

      const classesBeforeLunch = d.settings.classes_before_lunch || 3;
      const classesAfterLunch  = d.settings.classes_after_lunch  || 2;
      const classDay           = d.settings.class_day;

      // class_day is stored as "Sunday-Thursday" — derive the actual day list
      const activeDays = getWorkingDays(classDay);
      const slotCount  = classesBeforeLunch + classesAfterLunch;
      const slotIds    = Array.from({ length: slotCount }, (_, i) => `s${i + 1}`);

      const selCourses = filterCoursesBySemesters(d.courses, d.selectedSemesters)
        .filter(c => !c.is_exceptional);

      // weeklyMap = weekly_classes (how many times/week to schedule); falls back to duration_periods
      const durMap    = {};
      const weeklyMap = {};
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

      const theoryRooms         = d.rooms.theory_rooms         || [];
      const labRooms            = d.rooms.lab_rooms            || [];
      const semesterTheoryRooms = d.rooms.semester_theory_rooms || {};

      // Schedule state: track what is busy
      const teacherBusy  = new Set(); // "teacherId-day-slot"
      const semesterBusy = new Set(); // "semester-day-slot"
      const roomBusy     = new Set(); // "room-day-slot"

      // Sort most-constrained courses first (fewest teacher available slots)
      const sortedCourses = [...selCourses].sort((a, b) => {
        const ta = ctMap[a.id]?.[0];
        const tb = ctMap[b.id]?.[0];
        return (availMap[ta]?.size || 0) - (availMap[tb]?.size || 0);
      });

      const entries  = [];
      const warnings = [];

      for (const course of sortedCourses) {
        // weeklyMap gives how many time-slots to book per week
        const periodsNeeded = weeklyMap[course.id] || 0;
        if (periodsNeeded === 0) continue;

        const teacherId = ctMap[course.id]?.[0];
        if (!teacherId || !teacherMap[teacherId]) {
          warnings.push(`Skipped "${course.code}" — no active teacher assigned.`);
          continue;
        }

        const teacherSlots = availMap[teacherId] || new Set();
        let placed = 0;

        // Build candidate (day, slot) pairs where teacher is available
        const candidates = [];
        for (const day of activeDays) {
          for (const slot of slotIds) {
            if (teacherSlots.has(`${day}-${slot}`)) {
              candidates.push({ day, slot });
            }
          }
        }

        for (const { day, slot } of candidates) {
          if (placed >= periodsNeeded) break;

          // Use compact ID (Y2-S1) as the semester key for busy-tracking and room lookup
          const semId = courseToSemId(course) || `${course.year}|${course.semester}`;
          const tk = `${teacherId}-${day}-${slot}`;
          const sk = `${semId}-${day}-${slot}`;
          if (teacherBusy.has(tk) || semesterBusy.has(sk)) continue;

          // Determine room — semester_theory_rooms keys are compact IDs
          let room = null;
          if (course.course_type === 'lab') {
            room = labRooms.find(r => !roomBusy.has(`${r}-${day}-${slot}`)) || null;
            if (!room) continue; // no lab room free this slot
          } else {
            room = semesterTheoryRooms[semId] || theoryRooms[0] || null;
            if (room && roomBusy.has(`${room}-${day}-${slot}`)) continue;
          }

          teacherBusy.add(tk);
          semesterBusy.add(sk);
          if (room) roomBusy.add(`${room}-${day}-${slot}`);
          placed++;

          entries.push({
            semester:    semId,          // compact ID, e.g. "Y2-S1"
            day_of_week: day,
            slot_id:     slot,
            course_id:   course.id,
            teacher_id:  teacherId,
            room,
          });
        }

        if (placed < periodsNeeded) {
          warnings.push(`"${course.code} – ${course.title}": scheduled ${placed}/${periodsNeeded} weekly classes.`);
        }
      }

      // Persist routine (single JSONB row)
      const generatedAt = new Date().toISOString();
      const { error: saveErr } = await supabase
        .from('routines')
        .upsert({ id: 1, entries, generated_at: generatedAt }, { onConflict: 'id' });

      if (saveErr) {
        console.warn('routineService: could not persist routine:', saveErr.message);
      }

      return { success: true, entries, warnings, generatedAt };
    } catch (err) {
      console.error('routineService.generateRoutine:', err);
      return { success: false, error: err.message };
    }
  },

  async getRoutine() {
    try {
      const { data, error } = await supabase
        .from('routines')
        .select('entries,generated_at')
        .eq('id', 1)
        .maybeSingle();

      if (error) throw error;
      return {
        success: true,
        entries:     data?.entries     || [],
        generatedAt: data?.generated_at || null,
      };
    } catch (err) {
      // 42703 = undefined_column — routines table exists but schema is not set up yet
      if (err?.code !== '42703') console.error('routineService.getRoutine:', err);
      return { success: true, entries: [], generatedAt: null };
    }
  },

  async clearRoutine() {
    try {
      await supabase.from('routines').delete().eq('id', 1);
      return { success: true };
    } catch {
      return { success: true };
    }
  },
};
