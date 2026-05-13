import { useEffect, useMemo, useRef, useState } from 'react';
import { courseTimeAPI } from '../../../services/courseTimeAPI';
import './styles/CourseTime.css';

/* ─── helpers ───────────────────────────────────────────────────────────── */

const normalizeDuration = (value) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) || parsed < 1 ? null : parsed;
};

/* ─── Section component ─────────────────────────────────────────────────── */

/**
 * CourseDurationSection
 *
 * Props
 *   sectionKey       string   – unique id prefix for form labels
 *   title            string   – section heading ("Theory" / "Lab" / "Mixed")
 *   courses          array    – [{ id, code, title, course_type, year, semester }]
 *   durations        object   – { [courseId]: durationPeriods (number) }
 *   onSaveDuration   (courseId, periods) => Promise<{success, error?}>
 *   onSaveBulk       (courseIds, periods) => Promise<{success, error?}>
 */
function CourseDurationSection({ sectionKey, title, courses, durations, onSaveDuration, onSaveBulk }) {
  const [allCourseDuration, setAllCourseDuration] = useState('');
  const [searchTerm, setSearchTerm]               = useState('');
  const [selectedCourseId, setSelectedCourseId]   = useState('');
  const [customDuration, setCustomDuration]       = useState('');
  const [saving, setSaving]                       = useState(false);
  const [message, setMessage]                     = useState({ text: '', type: 'success' });
  const msgTimerRef = useRef(null);

  // Default selected course once courses arrive
  useEffect(() => {
    if (courses.length > 0 && !selectedCourseId) {
      setSelectedCourseId(courses[0].id);
    }
  }, [courses, selectedCourseId]);

  // Cleanup timer on unmount
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

  const assignedCount = useMemo(
    () => courses.filter((c) => durations[c.id] != null).length,
    [courses, durations]
  );

  /* apply to all ---------------------------------------------------------- */
  const handleApplyAll = async () => {
    const value = normalizeDuration(allCourseDuration);
    if (!value) {
      showMessage('Enter a valid period count (≥ 1) to apply to all courses.', 'error');
      return;
    }
    if (courses.length === 0) {
      showMessage('No courses in this section.', 'error');
      return;
    }

    setSaving(true);
    const result = await onSaveBulk(courses.map((c) => c.id), value);
    setSaving(false);

    if (result.success) {
      showMessage(`Applied ${value} period(s) to all ${courses.length} ${title.toLowerCase()} courses.`);
      setAllCourseDuration('');
    } else {
      showMessage(`Save failed: ${result.error}`, 'error');
    }
  };

  /* apply custom ---------------------------------------------------------- */
  const handleApplyCustom = async () => {
    if (!selectedCourseId) {
      showMessage('Select a course before applying a custom duration.', 'error');
      return;
    }
    const value = normalizeDuration(customDuration);
    if (!value) {
      showMessage('Enter a valid custom period count (≥ 1).', 'error');
      return;
    }

    const course = courses.find((c) => c.id === selectedCourseId);
    setSaving(true);
    const result = await onSaveDuration(selectedCourseId, value);
    setSaving(false);

    if (result.success) {
      showMessage(`Updated ${course?.code ?? selectedCourseId} → ${value} period(s).`);
      setCustomDuration('');
    } else {
      showMessage(`Save failed: ${result.error}`, 'error');
    }
  };

  if (courses.length === 0) {
    return (
      <section className="ct-section-card" aria-label={`${title} section`}>
        <div className="ct-section-header">
          <h3>{title} Courses</h3>
        </div>
        <p className="ct-empty">
          No {title.toLowerCase()} courses found in the database. Add courses from the
          Courses page first.
        </p>
      </section>
    );
  }

  return (
    <section className="ct-section-card" aria-label={`${title} course duration section`}>
      {/* ── header ── */}
      <div className="ct-section-header">
        <h3>{title} Courses</h3>
        <span className="ct-course-count">
          Assigned: {assignedCount} / {courses.length}
        </span>
      </div>

      {/* ── apply to all ── */}
      <div className="ct-block">
        <h4 className="ct-block-title">Set Duration For All Courses</h4>
        <div className="ct-inline-controls">
          <div className="ct-input-group">
            <label htmlFor={`${sectionKey}-all-duration`}>Duration (periods)</label>
            <input
              id={`${sectionKey}-all-duration`}
              type="number"
              min="1"
              value={allCourseDuration}
              onChange={(e) => setAllCourseDuration(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.currentTarget.blur(); handleApplyAll(); } }}
              placeholder="e.g. 2"
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
        <div className="ct-grid-controls">
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
            <label htmlFor={`${sectionKey}-custom-duration`}>Custom Duration (periods)</label>
            <input
              id={`${sectionKey}-custom-duration`}
              type="number"
              min="1"
              value={customDuration}
              onChange={(e) => setCustomDuration(e.target.value)}
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
          {saving ? 'Saving…' : 'Apply Custom Duration'}
        </button>
      </div>

      {/* ── feedback message ── */}
      {message.text && (
        <p className={`ct-message ${message.type === 'error' ? 'error' : 'success'}`}>
          {message.text}
        </p>
      )}

      {/* ── duration table ── */}
      <div className="ct-table-wrapper">
        <table className="ct-table">
          <thead>
            <tr>
              <th>Course Code</th>
              <th>Course Title</th>
              <th>Year / Semester</th>
              <th>Duration (Periods)</th>
            </tr>
          </thead>
          <tbody>
            {courses.map((course) => {
              const periods = durations[course.id];
              return (
                <tr key={course.id} className={periods != null ? 'ct-row-assigned' : ''}>
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

function CourseTime() {
  const [courses, setCourses]     = useState([]);
  const [durations, setDurations] = useState({});   // { [courseId]: durationPeriods }
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);

    const [coursesResult, durationsResult] = await Promise.all([
      courseTimeAPI.getCourses(),
      courseTimeAPI.getDurations(),
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
      const obj = {};
      (durationsResult.data || []).forEach((d) => {
        obj[d.course_id] = d.duration_periods;
      });
      setDurations(obj);
    }

    setLoading(false);
  };

  /* ── callbacks passed to sections ── */

  const saveDuration = async (courseId, durationPeriods) => {
    const result = await courseTimeAPI.saveDuration(courseId, durationPeriods);
    if (result.success) {
      setDurations((prev) => ({ ...prev, [courseId]: durationPeriods }));
      return { success: true };
    }
    return { success: false, error: result.error };
  };

  const saveBulkDurations = async (courseIds, durationPeriods) => {
    const payload = courseIds.map((id) => ({ courseId: id, durationPeriods }));
    const result = await courseTimeAPI.saveBulkDurations(payload);
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

  /* ── filter courses by type ── */
  // theory + mixed  →  Theory section
  // lab             →  Lab section
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
          onSaveDuration={saveDuration}
          onSaveBulk={saveBulkDurations}
        />
        <CourseDurationSection
          sectionKey="lab"
          title="Lab"
          courses={labCourses}
          durations={durations}
          onSaveDuration={saveDuration}
          onSaveBulk={saveBulkDurations}
        />
      </div>
    </div>
  );
}

export default CourseTime;
