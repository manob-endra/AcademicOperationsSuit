/**
 * Teacher seniority ranking + default max teaching load.
 *
 * One ordered ladder used everywhere teachers are listed, so every list
 * sorts the same way: Dean → Chairman → Professor → Associate Professor →
 * Assistant Professor → Lecturer.
 *
 * Dean and Chairman are administrative posts (stored in `special_post`),
 * while the rest are academic ranks (stored in `designation`). A Dean is
 * usually also a Professor, so ranking checks the special post first and
 * falls back to the designation.
 *
 * The number beside each rank is that rank's DEFAULT maximum weekly load
 * (hours) — used to pre-fill a new teacher's load limit. Admins can still
 * override it per teacher.
 */

// Rank order (index = seniority; lower = more senior) with default load.
const RANKS = [
  { key: 'Dean',                 defaultLoad: 6  },
  { key: 'Chairman',             defaultLoad: 6  },
  { key: 'Professor',            defaultLoad: 8  },
  { key: 'Associate Professor',  defaultLoad: 10 },
  { key: 'Assistant Professor',  defaultLoad: 12 },
  { key: 'Lecturer',             defaultLoad: 16 },
];

// Ranks that live in `special_post` rather than `designation`.
const SPECIAL_POST_RANKS = new Set(['Dean', 'Chairman']);

const norm = (v) => String(v || '').trim().toLowerCase();

// Loose matching so "Sr. Lecturer" / "Senior Lecturer" fold onto Lecturer,
// "Assoc. Professor" onto Associate Professor, etc.
function matchRankIndex(value) {
  const v = norm(value);
  if (!v) return -1;
  if (v.includes('dean')) return 0;
  if (v.includes('chairman') || v.includes('chairperson') || v.includes('head')) return 1;
  if (v.includes('associate')) return 3;
  if (v.includes('assistant')) return 4;
  if (v.includes('lecturer')) return 5;          // senior lecturer + lecturer
  if (v.includes('professor')) return 2;         // plain professor (after assoc/assist checked)
  return -1;
}

/**
 * Seniority index for a teacher row (lower = more senior). Checks the
 * administrative post first, then the academic designation. Unranked
 * teachers sort last.
 */
export function teacherRankIndex(teacher) {
  const bySpecial = matchRankIndex(teacher?.special_post);
  if (bySpecial !== -1 && SPECIAL_POST_RANKS.has(RANKS[bySpecial].key)) return bySpecial;
  const byDesignation = matchRankIndex(teacher?.designation);
  if (byDesignation !== -1) return byDesignation;
  return RANKS.length; // unknown → after everyone
}

/**
 * Comparator for Array.prototype.sort — seniority first, then name so ties
 * are stable and alphabetical.
 */
export function compareTeachersByRank(a, b) {
  const ra = teacherRankIndex(a);
  const rb = teacherRankIndex(b);
  if (ra !== rb) return ra - rb;
  return String(a?.name || '').localeCompare(String(b?.name || ''));
}

/** Return a new array sorted by seniority (does not mutate the input). */
export function sortTeachersByRank(teachers) {
  return [...(teachers || [])].sort(compareTeachersByRank);
}

/**
 * Default max weekly load for a designation / special post. Used to pre-fill
 * a new teacher's load limit. Falls back to the Lecturer default when the
 * rank is unknown.
 */
export function defaultLoadLimit({ designation, special_post } = {}) {
  const idx = teacherRankIndex({ designation, special_post });
  return idx < RANKS.length ? RANKS[idx].defaultLoad : RANKS[RANKS.length - 1].defaultLoad;
}

export const TEACHER_RANKS = RANKS;
