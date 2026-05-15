import { useState, useMemo, useCallback, useEffect } from 'react';
import { teacherAPI } from '../../../services/teacherAPI';
import { teacherPrefAPI } from '../../../services/teacherPrefAPI';
import { courseAPI } from '../../../services/courseAPI';
import TeacherPreferences from '../allocation/TeacherPreferences';
import './styles/Teachers.css';
import './styles/Modal.css';
import AddTeacherModal from './components/AddTeacherModal';
import ImportTeachersModal from './components/ImportTeachersModal';
import RemoveTeachersModal from './components/RemoveTeachersModal';
import RemovedTeachersModal from './components/RemovedTeachersModal';
import TeacherPreferenceModal from './components/TeacherPreferenceModal';

// Map a raw DB teacher row to the shape this component expects
const mapTeacher = (row) => ({
  id: row.id,
  initials: row.initials || '',
  name: row.name || '',
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

function Teachers() {
  const [activeTab, setActiveTab] = useState('details');

  // Teachers state
  const [teachers, setTeachers]           = useState([]);
  const [removedTeachers, setRemovedTeachers] = useState([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState(null);

  // Filter and search state
  const [searchTerm, setSearchTerm]       = useState('');
  const [selectedFilter, setSelectedFilter] = useState('All teachers');

  // Modal states
  const [modals, setModals] = useState({
    addTeacher: false,
    importTeachers: false,
    removeTeachers: false,
    removedTeachers: false,
  });

  const [preferenceModal, setPreferenceModal] = useState({
    isOpen: false,
    teacher: null,
    type: null,
  });

  const [prefsMap, setPrefsMap]   = useState({}); // teacherId → teacher_course_preferences row
  const [courseMap, setCourseMap] = useState({}); // courseId  → course row

  // Load all data — called on mount and when switching back to Details tab
  const loadData = async (showSpinner = true) => {
    if (showSpinner) { setLoading(true); setError(null); }
    const [activeResult, removedResult, prefResult, courseResult] = await Promise.all([
      teacherAPI.getTeachers(),
      teacherAPI.getRemovedTeachers(),
      teacherPrefAPI.getAllPreferences(),
      courseAPI.getAllCourses(),
    ]);
    if (activeResult.success) {
      setTeachers((activeResult.data || []).map(mapTeacher));
    } else if (showSpinner) {
      setError(activeResult.error);
    }
    if (removedResult.success) {
      setRemovedTeachers((removedResult.data || []).map(mapTeacher));
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
    if (showSpinner) setLoading(false);
  };

  useEffect(() => { loadData(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Calculate summary statistics
  const totalTeachers = teachers.length;
  const teachersWithPreferences = teachers.filter(
    (t) => getTheoryPrefCount(t.id) > 0 || getLabPrefCount(t.id) > 0
  ).length;
  const totalPreferences = teachers.reduce(
    (sum, t) => sum + getTheoryPrefCount(t.id) + getLabPrefCount(t.id),
    0
  );
  const avgPreferences = (totalPreferences / (totalTeachers || 1)).toFixed(2);

  const withinLoadLimit = teachers.filter((t) => t.weeklyLoadHours <= t.loadLimit).length;
  const overloaded = teachers.filter((t) => t.weeklyLoadHours > t.loadLimit).length;
  const nearLimit = teachers.filter(
    (t) => t.weeklyLoadHours > t.loadLimit * 0.8 && t.weeklyLoadHours <= t.loadLimit
  ).length;

  // All initials in use (active + removed) — passed to modals for uniqueness checks
  const existingInitials = useMemo(
    () => [...teachers, ...removedTeachers].map((t) => t.initials).filter(Boolean),
    [teachers, removedTeachers]
  );

  // Filter teachers based on search term and selected filter
  const filteredTeachers = useMemo(() => {
    return teachers.filter((teacher) => {
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
    });
  }, [teachers, searchTerm, selectedFilter]);

  // Modal handlers
  const handleOpenModal = useCallback((modalName) => {
    setModals(prev => ({ ...prev, [modalName]: true }));
  }, []);

  const handleCloseModal = useCallback((modalName) => {
    setModals(prev => ({ ...prev, [modalName]: false }));
  }, []);

  // Teacher operations
  const handleAddTeacher = useCallback(async (newTeacher) => {
    const result = await teacherAPI.createTeacher({
      name:              newTeacher.name,
      initials:          newTeacher.initials,
      load_limit:        10,
      weekly_load_hours: 0,
    });
    if (result.success) {
      setTeachers(prev => [...prev, mapTeacher(result.data)]);
      handleCloseModal('addTeacher');
    }
  }, [handleCloseModal]);

  const handleImportTeachers = useCallback(async (importedTeachers) => {
    const result = await teacherAPI.importTeachers(
      importedTeachers.map(t => ({
        name:              t.name,
        initials:          t.initials,
        load_limit:        10,
        weekly_load_hours: 0,
      }))
    );
    if (result.success) {
      setTeachers(prev => [...prev, ...(result.data || []).map(mapTeacher)]);
    }
    handleCloseModal('importTeachers');
  }, [handleCloseModal]);

  const handleRemoveTeachers = useCallback(async (teachersToRemove) => {
    await Promise.all(teachersToRemove.map(t => teacherAPI.deleteTeacher(t.id)));
    setTeachers(prev =>
      prev.filter(t => !teachersToRemove.some(r => r.initials === t.initials))
    );
    setRemovedTeachers(prev => [...prev, ...teachersToRemove]);
    handleCloseModal('removeTeachers');
  }, [handleCloseModal]);

  const handleRestoreTeachers = useCallback(async (teachersToRestore) => {
    await Promise.all(teachersToRestore.map(t => teacherAPI.restoreTeacher(t.id)));
    setRemovedTeachers(prev =>
      prev.filter(t => !teachersToRestore.some(r => r.initials === t.initials))
    );
    setTeachers(prev => [...prev, ...teachersToRestore]);
    handleCloseModal('removedTeachers');
  }, [handleCloseModal]);

  const handleLoadLimitChange = useCallback(async (teacherId, newLimit) => {
    // Optimistic update
    setTeachers(prev =>
      prev.map(t => t.id === teacherId ? { ...t, loadLimit: newLimit } : t)
    );
    await teacherAPI.updateLoadLimit(teacherId, newLimit);
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
              {/* Top Action Buttons */}
              <div className="action-buttons-block">
                <button className="action-btn add-btn" onClick={() => handleOpenModal('addTeacher')}>
                  + Add Teacher
                </button>
                <button className="action-btn import-btn" onClick={() => handleOpenModal('importTeachers')}>
                  ⬆ Import Teachers
                </button>
                <button className="action-btn removed-btn" onClick={() => handleOpenModal('removedTeachers')}>
                  📋 Removed Teachers
                </button>
                <button className="action-btn remove-btn" onClick={() => handleOpenModal('removeTeachers')}>
                  🗑 Remove
                </button>
              </div>

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
                                <span className="preference-badge">{teacher.timePreferences}</span>
                              </div>
                            </div>
                          </td>

                          {/* Load */}
                          <td>
                            <div className="load-cell">
                              <div className="load-hours">{teacher.weeklyLoadHours} hrs/week</div>
                              <div className="load-bar-container">
                                <div
                                  className="load-bar"
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

                          {/* Load Limit */}
                          <td>
                            <select
                              className="load-limit-select"
                              value={teacher.loadLimit}
                              onChange={(e) => handleLoadLimitChange(teacher.id, Number(e.target.value))}
                            >
                              {Array.from({ length: 26 }, (_, i) => (
                                <option key={i} value={i}>{i} hrs</option>
                              ))}
                            </select>
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

                          {/* Assigned Courses */}
                          <td>
                            <div className="courses-cell">
                              <div className="courses-list">
                                {(() => {
                                  const ids = prefsMap[teacher.id]?.assigned_courses || [];
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

              {/* Modals */}
              <AddTeacherModal
                isOpen={modals.addTeacher}
                onClose={() => handleCloseModal('addTeacher')}
                onAddTeacher={handleAddTeacher}
                existingInitials={existingInitials}
              />

              <ImportTeachersModal
                isOpen={modals.importTeachers}
                onClose={() => handleCloseModal('importTeachers')}
                onImportTeachers={handleImportTeachers}
                existingTeachers={teachers}
                existingInitials={existingInitials}
              />

              <RemoveTeachersModal
                isOpen={modals.removeTeachers}
                onClose={() => handleCloseModal('removeTeachers')}
                teachers={teachers}
                onRemoveTeachers={handleRemoveTeachers}
              />

              <RemovedTeachersModal
                isOpen={modals.removedTeachers}
                onClose={() => handleCloseModal('removedTeachers')}
                removedTeachers={removedTeachers}
                onRestoreTeachers={handleRestoreTeachers}
              />

              <TeacherPreferenceModal
                isOpen={preferenceModal.isOpen}
                onClose={handleClosePreferenceModal}
                teacher={preferenceModal.teacher}
                preferenceType={preferenceModal.type}
                prefsMap={prefsMap}
                courseMap={courseMap}
              />
            </>
          )}
        </>
      )}

      {/* Teacher's Preference tab */}
      {activeTab === 'teacherPreference' && <TeacherPreferences />}
    </div>
  );
}

export default Teachers;
