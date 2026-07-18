import { useEffect, useMemo, useRef, useState } from 'react';
import { courseTimeAPI } from '../../../services/courseTimeAPI';
import { courseAPI } from '../../../services/courseAPI';
import { syllabusAPI } from '../../../services/syllabusAPI';
import { makeRoutineEligibility } from '../Courses/routineEligibility';
import './styles/CourseTime.css';

/* ─── helpers ───────────────────────────────────────────────────────────── */

const normalizePosInt = (value) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) || parsed < 1 ? null : parsed;
};

// Weekly-frequency options for the "Apply by Credit" control. Each maps to a
// weekly_classes count plus an `alternating` flag.
const FREQUENCY_OPTIONS = [
  { value: '1',   label: '1 class per week',            weekly: 1, alternating: false },
  { value: '2',   label: '2 classes per week',          weekly: 2, alternating: false },
  { value: '3',   label: '3 classes per week',          weekly: 3, alternating: false },
  { value: '4',   label: '4 classes per week',          weekly: 4, alternating: false },
  { value: 'alt', label: '1 class every other week',    weekly: 1, alternating: true  },
];

// Neatly format a credit number (3, 1.5, 0.75) without trailing zeros.
const fmtCredit = (n) => {
  const v = Number(n);
  return Number.isFinite(v) ? String(v) : '—';
};

/* ─── Inline Weekly-Classes cell ─────────────────────────────────────────── */

function WeeklyClassesCell({ courseId, value, onSave }) {
  const [local, setLocal]   = useState(value != null ? String(value) : '');
  const [saving, setSaving] = useState(false);

  // Keep in sync when parent updates (e.g. after "Apply to All")
  useEffect(() => {
    setLocal(value != null ? String(value) : '');
  }, [value]);

  const commit = async () => {
    const parsed = normalizePosInt(local);
    if (parsed === null) {
      setLocal(value != null ? String(value) : '');
      return;
    }
    if (parsed === value) return; // no change
    setSaving(true);
    await onSave(courseId, parsed);
    setSaving(false);
  };

  return (
    <input
      type="number"
      min="1"
      className="ct-weekly-input"
      value={local}
      placeholder="—"
      disabled={saving}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
      title="Weekly classes — press Enter or click away to save"
    />
  );
}

/* ─── Section component ─────────────────────────────────────────────────── */

