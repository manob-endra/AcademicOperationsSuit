import { useMemo, useState } from 'react';
import './styles/CourseWiseTeacher.css';

const TEACHERS = [
  { id: 'MHK', shortCode: 'MHK', name: 'Dr. Md. Hafiz Karim' },
  { id: 'HMHB', shortCode: 'HMHB', name: 'Dr. Hafiz Md. Hasan Babu' },
  { id: 'AR', shortCode: 'AR', name: 'Md. Abdur Razzaque' },
  { id: 'SP', shortCode: 'SP', name: 'Dr. Suraiya Parvin' },
  { id: 'SA', shortCode: 'SA', name: 'Dr. Sadia Anwar' },
  { id: 'MRK', shortCode: 'MRK', name: 'Dr. Md. Rezaul Karim' },
  { id: 'NK', shortCode: 'NK', name: 'Prof. Nadia Khan' },
  { id: 'SF', shortCode: 'SF', name: 'Dr. Sharmin Farhana' },
];

const INITIAL_COURSES = [
  {
    code: 'CSE-536 (3)',
    title: 'Applied Game Theory and Mechanism (MS)',
    type: 'theory',
    history: ['MHK'],
    firstChoice: '',
    secondChoice: '',
    thirdChoice: 'MHK',
    otherChoices: [],
    teacherAssignments: [],
  },
  {
    code: 'CSE-532 (3)',
    title: 'Decision Diagram for VLSI Design (MS)',
    type: 'theory',
    history: ['HMHB'],
    firstChoice: 'HMHB',
    secondChoice: '',
    thirdChoice: '',
    otherChoices: [],
    teacherAssignments: [],
  },
  {
    code: 'CSE-531 (3)',
    title: 'Reversible Logic Synthesis (MS)',
    type: 'theory',
    history: [],
    firstChoice: '',
    secondChoice: '',
    thirdChoice: 'HMHB',
    otherChoices: [],
    teacherAssignments: [],
  },
  {
    code: 'CSE-530 (3)',
    title: 'Cloud Computing',
    type: 'theory',
    history: ['AR'],
    firstChoice: '',
    secondChoice: 'AR',
    thirdChoice: '',
    otherChoices: [],
    teacherAssignments: ['AR'],
  },
  {
    code: 'CSE-528 (3)',
    title: 'Network Performance Analysis (MS)',
    type: 'theory',
    history: [],
    firstChoice: '',
    secondChoice: '',
    thirdChoice: 'AR',
    otherChoices: [],
    teacherAssignments: [],
  },
  {
    code: 'CSE-4102 (1.5)',
    title: 'Machine Learning Lab',
    type: 'lab',
    history: ['SP'],
    firstChoice: 'SP',
    secondChoice: 'SA',
    thirdChoice: '',
    otherChoices: ['MRK'],
    teacherAssignments: ['SP', 'SA'],
  },
  {
    code: 'CSE-4302 (1.5)',
    title: 'Cyber Security Lab',
    type: 'lab',
    history: ['SA'],
    firstChoice: 'SA',
    secondChoice: '',
    thirdChoice: '',
    otherChoices: [],
    teacherAssignments: ['SA'],
  },
  {
    code: 'CSE-3116 (1.5)',
    title: 'Microcontroller Lab',
    type: 'lab',
    history: ['MRK'],
    firstChoice: 'MRK',
    secondChoice: '',
    thirdChoice: '',
    otherChoices: [],
    teacherAssignments: [],
  },
];

const FIELD_CONFIG = {
  history: { label: 'History', multi: true },
  firstChoice: { label: '1st Choice', multi: false },
  secondChoice: { label: '2nd Choice', multi: false },
  thirdChoice: { label: '3rd Choice', multi: false },
  otherChoices: { label: 'Other', multi: true },
  teacherAssignments: { label: 'Teacher Assignments', multi: true },
};

