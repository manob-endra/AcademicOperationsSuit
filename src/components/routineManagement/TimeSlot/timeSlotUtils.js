/**
 * Shared time-slot + working-day generation from Class Time Details settings.
 *
 * The period id is stable: `s{periodNumber}` (s1, s2, …) where the number is
 * the 1-based class-period index (morning periods first, then afternoon). This
 * is the SAME id availability and the routine are keyed by, so changing the
 * start time / duration / lunch only relabels the columns — stored teacher
 * availability (keyed by "Day-sN") stays valid and never needs migrating.
 */

export const WEEK_DAYS = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

export const DEFAULT_SETTINGS = {
  startTime: '08:30',
  duration: '01:30',
  classesBeforeLunch: 3,
  lunchDuration: '01:00',
  classesAfterLunch: 2,
  classDay: 'Sunday-Thursday',
  skipTime: '5 mins',
};

const timeToMinutes = (timeStr) => {
  const [h, m] = String(timeStr).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

const minutesToTime = (total) => {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

export const formatTimeWithPeriod = (timeStr) => {
  const [h, m] = String(timeStr).split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const dh = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${String(dh).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`;
};

// Parse a skip value like "5 mins" or 5 → minutes (default 5).
const parseSkip = (skip) => {
  if (skip == null) return 5;
  const n = parseInt(String(skip), 10);
  return Number.isNaN(n) ? 5 : n;
};

/** Working days from a "Sunday-Thursday" range (circular). */
export const getWorkingDays = (classDayStr) => {
  if (!classDayStr || typeof classDayStr !== 'string') return [];
  const [startDay, endDay] = classDayStr.split('-').map((s) => s.trim());
  const startIdx = WEEK_DAYS.indexOf(startDay);
  const endIdx = WEEK_DAYS.indexOf(endDay);
  if (startIdx === -1 || endIdx === -1) return [];
  const days = [];
  let i = startIdx;
  while (true) {
    days.push(WEEK_DAYS[i]);
    if (i === endIdx) break;
    i = (i + 1) % WEEK_DAYS.length;
  }
  return days;
};

/**
 * Build the ordered slot list from settings.
 * Each entry: { id, periodNo, label, startPeriod, endPeriod, type, isBreak }.
 * Class periods use id `s{periodNo}`; the lunch break uses id `lunch`.
 */
export const generateSlots = (settings = {}) => {
  const s = { ...DEFAULT_SETTINGS, ...settings };
  const before = parseInt(s.classesBeforeLunch, 10) || 0;
  const after = parseInt(s.classesAfterLunch, 10) || 0;
  const durMin = timeToMinutes(s.duration);
  const lunchMin = timeToMinutes(s.lunchDuration);
  const skipMin = parseSkip(s.skipTime);

  const slots = [];
  let cur = timeToMinutes(s.startTime);
  let periodNo = 0;

  const pushClass = () => {
    periodNo += 1;
    const start = minutesToTime(cur);
    const end = minutesToTime(cur + durMin);
    slots.push({
      id: `s${periodNo}`,
      periodNo,
      label: `${formatTimeWithPeriod(start)}\n${formatTimeWithPeriod(end)}`,
      startPeriod: formatTimeWithPeriod(start),
      endPeriod: formatTimeWithPeriod(end),
      type: 'class',
      isBreak: false,
    });
    cur += durMin + skipMin;
  };

  for (let i = 0; i < before; i++) pushClass();

  // Lunch break (only when there are morning classes and a positive duration)
  if (before > 0 && lunchMin > 0) {
    const start = minutesToTime(cur);
    const end = minutesToTime(cur + lunchMin);
    slots.push({
      id: 'lunch',
      periodNo: null,
      label: 'Break',
      startPeriod: formatTimeWithPeriod(start),
      endPeriod: formatTimeWithPeriod(end),
      type: 'lunch',
      isBreak: true,
    });
    cur += lunchMin;
  }

  for (let i = 0; i < after; i++) pushClass();

  return slots;
};
