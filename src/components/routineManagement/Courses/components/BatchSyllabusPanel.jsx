import { useState, useEffect, useMemo, useCallback } from 'react';
import { syllabusAPI } from '../../../../services/syllabusAPI';
import '../styles/SyllabusManager.css';

const BATCH_LABELS = {
  'Y1-S1': '1st Year · 1st Semester', 'Y1-S2': '1st Year · 2nd Semester',
  'Y2-S1': '2nd Year · 1st Semester', 'Y2-S2': '2nd Year · 2nd Semester',
  'Y3-S1': '3rd Year · 1st Semester', 'Y3-S2': '3rd Year · 2nd Semester',
  'Y4-S1': '4th Year · 1st Semester', 'Y4-S2': '4th Year · 2nd Semester',
  'MS-S1': 'Master · 1st Semester',   'MS-S2': 'Master · 2nd Semester',
};

const BATCH_TO_PAIR = {
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

/**
 * Per-academic-semester syllabus assignment + offered options.
 *
 * For each running batch level selected on the Home page, the admin picks
 * which syllabus that batch follows this semester (old batches keep the old
 * syllabus, new batches the new one). For option groups in that syllabus
 * semester, the admin ticks which optional courses actually run — that
 * choice lives in course_offerings, never in the syllabus itself.
 */
function BatchSyllabusPanel({ semesterId, selectedSemesters, syllabi, optionGroups, courses }) {
  const [assignments, setAssignments] = useState({}); // batchCode → syllabusId
  const [offered, setOffered] = useState(new Set());  // courseId set
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState(null);

  const load = useCallback(async () => {
    if (!semesterId) return;
    setLoading(true);
    const [aRes, oRes] = await Promise.all([
      syllabusAPI.getAssignments(semesterId),
      syllabusAPI.getOfferings(semesterId),
    ]);
    if (aRes.success) {
      const map = {};
      (aRes.data || []).forEach(r => { map[r.batch_code] = r.syllabus_id; });
      setAssignments(map);
    }
    if (oRes.success) setOffered(new Set(oRes.data || []));
    setLoading(false);
  }, [semesterId]);

  useEffect(() => { load(); }, [load]);

  const handleAssign = async (batchCode, syllabusId) => {
    setSavingKey(batchCode);
    const r = await syllabusAPI.assignSyllabus(semesterId, batchCode, syllabusId || null);
    setSavingKey(null);
    if (r.success) {
      setAssignments(prev => {
        const next = { ...prev };
        if (syllabusId) next[batchCode] = syllabusId;
        else delete next[batchCode];
        return next;
      });
    } else {
      alert(r.error || 'Failed to save syllabus assignment.');
    }
  };

  const handleToggleOffer = async (courseId, nowOffered) => {
    setSavingKey(courseId);
    const r = await syllabusAPI.setOffering(semesterId, courseId, nowOffered);
    setSavingKey(null);
    if (r.success) {
      setOffered(prev => {
        const next = new Set(prev);
        if (nowOffered) next.add(courseId);
        else next.delete(courseId);
        return next;
      });
    } else {
      alert(r.error || 'Failed to save offering.');
    }
  };

  // For each selected batch level: the option groups of its assigned
  // syllabus that sit in that year/semester, with their member courses.
  const batchRows = useMemo(() => {
    return (selectedSemesters || []).map(code => {
      const pair = BATCH_TO_PAIR[code];
      const syllabusId = assignments[code] || '';
      const groups = syllabusId && pair
        ? optionGroups.filter(g =>
            g.syllabus_id === syllabusId && g.year === pair.year && g.semester === pair.semester
          ).map(g => ({
            ...g,
            members: courses.filter(c => c.optionGroupId === g.id),
          }))
        : [];
      return { code, label: BATCH_LABELS[code] || code, syllabusId, groups };
    });
  }, [selectedSemesters, assignments, optionGroups, courses]);

  if (!selectedSemesters || selectedSemesters.length === 0) {
    return (
      <div className="sylm-empty">
        <p>No running semesters selected. Select the semesters on the Home page first — then assign each one its syllabus here.</p>
      </div>
    );
  }

  if (loading) {
    return <p className="sylm-hint">Loading syllabus assignments…</p>;
  }

  return (
    <div className="sylm-wrap">
      <p className="sylm-hint">
        Each running batch follows exactly one syllabus this semester. Older batches keep the
        older syllabus; newer batches follow the new one — both run side by side without conflict.
        For option groups, tick which optional courses actually run; unticked options never
        reach the routine.
      </p>

      <div className="bsp-list">
        {batchRows.map(row => (
          <div key={row.code} className="bsp-card">
            <div className="bsp-card-head">
              <span className="bsp-batch-label">{row.label}</span>
              <select
                className="bsp-syllabus-select"
                value={row.syllabusId}
                disabled={savingKey === row.code}
                onChange={e => handleAssign(row.code, e.target.value)}
              >
                <option value="">No syllabus assigned (all courses match by year/semester)</option>
                {syllabi.map(s => (
                  <option key={s.id} value={s.id}>{s.title} ({s.effective_session})</option>
                ))}
              </select>
            </div>

            {row.syllabusId && row.groups.length > 0 && (
              <div className="bsp-groups">
                {row.groups.map(g => {
                  const offeredCount = g.members.filter(c => offered.has(c.id)).length;
                  const overChosen = offeredCount > g.choose_count;
                  return (
                    <div key={g.id} className="bsp-group">
                      <div className="bsp-group-head">
                        <span className="bsp-group-name">{g.name}</span>
                        <span className={`bsp-group-count${overChosen ? ' over' : ''}`}>
                          {offeredCount} of {g.choose_count} offered
                          {overChosen ? ' — more than choose count!' : ''}
                        </span>
                      </div>
                      {g.members.length === 0 ? (
                        <p className="sylm-hint">No courses in this group yet — assign them from Add/Edit Course.</p>
                      ) : (
                        <div className="bsp-group-courses">
                          {g.members.map(c => (
                            <label key={c.id} className={`bsp-offer-item${offered.has(c.id) ? ' offered' : ''}`}>
                              <input
                                type="checkbox"
                                checked={offered.has(c.id)}
                                disabled={savingKey === c.id}
                                onChange={e => handleToggleOffer(c.id, e.target.checked)}
                              />
                              <span className="bsp-offer-code">{c.code}</span>
                              <span className="bsp-offer-title">{c.title}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {row.syllabusId && row.groups.length === 0 && (
              <p className="sylm-hint" style={{ margin: '8px 0 0' }}>
                No option groups in this syllabus for {row.label} — all its courses are compulsory.
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default BatchSyllabusPanel;
