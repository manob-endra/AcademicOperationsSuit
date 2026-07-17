import { useState, useMemo } from 'react';
import { courseAPI } from '../../../../services/courseAPI';

// Course types shown as separate lists. Values match transformDBCourse's
// capitalized `type`. Only checked courses take part in routine generation.
const TYPE_TABS = ['Theory', 'Lab', 'Mixed', 'Project', 'Internship', 'Viva'];

/**
 * Routine Courses tab.
 *
 * Per course-type, a checklist of every catalog course. A checked course has
 * in_routine = true and is the ONLY kind of course routine generation and
 * conflict checks consider (opt-in). Project/internship/viva can be checked
 * too, though with no weekly classes they won't produce scheduled slots.
 */
function RoutineCoursesPanel({ courses, onCoursesChanged }) {
  const [activeType, setActiveType] = useState('Theory');
  const [search, setSearch] = useState('');
  const [busyIds, setBusyIds] = useState(new Set());
  const [error, setError] = useState('');

  const countsByType = useMemo(() => {
    const map = {};
    for (const t of TYPE_TABS) map[t] = { total: 0, on: 0 };
    for (const c of courses) {
      const bucket = map[c.type];
      if (!bucket) continue;
      bucket.total += 1;
      if (c.inRoutine) bucket.on += 1;
    }
    return map;
  }, [courses]);

  const typeCourses = useMemo(() => {
    const q = search.trim().toLowerCase();
    return courses
      .filter(c => c.type === activeType)
      .filter(c => !q || `${c.code} ${c.title}`.toLowerCase().includes(q))
      .sort((a, b) => a.code.localeCompare(b.code));
  }, [courses, activeType, search]);

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
        Check the courses that should take part in routine generation. Only checked courses are
        scheduled and conflict-checked — everything else stays in the catalog but sits out of the
        routine.
      </p>

      {error && <div className="error-message">{error}</div>}

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
        <div className="rcp-empty">No {activeType.toLowerCase()} courses{search ? ' match your search' : ''}.</div>
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
              <span className="rcp-item-meta">{c.year} · {c.semester}{c.credit ? ` · ${c.credit} cr` : ''}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

export default RoutineCoursesPanel;