const STATUS_FILTERS = ['All Status', 'Assigned', 'Unassigned'];
const COURSE_TYPE_FILTERS = ['All Courses', 'Lab Only', 'Theory only'];

const normalize = (value) => value.trim().toLowerCase();

function CourseWiseTeacher() {
  const [courses, setCourses] = useState(INITIAL_COURSES);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [typeFilter, setTypeFilter] = useState('All Courses');
  const [editorState, setEditorState] = useState({
    open: false,
    courseCode: '',
    field: '',
    mode: 'replace',
    selectedIds: [],
    search: '',
  });

  const teacherMap = useMemo(() => {
    const map = {};
    TEACHERS.forEach((teacher) => {
      map[teacher.id] = teacher;
    });
    return map;
  }, []);

  const summary = useMemo(() => {
    const theoryCourses = courses.filter((course) => course.type === 'theory');
    const labCourses = courses.filter((course) => course.type === 'lab');

    return {
      totalTheoryCourses: theoryCourses.length,
      pendingTheory: theoryCourses.filter((course) => course.teacherAssignments.length === 0).length,
      totalLabCourses: labCourses.length,
      pendingLab: labCourses.filter((course) => course.teacherAssignments.length === 0).length,
    };
  }, [courses]);

  const filteredCourses = useMemo(() => {
    const query = normalize(searchText);

    return courses.filter((course) => {
      const assignedTeacherNames = course.teacherAssignments
        .map((teacherId) => {
          const teacher = teacherMap[teacherId];
          return teacher ? `${teacher.shortCode} ${teacher.name}` : teacherId;
        })
        .join(' ')
        .toLowerCase();

      const searchMatch =
        !query ||
        `${course.code} ${course.title}`.toLowerCase().includes(query) ||
        assignedTeacherNames.includes(query);

      const statusMatch =
        statusFilter === 'All Status' ||
        (statusFilter === 'Assigned' && course.teacherAssignments.length > 0) ||
        (statusFilter === 'Unassigned' && course.teacherAssignments.length === 0);

      const typeMatch =
        typeFilter === 'All Courses' ||
        (typeFilter === 'Lab Only' && course.type === 'lab') ||
        (typeFilter === 'Theory only' && course.type === 'theory');

      return searchMatch && statusMatch && typeMatch;
    });
  }, [courses, searchText, statusFilter, typeFilter, teacherMap]);

  const openEditor = (courseCode, field, mode = 'replace') => {
    const row = courses.find((course) => course.code === courseCode);
    const config = FIELD_CONFIG[field];

    if (!row || !config) {
      return;
    }

    const value = row[field];
    const selectedIds = mode === 'replace'
      ? (Array.isArray(value) ? value : value ? [value] : [])
      : [];

    setEditorState({
      open: true,
      courseCode,
      field,
      mode,
      selectedIds,
      search: '',
    });
  };

  const closeEditor = () => {
    setEditorState({
      open: false,
      courseCode: '',
      field: '',
      mode: 'replace',
      selectedIds: [],
      search: '',
    });
  };

  const toggleTeacherSelection = (teacherId) => {
    const config = FIELD_CONFIG[editorState.field];
    if (!config) {
      return;
    }

    const isMulti = config.multi && editorState.mode !== 'add-one';

    setEditorState((current) => {
      const isAlreadySelected = current.selectedIds.includes(teacherId);

      if (isMulti) {
        return {
          ...current,
          selectedIds: isAlreadySelected
            ? current.selectedIds.filter((id) => id !== teacherId)
            : [...current.selectedIds, teacherId],
        };
      }

      return {
        ...current,
        selectedIds: isAlreadySelected ? [] : [teacherId],
      };
    });
  };

  const saveEditor = () => {
    const { courseCode, field, mode, selectedIds } = editorState;
    const config = FIELD_CONFIG[field];

    if (!config || !courseCode) {
      closeEditor();
      return;
    }

    setCourses((current) =>
      current.map((course) => {
        if (course.code !== courseCode) {
          return course;
        }

        const currentValue = course[field];

        if (mode === 'add-one' && config.multi) {
          const previous = Array.isArray(currentValue) ? currentValue : currentValue ? [currentValue] : [];
          const merged = Array.from(new Set([...previous, ...selectedIds]));
          return {
            ...course,
            [field]: merged,
          };
        }

        return {
          ...course,
          [field]: config.multi ? selectedIds : selectedIds[0] || '',
        };
      })
    );

    closeEditor();
  };

  const editorAvailableTeachers = useMemo(() => {
    const query = normalize(editorState.search);

    return TEACHERS.filter((teacher) => {
      if (!query) {
        return true;
      }

      return `${teacher.shortCode} ${teacher.name}`.toLowerCase().includes(query);
    });
  }, [editorState.search]);

  const editorTitle = useMemo(() => {
    const config = FIELD_CONFIG[editorState.field];
    if (!config) {
      return 'Select teacher';
    }

    if (editorState.mode === 'add-one') {
      return `Add another teacher to ${config.label}`;
    }

    return `Update ${config.label}`;
  }, [editorState.field, editorState.mode]);

  const renderTeacherTagList = (value, emptyLabel = 'Not selected') => {
    const ids = Array.isArray(value) ? value : value ? [value] : [];

    if (ids.length === 0) {
      return <span className="cwt-tag empty">{emptyLabel}</span>;
    }

    return ids.map((teacherId) => {
      const teacher = teacherMap[teacherId];
      const label = teacher ? teacher.shortCode : teacherId;
      return (
        <span key={`${teacherId}-${label}`} className="cwt-tag">
          {label}
        </span>
      );
    });
  };

  return (
    <div className="allocation-panel">
      <h3 className="allocation-panel-title">Course Wise Teacher</h3>
      <p className="allocation-panel-description">
        Assign teachers by course with intelligent filtering and editable choice columns.
      </p>

      <section className="cwt-summary-grid">
        <article className="cwt-summary-card blue">
          <h4>{summary.totalTheoryCourses}</h4>
          <p>Total Theory Course</p>
        </article>
        <article className="cwt-summary-card amber">
          <h4>{summary.pendingTheory}</h4>
          <p>Pending Theory</p>
        </article>
        <article className="cwt-summary-card green">
          <h4>{summary.totalLabCourses}</h4>
          <p>Total Lab Course</p>
        </article>
        <article className="cwt-summary-card indigo">
          <h4>{summary.pendingLab}</h4>
          <p>Pending Lab</p>
        </article>
      </section>

      <section className="cwt-filters-wrap">
        <input
          type="text"
          className="cwt-search-input"
          value={searchText}
          onChange={(event) => setSearchText(event.target.value)}
          placeholder="Search courses by code, title, or teacher name"
        />
        <select
          className="cwt-filter-select"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
        >
          {STATUS_FILTERS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <select
          className="cwt-filter-select"
          value={typeFilter}
          onChange={(event) => setTypeFilter(event.target.value)}
        >
          {COURSE_TYPE_FILTERS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </section>

      <section className="cwt-table-section">
        <div className="cwt-table-heading">
          <h4>Course Allocation Table</h4>
          <p>
            Showing {filteredCourses.length} of {courses.length} courses.
          </p>
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
                <th>Teacher Assignments</th>
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
                filteredCourses.map((course) => (
                  <tr key={course.code}>
                    <td>
                      <div className="cwt-course-cell">
                        <p className="cwt-course-code">{course.code}</p>
                        <p className="cwt-course-title">{course.title}</p>
                        <span className={`cwt-course-type ${course.type}`}>{course.type}</span>
                      </div>
                    </td>
                    <td>
                      <div className="cwt-edit-cell">
                        <div className="cwt-tag-wrap">{renderTeacherTagList(course.history, 'No history')}</div>
                        <button
                          type="button"
                          className="cwt-mini-btn"
                          onClick={() => openEditor(course.code, 'history')}
                        >
                          Change
                        </button>
                      </div>
                    </td>
                    <td>
                      <div className="cwt-edit-cell">
                        <div className="cwt-tag-wrap">{renderTeacherTagList(course.firstChoice)}</div>
                        <button
                          type="button"
                          className="cwt-mini-btn"
                          onClick={() => openEditor(course.code, 'firstChoice')}
                        >
                          {course.firstChoice ? 'Change' : 'Select'}
                        </button>
                      </div>
                    </td>
                    <td>
                      <div className="cwt-edit-cell">
                        <div className="cwt-tag-wrap">{renderTeacherTagList(course.secondChoice)}</div>
                        <button
                          type="button"
                          className="cwt-mini-btn"
                          onClick={() => openEditor(course.code, 'secondChoice')}
                        >
                          {course.secondChoice ? 'Change' : 'Select'}
                        </button>
                      </div>
                    </td>
                    <td>
                      <div className="cwt-edit-cell">
                        <div className="cwt-tag-wrap">{renderTeacherTagList(course.thirdChoice)}</div>
                        <button
                          type="button"
                          className="cwt-mini-btn"
                          onClick={() => openEditor(course.code, 'thirdChoice')}
                        >
                          {course.thirdChoice ? 'Change' : 'Select'}
                        </button>
                      </div>
                    </td>
                    <td>
                      <div className="cwt-edit-cell">
                        <div className="cwt-tag-wrap">{renderTeacherTagList(course.otherChoices, 'None')}</div>
                        <button
                          type="button"
                          className="cwt-mini-btn"
                          onClick={() => openEditor(course.code, 'otherChoices')}
                        >
                          Change
                        </button>
                      </div>
                    </td>
                    <td>
                      <div className="cwt-edit-cell">
                        <div className="cwt-tag-wrap">
                          {renderTeacherTagList(course.teacherAssignments, 'Unassigned')}
                        </div>
                        <div className="cwt-assignment-actions">
                          <button
                            type="button"
                            className="cwt-mini-btn primary"
                            onClick={() => openEditor(course.code, 'teacherAssignments')}
                          >
                            {course.teacherAssignments.length > 0 ? 'Change' : 'Add Teacher'}
                          </button>
                          {course.teacherAssignments.length > 0 && (
                            <button
                              type="button"
                              className="cwt-mini-btn"
                              onClick={() => openEditor(course.code, 'teacherAssignments', 'add-one')}
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

      {editorState.open && (
        <div className="cwt-modal-overlay" onClick={closeEditor}>
          <div className="cwt-modal" onClick={(event) => event.stopPropagation()}>
            <h4 className="cwt-modal-title">{editorTitle}</h4>
            <p className="cwt-modal-text">Choose from the teacher list below.</p>

            <input
              type="text"
              className="cwt-modal-search"
              value={editorState.search}
              onChange={(event) =>
                setEditorState((current) => ({
                  ...current,
                  search: event.target.value,
                }))
              }
              placeholder="Search by teacher name or code"
            />

            <div className="cwt-modal-list">
              {editorAvailableTeachers.map((teacher) => {
                const selected = editorState.selectedIds.includes(teacher.id);

                return (
                  <button
                    key={teacher.id}
                    type="button"
                    className={`cwt-modal-item ${selected ? 'selected' : ''}`}
                    onClick={() => toggleTeacherSelection(teacher.id)}
                  >
                    <span className="cwt-modal-item-code">{teacher.shortCode}</span>
                    <span className="cwt-modal-item-name">{teacher.name}</span>
                  </button>
                );
              })}
            </div>

            <div className="cwt-modal-actions">
              <button type="button" className="cwt-modal-btn cancel" onClick={closeEditor}>
                Cancel
              </button>
              <button type="button" className="cwt-modal-btn save" onClick={saveEditor}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CourseWiseTeacher;
