/**
 * Incourse exam routine generator.
 *
 * Scheduling rules (agreed with the department):
 *   • Only THEORY courses sit an incourse exam.
 *   • Dates come from the academic calendar's dedicated incourse week; the
 *     admin confirms/overrides the start date.
 *   • 5 courses → a regular run on consecutive class days. Fewer than 5 →
 *     Tuesday is left as a gap day.
 *   • Two shifts on the same day: shift 1 = 1st + 3rd year, shift 2 = 2nd +
 *     4th year, so those pairs sit simultaneously. Each batch keeps the SAME
 *     start time and the SAME rooms for all of its exams.
 *
 * Invigilation:
 *   • The course teacher(s) are compulsory for their own exam.
 *   • Remaining seats are filled from the LOWEST rank upward — Lecturers
 *     first, then Assistant → Associate → Professor — balancing duty count
 *     within each rank so every Lecturer carries a similar load.
 *   • Dean / Chairman (weight 1) only invigilate their own course.
 *   • Teachers on approved leave that day are skipped, and nobody is placed
 *     in two rooms in the same shift.
 */

const WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Lower index = assigned first (Lecturers absorb duty before seniors).
const RANK_ORDER = [
  'Lecturer', 'Senior Lecturer', 'Adjunct Professor',
  'Assistant Professor', 'Associate Professor', 'Professor',
];
const rankIndex = (t) => {
  const i = RANK_ORDER.indexOf(t?.designation);
  return i === -1 ? RANK_ORDER.length : i;
};

const toISO = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};
const dayName = (iso) => WEEK[new Date(iso + 'T00:00:00').getDay()];

const addMins = (time, mins) => {
  const [h, m] = String(time || '00:00').split(':').map(Number);
  const t = h * 60 + m + (mins || 0);
  return `${String(Math.floor(t / 60) % 24).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};

// Batch → shift number. Y1/Y3 sit together in shift 1; Y2/Y4 in shift 2.
export const shiftOfBatch = (batchId) => {
  const y = String(batchId).slice(0, 2);
  return (y === 'Y1' || y === 'Y3') ? 1 : 2;
};

/**
 * Build the ordered exam dates.
 *
 * @param {string}   startDate  'YYYY-MM-DD' (confirmed by the admin)
 * @param {number}   count      how many exam days are needed
 * @param {string[]} allowedDays working day names (default Sun–Thu)
 * @param {boolean}  skipTuesday leave Tuesday as a gap (courses < 5)
 */
export function buildExamDates(startDate, count, allowedDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'], skipTuesday = false) {
  const dates = [];
  if (!startDate || count <= 0) return dates;

  const cur = new Date(startDate + 'T00:00:00');
  let guard = 0;
  while (dates.length < count && guard < 120) {
    guard++;
    const iso = toISO(cur);
    const name = dayName(iso);
    const usable = allowedDays.includes(name) && !(skipTuesday && name === 'Tuesday');
    if (usable) dates.push(iso);
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

/**
 * Generate slots for ONE batch.
 *
 * @returns [{ course_id, exam_date, start_time, end_time, rooms, slot_order }]
 */
export function generateSlots({ batchId, courses, startDate, allowedDays, shiftTimes, rooms, durationMins = 60 }) {
  const theory = (courses || []).filter(c => c.course_type === 'theory' || c.course_type === 'mixed');
  if (theory.length === 0) return [];

  // Fewer than 5 exams → keep Tuesday free as a gap day.
  const skipTuesday = theory.length < 5;
  const dates = buildExamDates(startDate, theory.length, allowedDays, skipTuesday);

  const shift = shiftOfBatch(batchId);
  const startTime = shiftTimes[shift] || shiftTimes[1] || '09:30';

  return theory.map((c, i) => ({
    course_id: c.id,
    exam_date: dates[i] || '',
    start_time: startTime,
    end_time: addMins(startTime, durationMins),
    rooms: rooms || '',
    slot_order: i,
  }));
}

/**
 * Assign invigilators across ALL slots of the session.
 *
 * @param slots            [{ id, course_id, exam_date, start_time }]
 * @param teachers         teacher rows (id, designation, special_post, availability_status)
 * @param courseTeachers   { courseId: [teacherId] }  — who teaches the course
 * @param weightMap        { teacherId: 0|1|2 }  0 = excluded, 1 = own course only
 * @param perExam          total invigilators required per exam (admin sets)
 * @param leaveMap         { teacherId: Set('YYYY-MM-DD') }
 * @returns { [slotId]: [{ teacher_id, is_course_teacher, is_lead }] }
 */
export function assignInvigilators({ slots, teachers, courseTeachers, weightMap = {}, perExam = 3, leaveMap = {} }) {
  const result = {};
  const load = {};                       // teacherId → duties so far
  for (const t of teachers) load[t.id] = 0;

  const onLeave = (tid, date) => !!leaveMap[tid]?.has(date);

  // Deterministic order: by date then start time.
  const sorted = [...slots].sort((a, b) =>
    a.exam_date !== b.exam_date
      ? (a.exam_date < b.exam_date ? -1 : 1)
      : (a.start_time < b.start_time ? -1 : 1)
  );

  for (const slot of sorted) {
    result[slot.id] = [];
    const taken = new Set();

    // Nobody can invigilate two rooms in the same shift (same date + time).
    const busyNow = new Set();
    for (const other of sorted) {
      if (other.id === slot.id) continue;
      if (other.exam_date === slot.exam_date && other.start_time === slot.start_time) {
        for (const a of (result[other.id] || [])) busyNow.add(a.teacher_id);
      }
    }

    // 1) Course teacher(s) are compulsory for their own exam.
    for (const tid of (courseTeachers[slot.course_id] || [])) {
      if ((weightMap[tid] ?? 2) < 1) continue;      // fully excluded
      if (onLeave(tid, slot.exam_date)) continue;
      if (busyNow.has(tid) || taken.has(tid)) continue;
      result[slot.id].push({ teacher_id: tid, is_course_teacher: true, is_lead: result[slot.id].length === 0 });
      taken.add(tid);
      load[tid] = (load[tid] || 0) + 1;
    }

    // 2) Fill the rest from the lowest rank upward, least-loaded first inside
    //    each rank so duty is spread evenly among peers.
    const needed = Math.max(0, perExam - taken.size);
    if (needed === 0) continue;

    const pool = teachers
      .filter(t =>
        !taken.has(t.id) &&
        !busyNow.has(t.id) &&
        !onLeave(t.id, slot.exam_date) &&
        (weightMap[t.id] ?? 2) >= 2 &&              // weight 1 = own course only
        (t.availability_status ?? 'available') === 'available'
      )
      .sort((a, b) => {
        const ra = rankIndex(a), rb = rankIndex(b);
        if (ra !== rb) return ra - rb;              // Lecturers first
        const la = load[a.id] || 0, lb = load[b.id] || 0;
        if (la !== lb) return la - lb;              // then least-loaded peer
        return String(a.name || '').localeCompare(String(b.name || ''));
      });

    for (let i = 0; i < Math.min(needed, pool.length); i++) {
      const t = pool[i];
      result[slot.id].push({ teacher_id: t.id, is_course_teacher: false, is_lead: false });
      taken.add(t.id);
      load[t.id] = (load[t.id] || 0) + 1;
    }
  }

  return result;
}
