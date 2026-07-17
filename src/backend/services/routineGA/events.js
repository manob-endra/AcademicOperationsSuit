/**
 * Event extraction: turns the raw routine data (courses, teachers, rooms,
 * time settings) into the schedulable event list + scheduling context the
 * GA works on. Pure module — no framework/database imports.
 */

const WEEK_DAYS = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

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

const REVERSE_SEMESTER_MAP = {};
for (const [id, { year, semester }] of Object.entries(SEMESTER_MAP)) {
  REVERSE_SEMESTER_MAP[`${year}|${semester}`] = id;
}

export function courseToSemId(course) {
  return REVERSE_SEMESTER_MAP[`${course.year}|${course.semester}`] || null;
}

// "Sunday-Thursday" → ["Sunday", ..., "Thursday"]
export function getWorkingDays(classDayStr) {
  if (!classDayStr || typeof classDayStr !== 'string') return [];
  const parts = classDayStr.split('-').map(s => s.trim());
  if (parts.length < 2) return [];
  const si = WEEK_DAYS.indexOf(parts[0]);
  const ei = WEEK_DAYS.indexOf(parts[1]);
  if (si === -1 || ei === -1) return [];
  const days = [];
  let cur = si;
  while (true) {
    days.push(WEEK_DAYS[cur]);
    if (cur === ei) break;
    cur = (cur + 1) % WEEK_DAYS.length;
  }
  return days;
}

/**
 * Build the scheduling context.
 * `data` is routineService._loadData() output:
 *   { settings, selectedSemesters, courses, durations, rooms, teachers,
 *     availability, courseTeacherChoices }
 * Returns { ctx, problems } — problems are input defects reported to the admin.
 */
export function buildContext(data, cfg) {
  const problems = [];
  const s = data.settings || {};

  const before = s.classes_before_lunch || 0;
  const after  = s.classes_after_lunch  || 0;
  const slotCount = before + after;
  const days = getWorkingDays(s.class_day);

  // Valid start periods (1-based). A lab occupies [start, start+1] and must
  // stay on one side of lunch (H5).
  const theoryStarts = Array.from({ length: slotCount }, (_, i) => i + 1);
  const labStarts = theoryStarts.filter(p =>
    (p + cfg.labPeriods - 1 <= before) ||
    (p > before && p + cfg.labPeriods - 1 <= slotCount)
  );

  // ── lookup maps ──
  const weeklyMap = {};
  (data.durations || []).forEach(x => {
    weeklyMap[x.course_id] = x.weekly_classes ?? x.duration_periods;
  });

  const ctMap = {};
  (data.courseTeacherChoices || []).forEach(x => {
    ctMap[x.course_id] = x.teacher_assignments || [];
  });

  const teacherById = {};
  (data.teachers || []).forEach(t => { teacherById[t.id] = t; });

  const availMap = {}; // teacherId → Set("Day-s3")
  (data.availability || []).forEach(a => {
    if (!availMap[a.teacher_id]) availMap[a.teacher_id] = new Set();
    availMap[a.teacher_id].add(`${a.day_of_week}-${a.slot_id}`);
  });

  const rooms = data.rooms || {};
  const labRooms = rooms.lab_rooms || [];
  const semesterTheoryRooms = rooms.semester_theory_rooms || {};

  // Seniority helpers
  const rankWeight = (t) =>
    cfg.seniorityWeights[t?.designation] ?? cfg.defaultSeniorityWeight;
  const isHardAvailTeacher = (t) =>
    cfg.hardAvailabilityRanks.includes(t?.designation) &&
    (availMap[t.id]?.size || 0) > 0;

  // ── select courses ──
  // routineService already pre-filters to in_routine courses, but keep the
  // gate here too so the GA never schedules a course that wasn't opted in.
  const pairs = (data.selectedSemesters || []).map(id => SEMESTER_MAP[id]).filter(Boolean);
  const selCourses = (data.courses || []).filter(c =>
    c.in_routine &&
    pairs.some(p => c.year === p.year && c.semester === p.semester)
  );

  // ── build events ──
  const events = [];
  const pushEvent = (ev) => { ev.idx = events.length; events.push(ev); };

  for (const course of selCourses) {
    const semId = courseToSemId(course);
    if (!semId) continue;

    const teacherIds = (ctMap[course.id] || []).filter(id => teacherById[id]);
    if (teacherIds.length === 0) {
      problems.push(`"${course.code} – ${course.title}" skipped: no active teacher assigned.`);
      continue;
    }

    const base = {
      courseId: course.id,
      code: course.code,
      title: course.title,
      semId,
      teacherIds,
    };

    if (course.course_type === 'lab') {
      if (labStarts.length === 0) {
        problems.push(`"${course.code}" skipped: no ${cfg.labPeriods}-consecutive-period block fits on one side of lunch.`);
        continue;
      }
      if (labRooms.length === 0) {
        problems.push(`"${course.code}" skipped: no lab rooms configured.`);
        continue;
      }
      const credit = Number(course.credit_hours) || 0;
      if (credit >= cfg.labDualGroupMinCredit) {
        // Dual-group lab: one session per group per week, same teachers
        pushEvent({ ...base, type: 'lab', group: 'A', periods: cfg.labPeriods, fixedRoom: null });
        pushEvent({ ...base, type: 'lab', group: 'B', periods: cfg.labPeriods, fixedRoom: null });
      } else {
        // Low-credit lab: single weekly session, groups alternate weeks
        pushEvent({ ...base, type: 'lab', group: 'alt', periods: cfg.labPeriods, fixedRoom: null });
      }
    } else {
      // theory / mixed → weekly single-period classes in the fixed semester room.
      // Per-semester setting wins; the syllabus catalog default (courses.
      // weekly_classes) fills in when the admin hasn't set one yet.
      const weekly = weeklyMap[course.id] || course.weekly_classes || cfg.defaultTheoryWeekly;
      const room = semesterTheoryRooms[semId] || null;
      if (!room) {
        problems.push(`"${course.code}": semester ${semId} has no fixed theory room assigned (Room Allocation).`);
      }
      for (let k = 0; k < weekly; k++) {
        pushEvent({
          ...base,
          type: 'theory',
          group: null,
          periods: 1,
          weeklyIndex: k,
          fixedRoom: room,
        });
      }
    }
  }

  const ctx = {
    events,
    days,
    slotCount,
    before,
    after,
    theoryStarts,
    labStarts,
    labRooms,
    teacherById,
    availMap,
    rankWeight,
    isHardAvailTeacher,
  };

  return { ctx, problems };
}

/** Valid start periods for an event. */
export function validStarts(ev, ctx) {
  return ev.type === 'lab' ? ctx.labStarts : ctx.theoryStarts;
}
