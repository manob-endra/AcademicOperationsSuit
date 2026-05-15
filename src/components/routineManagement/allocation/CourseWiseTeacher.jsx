import { useMemo, useState, useEffect, useRef } from 'react';
import { teacherAPI } from '../../../services/teacherAPI';
import { courseAPI } from '../../../services/courseAPI';
import { courseTeacherAPI } from '../../../services/courseTeacherAPI';
import './styles/CourseWiseTeacher.css';

// Maps Home-page semester IDs to the year/semester strings stored in the courses table
const SEMESTER_MAP = {
  'Y1-S1': { year: '1st Year', semester: '1st Semester' },
  'Y1-S2': { year: '1st Year', semester: '2nd Semester' },
  'Y2-S1': { year: '2nd Year', semester: '1st Semester' },
  'Y2-S2': { year: '2nd Year', semester: '2nd Semester' },
  'Y3-S1': { year: '3rd Year', semester: '1st Semester' },
  'Y3-S2': { year: '3rd Year', semester: '2nd Semester' },
  'Y4-S1': { year: '4th Year', semester: '1st Semester' },
  'Y4-S2': { year: '4th Year', semester: '2nd Semester' },
  'MS-S1': { year: 'Master', semester: '1st Semester' },
  'MS-S2': { year: 'Master', semester: '2nd Semester' },
};

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

function CourseWiseTeacher({ selectedSemesters = [] }) {
  const [allCourses, setAllCourses] = useState([]);
  const [teachers,   setTeachers]   = useState([]);
  const [choicesMap, setChoicesMap] = useState({}); // courseId → DB row
  const [loading,    setLoading]    = useState(true);

  const [searchText,    setSearchText]    = useState('');
  const [statusFilter,  setStatusFilter]  = useState('All Status');
  const [typeFilter,    setTypeFilter]    = useState('All Courses');
  const [editorState,   setEditorState]   = useState({
    open: false, courseId: '', field: '', mode: 'replace', selectedIds: [], search: '',
  });

  // Load teachers and all active courses once
  useEffect(() => {
    Promise.all([
      teacherAPI.getTeachers(),
      courseAPI.getAllCourses(),
    ]).then(([tResult, cResult]) => {
      if (tResult.success) setTeachers(tResult.data || []);
      if (cResult.success) setAllCourses(cResult.courses || []);
      setLoading(false);
    });
  }, []);

  // Stable string key: sorted IDs of courses in selected semesters
  const filteredCourseIdsKey = useMemo(() => {
    const selectedPairs = selectedSemesters.map(id => SEMESTER_MAP[id]).filter(Boolean);
    if (selectedPairs.length === 0) return '';
    return allCourses
      .filter(c =>
        c.is_active !== false &&
        selectedPairs.some(p => c.year === p.year && c.semester === p.semester)
      )
      .map(c => c.id)
      .sort()
      .join(',');
  }, [allCourses, selectedSemesters]);

  // Load choices whenever the filtered course set changes
  useEffect(() => {
    if (!filteredCourseIdsKey) { setChoicesMap({}); return; }
    const ids = filteredCourseIdsKey.split(',');
    courseTeacherAPI.getChoices(ids).then(result => {
      if (result.success) {
        const map = {};
        (result.data || []).forEach(row => { map[row.course_id] = row; });
        setChoicesMap(map);
      }
    });
  }, [filteredCourseIdsKey]);

  const teacherMap = useMemo(() => {
    const map = {};
    teachers.forEach(t => { map[t.id] = t; });
    return map;
  }, [teachers]);

  // Merge courses with their choices into display rows
  const courses = useMemo(() => {
    const selectedPairs = selectedSemesters.map(id => SEMESTER_MAP[id]).filter(Boolean);
    if (selectedPairs.length === 0) return [];
    return allCourses
      .filter(c =>
        c.is_active !== false &&
        selectedPairs.some(p => c.year === p.year && c.semester === p.semester)
      )
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
  }, [allCourses, selectedSemesters, choicesMap]);

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
    const isMulti = config.multi && editorState.mode !== 'add-one';
    setEditorState(cur => {
      const already = cur.selectedIds.includes(teacherId);
      if (isMulti) {
        return { ...cur, selectedIds: already ? cur.selectedIds.filter(id => id !== teacherId) : [...cur.selectedIds, teacherId] };
      }
      return { ...cur, selectedIds: already ? [] : [teacherId] };
    });
  };

  const saveEditor = () => {
    const { courseId, field, mode, selectedIds } = editorState;
    const config = FIELD_CONFIG[field];
    if (!config || !courseId) { closeEditor(); return; }

    const course = courses.find(c => c.id === courseId);
    if (!course) { closeEditor(); return; }

    const currentValue = course[field];
    let updatedField;
    if (mode === 'add-one' && config.multi) {
      const prev = Array.isArray(currentValue) ? currentValue : currentValue ? [currentValue] : [];
      updatedField = Array.from(new Set([...prev, ...selectedIds]));
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
    courseTeacherAPI.saveChoices(courseId, toSave);
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

  const editorTitle = useMemo(() => {
    const config = FIELD_CONFIG[editorState.field];
    if (!config) return 'Select teacher';
    return editorState.mode === 'add-one'
      ? `Add another teacher to ${config.label}`
      : `Update ${config.label}`;
  }, [editorState.field, editorState.mode]);

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
        Assign teachers by course with intelligent filtering and editable choice columns.
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
                        No course found for current search/filter.
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
                            <div className="cwt-tag-wrap">
                              {renderTags(course.teacherAssignments, 'Unassigned', 'assigned')}
                            </div>
                            <div className="cwt-assignment-actions">
                              <button
                                type="button"
                                className="cwt-mini-btn primary"
                                onClick={() => openEditor(course.id, 'teacherAssignments')}
                              >
                                Assign Teacher
                              </button>
                              {course.teacherAssignments.length > 0 && (
                                <button
                                  type="button"
                                  className="cwt-mini-btn"
                                  onClick={() => openEditor(course.id, 'teacherAssignments', 'add-one')}
                                >
                                  Add Another
                                </button>
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
            <p className="cwt-modal-text">Choose from the teacher list below.</p>

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
                  return (
                    <button
                      key={t.id}
                      type="button"
                      className={`cwt-modal-item ${selected ? 'selected' : ''}`}
                      onClick={() => toggleTeacher(t.id)}
                    >
                      <span className="cwt-modal-item-code">{t.initials}</span>
                      <span className="cwt-modal-item-name">{t.name}</span>
                    </button>
                  );
                })
              )}
            </div>

            <div className="cwt-modal-actions">
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
