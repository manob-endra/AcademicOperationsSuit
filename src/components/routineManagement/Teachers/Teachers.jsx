import { useState, useMemo, useCallback, useEffect } from 'react';
import { teacherAPI } from '../../../services/teacherAPI';
import { teacherPrefAPI } from '../../../services/teacherPrefAPI';
import { courseAPI } from '../../../services/courseAPI';
import { courseTeacherAPI } from '../../../services/courseTeacherAPI';
import { compareTeachersByRank, defaultLoadLimit } from '../../../utils/teacherRank';
import TeacherPreferences from '../allocation/TeacherPreferences';
import './styles/Teachers.css';
import './styles/Modal.css';
import TeacherPreferenceModal from './components/TeacherPreferenceModal';

// Map a raw DB teacher row to the shape this component expects
const mapTeacher = (row) => ({
  id: row.id,
  initials: row.initials || '',
  name: row.name || '',
  designation: row.designation || '',   // kept for seniority sort
  special_post: row.special_post || '',  // kept for seniority sort
  theoryPreferences: 0,   // handled later
  labPreferences: 0,      // handled later
  timePreferences: 0,     // handled later
  weeklyLoadHours: row.weekly_load_hours ?? 0,
  loadLimit: row.load_limit ?? 20,
  assignedCourses: [],    // handled later
});

const filterOptions = [
  'All teachers',
  'Overloaded',
  'Underloaded',
  'Optimal loaded',
  'with preference',
  'without preference',
];

