import { useState, useMemo } from 'react';
import '../../styles/Courses.css';

// Sample course data
const sampleCourses = [
  { code: 'CSE101', title: 'Introduction to Programming', year: '1st year', semester: '1st semester', credit: 3 },
  { code: 'CSE102', title: 'Digital Logic Design', year: '1st year', semester: '1st semester', credit: 3 },
  { code: 'CSE103', title: 'Discrete Mathematics', year: '1st year', semester: '2nd semester', credit: 3 },
  { code: 'CSE104', title: 'Data Structures', year: '2nd year', semester: 'A1', credit: 3 },
  { code: 'CSE201', title: 'Database Management System', year: '2nd year', semester: 'A1', credit: 3 },
  { code: 'CSE202', title: 'Web Development', year: '2nd year', semester: 'B2', credit: 2 },
  { code: 'CSE203', title: 'Computer Networks', year: '3rd year', semester: 'A3', credit: 3 },
  { code: 'CSE204', title: 'Operating Systems', year: '3rd year', semester: 'B4', credit: 3 },
  { code: 'CSE301', title: 'Compiler Design', year: '3rd year', semester: 'A1', credit: 2 },
  { code: 'CSE302', title: 'Artificial Intelligence', year: '4th year', semester: 'B2', credit: 3 },
  { code: 'CSE303', title: 'Software Engineering', year: '4th year', semester: 'A3', credit: 3 },
  { code: 'CSE401', title: 'Machine Learning', year: '4th year', semester: 'B4', credit: 3 },
  { code: 'CSE501', title: 'Advanced Database Systems', year: 'MS', semester: 'A1', credit: 3 },
  { code: 'CSE502', title: 'Distributed Systems', year: 'MS', semester: 'B2', credit: 3.0 },
  { code: 'CSE503', title: 'Cloud Computing', year: 'MS', semester: 'Unknown', credit: 1.5 },
];

const yearOptions = ['All year', '1st year', '2nd year', '3rd year', '4th year', 'MS'];
const semesterOptions = ['All semester', '1st semester', '2nd semester', 'A1', 'A3', 'B2', 'B4', 'Unknown'];
const creditOptions = ['All credits', '0.75', '1.5', '2', '3'];

function Courses() {
  const [yearFilter, setYearFilter] = useState('All year');
  const [semesterFilter, setSemesterFilter] = useState('All semester');
  const [creditFilter, setCreditFilter] = useState('All credits');
  const [searchTerm, setSearchTerm] = useState('');

  // Filter courses based on selected filters and search term
  const filteredCourses = useMemo(() => {
    return sampleCourses.filter((course) => {
      const yearMatch = yearFilter === 'All year' || course.year === yearFilter;
      const semesterMatch = semesterFilter === 'All semester' || course.semester === semesterFilter;
      const creditMatch = creditFilter === 'All credits' || course.credit.toString() === creditFilter;
      const searchMatch = searchTerm === '' || 
        course.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        course.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        course.year.toLowerCase().includes(searchTerm.toLowerCase()) ||
        course.semester.toLowerCase().includes(searchTerm.toLowerCase());
      return yearMatch && semesterMatch && creditMatch && searchMatch;
    });
  }, [yearFilter, semesterFilter, creditFilter, searchTerm]);

  const handleViewAllCourses = () => {
    setYearFilter('All year');
    setSemesterFilter('All semester');
    setCreditFilter('All credits');
    setSearchTerm('');
  };

  return (
    <div className="routine-section-content courses-container">
      <h2>Courses</h2>
      <p>Manage course information and course-related scheduling.</p>
      
      {/* Top Action Buttons */}
      <div className="action-buttons-block">
        <button className="action-btn add-btn">+ Add Course</button>
        <button className="action-btn import-btn">⬆ Import Courses</button>
        <button className="action-btn removed-courses-btn">📋 Removed Courses</button>
        <button className="action-btn remove-btn">🗑 Remove</button>
      </div>

      {/* Filter and View Block */}
      <div className="filter-block">
        <button className="view-all-btn" onClick={handleViewAllCourses}>
          View All Courses
        </button>

        {/* Search Box */}
        <div className="search-box-container">
          <input
            type="text"
            placeholder="Search by code, title, year, or semester..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-box"
          />
        </div>

        <div className="filters-group">
          {/* Year Filter */}
          <div className="filter-dropdown">
            <label>Year</label>
            <select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}>
              {yearOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          {/* Semester Filter */}
          <div className="filter-dropdown">
            <label>Semester</label>
            <select value={semesterFilter} onChange={(e) => setSemesterFilter(e.target.value)}>
              {semesterOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          {/* Credit Filter */}
          <div className="filter-dropdown">
            <label>Credit</label>
            <select value={creditFilter} onChange={(e) => setCreditFilter(e.target.value)}>
              {creditOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Courses Table */}
      <div className="courses-table-wrapper">
        <table className="courses-table">
          <thead>
            <tr>
              <th>Course Code</th>
              <th>Title</th>
              <th>Year</th>
              <th>Semester</th>
              <th>Credit</th>
              <th>History</th>
            </tr>
          </thead>
          <tbody>
            {filteredCourses.length > 0 ? (
              filteredCourses.map((course, index) => (
                <tr key={course.code} className={index % 2 === 0 ? 'row-light' : 'row-dark'}>
                  <td>{course.code}</td>
                  <td>{course.title}</td>
                  <td>{course.year}</td>
                  <td>{course.semester}</td>
                  <td>{course.credit}</td>
                  <td>
                    <button className="history-btn">View</button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="6" className="no-results">
                  No courses found matching the selected filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="table-info">
        Showing {filteredCourses.length} of {sampleCourses.length} courses
      </div>
    </div>
  );
}

export default Courses;