function CourseDurationSection({
  sectionKey,
  title,
  courses,
  durations,
  weeklyClasses,
  alternatingMap = {},
  onSaveDuration,
  onSaveBulk,
  onSaveWeeklyClasses,
  onSaveBulkWeeklyClasses,
  onApplyByCredit,
}) {
  const [allDuration,      setAllDuration]      = useState('');
  const [allWeekly,        setAllWeekly]         = useState('');
  const [searchTerm,       setSearchTerm]        = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [customDuration,   setCustomDuration]   = useState('');
  const [customWeekly,     setCustomWeekly]     = useState('');
  const [saving,           setSaving]           = useState(false);
  const [message,          setMessage]          = useState({ text: '', type: 'success' });
  const msgTimerRef = useRef(null);

  // Apply-by-credit controls
  const [credit,        setCredit]        = useState('');
  const [creditPeriods, setCreditPeriods] = useState('1');
  const [creditFreq,    setCreditFreq]    = useState('1');

  // Distinct credits present among this section's courses, with course counts.
  const creditOptions = useMemo(() => {
    const counts = new Map();
    courses.forEach((c) => {
      const v = Number(c.credit_hours);
      if (Number.isFinite(v)) counts.set(v, (counts.get(v) || 0) + 1);
    });
    return [...counts.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([value, count]) => ({ value, count }));
  }, [courses]);

  useEffect(() => {
    if (creditOptions.length > 0 && credit === '') {
      setCredit(String(creditOptions[0].value));
    }
  }, [creditOptions, credit]);

  useEffect(() => {
    if (courses.length > 0 && !selectedCourseId) {
      setSelectedCourseId(courses[0].id);
    }
  }, [courses, selectedCourseId]);

  useEffect(() => () => { if (msgTimerRef.current) clearTimeout(msgTimerRef.current); }, []);

  const showMessage = (text, type = 'success') => {
    if (msgTimerRef.current) clearTimeout(msgTimerRef.current);
    setMessage({ text, type });
    msgTimerRef.current = setTimeout(() => setMessage({ text: '', type: 'success' }), 3500);
  };

  const filteredCourses = useMemo(() => {
    if (!searchTerm.trim()) return courses;
    const q = searchTerm.toLowerCase();
    return courses.filter(
      (c) => c.code.toLowerCase().includes(q) || c.title.toLowerCase().includes(q)
    );
  }, [courses, searchTerm]);

  const assignedDurCount = useMemo(
    () => courses.filter((c) => durations[c.id] != null).length,
    [courses, durations]
  );

  const assignedWklyCount = useMemo(
    () => courses.filter((c) => weeklyClasses[c.id] != null).length,
    [courses, weeklyClasses]
  );

  /* apply duration to all ------------------------------------------------- */
  const handleApplyAll = async () => {
    const durVal  = normalizePosInt(allDuration);
    const wklyVal = normalizePosInt(allWeekly);

    if (!durVal && !wklyVal) {
      showMessage('Enter a duration and/or weekly classes count to apply.', 'error');
      return;
    }
    if (courses.length === 0) {
      showMessage('No courses in this section.', 'error');
      return;
    }

    setSaving(true);
    const promises = [];

    if (durVal) {
      promises.push(onSaveBulk(courses.map((c) => c.id), durVal));
    }
    if (wklyVal) {
      promises.push(onSaveBulkWeeklyClasses(courses.map((c) => c.id), wklyVal));
    }

    const results = await Promise.all(promises);
    setSaving(false);

    const failed = results.find((r) => !r.success);
    if (failed) {
      showMessage(`Save failed: ${failed.error}`, 'error');
    } else {
      const parts = [];
      if (durVal)  parts.push(`duration = ${durVal} period(s)`);
      if (wklyVal) parts.push(`weekly classes = ${wklyVal}`);
      showMessage(`Applied ${parts.join(', ')} to all ${courses.length} ${title.toLowerCase()} courses.`);
      setAllDuration('');
      setAllWeekly('');
    }
  };

  /* apply custom per course ----------------------------------------------- */
  const handleApplyCustom = async () => {
    if (!selectedCourseId) {
      showMessage('Select a course first.', 'error');
      return;
    }
    const durVal  = normalizePosInt(customDuration);
    const wklyVal = normalizePosInt(customWeekly);

    if (!durVal && !wklyVal) {
      showMessage('Enter a duration and/or weekly classes count to apply.', 'error');
      return;
    }

    const course = courses.find((c) => c.id === selectedCourseId);
    setSaving(true);
    const promises = [];
    if (durVal)  promises.push(onSaveDuration(selectedCourseId, durVal));
    if (wklyVal) promises.push(onSaveWeeklyClasses(selectedCourseId, wklyVal));
    const results = await Promise.all(promises);
    setSaving(false);

    const failed = results.find((r) => !r.success);
    if (failed) {
      showMessage(`Save failed: ${failed.error}`, 'error');
    } else {
      const parts = [];
      if (durVal)  parts.push(`${durVal} period(s)`);
      if (wklyVal) parts.push(`${wklyVal} weekly class${wklyVal > 1 ? 'es' : ''}`);
      showMessage(`Updated ${course?.code ?? selectedCourseId} → ${parts.join(', ')}.`);
      setCustomDuration('');
      setCustomWeekly('');
    }
  };

  /* apply by credit -------------------------------------------------------- */
  const handleApplyByCredit = async () => {
    const creditVal = Number(credit);
    const periods   = normalizePosInt(creditPeriods);
    const freq      = FREQUENCY_OPTIONS.find((f) => f.value === creditFreq);

    if (!Number.isFinite(creditVal)) { showMessage('Select a credit value.', 'error'); return; }
    if (!periods) { showMessage('Enter periods per class (>= 1).', 'error'); return; }
    if (!freq)    { showMessage('Select a weekly frequency.', 'error'); return; }

    const ids = courses.filter((c) => Number(c.credit_hours) === creditVal).map((c) => c.id);
    if (ids.length === 0) { showMessage(`No ${title.toLowerCase()} courses with ${fmtCredit(creditVal)} credit.`, 'error'); return; }

    setSaving(true);
    const result = await onApplyByCredit(ids, {
      durationPeriods: periods,
      weeklyClasses: freq.weekly,
      alternating: freq.alternating,
    });
    setSaving(false);

    if (result?.success) {
      showMessage(`Applied ${periods} period/class · ${freq.label} to ${ids.length} ${fmtCredit(creditVal)}-credit ${title.toLowerCase()} course${ids.length !== 1 ? 's' : ''}.`);
    } else {
      showMessage(`Save failed: ${result?.error || 'unknown error'}`, 'error');
    }
  };

  if (courses.length === 0) {
    return (
      <section className="ct-section-card" aria-label={`${title} section`}>
        <div className="ct-section-header">
          <h3>{title} Courses</h3>
        </div>
        <p className="ct-empty">
          No {title.toLowerCase()} courses found. Add courses from the Courses page first.
        </p>
      </section>
    );
  }

  return (
    <section className="ct-section-card" aria-label={`${title} course duration section`}>

      {/* ── header ── */}
      <div className="ct-section-header">
        <h3>{title} Courses</h3>
        <div className="ct-assigned-counts">
          <span className="ct-course-count">Duration: {assignedDurCount} / {courses.length}</span>
          <span className="ct-course-count">Weekly Classes: {assignedWklyCount} / {courses.length}</span>
        </div>
      </div>

      {/* ── apply by credit ── */}
      <div className="ct-block">
        <h4 className="ct-block-title">Apply By Credit</h4>
        <p className="ct-block-hint">
          Set periods per class and how often it meets, for every {title.toLowerCase()} course
          of a given credit.
        </p>
        <div className="ct-inline-controls ct-inline-controls--wide">
          <div className="ct-input-group">
            <label htmlFor={`${sectionKey}-credit`}>Credit</label>
            <select
              id={`${sectionKey}-credit`}
              value={credit}
              onChange={(e) => setCredit(e.target.value)}
            >
              {creditOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {fmtCredit(o.value)} credit ({o.count} course{o.count !== 1 ? 's' : ''})
                </option>
              ))}
            </select>
          </div>
          <div className="ct-input-group">
            <label htmlFor={`${sectionKey}-credit-periods`}>Periods / Class</label>
            <input
              id={`${sectionKey}-credit-periods`}
              type="number"
              min="1"
              value={creditPeriods}
              onChange={(e) => setCreditPeriods(e.target.value)}
              placeholder="e.g. 1"
            />
          </div>
          <div className="ct-input-group">
            <label htmlFor={`${sectionKey}-credit-freq`}>Classes / Week</label>
            <select
              id={`${sectionKey}-credit-freq`}
              value={creditFreq}
              onChange={(e) => setCreditFreq(e.target.value)}
            >
              {FREQUENCY_OPTIONS.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          </div>
          <button
            type="button"
            className="ct-btn ct-btn-primary"
            onClick={handleApplyByCredit}
            disabled={saving || creditOptions.length === 0}
          >
            {saving ? 'Saving…' : 'Apply By Credit'}
          </button>
        </div>
      </div>

      {/* ── apply to all ── */}
      <div className="ct-block">
        <h4 className="ct-block-title">Apply To All Courses</h4>
        <div className="ct-inline-controls ct-inline-controls--wide">
          <div className="ct-input-group">
            <label htmlFor={`${sectionKey}-all-duration`}>Duration (periods)</label>
            <input
              id={`${sectionKey}-all-duration`}
              type="number"
              min="1"
              value={allDuration}
              onChange={(e) => setAllDuration(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.currentTarget.blur(); handleApplyAll(); } }}
              placeholder="e.g. 1"
            />
          </div>
          <div className="ct-input-group">
            <label htmlFor={`${sectionKey}-all-weekly`}>Weekly Classes</label>
            <input
              id={`${sectionKey}-all-weekly`}
              type="number"
              min="1"
              value={allWeekly}
              onChange={(e) => setAllWeekly(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.currentTarget.blur(); handleApplyAll(); } }}
              placeholder="e.g. 3"
            />
          </div>
          <button
            type="button"
            className="ct-btn ct-btn-primary"
            onClick={handleApplyAll}
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Apply To All'}
          </button>
        </div>
      </div>

      {/* ── custom per course ── */}
      <div className="ct-block">
        <h4 className="ct-block-title">Custom Duration By Course</h4>
        <div className="ct-grid-controls ct-grid-controls--4">
          <div className="ct-input-group">
            <label htmlFor={`${sectionKey}-search`}>Search Course</label>
            <input
              id={`${sectionKey}-search`}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by code or title"
            />
          </div>

          <div className="ct-input-group">
            <label htmlFor={`${sectionKey}-course`}>Select Course</label>
            <select
              id={`${sectionKey}-course`}
              value={selectedCourseId}
              onChange={(e) => setSelectedCourseId(e.target.value)}
            >
              {filteredCourses.length === 0 ? (
                <option value="">No course found</option>
              ) : (
                filteredCourses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} — {c.title}
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="ct-input-group">
            <label htmlFor={`${sectionKey}-custom-duration`}>Duration (periods)</label>
            <input
              id={`${sectionKey}-custom-duration`}
              type="number"
              min="1"
              value={customDuration}
              onChange={(e) => setCustomDuration(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.currentTarget.blur(); handleApplyCustom(); } }}
              placeholder="e.g. 2"
            />
          </div>

          <div className="ct-input-group">
            <label htmlFor={`${sectionKey}-custom-weekly`}>Weekly Classes</label>
            <input
              id={`${sectionKey}-custom-weekly`}
              type="number"
              min="1"
              value={customWeekly}
              onChange={(e) => setCustomWeekly(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.currentTarget.blur(); handleApplyCustom(); } }}
              placeholder="e.g. 3"
            />
          </div>
        </div>

        <button
          type="button"
          className="ct-btn ct-btn-secondary"
          onClick={handleApplyCustom}
          disabled={saving}
        >
          {saving ? 'Saving…' : 'Apply to Selected Course'}
        </button>
      </div>

      {/* ── feedback ── */}
      {message.text && (
        <p className={`ct-message ${message.type === 'error' ? 'error' : 'success'}`}>
          {message.text}
        </p>
      )}

      {/* ── table ── */}
      <div className="ct-table-wrapper">
        <table className="ct-table">
          <thead>
            <tr>
              <th>Course Code</th>
              <th>Course Title</th>
              <th>Credit</th>
              <th>Year / Semester</th>
              <th>Periods / Class</th>
              <th>Weekly Classes</th>
            </tr>
          </thead>
          <tbody>
            {courses.map((course) => {
              const periods = durations[course.id];
              const weekly  = weeklyClasses[course.id];
              const alt     = alternatingMap[course.id];
              return (
                <tr key={course.id} className={periods != null || weekly != null ? 'ct-row-assigned' : ''}>
                  <td>
                    <span className="ct-course-code">{course.code}</span>
                  </td>
                  <td>{course.title}</td>
                  <td className="ct-meta">{fmtCredit(course.credit_hours)}</td>
                  <td className="ct-meta">
                    {[course.year, course.semester].filter(Boolean).join(' / ') || '—'}
                  </td>
                  <td>
                    {periods != null ? (
                      <span className="ct-duration-badge">{periods} period{periods !== 1 ? 's' : ''}</span>
                    ) : (
                      <span className="ct-unset">Not set</span>
                    )}
                  </td>
                  <td>
                    <div className="ct-weekly-cell-wrap">
                      <WeeklyClassesCell
                        courseId={course.id}
                        value={weekly ?? null}
                        onSave={onSaveWeeklyClasses}
                      />
                      {alt && <span className="ct-alt-badge" title="One class every other week">every other week</span>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* ─── Main page component ───────────────────────────────────────────────── */

function CourseTime({ semesterId, selectedSemesters = [] }) {
  const [allCourses,   setAllCourses]   = useState([]);
  const [durations,    setDurations]    = useState({});      // { courseId: durationPeriods }
  const [weeklyClasses, setWeeklyClasses] = useState({});    // { courseId: weeklyClasses }
  const [alternatingMap, setAlternatingMap] = useState({});  // { courseId: bool }
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);
  const [offeredSet,  setOfferedSet]  = useState(new Set()); // offered course ids
  const [assignments, setAssignments] = useState({});        // batchCode → syllabusId

  useEffect(() => { if (semesterId) loadData(); }, [semesterId]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadData = async () => {
    setLoading(true);
    setError(null);

    const [coursesResult, durationsResult, offRes, asgRes] = await Promise.all([
      courseAPI.getAllCourses(),
      courseTimeAPI.getDurations(semesterId),
      syllabusAPI.getOfferings(semesterId),
      syllabusAPI.getAssignments(semesterId),
    ]);

    if (coursesResult.success) {
      setAllCourses(coursesResult.courses || []);
    } else {
      setError(
        coursesResult.offline
          ? 'Backend server is not running. Please start it with: npm run dev'
          : coursesResult.error
      );
      setLoading(false);
      return;
    }

    if (durationsResult.success) {
      const durObj  = {};
      const wklyObj = {};
      const altObj  = {};
      (durationsResult.data || []).forEach((d) => {
        durObj[d.course_id]  = d.duration_periods;
        if (d.weekly_classes != null) wklyObj[d.course_id] = d.weekly_classes;
        altObj[d.course_id] = !!d.alternating;
      });
      setDurations(durObj);
      setWeeklyClasses(wklyObj);
      setAlternatingMap(altObj);
    }

    if (offRes.success) setOfferedSet(new Set(offRes.data || []));
    if (asgRes.success) {
      const map = {};
      (asgRes.data || []).forEach(a => { map[a.batch_code] = a.syllabus_id; });
      setAssignments(map);
    }

    setLoading(false);
  };

  // Only the routine courses (same rule as Courses → Routine Courses) get
  // durations set — those are the ones the admin builds the routine for.
  const courses = useMemo(() => {
    const eligible = makeRoutineEligibility(selectedSemesters, assignments, offeredSet);
    return allCourses.filter(c => c.is_active !== false && c.in_routine === true && eligible(c));
  }, [allCourses, selectedSemesters, assignments, offeredSet]);

  /* ── callbacks ── */

  const saveDuration = async (courseId, durationPeriods) => {
    const result = await courseTimeAPI.saveDuration(semesterId, courseId, durationPeriods);
    if (result.success) {
      setDurations((prev) => ({ ...prev, [courseId]: durationPeriods }));
      return { success: true };
    }
    return { success: false, error: result.error };
  };

  const saveBulkDurations = async (courseIds, durationPeriods) => {
    const payload = courseIds.map((id) => ({ courseId: id, durationPeriods }));
    const result = await courseTimeAPI.saveBulkDurations(semesterId, payload);
    if (result.success) {
      setDurations((prev) => {
        const updated = { ...prev };
        courseIds.forEach((id) => { updated[id] = durationPeriods; });
        return updated;
      });
      return { success: true };
    }
    return { success: false, error: result.error };
  };

  const saveWeeklyClasses = async (courseId, count) => {
    const result = await courseTimeAPI.saveWeeklyClasses(semesterId, courseId, count);
    if (result.success) {
      setWeeklyClasses((prev) => ({ ...prev, [courseId]: count }));
      return { success: true };
    }
    return { success: false, error: result.error };
  };

  const saveBulkWeeklyClasses = async (courseIds, count) => {
    const result = await courseTimeAPI.saveBulkWeeklyClasses(semesterId, courseIds, count);
    if (result.success) {
      setWeeklyClasses((prev) => {
        const updated = { ...prev };
        courseIds.forEach((id) => { updated[id] = count; });
        return updated;
      });
      return { success: true };
    }
    return { success: false, error: result.error };
  };

  // Apply periods-per-class + weekly frequency (+ alternating) to a credit's courses.
  const applyByCredit = async (courseIds, values) => {
    const result = await courseTimeAPI.applyByCredit(semesterId, courseIds, values);
    if (result.success) {
      setDurations((prev) => {
        const u = { ...prev };
        courseIds.forEach((id) => { u[id] = values.durationPeriods; });
        return u;
      });
      setWeeklyClasses((prev) => {
        const u = { ...prev };
        courseIds.forEach((id) => { u[id] = values.weeklyClasses; });
        return u;
      });
      setAlternatingMap((prev) => {
        const u = { ...prev };
        courseIds.forEach((id) => { u[id] = !!values.alternating; });
        return u;
      });
      return { success: true };
    }
    return { success: false, error: result.error };
  };

  /* ── split courses by type ── */
  const theoryCourses = courses.filter(
    (c) => c.course_type === 'theory' || c.course_type === 'mixed'
  );
  const labCourses = courses.filter((c) => c.course_type === 'lab');

  /* ── loading / error states ── */

  if (loading) {
    return (
      <div className="course-time-container">
        <div className="ct-status-box">Loading courses…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="course-time-container">
        <div className="ct-status-box ct-status-error">
          <p>{error}</p>
          <button type="button" className="ct-btn ct-btn-primary" onClick={loadData}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (courses.length === 0) {
    return (
      <div className="course-time-container">
        <div className="ct-status-box">
          <p>No routine courses for the selected semesters.</p>
          <p className="ct-hint">Check the courses in <strong>Courses → Routine Courses</strong> first — only those appear here for duration setup.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="course-time-container">
      <div className="ct-sections-grid">
        <CourseDurationSection
          sectionKey="theory"
          title="Theory"
          courses={theoryCourses}
          durations={durations}
          weeklyClasses={weeklyClasses}
          alternatingMap={alternatingMap}
          onSaveDuration={saveDuration}
          onSaveBulk={saveBulkDurations}
          onSaveWeeklyClasses={saveWeeklyClasses}
          onSaveBulkWeeklyClasses={saveBulkWeeklyClasses}
          onApplyByCredit={applyByCredit}
        />
        <CourseDurationSection
          sectionKey="lab"
          title="Lab"
          courses={labCourses}
          durations={durations}
          weeklyClasses={weeklyClasses}
          alternatingMap={alternatingMap}
          onSaveDuration={saveDuration}
          onSaveBulk={saveBulkDurations}
          onSaveWeeklyClasses={saveWeeklyClasses}
          onSaveBulkWeeklyClasses={saveBulkWeeklyClasses}
          onApplyByCredit={applyByCredit}
        />
      </div>
    </div>
  );
}

export default CourseTime;
