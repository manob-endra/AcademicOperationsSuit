// ── Shared constants ─────────────────────────────────────────────────────────

export const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

export const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const CELL_TYPES = {
  class:            { label: 'Regular Class',          bg: '#ffffff',  border: '#d1d5db', text: '#374151' },
  class_start_end:  { label: 'Class Start / End Date', bg: '#00bcd4',  border: '#0097a7', text: '#ffffff' },
  class_office_off: { label: 'Class + Office Off',     bg: '#fda4af',  border: '#fb7185', text: '#881337' },
  possible_off:     { label: 'Possible Class Off',     bg: '#fef08a',  border: '#facc15', text: '#713f12' },
  class_off:        { label: 'Class Off',              bg: '#fca5a5',  border: '#ef4444', text: '#7f1d1d' },
  vacation:         { label: 'Vacation / Holiday',     bg: '#ef4444',  border: '#b91c1c', text: '#ffffff' },
  incourse:         { label: 'Incourse Exam',          bg: '#fed7aa',  border: '#fb923c', text: '#7c2d12' },
  pl:               { label: 'Preparation Leave',      bg: '#d8b4fe',  border: '#a855f7', text: '#3b0764' },
  exam:             { label: 'Final Exam',             bg: '#93c5fd',  border: '#3b82f6', text: '#1e3a8a' },
  event:            { label: 'Event',                  bg: '#6ee7b7',  border: '#10b981', text: '#064e3b' },
  weekend:          { label: 'Weekend',                bg: '#f3f4f6',  border: '#e5e7eb', text: '#9ca3af' },
};

// Types shown in the toolbar (order matters)
export const TOOLBAR_TYPES = [
  'class', 'class_start_end', 'class_office_off', 'possible_off',
  'class_off', 'vacation', 'incourse', 'pl', 'exam', 'event',
];

export const ROW_TYPE_BG = {
  vacation: '#fff1f2',
  incourse: '#fff7ed',
  pl:       '#faf5ff',
  exam:     '#eff6ff',
  class:    '#ffffff',
  mixed:    '#ffffff',
  empty:    '#f9fafb',
};

export const ROW_LABEL_STYLE = {
  vacation: { background: '#ef4444', color: '#ffffff' },
  incourse: { background: '#f97316', color: '#ffffff' },
  pl:       { background: '#a855f7', color: '#ffffff' },
  exam:     { background: '#3b82f6', color: '#ffffff' },
  class:    { background: '#1e3a5f', color: '#ffffff' },
  mixed:    { background: '#374151', color: '#ffffff' },
  empty:    { background: '#e5e7eb', color: '#6b7280' },
};

// ── Date utilities ────────────────────────────────────────────────────────────

export const toDateStr = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const isWeekend = (date) => {
  const day = date.getDay();
  return day === 5 || day === 6; // Friday=5, Saturday=6
};

export const getDefaultType = (date) => (isWeekend(date) ? 'weekend' : 'class');

export const getEffectiveType = (date, entries) =>
  entries[toDateStr(date)]?.type || getDefaultType(date);

// Sunday of the week containing dateStr
export const getWeekSunday = (dateStr) => {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() - d.getDay());
  return d;
};

// Generate numWeeks weeks starting from the Sunday of startDateStr
export const generateWeeks = (startDateStr, numWeeks) => {
  const sunday = getWeekSunday(startDateStr);
  return Array.from({ length: numWeeks }, (_, w) =>
    Array.from({ length: 7 }, (__, d) => {
      const date = new Date(sunday);
      date.setDate(sunday.getDate() + w * 7 + d);
      return date;
    })
  );
};

// ── Row classification (majority of Sun–Thu working days) ────────────────────

// Map a cell type to one of the 5 row categories
const rowCategory = (type) => {
  if (type === 'incourse') return 'incourse';
  if (type === 'pl')       return 'pl';
  if (type === 'exam')     return 'exam';
  if (['vacation', 'class_off'].includes(type)) return 'vacation';
  return 'class'; // class, class_start_end, class_office_off, possible_off, event
};

// Tie-break priority when two categories have equal counts
const CATEGORY_PRIORITY = ['incourse', 'pl', 'exam', 'vacation', 'class'];

export const getWeekRowType = (weekDays, entries) => {
  // Working days = Sunday(0) through Thursday(4) only
  const workDays = weekDays.filter(d => d.getDay() <= 4);
  if (!workDays.length) return 'empty';

  const counts = { class: 0, vacation: 0, incourse: 0, pl: 0, exam: 0 };
  workDays.forEach(d => {
    counts[rowCategory(getEffectiveType(d, entries))]++;
  });

  const maxCount = Math.max(...Object.values(counts));
  // Return the highest-priority category that has the majority count
  return CATEGORY_PRIORITY.find(cat => counts[cat] === maxCount) || 'class';
};

// ── Month grouping (for rowspan) ──────────────────────────────────────────────

export const computeWeekMonths = (weeks) =>
  weeks.map(weekDays => {
    const counts = {};
    weekDays.forEach(d => {
      const m = d.getMonth();
      counts[m] = (counts[m] || 0) + 1;
    });
    return parseInt(Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]);
  });

export const computeMonthRowspans = (weekMonths) => {
  const spans = new Array(weekMonths.length).fill(0);
  let i = 0;
  while (i < weekMonths.length) {
    const m = weekMonths[i];
    let j = i;
    while (j < weekMonths.length && weekMonths[j] === m) j++;
    spans[i] = j - i;
    i = j;
  }
  return spans;
};

// ── Summary calculation ───────────────────────────────────────────────────────

export const calculateSummary = (weeks, entries) => {
  let classWeeks = 0, classDays = 0, vacationDays = 0;
  let plDays = 0, examDays = 0, holidayDays = 0;

  weeks.forEach(weekDays => {
    const rowType = getWeekRowType(weekDays, entries);
    if (['class', 'mixed', 'incourse'].includes(rowType)) classWeeks++;

    weekDays.forEach(day => {
      if (isWeekend(day)) return;
      const t = getEffectiveType(day, entries);
      if (['class', 'class_start_end', 'class_office_off', 'incourse'].includes(t)) classDays++;
      else if (['vacation', 'class_off'].includes(t)) { vacationDays++; holidayDays++; }
      else if (t === 'possible_off') holidayDays++;
      else if (t === 'pl') plDays++;
      else if (t === 'exam') examDays++;
    });
  });

  return { classWeeks, classDays, vacationDays, plDays, examDays, holidayDays };
};

// Flat ordered list of all date strings in the grid (for range selection)
export const getAllDates = (weeks) => weeks.flat().map(toDateStr);
