/* ─── constants ──────────────────────────────────────────────────────────── */

const DEFAULTS = {
  theoryPreferences: 0,
  labPreferences:    0,
  timePreferences:   0,
  weeklyLoadHours:   0,
  loadLimit:         10,
  assignedCourses:   [],
};

// Titles that should be ignored when building initials
const HONORIFICS = new Set([
  'dr', 'mr', 'mrs', 'ms', 'prof', 'professor',
  'eng', 'engr', 'er', 'sir', 'lecturer',
]);

/* ─── helpers ─────────────────────────────────────────────────────────────── */

/**
 * Remove leading honorific words from a name.
 * e.g. "Dr. Ahmed Khan" → "Ahmed Khan"
 *      "Prof. Sara Rahman" → "Sara Rahman"
 *      "Ahmed Khan" → "Ahmed Khan"  (unchanged)
 */
const stripHonorifics = (name) => {
  const words = name.trim().split(/\s+/);
  while (words.length > 1) {
    const token = words[0].replace(/\.$/, '').toLowerCase();
    if (HONORIFICS.has(token)) words.shift();
    else break;
  }
  return words.join(' ');
};

/**
 * Build an ordered list of candidate initials for a name.
 *
 * Strategy (after stripping honorifics and uppercasing):
 *   Round 0 : 1 letter from each word            e.g.  "Ahmed Khan"  → "AK"
 *   Round 1 : 2 letters from word[0], 1 from rest       → "AHK"
 *   Round 2 : 3 letters from word[0], 1 from rest       → "AHMK"
 *   …exhaust word[0] first, then extend word[1], word[2], etc.
 *
 * This matches the rule: "use another letter from the first name;
 * if that also exists, use one from the second name; and so on."
 */
const buildCandidates = (name) => {
  const clean = stripHonorifics(name);
  const parts = clean.toUpperCase().trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return ['T'];

  const candidates = [];
  const seen       = new Set();
  const counts     = new Array(parts.length).fill(1);

  const push = () => {
    const c = parts.map((p, i) => p.slice(0, counts[i])).join('');
    if (!seen.has(c)) { seen.add(c); candidates.push(c); }
  };

  push(); // base: 1 char from each part

  // Extend one char at a time, starting from the LAST word and working backwards.
  // The second letter of the first/given name is only reached after all letters
  // of the surname(s) have been tried first.
  let extended = true;
  while (extended) {
    extended = false;
    for (let i = parts.length - 1; i >= 0; i--) {
      if (counts[i] < parts[i].length) {
        counts[i]++;
        push();
        extended = true;
        break;
      }
    }
  }

  return candidates;
};

/* ─── public API ──────────────────────────────────────────────────────────── */

/**
 * Return initials for `name` that are not present in `existingInitials`.
 * Falls back to appending numbers only after every letter combination is tried.
 */
export const generateUniqueInitials = (name, existingInitials = []) => {
  const taken      = new Set(existingInitials.map((i) => i.toUpperCase()));
  const candidates = buildCandidates(name);

  for (const c of candidates) {
    if (!taken.has(c)) return c;
  }

  // Last resort: append incrementing number to the longest candidate
  const base = candidates[candidates.length - 1] || 'T';
  for (let n = 2; n <= 999; n++) {
    const c = base + n;
    if (!taken.has(c)) return c;
  }

  return base + Date.now().toString().slice(-4);
};

// Only name is required; initials are auto-generated
export const validateTeacherFields = (teacher) =>
  Boolean(teacher.name?.trim());

/**
 * Parse CSV — only needs a "name" column.
 * Initials are generated per-row, unique within existingInitials + this batch.
 */
export const parseCSVFile = (fileContent, existingInitials = []) => {
  const lines = fileContent.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const nameIdx = headers.indexOf('name');
  if (nameIdx === -1) return [];

  const usedInBatch = [...existingInitials];
  const teachers    = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map((v) => v.trim());
    const name   = values[nameIdx] || '';
    if (!name) continue;

    const initials = generateUniqueInitials(name, usedInBatch);
    usedInBatch.push(initials);
    teachers.push({ ...DEFAULTS, name, initials });
  }

  return teachers;
};

/**
 * Parse XML — reads <teacher><name>…</name></teacher> nodes.
 * Initials are auto-generated with the same uniqueness guarantee.
 */
export const parseXMLFile = (fileContent, existingInitials = []) => {
  const parser = new DOMParser();
  const doc    = parser.parseFromString(fileContent, 'text/xml');
  const nodes  = doc.getElementsByTagName('teacher');

  const usedInBatch = [...existingInitials];
  const teachers    = [];

  for (const node of nodes) {
    const name = node.getElementsByTagName('name')[0]?.textContent?.trim() || '';
    if (!name) continue;

    const initials = generateUniqueInitials(name, usedInBatch);
    usedInBatch.push(initials);
    teachers.push({ ...DEFAULTS, name, initials });
  }

  return teachers;
};

// Check for duplicate teachers by name (case-insensitive)
export const isDuplicateTeacher = (teachers, newTeacher) =>
  teachers.some((t) => t.name.toLowerCase() === newTeacher.name.toLowerCase());
