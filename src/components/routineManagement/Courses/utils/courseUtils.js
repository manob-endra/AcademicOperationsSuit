// Course utility functions

// Course types that carry no routine classes (weekly classes forced to 0)
export const NON_CLASS_TYPES = ['Project', 'Internship', 'Viva'];
export const ALL_COURSE_TYPES = ['Theory', 'Lab', 'Mixed', ...NON_CLASS_TYPES];

export const isNonClassType = (type) =>
  NON_CLASS_TYPES.some(t => t.toLowerCase() === String(type || '').toLowerCase());

export const validateCourseFields = (course) => {
  const requiredFields = ['code', 'title', 'type', 'year', 'semester', 'credit'];

  for (let field of requiredFields) {
    if (!course[field] || (typeof course[field] === 'string' && course[field].trim() === '')) {
      return { isValid: false, message: `${field.charAt(0).toUpperCase() + field.slice(1)} is required` };
    }
  }

  if (isNaN(course.credit) || parseFloat(course.credit) <= 0) {
    return { isValid: false, message: 'Credit must be a valid positive number' };
  }

  return { isValid: true, message: 'All fields are valid' };
};

// ── Row normalisation for imports ──────────────────────────────────────────
// Accepts header spellings like "Course Code", "code", "COURSE_CODE" and
// value variations ("theory", "Theory"). weeklyClasses defaults per type.

const HEADER_ALIASES = {
  code:          ['code', 'course code', 'course_code', 'coursecode'],
  title:         ['title', 'course title', 'course_title', 'name'],
  type:          ['type', 'course type', 'course_type'],
  year:          ['year'],
  semester:      ['semester', 'term'],
  credit:        ['credit', 'credits', 'credit hours', 'credit_hours'],
  weeklyClasses: ['weekly classes', 'weekly_classes', 'weeklyclasses', 'classes/week'],
};

const canonField = (header) => {
  const h = String(header || '').trim().toLowerCase();
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    if (aliases.includes(h)) return field;
  }
  return null;
};

const YEAR_NORMALIZE = {
  '1': '1st Year', '1st': '1st Year', '1st year': '1st Year',
  '2': '2nd Year', '2nd': '2nd Year', '2nd year': '2nd Year',
  '3': '3rd Year', '3rd': '3rd Year', '3rd year': '3rd Year',
  '4': '4th Year', '4th': '4th Year', '4th year': '4th Year',
  'ms': 'Master', 'master': 'Master', 'masters': 'Master',
};

const SEM_NORMALIZE = {
  '1': '1st Semester', '1st': '1st Semester', '1st semester': '1st Semester',
  '2': '2nd Semester', '2nd': '2nd Semester', '2nd semester': '2nd Semester',
};

const defaultWeekly = (type) => {
  const t = String(type || '').toLowerCase();
  if (t === 'lab') return 1;
  if (isNonClassType(t)) return 0;
  return 3; // theory / mixed
};

const normalizeRow = (row) => {
  const code = String(row.code || '').trim();
  const title = String(row.title || '').trim();
  if (!code || !title) return null;

  const rawType = String(row.type || 'Theory').trim();
  const type = ALL_COURSE_TYPES.find(t => t.toLowerCase() === rawType.toLowerCase()) || 'Theory';

  const rawYear = String(row.year || '').trim();
  const year = YEAR_NORMALIZE[rawYear.toLowerCase()] || rawYear;

  const rawSem = String(row.semester || '').trim();
  const semester = SEM_NORMALIZE[rawSem.toLowerCase()] || rawSem;

  const credit = parseFloat(row.credit);
  const weekly = row.weeklyClasses !== undefined && row.weeklyClasses !== ''
    ? parseInt(row.weeklyClasses)
    : defaultWeekly(type);

  return {
    code,
    title,
    type,
    year,
    semester,
    credit: isNaN(credit) ? 0 : credit,
    weeklyClasses: isNonClassType(type) ? 0 : (isNaN(weekly) ? defaultWeekly(type) : weekly),
  };
};

// Build courses from a 2-D array (first row = headers)
const rowsToCourses = (rows) => {
  if (!rows || rows.length < 2) return [];
  const fields = rows[0].map(canonField);
  const courses = [];
  for (let i = 1; i < rows.length; i++) {
    const raw = {};
    fields.forEach((f, col) => { if (f) raw[f] = rows[i][col]; });
    const course = normalizeRow(raw);
    if (course) courses.push(course);
  }
  return courses;
};

// Split one CSV line respecting double quotes
const splitCSVLine = (line) => {
  const out = [];
  let cur = '', inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      out.push(cur); cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map(v => v.trim());
};

export const parseCSVFile = (fileContent) => {
  const lines = String(fileContent).trim().split(/\r?\n/).filter(Boolean);
  return rowsToCourses(lines.map(splitCSVLine));
};

// Parse an Excel workbook (ArrayBuffer) — first sheet, first row = headers.
// xlsx is loaded on demand so it never weighs down the main bundle.
export const parseExcelFile = async (arrayBuffer) => {
  const XLSX = await import('xlsx');
  const wb = XLSX.read(arrayBuffer, { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return [];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  return rowsToCourses(rows.map(r => r.map(v => String(v))));
};

export const generateCourseID = () => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

export const filterCoursesBySemester = (courses, selectedSemesters) => {
  if (!selectedSemesters || selectedSemesters.length === 0) {
    return courses;
  }
  return courses.filter(course => selectedSemesters.includes(course.semester));
};
