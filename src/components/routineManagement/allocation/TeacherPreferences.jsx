import { useMemo, useState, useEffect, useRef } from 'react';
import { teacherAPI } from '../../../services/teacherAPI';
import { courseAPI } from '../../../services/courseAPI';
import { teacherPrefAPI } from '../../../services/teacherPrefAPI';
import { courseTeacherAPI } from '../../../services/courseTeacherAPI';
import { syllabusAPI } from '../../../services/syllabusAPI';
import { makeRoutineEligibility } from '../Courses/routineEligibility';
import './styles/TeacherPreferences.css';

// Which DB course_type values belong to each preference category
const TYPE_FILTER = {
  theory: (t) => t === 'theory' || t === 'mixed',
  lab:    (t) => t === 'lab'    || t === 'mixed',
  all:    ()  => true,
};

const FIELD_CONFIG = {
  firstPreference:  { label: '1st Preference',    multi: false, typeFilter: TYPE_FILTER.theory },
  secondPreference: { label: '2nd Preference',    multi: false, typeFilter: TYPE_FILTER.theory },
  thirdPreference:  { label: '3rd Preference',    multi: false, typeFilter: TYPE_FILTER.theory },
  otherPreferences: { label: 'Other Preferences', multi: true,  typeFilter: TYPE_FILTER.theory },
  labPreferences:   { label: 'Lab Preferences',   multi: true,  typeFilter: TYPE_FILTER.lab    },
  assignedCourses:  { label: 'Assigned Courses',  multi: true,  typeFilter: TYPE_FILTER.all    },
};

// DB column name for each JS field name
const FIELD_TO_DB = {
  firstPreference:  'first_preference',
  secondPreference: 'second_preference',
  thirdPreference:  'third_preference',
  otherPreferences: 'other_preferences',
  labPreferences:   'lab_preferences',
  assignedCourses:  'assigned_courses',
};

