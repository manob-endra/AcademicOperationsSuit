import { useEffect, useMemo, useRef, useState } from 'react';
import { courseTimeAPI } from '../../../services/courseTimeAPI';
import './styles/CourseTime.css';

/* ─── helpers ───────────────────────────────────────────────────────────── */

const normalizePosInt = (value) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) || parsed < 1 ? null : parsed;
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
  onSaveDuration,
  onSaveBulk,
  onSaveWeeklyClasses,
  onSaveBulkWeeklyClasses,
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
              <th>Year / Semester</th>
              <th>Duration (Periods)</th>
              <th>Weekly Classes</th>
            </tr>
          </thead>
          <tbody>
            {courses.map((course) => {
              const periods = durations[course.id];
              const weekly  = weeklyClasses[course.id];
              return (
                <tr key={course.id} className={periods != null || weekly != null ? 'ct-row-assigned' : ''}>
                  <td>
                    <span className="ct-course-code">{course.code}</span>
                  </td>
                  <td>{course.title}</td>
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
                    <WeeklyClassesCell
                      courseId={course.id}
                      value={weekly ?? null}
                      onSave={onSaveWeeklyClasses}
                    />
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

function CourseTime({ semesterId }) {
  const [courses,      setCourses]      = useState([]);
  const [durations,    setDurations]    = useState({});      // { courseId: durationPeriods }
  const [weeklyClasses, setWeeklyClasses] = useState({});    // { courseId: weeklyClasses }
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);

  useEffect(() => { if (semesterId) loadData(); }, [semesterId]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadData = async () => {
    setLoading(true);
    setError(null);

    const [coursesResult, durationsResult] = await Promise.all([
      courseTimeAPI.getCourses(),
      courseTimeAPI.getDurations(semesterId),
    ]);

    if (coursesResult.success) {
      setCourses(coursesResult.data || []);
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
      (durationsResult.data || []).forEach((d) => {
        durObj[d.course_id]  = d.duration_periods;
        if (d.weekly_classes != null) wklyObj[d.course_id] = d.weekly_classes;
      });
      setDurations(durObj);
      setWeeklyClasses(wklyObj);
    }

    setLoading(false);
  };

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
          <p>No courses found in the database.</p>
          <p className="ct-hint">Add courses from the <strong>Courses</strong> management page first.</p>
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
          onSaveDuration={saveDuration}
          onSaveBulk={saveBulkDurations}
          onSaveWeeklyClasses={saveWeeklyClasses}
          onSaveBulkWeeklyClasses={saveBulkWeeklyClasses}
        />
        <CourseDurationSection
          sectionKey="lab"
          title="Lab"
          courses={labCourses}
          durations={durations}
          weeklyClasses={weeklyClasses}
          onSaveDuration={saveDuration}
          onSaveBulk={saveBulkDurations}
          onSaveWeeklyClasses={saveWeeklyClasses}
          onSaveBulkWeeklyClasses={saveBulkWeeklyClasses}
        />
      </div>
    </div>
  );
}

export default CourseTime;
