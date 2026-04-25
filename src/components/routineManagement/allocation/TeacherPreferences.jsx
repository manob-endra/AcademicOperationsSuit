import { useMemo, useState } from 'react';
import './styles/TeacherPreferences.css';

const COURSE_OPTIONS = [
  { code: 'CSE-4202', title: 'Society and Technology', type: 'theory' },
  { code: 'ENG-3217', title: 'Technical Writing and Presentation Lab', type: 'lab' },
  { code: 'CSE-2109', title: 'Data and Telecommunication', type: 'theory' },
  { code: 'STAT-3205', title: 'Introduction to Probability and Statistics', type: 'theory' },
  { code: 'CSE-532', title: 'Decision Diagram for VLSI Design', type: 'theory' },
  { code: 'CSE-521', title: 'Embedded System (MS)', type: 'theory' },
  { code: 'CSE-531', title: 'Reversible Logic Synthesis (MS)', type: 'theory' },
  { code: 'CSE-2106', title: 'Microprocessor and Assembly Language Lab', type: 'lab' },
  { code: 'CSE-3203', title: 'Design and Analysis of Algorithms - II', type: 'theory' },
  { code: 'CSE-4235', title: 'Digital Forensic (Option A)', type: 'theory' },
  { code: 'CSE-501', title: 'Advanced Algorithms (MS)', type: 'theory' },
  { code: 'CSE-2102', title: 'Data Structures and Algorithms Lab, II', type: 'lab' },
  { code: 'EEE-1106', title: 'Electrical Circuits Lab', type: 'lab' },
  { code: 'CSE-3113', title: 'Microprocessor and Assembly Language Lab', type: 'lab' },
  { code: 'CSE-3116', title: 'Microcontroller Lab', type: 'lab' },
  { code: 'CSE-3101', title: 'Computer Networking', type: 'theory' },
  { code: 'CSE-2101', title: 'Data Structures and Algorithms', type: 'theory' },
  { code: 'CSE-2201', title: 'Database Management Systems', type: 'theory' },
  { code: 'CSE-3201', title: 'Operating Systems', type: 'theory' },
  { code: 'CSE-4101', title: 'Machine Learning', type: 'theory' },
  { code: 'CSE-4102', title: 'Machine Learning Lab', type: 'lab' },
  { code: 'CSE-4301', title: 'Cyber Security', type: 'theory' },
  { code: 'CSE-4302', title: 'Cyber Security Lab', type: 'lab' },
  { code: 'MAT-2101', title: 'Linear Algebra', type: 'theory' },
  { code: 'PHY-1101', title: 'Physics', type: 'theory' },
];

const FIELD_CONFIG = {
  firstPreference: { label: '1st Preference', multi: false, types: ['theory'] },
  secondPreference: { label: '2nd Preference', multi: false, types: ['theory'] },
  thirdPreference: { label: '3rd Preference', multi: false, types: ['theory'] },
  otherPreferences: { label: 'Other Preferences', multi: true, types: ['theory'] },
  labPreferences: { label: 'Lab Preferences', multi: true, types: ['lab'] },
  assignedCourses: { label: 'Assigned Courses', multi: true, types: ['theory', 'lab'] },
};

const getCourseLabel = (code) => {
  const course = COURSE_OPTIONS.find((item) => item.code === code);
  if (!course) {
    return code;
  }
  return `[${course.type === 'lab' ? 'Lab' : 'Theory'}] ${course.code} ${course.title}`;
};

