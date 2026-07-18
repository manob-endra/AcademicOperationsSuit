/**
 * Shared "which courses take part in the routine" logic.
 *
 * Used by both the Courses → Routine Courses panel (where the admin CHECKS
 * courses) and the Allocation → Course Wise Teacher page (where the admin
 * assigns teachers to those same courses). Keeping one implementation means
 * the two lists can never drift apart.
 *
 * A course is eligible when ALL of these hold:
 *   • it matches one of the selected batch semesters (Y1-S1 …) by year+semester
 *   • it belongs to the syllabus assigned to that batch this semester
 *     (Semester Syllabus tab). If no syllabus is assigned yet, syllabus is
 *     not enforced so nothing disappears before assignment.
 *   • compulsory (no option group) OR grouped AND offered this semester
 *
 * Course objects may be raw DB rows (snake_case: course_type, syllabus_id,
 * option_group_id) or the Courses-page shape (camelCase: type, syllabusId,
 * optionGroupId). Both are handled.
 */

const YEAR_MAP = { Y1: '1st Year', Y2: '2nd Year', Y3: '3rd Year', Y4: '4th Year', MS: 'Master' };
const SEM_MAP  = { S1: '1st Semester', S2: '2nd Semester' };

export const batchToPair = (code) => {
  const [y, s] = String(code).split('-');
  return { year: YEAR_MAP[y] || null, semester: SEM_MAP[s] || null };
};

// Reduce a year string ('1st Year', 'Master', '2', …) to a comparable id.
export const yearIdOf = (yearStr) => {
  if (!yearStr) return null;
  const lower = String(yearStr).toLowerCase();
  if (lower.includes('master') || lower === 'ms') return 'master';
  const m = lower.match(/([1-4])/);
  return m ? parseInt(m[1]) : null;
};

export const sameYearSem = (course, pair) =>
  yearIdOf(course.year) !== null &&
  yearIdOf(course.year) === yearIdOf(pair.year) &&
  String(course.semester).toLowerCase() === String(pair.semester).toLowerCase();

// Read syllabus / option-group ids from either row shape.
const syllabusIdOf   = (c) => c.syllabusId ?? c.syllabus_id ?? null;
const optionGroupIdOf = (c) => c.optionGroupId ?? c.option_group_id ?? null;

/**
 * Build the eligible-course predicate.
 *
 * @param {string[]} selectedSemesters  batch codes selected on the Home page
 * @param {Object}   assignments        { batchCode: syllabusId }
 * @param {Set}      offeredSet          offered course ids this semester
 * @returns {(course) => boolean}
 */
export function makeRoutineEligibility(selectedSemesters, assignments = {}, offeredSet = new Set()) {
  const targets = (selectedSemesters || []).map(code => ({
    ...batchToPair(code),
    syllabusId: assignments[code] || null,
  }));

  return (course) => {
    const target = targets.find(t => sameYearSem(course, t));
    if (!target) return false;
    const sid = syllabusIdOf(course);
    if (target.syllabusId && sid && sid !== target.syllabusId) return false;
    if (optionGroupIdOf(course) && !offeredSet.has(course.id)) return false;
    return true;
  };
}
