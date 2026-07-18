import { useMemo, useState, useEffect, useRef } from 'react';
import { teacherAPI } from '../../../services/teacherAPI';
import { courseAPI } from '../../../services/courseAPI';
import { courseTeacherAPI } from '../../../services/courseTeacherAPI';
import { syllabusAPI } from '../../../services/syllabusAPI';
import { makeRoutineEligibility } from '../Courses/routineEligibility';
import './styles/CourseWiseTeacher.css';

const FIELD_CONFIG = {
  history:            { label: 'History',       multi: true  },
  firstChoice:        { label: '1st Choice',    multi: false },
  secondChoice:       { label: '2nd Choice',    multi: false },
  thirdChoice:        { label: '3rd Choice',    multi: false },
  otherChoices:       { label: 'Other',         multi: true  },
  teacherAssignments: { label: 'Assign Teacher', multi: true  },
};

const STATUS_FILTERS    = ['All Status', 'Assigned', 'Unassigned'];
const COURSE_TYPE_FILTERS = ['All Courses', 'Lab Only', 'Theory only'];

const normalize = (value) => value.trim().toLowerCase();

// Theory courses take exactly one teacher; lab / mixed can take several.
const isSingleTeacherCourse = (type) => type === 'theory';

function CourseWiseTeacher({ semesterId, selectedSemesters = [] }) {
  const [allCourses, setAllCourses] = useState([]);
  const [teachers,   setTeachers]   = useState([]);
  const [choicesMap, setChoicesMap] = useState({}); // courseId → DB row
  const [loading,    setLoading]    = useState(true);
  const [offeredSet,  setOfferedSet]  = useState(new Set()); // offered course ids
  const [assignments, setAssignments] = useState({});        // batchCode → syllabusId

  const [searchText,    setSearchText]    = useState('');
  const [statusFilter,  setStatusFilter]  = useState('All Status');
  const [typeFilter,    setTypeFilter]    = useState('All Courses');
  const [editorState,   setEditorState]   = useState({
    open: false, courseId: '', field: '', mode: 'replace', selectedIds: [], search: '',
  });

  // Load teachers, courses, offered options and per-batch syllabus assignments.
  useEffect(() => {
    if (!semesterId) return;
    Promise.all([
      teacherAPI.getTeachers(semesterId),
      courseAPI.getAllCourses(),
      syllabusAPI.getOfferings(semesterId),
      syllabusAPI.getAssignments(semesterId),
    ]).then(([tResult, cResult, offRes, asgRes]) => {
      if (tResult.success) setTeachers(tResult.data || []);
      if (cResult.success) setAllCourses(cResult.courses || []);
      if (offRes.success) setOfferedSet(new Set(offRes.data || []));
      if (asgRes.success) {
        const map = {};
        (asgRes.data || []).forEach(a => { map[a.batch_code] = a.syllabus_id; });
        setAssignments(map);
      }
      setLoading(false);
    });
  }, [semesterId]);

  // Same eligibility rule as Courses → Routine Courses (assigned syllabus +
  // offered options), then narrowed to courses actually opted into the routine.
  const isRoutineCourse = useMemo(() => {
    const eligible = makeRoutineEligibility(selectedSemesters, assignments, offeredSet);
    return (c) => c.is_active !== false && c.in_routine === true && eligible(c);
  }, [selectedSemesters, assignments, offeredSet]);

  // Stable string key: sorted IDs of the routine courses for this semester
  const filteredCourseIdsKey = useMemo(() => {
    if (selectedSemesters.length === 0) return '';
    return allCourses
      .filter(isRoutineCourse)
      .map(c => c.id)
      .sort()
      .join(',');
  }, [allCourses, selectedSemesters, isRoutineCourse]);

  // Per-teacher load baseline captured from the server (weekly_load_hours as
  // loaded) plus the assignment snapshot this view started with. Live load is
  // recomputed as: baseline − original contribution here + current one, so it
  // updates instantly while staying correct for courses outside this view.
  const baselineLoadRef = useRef({});   // teacherId → server load at load time
  const originalContribRef = useRef(null); // teacherId → hours from this view's initial choices

  // Load choices whenever the filtered course set changes
  useEffect(() => {
    if (!filteredCourseIdsKey || !semesterId) { setChoicesMap({}); originalContribRef.current = null; return; }
    const ids = filteredCourseIdsKey.split(',');
    courseTeacherAPI.getChoices(semesterId, ids).then(result => {
      if (result.success) {
        const map = {};
        (result.data || []).forEach(row => { map[row.course_id] = row; });
        setChoicesMap(map);
        originalContribRef.current = null; // recomputed once courses+choices are ready
      }
    });
  }, [filteredCourseIdsKey, semesterId]);

  // Snapshot the server load baseline once teachers arrive.
  useEffect(() => {
    const map = {};
    teachers.forEach(t => { map[t.id] = Number(t.weekly_load_hours) || 0; });
    baselineLoadRef.current = map;
  }, [teachers]);

  const teacherMap = useMemo(() => {
    const map = {};
    teachers.forEach(t => { map[t.id] = t; });
    return map;
  }, [teachers]);

  // How many load-hours one course adds (theory = credits, lab = credits × 4).
  const courseLoadHours = useMemo(() => {
    const map = {};
    allCourses.forEach(c => {
      const hrs = Number(c.credit_hours) || 0;
      map[c.id] = c.course_type === 'lab' ? hrs * 4 : hrs;
    });
    return map;
  }, [allCourses]);

  // Sum the hours a teacher gets from the current choicesMap (this view only).
  const contributionFromChoices = (choices) => {
    const perTeacher = {};
    Object.entries(choices).forEach(([courseId, row]) => {
      const hrs = courseLoadHours[courseId] || 0;
      (row?.teacher_assignments || []).forEach(tid => {
        perTeacher[tid] = (perTeacher[tid] || 0) + hrs;
      });
    });
    return perTeacher;
  };

  // Capture the original contribution the first time choices+courses are ready.
  useEffect(() => {
    if (originalContribRef.current === null && Object.keys(courseLoadHours).length) {
      originalContribRef.current = contributionFromChoices(choicesMap);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [choicesMap, courseLoadHours]);

  // Live load per teacher: baseline − original here + current here (rounded up).
  const liveLoadMap = useMemo(() => {
    const original = originalContribRef.current || {};
    const current  = contributionFromChoices(choicesMap);
    const out = {};
    teachers.forEach(t => {
      const base = baselineLoadRef.current[t.id] || 0;
      const load = base - (original[t.id] || 0) + (current[t.id] || 0);
      out[t.id] = Math.max(0, Math.ceil(load));
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [choicesMap, teachers, courseLoadHours]);

  // Merge courses with their choices into display rows
  const courses = useMemo(() => {
    if (selectedSemesters.length === 0) return [];
    return allCourses
      .filter(isRoutineCourse)
      .map(c => {
        const ch = choicesMap[c.id] || {};
        return {
          id:                 c.id,
          code:               c.code,
          title:              c.title,
          type:               c.course_type || 'theory',
          history:            ch.history            || [],
          firstChoice:        ch.first_choice       || '',
          secondChoice:       ch.second_choice      || '',
          thirdChoice:        ch.third_choice       || '',
          otherChoices:       ch.other_choices      || [],
          teacherAssignments: ch.teacher_assignments || [],
        };
      });
  }, [allCourses, selectedSemesters, choicesMap, isRoutineCourse]);

  const summary = useMemo(() => {
    const theory = courses.filter(c => c.type === 'theory' || c.type === 'mixed');
    const lab    = courses.filter(c => c.type === 'lab'    || c.type === 'mixed');
    return {
      totalTheory:   theory.length,
      pendingTheory: theory.filter(c => c.teacherAssignments.length === 0).length,
      totalLab:      lab.length,
      pendingLab:    lab.filter(c => c.teacherAssignments.length === 0).length,
    };
  }, [courses]);

  const filteredCourses = useMemo(() => {
    const query = normalize(searchText);
    return courses.filter(course => {
      const assignedNames = course.teacherAssignments
        .map(id => { const t = teacherMap[id]; return t ? `${t.initials} ${t.name}` : id; })
        .join(' ')
        .toLowerCase();

      const searchMatch =
        !query ||
        `${course.code} ${course.title}`.toLowerCase().includes(query) ||
        assignedNames.includes(query);

      const statusMatch =
        statusFilter === 'All Status' ||
        (statusFilter === 'Assigned'   && course.teacherAssignments.length > 0) ||
        (statusFilter === 'Unassigned' && course.teacherAssignments.length === 0);

      const typeMatch =
        typeFilter === 'All Courses' ||
        (typeFilter === 'Lab Only'    && course.type === 'lab') ||
        (typeFilter === 'Theory only' && course.type === 'theory');

      return searchMatch && statusMatch && typeMatch;
    });
  }, [courses, searchText, statusFilter, typeFilter, teacherMap]);

  const openEditor = (courseId, field, mode = 'replace') => {
    const course = courses.find(c => c.id === courseId);
    const config = FIELD_CONFIG[field];
    if (!course || !config) return;

    const value = course[field];
    const selectedIds = mode === 'replace'
      ? (Array.isArray(value) ? value : value ? [value] : [])
      : [];

    setEditorState({ open: true, courseId, field, mode, selectedIds, search: '' });
  };

  const closeEditor = () =>
    setEditorState({ open: false, courseId: '', field: '', mode: 'replace', selectedIds: [], search: '' });

  const toggleTeacher = (teacherId) => {
    const config = FIELD_CONFIG[editorState.field];
    if (!config) return;
    // Teacher-assignment editor: theory allows a single teacher, lab allows many.
    const course = courses.find(c => c.id === editorState.courseId);
    const singleTeacher = editorState.field === 'teacherAssignments'
      ? isSingleTeacherCourse(course?.type)
      : !config.multi;
    const isMulti = config.multi && editorState.mode !== 'add-one' && !singleTeacher;
    setEditorState(cur => {
      const already = cur.selectedIds.includes(teacherId);
      if (isMulti) {
        return { ...cur, selectedIds: already ? cur.selectedIds.filter(id => id !== teacherId) : [...cur.selectedIds, teacherId] };
      }
      // Single-select: picking a teacher replaces any current pick.
      return { ...cur, selectedIds: already ? [] : [teacherId] };
    });
  };

  // Persist a teacher-assignments array for a course (used by remove & editor).
  const persistAssignments = (courseId, teacherIds) => {
    const course = courses.find(c => c.id === courseId);
    if (!course) return;
    const toSave = {
      history:            course.history,
      firstChoice:        course.firstChoice  || null,
      secondChoice:       course.secondChoice || null,
      thirdChoice:        course.thirdChoice  || null,
      otherChoices:       course.otherChoices,
      teacherAssignments: teacherIds,
    };
    setChoicesMap(prev => ({
      ...prev,
      [courseId]: {
        ...prev[courseId],
        course_id:           courseId,
        history:             toSave.history,
        first_choice:        toSave.firstChoice,
        second_choice:       toSave.secondChoice,
        third_choice:        toSave.thirdChoice,
        other_choices:       toSave.otherChoices,
        teacher_assignments: teacherIds,
      },
    }));
    courseTeacherAPI.saveChoices(semesterId, courseId, toSave);
  };

  // Remove one teacher from a course's assignments.
  const removeAssignedTeacher = (courseId, teacherId) => {
    const course = courses.find(c => c.id === courseId);
    if (!course) return;
    persistAssignments(courseId, course.teacherAssignments.filter(id => id !== teacherId));
  };

  // Clear all assigned teachers for a course.
  const clearAssignments = (courseId) => {
    persistAssignments(courseId, []);
  };

  const saveEditor = () => {
    const { courseId, field, mode, selectedIds } = editorState;
    const config = FIELD_CONFIG[field];
    if (!config || !courseId) { closeEditor(); return; }

    const course = courses.find(c => c.id === courseId);
    if (!course) { closeEditor(); return; }

    // Theory courses accept a single teacher even though the field is "multi".
    const forceSingle = field === 'teacherAssignments' && isSingleTeacherCourse(course.type);

    const currentValue = course[field];
    let updatedField;
    if (mode === 'add-one' && config.multi && !forceSingle) {
      const prev = Array.isArray(currentValue) ? currentValue : currentValue ? [currentValue] : [];
      updatedField = Array.from(new Set([...prev, ...selectedIds]));
    } else if (forceSingle) {
      updatedField = selectedIds.length ? [selectedIds[0]] : [];
    } else {
      updatedField = config.multi ? selectedIds : (selectedIds[0] || '');
    }

    const updated = { ...course, [field]: updatedField };
    const toSave = {
      history:            updated.history,
      firstChoice:        updated.firstChoice  || null,
      secondChoice:       updated.secondChoice || null,
      thirdChoice:        updated.thirdChoice  || null,
      otherChoices:       updated.otherChoices,
      teacherAssignments: updated.teacherAssignments,
    };

    // Optimistic update
    setChoicesMap(prev => ({
      ...prev,
      [courseId]: {
        ...prev[courseId],
        course_id:           courseId,
        history:             toSave.history,
        first_choice:        toSave.firstChoice,
        second_choice:       toSave.secondChoice,
        third_choice:        toSave.thirdChoice,
        other_choices:       toSave.otherChoices,
        teacher_assignments: toSave.teacherAssignments,
      },
    }));

    closeEditor();
    courseTeacherAPI.saveChoices(semesterId, courseId, toSave);
  };

  // Always-current ref so the keydown listener always calls the latest saveEditor
  const saveEditorRef = useRef(null);
  saveEditorRef.current = saveEditor;

  // Enter = Save, Escape = Cancel when the teacher editor modal is open
  useEffect(() => {
    if (!editorState.open) return;
    const onKeyDown = (e) => {
      if (e.key === 'Enter') { e.preventDefault(); saveEditorRef.current?.(); }
      else if (e.key === 'Escape') { closeEditor(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorState.open]);

  const editorTeachers = useMemo(() => {
    const query = normalize(editorState.search);
    if (!query) return teachers;
    return teachers.filter(t =>
      `${t.initials} ${t.name}`.toLowerCase().includes(query)
    );
  }, [teachers, editorState.search]);

  const editorCourse = useMemo(
    () => courses.find(c => c.id === editorState.courseId) || null,
    [courses, editorState.courseId]
  );
  const editorSingleTeacher =
    editorState.field === 'teacherAssignments' && isSingleTeacherCourse(editorCourse?.type);

  const editorTitle = useMemo(() => {
    const config = FIELD_CONFIG[editorState.field];
    if (!config) return 'Select teacher';
    if (editorState.field === 'teacherAssignments') {
      const had = (editorCourse?.teacherAssignments?.length || 0) > 0;
      if (editorState.mode === 'add-one') return 'Add another teacher';
      return had ? 'Edit assigned teacher' : 'Assign teacher';
    }
    return editorState.mode === 'add-one'
      ? `Add another teacher to ${config.label}`
      : `Update ${config.label}`;
  }, [editorState.field, editorState.mode, editorCourse]);

  const renderTags = (value, emptyLabel = 'Not selected', variant = '') => {
    const ids = Array.isArray(value) ? value : value ? [value] : [];
    if (ids.length === 0) return <span className="cwt-tag empty">{emptyLabel}</span>;
    return ids.map(id => {
      const t = teacherMap[id];
      return (
        <span key={id} className={`cwt-tag${variant ? ` ${variant}` : ''}`} data-tooltip={t ? t.name : id}>
          {t ? t.initials : id.slice(0, 6)}
        </span>
      );
    });
  };

  if (loading) {
    return (
      <div className="allocation-panel">
        <p style={{ color: '#6a7d94', fontSize: 14 }}>Loading course data...</p>
      </div>
    );
  }

  return (
    <div className="allocation-panel">
      <h3 className="allocation-panel-title">Course Wise Teacher</h3>
      <p className="allocation-panel-description">
        Assign teachers to the courses selected for the routine (checked in Courses → Routine
        Courses). Only those courses appear here.
      </p>

      <section className="cwt-summary-grid">
        <article className="cwt-summary-card blue">
          <h4>{summary.totalTheory}</h4>
          <p>Total Theory Course</p>
        </article>
        <article className="cwt-summary-card amber">
          <h4>{summary.pendingTheory}</h4>
          <p>Pending Theory</p>
        </article>
        <article className="cwt-summary-card green">
          <h4>{summary.totalLab}</h4>
          <p>Total Lab Course</p>
        </article>
        <article className="cwt-summary-card indigo">
          <h4>{summary.pendingLab}</h4>
          <p>Pending Lab</p>
        </article>
      </section>

      {selectedSemesters.length === 0 ? (
        <p className="cwt-empty-notice">
          No semesters selected. Please select semesters on the Home page.
        </p>
      ) : (
        <>
          <section className="cwt-filters-wrap">
            <input
              type="text"
              className="cwt-search-input"
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              placeholder="Search courses by code, title, or teacher name"
            />
            <select
              className="cwt-filter-select"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
            >
              {STATUS_FILTERS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
            <select
              className="cwt-filter-select"
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
            >
              {COURSE_TYPE_FILTERS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </section>

          <section className="cwt-table-section">
            <div className="cwt-table-heading">
              <h4>Course Allocation Table</h4>
              <p>Showing {filteredCourses.length} of {courses.length} courses.</p>
            </div>

            <div className="cwt-table-wrap">
              <table className="cwt-table">
                <thead>
                  <tr>
                    <th>Course</th>
                    <th>History</th>
                    <th>1st Choice</th>
                    <th>2nd Choice</th>
                    <th>3rd Choice</th>
                    <th>Other</th>
                    <th>Assign Teacher</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCourses.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="cwt-empty-row">
                        {courses.length === 0
                          ? 'No routine courses for the selected semesters. Check the courses in Courses → Routine Courses first.'
                          : 'No course found for current search/filter.'}
                      </td>
                    </tr>
                  ) : (
                    filteredCourses.map(course => (
                      <tr key={course.id}>
                        <td>
                          <div className="cwt-course-cell">
                            <p className="cwt-course-code">{course.code}</p>
                            <p className="cwt-course-title">{course.title}</p>
                            <span className={`cwt-course-type ${course.type}`}>{course.type}</span>
                          </div>
                        </td>
                        <td>
                          <div className="cwt-edit-cell">
                            <div className="cwt-tag-wrap">{renderTags(course.history, 'No history')}</div>
                            <button type="button" className="cwt-mini-btn" onClick={() => openEditor(course.id, 'history')}>
                              Change
                            </button>
                          </div>
                        </td>
                        <td>
                          <div className="cwt-edit-cell">
                            <div className="cwt-tag-wrap">{renderTags(course.firstChoice)}</div>
                            <button type="button" className="cwt-mini-btn" onClick={() => openEditor(course.id, 'firstChoice')}>
                              {course.firstChoice ? 'Change' : 'Select'}
                            </button>
                          </div>
                        </td>
                        <td>
                          <div className="cwt-edit-cell">
                            <div className="cwt-tag-wrap">{renderTags(course.secondChoice)}</div>
                            <button type="button" className="cwt-mini-btn" onClick={() => openEditor(course.id, 'secondChoice')}>
                              {course.secondChoice ? 'Change' : 'Select'}
                            </button>
                          </div>
                        </td>
                        <td>
                          <div className="cwt-edit-cell">
                            <div className="cwt-tag-wrap">{renderTags(course.thirdChoice)}</div>
                            <button type="button" className="cwt-mini-btn" onClick={() => openEditor(course.id, 'thirdChoice')}>
                              {course.thirdChoice ? 'Change' : 'Select'}
                            </button>
                          </div>
                        </td>
                        <td>
                          <div className="cwt-edit-cell">
                            <div className="cwt-tag-wrap">{renderTags(course.otherChoices, 'None')}</div>
                            <button type="button" className="cwt-mini-btn" onClick={() => openEditor(course.id, 'otherChoices')}>
                              Change
                            </button>
                          </div>
                        </td>
                        <td>
                          <div className="cwt-edit-cell">
                            {course.teacherAssignments.length === 0 ? (
                              <span className="cwt-tag empty">Unassigned</span>
                            ) : (
                              <div className="cwt-assigned-list">
                                {course.teacherAssignments.map(id => {
                                  const t = teacherMap[id];
                                  return (
                                    <span key={id} className="cwt-tag assigned cwt-tag--removable" data-tooltip={t ? t.name : id}>
                                      {t ? t.initials : id.slice(0, 6)}
                                      <button
                                        type="button"
                                        className="cwt-tag-remove"
                                        title={`Remove ${t ? t.name : 'teacher'}`}
                                        onClick={() => removeAssignedTeacher(course.id, id)}
                                      >
                                        ×
                                      </button>
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                            <div className="cwt-assignment-actions">
                              {course.teacherAssignments.length === 0 ? (
                                <button
                                  type="button"
                                  className="cwt-mini-btn primary"
                                  onClick={() => openEditor(course.id, 'teacherAssignments')}
                                >
                                  Assign Teacher
                                </button>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    className="cwt-mini-btn primary"
                                    onClick={() => openEditor(course.id, 'teacherAssignments')}
                                    title={isSingleTeacherCourse(course.type)
                                      ? 'Change the assigned teacher'
                                      : 'Change the assigned teachers'}
                                  >
                                    Edit Teacher
                                  </button>
                                  {/* Lab / mixed can hold more than one teacher */}
                                  {!isSingleTeacherCourse(course.type) && (
                                    <button
                                      type="button"
                                      className="cwt-mini-btn"
                                      onClick={() => openEditor(course.id, 'teacherAssignments', 'add-one')}
                                    >
                                      Add Another
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    className="cwt-mini-btn danger"
                                    onClick={() => clearAssignments(course.id)}
                                    title="Remove all assigned teachers"
                                  >
                                    Remove
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {editorState.open && (
        <div className="cwt-modal-overlay" onClick={closeEditor}>
          <div className="cwt-modal" onClick={e => e.stopPropagation()}>
            <h4 className="cwt-modal-title">{editorTitle}</h4>
            <p className="cwt-modal-text">
              {editorState.field === 'teacherAssignments'
                ? (editorSingleTeacher
                    ? 'Theory course — select one teacher (picking a new one replaces the current).'
                    : 'Lab course — select one or more teachers.')
                : 'Choose from the teacher list below.'}
            </p>

            <input
              type="text"
              className="cwt-modal-search"
              value={editorState.search}
              onChange={e => setEditorState(cur => ({ ...cur, search: e.target.value }))}
              placeholder="Search by teacher name or initials"
            />

            <div className="cwt-modal-list">
              {editorTeachers.length === 0 ? (
                <p style={{ margin: '8px', color: '#607891', fontSize: 13 }}>No teachers found.</p>
              ) : (
                editorTeachers.map(t => {
                  const selected = editorState.selectedIds.includes(t.id);
                  const load  = liveLoadMap[t.id] ?? (Number(t.weekly_load_hours) || 0);
                  const limit = Number(t.load_limit) || 0;
                  const pct   = limit > 0 ? Math.min((load / limit) * 100, 100) : 0;
                  const over  = limit > 0 && load > limit;
                  const near  = !over && limit > 0 && load >= limit * 0.8;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      className={`cwt-modal-item ${selected ? 'selected' : ''}`}
                      onClick={() => toggleTeacher(t.id)}
                    >
                      <span className="cwt-modal-item-code">{t.initials}</span>
                      <span className="cwt-modal-item-name">{t.name}</span>
                      <span className="cwt-modal-item-load">
                        <span className="cwt-load-bar">
                          <span
                            className={`cwt-load-fill${over ? ' over' : near ? ' near' : ''}`}
                            style={{ width: `${pct}%` }}
                          />
                        </span>
                        <span className={`cwt-load-num${over ? ' over' : ''}`}>{load}/{limit}</span>
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            <div className="cwt-modal-actions">
              {editorState.field === 'teacherAssignments' &&
               editorState.mode !== 'add-one' &&
               (editorCourse?.teacherAssignments?.length || 0) > 0 && (
                <button
                  type="button"
                  className="cwt-modal-btn danger"
                  onClick={() => { clearAssignments(editorState.courseId); closeEditor(); }}
                >
                  Remove Allocation
                </button>
              )}
              <button type="button" className="cwt-modal-btn cancel" onClick={closeEditor}>Cancel</button>
              <button type="button" className="cwt-modal-btn save" onClick={saveEditor}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CourseWiseTeacher;