function TeacherPreferences() {
  const [teacherRows, setTeacherRows] = useState([
    {
      id: 1,
      shortCode: 'SP',
      teacherName: 'Dr. Suraiya Parvin',
      firstPreference: 'CSE-4202',
      secondPreference: 'CSE-2109',
      thirdPreference: 'STAT-3205',
      otherPreferences: [],
      labPreferences: ['EEE-1106'],
      assignedCourses: ['CSE-4202', 'ENG-3217'],
    },
    {
      id: 2,
      shortCode: 'HMHB',
      teacherName: 'Dr. Hafiz Md. Hasan Babu',
      firstPreference: 'CSE-532',
      secondPreference: 'CSE-521',
      thirdPreference: 'CSE-531',
      otherPreferences: [],
      labPreferences: ['CSE-2106'],
      assignedCourses: ['CSE-3113', 'CSE-521'],
    },
    {
      id: 3,
      shortCode: 'MRK',
      teacherName: 'Dr. Md. Rezaul Karim',
      firstPreference: 'CSE-3203',
      secondPreference: 'CSE-4235',
      thirdPreference: 'CSE-501',
      otherPreferences: [],
      labPreferences: ['CSE-2102', 'ENG-3217'],
      assignedCourses: ['CSE-3116', 'CSE-4235'],
    },
    {
      id: 4,
      shortCode: 'SA',
      teacherName: 'Dr. Sadia Anwar',
      firstPreference: 'CSE-3101',
      secondPreference: 'CSE-2201',
      thirdPreference: 'CSE-3201',
      otherPreferences: ['CSE-2101'],
      labPreferences: ['CSE-4302'],
      assignedCourses: ['CSE-3101'],
    },
  ]);

  const [editorState, setEditorState] = useState({
    open: false,
    teacherId: null,
    field: '',
    searchText: '',
    selectedCodes: [],
  });
  const [emptySelectionConfirmOpen, setEmptySelectionConfirmOpen] = useState(false);

  const getPreferenceCount = (row) => {
    const singleCount = [row.firstPreference, row.secondPreference, row.thirdPreference].filter(Boolean).length;
    return singleCount + row.otherPreferences.length + row.labPreferences.length;
  };

  const summary = useMemo(() => {
    const totalTeachers = teacherRows.length;
    const teachersWithPreferences = teacherRows.filter((row) => getPreferenceCount(row) > 0).length;

    const uniquePreferredSet = new Set();
    teacherRows.forEach((row) => {
      [row.firstPreference, row.secondPreference, row.thirdPreference]
        .filter(Boolean)
        .forEach((course) => uniquePreferredSet.add(course));
      row.otherPreferences.forEach((course) => uniquePreferredSet.add(course));
      row.labPreferences.forEach((course) => uniquePreferredSet.add(course));
    });

    const totalPreferenceCount = teacherRows.reduce((acc, row) => acc + getPreferenceCount(row), 0);
    const avgPreferences =
      teachersWithPreferences === 0 ? '0.0' : (totalPreferenceCount / teachersWithPreferences).toFixed(1);

    return {
      totalTeachers,
      teachersWithPreferences,
      totalPreferredCourses: uniquePreferredSet.size,
      avgPreferences,
    };
  }, [teacherRows]);

  const openEditor = (teacherId, field) => {
    const row = teacherRows.find((item) => item.id === teacherId);
    if (!row) {
      return;
    }

    const value = row[field];
    const selectedCodes = Array.isArray(value) ? value : value ? [value] : [];

    setEditorState({
      open: true,
      teacherId,
      field,
      searchText: '',
      selectedCodes,
    });
  };

  const closeEditor = () => {
    setEditorState({
      open: false,
      teacherId: null,
      field: '',
      searchText: '',
      selectedCodes: [],
    });
    setEmptySelectionConfirmOpen(false);
  };

  const toggleCourseInEditor = (courseCode) => {
    const config = FIELD_CONFIG[editorState.field];
    if (!config) {
      return;
    }

    setEditorState((current) => {
      const currentlySelected = current.selectedCodes.includes(courseCode);

      if (config.multi) {
        return {
          ...current,
          selectedCodes: currentlySelected
            ? current.selectedCodes.filter((code) => code !== courseCode)
            : [...current.selectedCodes, courseCode],
        };
      }

      return {
        ...current,
        selectedCodes: currentlySelected ? [] : [courseCode],
      };
    });
  };

  const applyEditorSelection = () => {
    const { teacherId, field, selectedCodes } = editorState;
    const config = FIELD_CONFIG[field];
    if (!config || teacherId == null) {
      return;
    }

    setTeacherRows((currentRows) =>
      currentRows.map((row) => {
        if (row.id !== teacherId) {
          return row;
        }

        return {
          ...row,
          [field]: config.multi ? selectedCodes : selectedCodes[0] || '',
        };
      })
    );

    closeEditor();
  };

  const handleEditorOk = () => {
    if (editorState.selectedCodes.length === 0) {
      setEmptySelectionConfirmOpen(true);
      return;
    }
    applyEditorSelection();
  };

  const availableCoursesForEditor = useMemo(() => {
    const config = FIELD_CONFIG[editorState.field];
    if (!config) {
      return [];
    }

    const query = editorState.searchText.trim().toLowerCase();

    return COURSE_OPTIONS.filter((course) => {
      if (!config.types.includes(course.type)) {
        return false;
      }

      if (!query) {
        return true;
      }

      const searchable = `${course.code} ${course.title}`.toLowerCase();
      return searchable.includes(query);
    });
  }, [editorState.field, editorState.searchText]);

  const renderCourseCell = (value, teacherId, field, emptyLabel = 'None') => {
    const items = Array.isArray(value) ? value : value ? [value] : [];

    return (
      <div className="teacher-pref-cell-wrap">
        <div className="teacher-pref-tags">
          {items.length === 0 ? (
            <span className="teacher-pref-tag empty">{emptyLabel}</span>
          ) : (
            items.map((courseCode) => (
              <span key={`${teacherId}-${field}-${courseCode}`} className="teacher-pref-tag">
                {getCourseLabel(courseCode)}
              </span>
            ))
          )}
        </div>
        <button
          type="button"
          className="teacher-pref-edit-btn"
          onClick={() => openEditor(teacherId, field)}
          aria-label={`Edit ${FIELD_CONFIG[field].label}`}
          title={`Edit ${FIELD_CONFIG[field].label}`}
        >
          ✎
        </button>
      </div>
    );
  };

  return (
    <div className="allocation-panel">
      <h3 className="allocation-panel-title">Teacher Preferences</h3>
      <p className="allocation-panel-description">
        Manage preferred courses, time ranges, and classroom constraints for teachers.
      </p>

      <section className="teacher-pref-summary" aria-label="Preferences Summary">
        <h4 className="teacher-pref-section-title">Preferences Summary</h4>
        <div className="teacher-pref-summary-grid">
          <article className="teacher-pref-summary-card blue">
            <p className="teacher-pref-summary-value">{summary.totalTeachers}</p>
            <p className="teacher-pref-summary-label">Total Teachers</p>
          </article>
          <article className="teacher-pref-summary-card green">
            <p className="teacher-pref-summary-value">{summary.teachersWithPreferences}</p>
            <p className="teacher-pref-summary-label">Teachers with Preferences</p>
          </article>
          <article className="teacher-pref-summary-card amber">
            <p className="teacher-pref-summary-value">{summary.totalPreferredCourses}</p>
            <p className="teacher-pref-summary-label">Total Preferred Course</p>
          </article>
          <article className="teacher-pref-summary-card violet">
            <p className="teacher-pref-summary-value">{summary.avgPreferences}</p>
            <p className="teacher-pref-summary-label">Avg Preferences/Teacher</p>
          </article>
        </div>
      </section>

      <section className="teacher-pref-table-section" aria-label="Teacher Preferences Table">
        <h4 className="teacher-pref-section-title">Teacher Preferences List (Sorted by Seniority)</h4>
        <div className="teacher-pref-table-wrap">
          <table className="teacher-pref-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Teacher Name</th>
                <th>Preferences Count</th>
                <th>1st Preference</th>
                <th>2nd Preference</th>
                <th>3rd Preference</th>
                <th>Other Preferences</th>
                <th>Lab Preferences</th>
                <th>Assigned Courses</th>
              </tr>
            </thead>
            <tbody>
              {teacherRows.map((row, index) => (
                <tr key={row.id}>
                  <td>{index + 1}</td>
                  <td>
                    <div className="teacher-name-block">
                      <span className="teacher-short-code">{row.shortCode}:</span> {row.teacherName}
                    </div>
                  </td>
                  <td>
                    <span className="teacher-pref-count-pill">{getPreferenceCount(row)} preferences</span>
                  </td>
                  <td>{renderCourseCell(row.firstPreference, row.id, 'firstPreference')}</td>
                  <td>{renderCourseCell(row.secondPreference, row.id, 'secondPreference')}</td>
                  <td>{renderCourseCell(row.thirdPreference, row.id, 'thirdPreference')}</td>
                  <td>{renderCourseCell(row.otherPreferences, row.id, 'otherPreferences')}</td>
                  <td>{renderCourseCell(row.labPreferences, row.id, 'labPreferences')}</td>
                  <td>{renderCourseCell(row.assignedCourses, row.id, 'assignedCourses')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {editorState.open && (
        <div className="teacher-pref-modal-overlay" onClick={closeEditor}>
          <div className="teacher-pref-modal" onClick={(event) => event.stopPropagation()}>
            <h4 className="teacher-pref-modal-title">Edit {FIELD_CONFIG[editorState.field]?.label}</h4>
            <input
              type="text"
              className="teacher-pref-search-input"
              placeholder="Search by course code or title"
              value={editorState.searchText}
              onChange={(event) =>
                setEditorState((current) => ({
                  ...current,
                  searchText: event.target.value,
                }))
              }
            />

            <div className="teacher-pref-course-list" role="listbox">
              {availableCoursesForEditor.length === 0 ? (
                <p className="teacher-pref-no-course">No course found for your search.</p>
              ) : (
                availableCoursesForEditor.map((course) => {
                  const selected = editorState.selectedCodes.includes(course.code);

                  return (
                    <button
                      type="button"
                      key={course.code}
                      className={`teacher-pref-course-item ${selected ? 'selected' : ''}`}
                      onClick={() => toggleCourseInEditor(course.code)}
                    >
                      <span className="teacher-pref-course-code">{course.code}</span>
                      <span className="teacher-pref-course-title">{course.title}</span>
                      <span className="teacher-pref-course-type">
                        {course.type === 'lab' ? 'Lab' : 'Theory'}
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            <div className="teacher-pref-modal-actions">
              <button type="button" className="teacher-pref-modal-btn cancel" onClick={closeEditor}>
                Cancel
              </button>
              <button type="button" className="teacher-pref-modal-btn ok" onClick={handleEditorOk}>
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {emptySelectionConfirmOpen && (
        <div className="teacher-pref-confirm-overlay" onClick={() => setEmptySelectionConfirmOpen(false)}>
          <div className="teacher-pref-confirm-modal" onClick={(event) => event.stopPropagation()}>
            <h4 className="teacher-pref-confirm-title">No Course Selected</h4>
            <p className="teacher-pref-confirm-text">
              You are saving this field without any selected course. Is this intentional?
            </p>
            <div className="teacher-pref-confirm-actions">
              <button
                type="button"
                className="teacher-pref-modal-btn cancel"
                onClick={() => setEmptySelectionConfirmOpen(false)}
              >
                Cancel
              </button>
              <button type="button" className="teacher-pref-modal-btn ok" onClick={applyEditorSelection}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TeacherPreferences;