function TeacherPreferences({ semesterId, selectedSemesters = [] }) {
  const [teachers,       setTeachers]       = useState([]);
  const [allCourses,     setAllCourses]     = useState([]);
  const [preferencesMap, setPreferencesMap] = useState({}); // teacherId → DB row
  const [courseAssignMap, setCourseAssignMap] = useState({}); // teacherId → courseId[] from course_teacher_choices
  const [loading,        setLoading]        = useState(true);
  const [offeredSet,  setOfferedSet]  = useState(new Set()); // offered course ids
  const [assignments, setAssignments] = useState({});        // batchCode → syllabusId

  const [activeRowId, setActiveRowId] = useState(null);

  const [editorState, setEditorState] = useState({
    open: false, teacherId: null, field: '', searchText: '', selectedCodes: [],
  });
  const [emptyConfirmOpen, setEmptyConfirmOpen] = useState(false);

  // Load all data on mount
  useEffect(() => {
    if (!semesterId) return;
    Promise.all([
      teacherAPI.getTeachers(semesterId),
      courseAPI.getAllCourses(),
      teacherPrefAPI.getAllPreferences(semesterId),
      courseTeacherAPI.getAllAssignments(semesterId),
      syllabusAPI.getOfferings(semesterId),
      syllabusAPI.getAssignments(semesterId),
    ]).then(([tRes, cRes, pRes, aRes, offRes, asgRes]) => {
      if (tRes.success) setTeachers(tRes.data || []);
      if (cRes.success) setAllCourses(cRes.courses || []);
      if (pRes.success) {
        const map = {};
        (pRes.data || []).forEach(row => { map[row.teacher_id] = row; });
        setPreferencesMap(map);
      }
      if (aRes.success) {
        const reverseMap = {};
        (aRes.data || []).forEach(({ course_id, teacher_assignments }) => {
          (teacher_assignments || []).forEach(tid => {
            if (!reverseMap[tid]) reverseMap[tid] = [];
            reverseMap[tid].push(course_id);
          });
        });
        setCourseAssignMap(reverseMap);
      }
      if (offRes.success) setOfferedSet(new Set(offRes.data || []));
      if (asgRes.success) {
        const map = {};
        (asgRes.data || []).forEach(a => { map[a.batch_code] = a.syllabus_id; });
        setAssignments(map);
      }
      setLoading(false);
    });
  }, [semesterId]);

  // Only courses selected for the routine (assigned syllabus + offered options
  // + checked in Routine Courses) can be assigned as preferences.
  const isRoutineCourse = useMemo(() => {
    const eligible = makeRoutineEligibility(selectedSemesters, assignments, offeredSet);
    return (c) => c.is_active !== false && c.in_routine === true && eligible(c);
  }, [selectedSemesters, assignments, offeredSet]);

  const courseMap = useMemo(() => {
    const map = {};
    allCourses.forEach(c => { map[c.id] = c; });
    return map;
  }, [allCourses]);

  // Merge teachers with their preferences into display rows
  const teacherRows = useMemo(() =>
    teachers.map(t => {
      const p = preferencesMap[t.id] || {};
      const fromChoices = courseAssignMap[t.id] || [];
      const fromPrefs   = p.assigned_courses    || [];
      return {
        id:               t.id,
        shortCode:        t.initials || '',
        teacherName:      t.name,
        firstPreference:  p.first_preference  || '',
        secondPreference: p.second_preference || '',
        thirdPreference:  p.third_preference  || '',
        otherPreferences: p.other_preferences || [],
        labPreferences:   p.lab_preferences   || [],
        assignedCourses:  [...new Set([...fromChoices, ...fromPrefs])],
      };
    }),
  [teachers, preferencesMap, courseAssignMap]);

  const getPreferenceCount = (row) =>
    [row.firstPreference, row.secondPreference, row.thirdPreference].filter(Boolean).length +
    row.otherPreferences.length +
    row.labPreferences.length;

  const summary = useMemo(() => {
    const withPrefs = teacherRows.filter(r => getPreferenceCount(r) > 0).length;
    const uniqueSet = new Set();
    teacherRows.forEach(r => {
      [r.firstPreference, r.secondPreference, r.thirdPreference]
        .filter(Boolean).forEach(id => uniqueSet.add(id));
      [...r.otherPreferences, ...r.labPreferences].forEach(id => uniqueSet.add(id));
    });
    const total = teacherRows.reduce((acc, r) => acc + getPreferenceCount(r), 0);
    return {
      totalTeachers:        teacherRows.length,
      teachersWithPrefs:    withPrefs,
      totalPreferredCourses: uniqueSet.size,
      avgPreferences:       withPrefs === 0 ? '0.0' : (total / withPrefs).toFixed(1),
    };
  }, [teacherRows]);

  // Courses shown in the editor: routine courses only, then by field type +
  // search text.
  const availableCoursesForEditor = useMemo(() => {
    const config = FIELD_CONFIG[editorState.field];
    if (!config) return [];
    const query = editorState.searchText.trim().toLowerCase();
    return allCourses.filter(c => {
      if (!isRoutineCourse(c)) return false;
      if (!config.typeFilter(c.course_type)) return false;
      if (!query) return true;
      return `${c.code} ${c.title}`.toLowerCase().includes(query);
    });
  }, [allCourses, editorState.field, editorState.searchText, isRoutineCourse]);

  const getCourseLabel = (courseId) => {
    if (!courseId) return '';
    const c = courseMap[courseId];
    if (!c) return courseId.slice(0, 8) + '…';
    return `${c.code} — ${c.title}`;
  };

  // ── Editor open / close ──────────────────────────────────────
  const openEditor = (teacherId, field) => {
    const row = teacherRows.find(r => r.id === teacherId);
    if (!row) return;
    const value = row[field];
    const selectedCodes = Array.isArray(value) ? value : value ? [value] : [];
    setActiveRowId(teacherId);
    setEditorState({ open: true, teacherId, field, searchText: '', selectedCodes });
  };

  const closeEditor = () => {
    setEditorState({ open: false, teacherId: null, field: '', searchText: '', selectedCodes: [] });
    setEmptyConfirmOpen(false);
  };

  const toggleCourse = (courseId) => {
    const config = FIELD_CONFIG[editorState.field];
    if (!config) return;
    setEditorState(cur => {
      const already = cur.selectedCodes.includes(courseId);
      if (config.multi) {
        return { ...cur, selectedCodes: already
          ? cur.selectedCodes.filter(id => id !== courseId)
          : [...cur.selectedCodes, courseId] };
      }
      return { ...cur, selectedCodes: already ? [] : [courseId] };
    });
  };

  // ── Save ─────────────────────────────────────────────────────
  const applyEditorSelection = () => {
    const { teacherId, field, selectedCodes } = editorState;
    const config = FIELD_CONFIG[field];
    if (!config || !teacherId) { closeEditor(); return; }

    const updatedValue = config.multi ? selectedCodes : (selectedCodes[0] || '');
    const dbKey = FIELD_TO_DB[field];

    // Optimistic update to preferencesMap
    setPreferencesMap(prev => ({
      ...prev,
      [teacherId]: {
        ...(prev[teacherId] || {}),
        teacher_id: teacherId,
        [dbKey]: config.multi ? updatedValue : (updatedValue || null),
      },
    }));

    // When saving assignedCourses, also optimistically update courseAssignMap
    if (field === 'assignedCourses') {
      setCourseAssignMap(prev => ({ ...prev, [teacherId]: updatedValue }));
    }

    // Build full preferences object using current merged value as base + this change
    const existing = preferencesMap[teacherId] || {};
    const mergedAssigned = [...new Set([...(courseAssignMap[teacherId] || []), ...(existing.assigned_courses || [])])];
    const toSave = {
      firstPreference:  existing.first_preference  || '',
      secondPreference: existing.second_preference || '',
      thirdPreference:  existing.third_preference  || '',
      otherPreferences: existing.other_preferences || [],
      labPreferences:   existing.lab_preferences   || [],
      assignedCourses:  mergedAssigned,
      [field]: updatedValue,
    };

    closeEditor();
    teacherPrefAPI.savePreferences(semesterId, teacherId, toSave);
  };

  const handleEditorOk = () => {
    if (editorState.selectedCodes.length === 0) { setEmptyConfirmOpen(true); return; }
    applyEditorSelection();
  };

  // ── Always-current refs for keyboard handlers ─────────────────
  const handleEditorOkRef   = useRef(null);
  const applySelectionRef   = useRef(null);
  handleEditorOkRef.current = handleEditorOk;
  applySelectionRef.current = applyEditorSelection;

  // Enter = OK, Escape = Cancel in the course-picker modal
  useEffect(() => {
    if (!editorState.open) return;
    const onKeyDown = (e) => {
      if (e.key === 'Enter')  { e.preventDefault(); handleEditorOkRef.current?.(); }
      else if (e.key === 'Escape') { closeEditor(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorState.open]);

  // Enter = Confirm, Escape = Cancel in the empty-selection confirm modal
  useEffect(() => {
    if (!emptyConfirmOpen) return;
    const onKeyDown = (e) => {
      if (e.key === 'Enter')  { e.preventDefault(); applySelectionRef.current?.(); }
      else if (e.key === 'Escape') { setEmptyConfirmOpen(false); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [emptyConfirmOpen]);

  // ── Cell renderer ─────────────────────────────────────────────
  const renderCell = (value, teacherId, field, emptyLabel = 'None') => {
    const items = Array.isArray(value) ? value : value ? [value] : [];
    const tagVariant = field === 'assignedCourses' ? 'assigned' : 'pref';
    return (
      <div className="teacher-pref-cell-wrap">
        <div className="teacher-pref-tags">
          {items.length === 0 ? (
            <span className="teacher-pref-tag empty">{emptyLabel}</span>
          ) : (
            items.map(id => (
              <span key={id} className={`teacher-pref-tag ${tagVariant}`} data-tooltip={getCourseLabel(id)}>
                {courseMap[id]?.code || id.slice(0, 8)}
              </span>
            ))
          )}
        </div>
        <button
          type="button"
          className="teacher-pref-edit-btn"
          onClick={() => openEditor(teacherId, field)}
          title={`Edit ${FIELD_CONFIG[field].label}`}
        >
          ✎
        </button>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="allocation-panel">
        <p style={{ color: '#6a7d94', fontSize: 14 }}>Loading teacher preferences...</p>
      </div>
    );
  }

  return (
    <div className="allocation-panel">
      <h3 className="allocation-panel-title">Teacher Preferences</h3>
      <p className="allocation-panel-description">
        Manage preferred courses and lab assignments for each teacher.
      </p>

      {/* Summary */}
      <section className="teacher-pref-summary" aria-label="Preferences Summary">
        <h4 className="teacher-pref-section-title">Preferences Summary</h4>
        <div className="teacher-pref-summary-grid">
          <article className="teacher-pref-summary-card blue">
            <p className="teacher-pref-summary-value">{summary.totalTeachers}</p>
            <p className="teacher-pref-summary-label">Total Teachers</p>
          </article>
          <article className="teacher-pref-summary-card green">
            <p className="teacher-pref-summary-value">{summary.teachersWithPrefs}</p>
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

      {/* Table */}
      <section className="teacher-pref-table-section" aria-label="Teacher Preferences Table">
        <h4 className="teacher-pref-section-title">Teacher Preferences List</h4>
        {teacherRows.length === 0 ? (
          <p style={{ color: '#6a7d94', fontSize: 14, margin: 0 }}>
            No teachers found. Add teachers in the Teacher page.
          </p>
        ) : (
          <div className="teacher-pref-table-wrap">
            <table className="teacher-pref-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Teacher Name</th>
                  <th>Pref. Count</th>
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
                  <tr key={row.id} className={row.id === activeRowId ? 'active-row' : index % 2 === 0 ? 'row-even' : 'row-odd'}>
                    <td>{index + 1}</td>
                    <td>
                      <div className="teacher-name-block">
                        <span className="teacher-short-code">{row.shortCode}:</span>{' '}
                        {row.teacherName}
                      </div>
                    </td>
                    <td>
                      <span className="teacher-pref-count-pill">
                        {getPreferenceCount(row)} preferences
                      </span>
                    </td>
                    <td>{renderCell(row.firstPreference,  row.id, 'firstPreference')}</td>
                    <td>{renderCell(row.secondPreference, row.id, 'secondPreference')}</td>
                    <td>{renderCell(row.thirdPreference,  row.id, 'thirdPreference')}</td>
                    <td>{renderCell(row.otherPreferences, row.id, 'otherPreferences')}</td>
                    <td>{renderCell(row.labPreferences,   row.id, 'labPreferences')}</td>
                    <td>{renderCell(row.assignedCourses,  row.id, 'assignedCourses')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Course-picker modal */}
      {editorState.open && (
        <div className="teacher-pref-modal-overlay" onClick={closeEditor}>
          <div className="teacher-pref-modal" onClick={e => e.stopPropagation()}>
            <h4 className="teacher-pref-modal-title">
              Edit {FIELD_CONFIG[editorState.field]?.label}
              <span className="teacher-pref-modal-hint">
                {FIELD_CONFIG[editorState.field]?.multi
                  ? ' — select one or more'
                  : ' — select one'}
              </span>
            </h4>

            <input
              type="text"
              className="teacher-pref-search-input"
              placeholder="Search by course code or title"
              value={editorState.searchText}
              autoFocus
              onChange={e =>
                setEditorState(cur => ({ ...cur, searchText: e.target.value }))
              }
            />

            {(() => {
              // For the Assigned Courses field, split into preferred vs other
              const isAssign = editorState.field === 'assignedCourses';
              let preferredIds = new Set();
              if (isAssign && editorState.teacherId) {
                const p = preferencesMap[editorState.teacherId] || {};
                [p.first_preference, p.second_preference, p.third_preference]
                  .filter(Boolean).forEach(id => preferredIds.add(id));
                [...(p.other_preferences || []), ...(p.lab_preferences || [])]
                  .forEach(id => preferredIds.add(id));
              }
              const preferred  = isAssign ? availableCoursesForEditor.filter(c =>  preferredIds.has(c.id)) : [];
              const others     = isAssign ? availableCoursesForEditor.filter(c => !preferredIds.has(c.id)) : availableCoursesForEditor;

              const renderItem = (course) => {
                const selected = editorState.selectedCodes.includes(course.id);
                return (
                  <button
                    type="button"
                    key={course.id}
                    className={`teacher-pref-course-item ${selected ? 'selected' : ''}`}
                    onClick={() => toggleCourse(course.id)}
                  >
                    <span className="teacher-pref-course-code">{course.code}</span>
                    <span className="teacher-pref-course-title">{course.title}</span>
                    <span className="teacher-pref-course-type">
                      {course.course_type === 'lab' ? 'Lab' : 'Theory'}
                    </span>
                  </button>
                );
              };

              return (
                <div className="teacher-pref-course-list" role="listbox">
                  {availableCoursesForEditor.length === 0 ? (
                    <p className="teacher-pref-no-course">No course found for your search.</p>
                  ) : isAssign ? (
                    <>
                      {preferred.length > 0 && (
                        <>
                          <p className="teacher-pref-list-header preferred">Preferred Courses</p>
                          {preferred.map(renderItem)}
                        </>
                      )}
                      {others.length > 0 && (
                        <>
                          <p className="teacher-pref-list-header other">All Other Courses</p>
                          {others.map(renderItem)}
                        </>
                      )}
                    </>
                  ) : (
                    availableCoursesForEditor.map(renderItem)
                  )}
                </div>
              );
            })()}

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

      {/* Empty-selection confirmation */}
      {emptyConfirmOpen && (
        <div className="teacher-pref-confirm-overlay" onClick={() => setEmptyConfirmOpen(false)}>
          <div className="teacher-pref-confirm-modal" onClick={e => e.stopPropagation()}>
            <h4 className="teacher-pref-confirm-title">No Course Selected</h4>
            <p className="teacher-pref-confirm-text">
              You are saving this field with no course selected. This will clear the current value.
              Continue?
            </p>
            <div className="teacher-pref-confirm-actions">
              <button
                type="button"
                className="teacher-pref-modal-btn cancel"
                onClick={() => setEmptyConfirmOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="teacher-pref-modal-btn ok"
                onClick={applyEditorSelection}
              >
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
