import { useState, useMemo } from 'react';
import '../../styles/Teacher.css';


// Sample teacher data
const sampleTeachers = [
  {
    initials: 'AK',
    name: 'Dr. Ahmed Khan',
    theoryPreferences: 3,
    labPreferences: 2,
    timePreferences: 1,
    weeklyLoadHours: 16,
    loadLimit: 20,
    assignedCourses: ['CSE101 - Introduction to Programming', 'CSE102 - Digital Logic Design'],
  },
  {
    initials: 'SR',
    name: 'Prof. Sara Rahman',
    theoryPreferences: 4,
    labPreferences: 1,
    timePreferences: 2,
    weeklyLoadHours: 22,
    loadLimit: 20,
    assignedCourses: ['CSE201 - Database Management System'],
  },
  {
    initials: 'MM',
    name: 'Dr. Moshiur Mahmud',
    theoryPreferences: 2,
    labPreferences: 3,
    timePreferences: 1,
    weeklyLoadHours: 18,
    loadLimit: 20,
    assignedCourses: ['CSE104 - Data Structures', 'CSE202 - Web Development'],
  },
  {
    initials: 'FS',
    name: 'Prof. Fatima Singh',
    theoryPreferences: 5,
    labPreferences: 0,
    timePreferences: 3,
    weeklyLoadHours: 14,
    loadLimit: 20,
    assignedCourses: ['CSE203 - Computer Networks', 'CSE301 - Compiler Design'],
  },
  {
    initials: 'RH',
    name: 'Dr. Rashid Hassan',
    theoryPreferences: 1,
    labPreferences: 4,
    timePreferences: 2,
    weeklyLoadHours: 19,
    loadLimit: 20,
    assignedCourses: ['CSE302 - Artificial Intelligence', 'CSE303 - Software Engineering'],
  },
  {
    initials: 'NK',
    name: 'Prof. Nadia Khan',
    theoryPreferences: 3,
    labPreferences: 3,
    timePreferences: 1,
    weeklyLoadHours: 21,
    loadLimit: 20,
    assignedCourses: ['CSE401 - Machine Learning'],
  },
];

const filterOptions = [
  'All teachers',
  'Overloaded',
  'Underloaded',
  'Optimal loaded',
  'with preference',
  'without preference',
];

function Teacher() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('All teachers');

  // Calculate summary statistics
  const totalTeachers = sampleTeachers.length;
  const teachersWithPreferences = sampleTeachers.filter(
    (t) => t.theoryPreferences > 0 || t.labPreferences > 0
  ).length;
  const totalPreferences = sampleTeachers.reduce(
    (sum, t) => sum + t.theoryPreferences + t.labPreferences,
    0
  );
  const avgPreferences = (totalPreferences / totalTeachers).toFixed(2);

  const withinLoadLimit = sampleTeachers.filter((t) => t.weeklyLoadHours <= t.loadLimit).length;
  const overloaded = sampleTeachers.filter((t) => t.weeklyLoadHours > t.loadLimit).length;
  const nearLimit = sampleTeachers.filter(
    (t) => t.weeklyLoadHours > t.loadLimit * 0.8 && t.weeklyLoadHours <= t.loadLimit
  ).length;

  // Filter teachers based on search term and selected filter
  const filteredTeachers = useMemo(() => {
    return sampleTeachers.filter((teacher) => {
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
        filterMatch = teacher.theoryPreferences > 0 || teacher.labPreferences > 0;
      } else if (selectedFilter === 'without preference') {
        filterMatch = teacher.theoryPreferences === 0 && teacher.labPreferences === 0;
      }

      return searchMatch && filterMatch;
    });
  }, [searchTerm, selectedFilter]);

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

      {/* Top Action Buttons */}
      <div className="action-buttons-block">
        <button className="action-btn add-btn">+ Add Teacher</button>
        <button className="action-btn import-btn">⬆ Import Teachers</button>
        <button className="action-btn removed-btn">📋 Removed Teachers</button>
        <button className="action-btn remove-btn">🗑 Remove</button>
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
                <tr key={teacher.initials} className={index % 2 === 0 ? 'row-light' : 'row-dark'}>
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
                        <button className="preference-btn theory-btn">Theory</button>
                        <span className="preference-badge">{teacher.theoryPreferences}</span>
                        <button className="add-remove-preference-btn" title="Add/Remove Theory Preference">
                          +/−
                        </button>
                      </div>
                      <div className="preference-row">
                        <button className="preference-btn lab-btn">Lab</button>
                        <span className="preference-badge">{teacher.labPreferences}</span>
                        <button className="add-remove-preference-btn" title="Add/Remove Lab Preference">
                          +/−
                        </button>
                      </div>
                      <div className="preference-row">
                        <button className="preference-btn time-btn">Time</button>
                        <span className="preference-badge">{teacher.timePreferences}</span>
                        <button className="add-remove-preference-btn" title="Add/Remove Time Preference">
                          +/−
                        </button>
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
                  <td>{teacher.loadLimit} hrs</td>

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
                        {teacher.assignedCourses.map((course) => (
                          <div key={course} className="course-item">
                            {course}
                          </div>
                        ))}
                      </div>
                      <button className="details-btn">Details</button>
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
        Showing {filteredTeachers.length} of {sampleTeachers.length} teachers
      </div>
    </div>
  );
}

export default Teacher;