function Teachers({ semesterId, selectedSemesters = [] }) {
  const [activeTab, setActiveTab] = useState('details');

  // Teachers state
  const [teachers, setTeachers]           = useState([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState(null);

  // Filter and search state
  const [searchTerm, setSearchTerm]       = useState('');
  const [selectedFilter, setSelectedFilter] = useState('All teachers');

  const [preferenceModal, setPreferenceModal] = useState({
    isOpen: false,
    teacher: null,
    type: null,
  });

  const [prefsMap, setPrefsMap]           = useState({}); // teacherId → teacher_course_preferences row
  const [courseMap, setCourseMap]         = useState({}); // courseId  → course row
  const [availMap, setAvailMap]           = useState({}); // teacherId → number of selected time slots
  // Authoritative reverse-map built from course_teacher_choices.teacher_assignments
  const [courseAssignMap, setCourseAssignMap] = useState({}); // teacherId → courseId[]

  // Derive weekly load from assigned courses.
  // courseAssignMap (from course_teacher_choices) is the authoritative source;
  // falls back to prefsMap for any courses assigned via Teacher Preferences page.
  const computeWeeklyLoad = useCallback((teacherId) => {
    const fromChoices = courseAssignMap[teacherId] || [];
    const fromPrefs   = prefsMap[teacherId]?.assigned_courses || [];
    // Union of both sources (some courses may only be in one)
    const assignedIds = [...new Set([...fromChoices, ...fromPrefs])];
    const total = assignedIds.reduce((sum, id) => {
      const c = courseMap[id];
      if (!c) return sum;
      const hrs = Number(c.credit_hours) || 0;
      return sum + (c.course_type === 'lab' ? hrs * 4 : hrs);
    }, 0);
    // credit_hours can be fractional; round up to whole hours (matches load limits)
    return Math.ceil(total);
  }, [courseAssignMap, prefsMap, courseMap]);

  const teachersWithLoad = useMemo(
    () => teachers.map(t => ({ ...t, weeklyLoadHours: computeWeeklyLoad(t.id) })),
    [teachers, computeWeeklyLoad]
  );

  // Load all data — called on mount and when switching back to Details tab
  const loadData = async (showSpinner = true) => {
    if (showSpinner) { setLoading(true); setError(null); }
    const [activeResult, prefResult, courseResult, availResult, assignResult] = await Promise.all([
      teacherAPI.getTeachers(semesterId),
      teacherPrefAPI.getAllPreferences(semesterId),
      courseAPI.getAllCourses(),
      teacherAPI.getAllAvailability(semesterId),
      courseTeacherAPI.getAllAssignments(semesterId),
    ]);
    if (activeResult.success) {
      setTeachers(
        (activeResult.data || [])
          .filter(row => !row.availability_status || row.availability_status === 'available')
          .map(mapTeacher)
      );
    } else if (showSpinner) {
      setError(activeResult.error);
    }
    if (prefResult.success) {
      const map = {};
      (prefResult.data || []).forEach(row => { map[row.teacher_id] = row; });
      setPrefsMap(map);
    }
    if (courseResult.success) {
      const map = {};
      (courseResult.courses || []).forEach(c => { map[c.id] = c; });
      setCourseMap(map);
    }
    if (availResult.success) {
      const map = {};
      (availResult.data || []).forEach(({ teacher_id }) => {
        map[teacher_id] = (map[teacher_id] || 0) + 1;
      });
      setAvailMap(map);
    } else {
      console.error('Could not load teacher availability for badge counts:', availResult.error);
    }
    // Build authoritative teacher→courses map from course_teacher_choices
    if (assignResult.success) {
      const map = {};
      (assignResult.data || []).forEach(row => {
        (row.teacher_assignments || []).forEach(tid => {
          if (!map[tid]) map[tid] = [];
          if (!map[tid].includes(row.course_id)) map[tid].push(row.course_id);
        });
      });
      setCourseAssignMap(map);
    }
    if (showSpinner) setLoading(false);
  };

  useEffect(() => { loadData(); }, [semesterId]); // eslint-disable-line react-hooks/exhaustive-deps

  // When switching back to Details, silently refresh so load hours reflect any assignment changes
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === 'details') loadData(false);
  };

  // Real preference counts derived from loaded prefsMap
  const getTheoryPrefCount = (teacherId) => {
    const p = prefsMap[teacherId] || {};
    return [p.first_preference, p.second_preference, p.third_preference].filter(Boolean).length
      + (p.other_preferences?.length || 0);
  };
  const getLabPrefCount = (teacherId) => prefsMap[teacherId]?.lab_preferences?.length || 0;

  // Calculate summary statistics (use computed load)
  const totalTeachers = teachersWithLoad.length;
  const teachersWithPreferences = teachersWithLoad.filter(
    (t) => getTheoryPrefCount(t.id) > 0 || getLabPrefCount(t.id) > 0
  ).length;
  const totalPreferences = teachersWithLoad.reduce(
    (sum, t) => sum + getTheoryPrefCount(t.id) + getLabPrefCount(t.id),
    0
  );
  const avgPreferences = (totalPreferences / (totalTeachers || 1)).toFixed(2);

  const withinLoadLimit = teachersWithLoad.filter((t) => t.weeklyLoadHours <= t.loadLimit).length;
  const overloaded = teachersWithLoad.filter((t) => t.weeklyLoadHours > t.loadLimit).length;
  const nearLimit = teachersWithLoad.filter(
    (t) => t.weeklyLoadHours > t.loadLimit * 0.8 && t.weeklyLoadHours <= t.loadLimit
  ).length;

  // Filter teachers based on search term and selected filter (use computed load)
  const filteredTeachers = useMemo(() => {
    return teachersWithLoad.filter((teacher) => {
      const searchMatch =
        searchTerm === '' ||
        teacher.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        teacher.initials.toLowerCase().includes(searchTerm.toLowerCase());

      let filterMatch = true;
      if (selectedFilter === 'Overloaded') {
        filterMatch = teacher.weeklyLoadHours > teacher.loadLimit;
      } else if (selectedFilter === 'Underloaded') {
        filterMatch = teacher.weeklyLoadHours < teacher.loadLimit * 0.6;
      } else if (selectedFilter === 'Optimal loaded') {
        filterMatch =
          teacher.weeklyLoadHours >= teacher.loadLimit * 0.6 &&
          teacher.weeklyLoadHours <= teacher.loadLimit;
      } else if (selectedFilter === 'with preference') {
        filterMatch = getTheoryPrefCount(teacher.id) > 0 || getLabPrefCount(teacher.id) > 0;
      } else if (selectedFilter === 'without preference') {
        filterMatch = getTheoryPrefCount(teacher.id) === 0 && getLabPrefCount(teacher.id) === 0;
      }

      return searchMatch && filterMatch;
    }).sort(compareTeachersByRank);
  }, [teachersWithLoad, searchTerm, selectedFilter]);

  const handleLoadLimitChange = useCallback(async (teacherId, newLimit, oldLimit) => {
    // Optimistic update so the select feels instant
    setTeachers(prev =>
      prev.map(t => t.id === teacherId ? { ...t, loadLimit: newLimit } : t)
    );
    const result = await teacherAPI.updateLoadLimit(teacherId, newLimit);
    if (!result.success) {
      // Revert on failure so the UI matches the DB
      setTeachers(prev =>
        prev.map(t => t.id === teacherId ? { ...t, loadLimit: oldLimit } : t)
      );
      console.error('Failed to save load limit:', result.error);
      alert(`Could not save load limit: ${result.error || 'Server error'}`);
    }
  }, []);

  // Preference modal handlers
  const handleOpenPreferenceModal = useCallback((teacher, type) => {
    setPreferenceModal({
      isOpen: true,
      teacher,
      type,
    });
  }, []);

  const handleClosePreferenceModal = useCallback(() => {
    setPreferenceModal({
      isOpen: false,
      teacher: null,
      type: null,
    });
  }, []);

  // Utility functions
  const getLoadStatus = (load, limit) => {
    return load > limit ? 'Overloaded' : 'OK';
  };

  const getLoadPercentage = (load, limit) => {
    return Math.min((load / limit) * 100, 100);
  };

  return (
    <div className="routine-section-content teacher-container">
      <h2>Teacher Management</h2>
      <p>Manage teacher profiles, availability, and teaching preferences.</p>

      {/* Top tabs */}
      <div className="teacher-page-tabs">
        <button
          className={`teacher-page-tab-btn ${activeTab === 'details' ? 'active' : ''}`}
          onClick={() => handleTabChange('details')}
        >
          Details
        </button>
        <button
          className={`teacher-page-tab-btn ${activeTab === 'teacherPreference' ? 'active' : ''}`}
          onClick={() => handleTabChange('teacherPreference')}
        >
          Teacher's Preference
        </button>
      </div>

      {/* Details tab */}
      {activeTab === 'details' && (
        <>
          {loading ? (
            <p className="teachers-loading">Loading teachers from database…</p>
          ) : error ? (
            <p className="teachers-error">{error}</p>
          ) : (
            <>
              {/* Summary Cards */}
              <div className="summary-cards-container">
                {/* Preferences Summary Card */}
                <div className="summary-card preferences-card">
                  <h3 className="card-title">Preferences Summary</h3>
                  <div className="summary-item">
                    <span className="summary-label">Total Teachers</span>
                    <span className="summary-value">{totalTeachers}</span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">Teachers with Preferences</span>
                    <span className="summary-value">{teachersWithPreferences}</span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">Total Preferences</span>
                    <span className="summary-value">{totalPreferences}</span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">Avg Preferences/Teacher</span>
                    <span className="summary-value">{avgPreferences}</span>
                  </div>
                </div>

                {/* Load Analysis Card */}
                <div className="summary-card load-card">
                  <h3 className="card-title">Load Analysis</h3>
                  <div className="summary-item">
                    <span className="summary-label">Total Teachers</span>
                    <span className="summary-value">{totalTeachers}</span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">Within Load Limit</span>
                    <span className="summary-value">{withinLoadLimit}</span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">Overloaded</span>
                    <span className="summary-value overloaded">{overloaded}</span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">Near Limit</span>
                    <span className="summary-value near-limit">{nearLimit}</span>
                  </div>
                </div>
              </div>

              {/* Filter Block */}
              <div className="filter-block">
                <button className="view-all-btn" onClick={() => setSelectedFilter('All teachers')}>
                  View All Teachers
                </button>

                {/* Search Box */}
                <div className="search-box-container">
                  <input
                    type="text"
                    placeholder="Search by name or initials..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="search-box"
                  />
                </div>

                {/* Filter Dropdown */}
                <div className="filter-dropdown">
                  <label>Filter</label>
                  <select value={selectedFilter} onChange={(e) => setSelectedFilter(e.target.value)}>
                    {filterOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Teachers Table */}
              <div className="teachers-table-wrapper">
                <table className="teachers-table">
                  <thead>
                    <tr>
                      <th>Initials</th>
                      <th>Name</th>
                      <th>Preferences</th>
                      <th>Load</th>
                      <th>Load Limit</th>
                      <th>Status</th>
                      <th>Assigned Courses</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTeachers.length > 0 ? (
                      filteredTeachers.map((teacher, index) => (
                        <tr key={teacher.id || teacher.initials} className={index % 2 === 0 ? 'row-light' : 'row-dark'}>
                          {/* Initials */}
                          <td>
                            <div className="initials-badge">{teacher.initials}</div>
                          </td>

                          {/* Name */}
                          <td>{teacher.name}</td>

                          {/* Preferences */}
                          <td>
                            <div className="preferences-cell">
                              <div className="preference-row">
                                <button
                                  className="preference-btn theory-btn"
                                  onClick={() => handleOpenPreferenceModal(teacher, 'theory')}
                                >
                                  Theory
                                </button>
                                <span className="preference-badge">{getTheoryPrefCount(teacher.id)}</span>
                              </div>
                              <div className="preference-row">
                                <button
                                  className="preference-btn lab-btn"
                                  onClick={() => handleOpenPreferenceModal(teacher, 'lab')}
                                >
                                  Lab
                                </button>
                                <span className="preference-badge">{getLabPrefCount(teacher.id)}</span>
                              </div>
                              <div className="preference-row">
                                <button
                                  className="preference-btn time-btn"
                                  onClick={() => handleOpenPreferenceModal(teacher, 'time')}
                                >
                                  Time
                                </button>
                                <span className="preference-badge">{availMap[teacher.id] || 0}</span>
                              </div>
                            </div>
                          </td>

                          {/* Load */}
                          <td>
                            <div className="load-cell">
                              <div className="load-hours">{teacher.weeklyLoadHours} hrs/week</div>
                              <div className="load-bar-container">
                                <div
                                  className={`load-bar${teacher.weeklyLoadHours > teacher.loadLimit ? ' overloaded' : ''}`}
                                  style={{
                                    width: `${getLoadPercentage(
                                      teacher.weeklyLoadHours,
                                      teacher.loadLimit
                                    )}%`,
                                  }}
                                ></div>
                              </div>
                            </div>
                          </td>

                          {/* Load Limit — default comes from the teacher's rank */}
                          <td>
                            {(() => {
                              const rankMax = defaultLoadLimit(teacher);
                              return (
                                <div className="load-limit-cell">
                                  <select
                                    className="load-limit-select"
                                    value={teacher.loadLimit}
                                    onChange={(e) => handleLoadLimitChange(teacher.id, Number(e.target.value), teacher.loadLimit)}
                                  >
                                    {Array.from({ length: 26 }, (_, i) => (
                                      <option key={i} value={i}>{i} hrs</option>
                                    ))}
                                  </select>
                                  {teacher.loadLimit !== rankMax && (
                                    <button
                                      type="button"
                                      className="load-limit-default-btn"
                                      title={`Reset to rank default (${rankMax} hrs)`}
                                      onClick={() => handleLoadLimitChange(teacher.id, rankMax, teacher.loadLimit)}
                                    >
                                      ↺ {rankMax}
                                    </button>
                                  )}
                                </div>
                              );
                            })()}
                          </td>

                          {/* Status */}
                          <td>
                            <span
                              className={`status-tag ${
                                getLoadStatus(teacher.weeklyLoadHours, teacher.loadLimit) === 'OK'
                                  ? 'status-ok'
                                  : 'status-overloaded'
                              }`}
                            >
                              {getLoadStatus(teacher.weeklyLoadHours, teacher.loadLimit)}
                            </span>
                          </td>

                          {/* Assigned Courses — sourced from course_teacher_choices (authoritative) */}
                          <td>
                            <div className="courses-cell">
                              <div className="courses-list">
                                {(() => {
                                  const fromChoices = courseAssignMap[teacher.id] || [];
                                  const fromPrefs   = prefsMap[teacher.id]?.assigned_courses || [];
                                  const ids = [...new Set([...fromChoices, ...fromPrefs])];
                                  if (ids.length === 0) {
                                    return <span className="no-course-assigned">No course assigned</span>;
                                  }
                                  return ids.map(id => {
                                    const c = courseMap[id];
                                    return (
                                      <div key={id} className="course-item" title={c ? `${c.code} — ${c.title}` : id}>
                                        {c ? c.code : id.slice(0, 8)}
                                      </div>
                                    );
                                  });
                                })()}
                              </div>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="7" className="no-results">
                          No teachers found matching the selected filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="table-info">
                Showing {filteredTeachers.length} of {teachers.length} teachers
              </div>

              <TeacherPreferenceModal
                isOpen={preferenceModal.isOpen}
                onClose={handleClosePreferenceModal}
                teacher={preferenceModal.teacher}
                preferenceType={preferenceModal.type}
                semesterId={semesterId}
                prefsMap={prefsMap}
                courseMap={courseMap}
                onAvailabilitySaved={(teacherId, count) =>
                  setAvailMap(prev => ({ ...prev, [teacherId]: count }))
                }
              />
            </>
          )}
        </>
      )}

      {/* Teacher's Preference tab */}
      {activeTab === 'teacherPreference' && <TeacherPreferences semesterId={semesterId} selectedSemesters={selectedSemesters} />}
    </div>
  );
}

export default Teachers;
