import { useState, useMemo, useEffect } from 'react';
import { courseAPI } from '../../../../services/courseAPI';
import { syllabusAPI } from '../../../../services/syllabusAPI';
import { makeRoutineEligibility } from '../routineEligibility';

// Course types shown as separate lists. Values match transformDBCourse's
// capitalized `type`. Only checked courses take part in routine generation.
const TYPE_TABS = ['Theory', 'Lab', 'Mixed', 'Project', 'Internship', 'Viva'];

/**
 * Routine Courses tab.
 *
 * Per course-type, a checklist of the courses eligible to take part in the
 * routine. A checked course has in_routine = true and is the ONLY kind of
 * course routine generation and conflict checks consider (opt-in).
 *
 * Which courses are ELIGIBLE to appear here:
 *   • Compulsory courses (no option group) — always listed.
 *   • Grouped / optional courses — listed only when the department has
 *     OFFERED them this semester (ticked in Semester Syllabus → offered
 *     options). A grouped course that isn't offered is ignored entirely,
 *     matching how routine generation treats it.
 */
function RoutineCoursesPanel({ semesterId, courses, optionGroups = [], selectedSemesters = [], syllabi = [], onCoursesChanged }) {
  const [activeType, setActiveType] = useState('Theory');
  const [search, setSearch] = useState('');
  const [busyIds, setBusyIds] = useState(new Set());
  const [error, setError] = useState('');
  const [offeredSet, setOfferedSet] = useState(new Set());
  const [assignments, setAssignments] = useState({}); // batchCode → syllabusId

  // Load this semester's offered options + per-batch syllabus assignments.
  useEffect(() => {
    if (!semesterId) return;
    let active = true;
    Promise.all([
      syllabusAPI.getOfferings(semesterId),
      syllabusAPI.getAssignments(semesterId),
    ]).then(([offRes, asgRes]) => {
      if (!active) return;
      if (offRes.success) setOfferedSet(new Set(offRes.data || []));
      if (asgRes.success) {
        const map = {};
        (asgRes.data || []).forEach(a => { map[a.batch_code] = a.syllabus_id; });
        setAssignments(map);
      }
    });
    return () => { active = false; };
  }, [semesterId]);

  const groupName = (id) => optionGroups.find(g => g.id === id)?.name || null;
  const hasSelection = selectedSemesters.length > 0;

  // Eligible = matches a selected batch's assigned syllabus + offered options
  // (shared with the Allocation page so both lists always agree).
  const eligibleCourses = useMemo(() => {
    const isEligible = makeRoutineEligibility(selectedSemesters, assignments, offeredSet);
    return courses.filter(isEligible);
  }, [courses, selectedSemesters, assignments, offeredSet]);

  const countsByType = useMemo(() => {
    const map = {};
    for (const t of TYPE_TABS) map[t] = { total: 0, on: 0 };
    for (const c of eligibleCourses) {
      const bucket = map[c.type];
      if (!bucket) continue;
      bucket.total += 1;
      if (c.inRoutine) bucket.on += 1;
    }
    return map;
  }, [eligibleCourses]);

  const typeCourses = useMemo(() => {
    const q = search.trim().toLowerCase();
    return eligibleCourses
      .filter(c => c.type === activeType)
      .filter(c => !q || `${c.code} ${c.title}`.toLowerCase().includes(q))
      .sort((a, b) => a.code.localeCompare(b.code));
  }, [eligibleCourses, activeType, search]);

  const applyChange = (ids, inRoutine) => {
    // optimistic
    onCoursesChanged(prev => prev.map(c => ids.includes(c.id) ? { ...c, inRoutine } : c));
  };

  const setOne = async (course, inRoutine) => {
    setBusyIds(prev => new Set(prev).add(course.id));
    setError('');
    applyChange([course.id], inRoutine);
    const r = await courseAPI.setInRoutine([course.id], inRoutine);
    if (!r.success) {
      applyChange([course.id], !inRoutine); // revert
      setError(r.error || 'Failed to update.');
    }
    setBusyIds(prev => { const n = new Set(prev); n.delete(course.id); return n; });
  };

  const setMany = async (inRoutine) => {
    const ids = typeCourses.map(c => c.id);
    if (ids.length === 0) return;
    setError('');
    applyChange(ids, inRoutine);
    const r = await courseAPI.setInRoutine(ids, inRoutine);
    if (!r.success) {
      applyChange(ids, !inRoutine);
      setError(r.error || 'Failed to update.');
    }
  };

  return (
    <div className="rcp-wrap">
      <p className="rcp-hint">
        Shows the courses of each selected semester, taken from the syllabus assigned to that
        semester in the <strong>Semester Syllabus</strong> tab (e.g. 1st Year 1st Semester → its
        2023 syllabus courses). Optional (grouped) courses appear only after they are offered there;
        unoffered options are ignored. Check the ones that should take part in routine generation —
        only checked courses are scheduled and conflict-checked.
      </p>

      {error && <div className="error-message">{error}</div>}

      {!hasSelection ? (
        <div className="rcp-empty">
          No semesters selected. Choose the running semesters on the Home page first — then the
          courses for those semesters will appear here.
        </div>
      ) : (
        <>
          {/* Type tabs */}
          <div className="rcp-type-tabs">
            {TYPE_TABS.map(t => (
              <button
                key={t}
                className={`rcp-type-tab ${activeType === t ? 'active' : ''}`}
                onClick={() => setActiveType(t)}
              >
                {t}
                <span className="rcp-type-count">{countsByType[t]?.on || 0}/{countsByType[t]?.total || 0}</span>
              </button>
            ))}
          </div>

          <div className="rcp-toolbar">
            <input
              type="text"
              className="rcp-search"
              placeholder={`Search ${activeType.toLowerCase()} courses…`}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <div className="rcp-bulk">
              <button className="action-btn add-btn" onClick={() => setMany(true)} disabled={typeCourses.length === 0}>
                Check all shown
              </button>
              <button className="action-btn" onClick={() => setMany(false)} disabled={typeCourses.length === 0}>
                Uncheck all shown
              </button>
            </div>
          </div>

          {typeCourses.length === 0 ? (
            <div className="rcp-empty">No {activeType.toLowerCase()} courses{search ? ' match your search' : ''} for the selected semesters.</div>
          ) : (
            <div className="rcp-list">
              {typeCourses.map(c => (
                <label key={c.id} className={`rcp-item${c.inRoutine ? ' on' : ''}`}>
                  <input
                    type="checkbox"
                    checked={c.inRoutine}
                    disabled={busyIds.has(c.id)}
                    onChange={e => setOne(c, e.target.checked)}
                  />
                  <span className="rcp-item-code">{c.code}</span>
                  <span className="rcp-item-title">{c.title}</span>
                  {c.optionGroupId && (
                    <span className="optional-chip" title={`Optional — offered from ${groupName(c.optionGroupId) || 'a group'}`}>
                      {groupName(c.optionGroupId) || 'Optional'}
                    </span>
                  )}
                  <span className="rcp-item-meta">{c.year} · {c.semester}{c.credit ? ` · ${c.credit} cr` : ''}</span>
                </label>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default RoutineCoursesPanel;
