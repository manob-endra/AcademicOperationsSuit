import { useMemo, useState } from 'react';
import './styles/CourseTime.css';

const theoryCourses = [
  { code: 'CSE101', title: 'Introduction to Programming' },
  { code: 'CSE102', title: 'Discrete Mathematics' },
  { code: 'CSE201', title: 'Data Structures' },
  { code: 'CSE202', title: 'Algorithm Design' },
  { code: 'CSE301', title: 'Database Systems' },
  { code: 'CSE302', title: 'Operating Systems' },
  { code: 'CSE401', title: 'Computer Networks' },
  { code: 'CSE402', title: 'Artificial Intelligence' },
];

const labCourses = [
  { code: 'CSE101L', title: 'Programming Lab' },
  { code: 'CSE201L', title: 'Data Structures Lab' },
  { code: 'CSE301L', title: 'Database Lab' },
  { code: 'CSE302L', title: 'Operating Systems Lab' },
  { code: 'CSE401L', title: 'Networks Lab' },
  { code: 'CSE402L', title: 'AI Lab' },
  { code: 'CSE403L', title: 'Software Engineering Lab' },
  { code: 'CSE404L', title: 'Web Engineering Lab' },
];

const getInitialDurations = (courses) => {
  return courses.reduce((acc, course) => {
    acc[course.code] = '';
    return acc;
  }, {});
};

const normalizeDuration = (value) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) || parsed <= 0 ? null : parsed;
};

function CourseDurationSection({ sectionKey, title, courses }) {
  const [allCourseDuration, setAllCourseDuration] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCourseCode, setSelectedCourseCode] = useState(courses[0]?.code ?? '');
  const [customDuration, setCustomDuration] = useState('');
  const [durations, setDurations] = useState(() => getInitialDurations(courses));
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');

  const filteredCourses = useMemo(() => {
    if (!searchTerm.trim()) {
      return courses;
    }

    const normalizedSearch = searchTerm.toLowerCase();
    return courses.filter(
      (course) =>
        course.code.toLowerCase().includes(normalizedSearch) ||
        course.title.toLowerCase().includes(normalizedSearch)
    );
  }, [courses, searchTerm]);

  const assignedCount = useMemo(() => {
    return Object.values(durations).filter((duration) => duration !== '').length;
  }, [durations]);

  const showMessage = (text, type = 'success') => {
    setMessage(text);
    setMessageType(type);
  };

  const handleApplyAllDurations = () => {
    const durationValue = normalizeDuration(allCourseDuration);

    if (!durationValue) {
      showMessage('Enter a valid period count to apply for all courses.', 'error');
      return;
    }

    const updatedDurations = courses.reduce((acc, course) => {
      acc[course.code] = String(durationValue);
      return acc;
    }, {});

    setDurations(updatedDurations);
    showMessage(`Applied ${durationValue} period(s) to all ${title.toLowerCase()} courses.`);
  };

  const handleApplyCustomDuration = () => {
    const durationValue = normalizeDuration(customDuration);

    if (!selectedCourseCode) {
      showMessage('Select a course before applying a custom duration.', 'error');
      return;
    }

    if (!durationValue) {
      showMessage('Enter a valid custom period count.', 'error');
      return;
    }

    setDurations((prev) => ({
      ...prev,
      [selectedCourseCode]: String(durationValue),
    }));
    showMessage(`Updated ${selectedCourseCode} with ${durationValue} period(s).`);
  };

  return (
    <section className="ct-section-card" aria-label={`${title} course duration section`}>
      <div className="ct-section-header">
        <h3>{title} Courses</h3>
        <span className="ct-course-count">Assigned: {assignedCount}/{courses.length}</span>
      </div>

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
              placeholder="e.g. 2"
            />
          </div>
          <button type="button" className="ct-btn ct-btn-primary" onClick={handleApplyAllDurations}>
            Apply To All
          </button>
        </div>
      </div>

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
              value={selectedCourseCode}
              onChange={(e) => setSelectedCourseCode(e.target.value)}
            >
              {filteredCourses.length === 0 && (
                <option value="">No course found</option>
              )}
              {filteredCourses.map((course) => (
                <option key={course.code} value={course.code}>
                  {course.code} - {course.title}
                </option>
              ))}
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
              placeholder="e.g. 3"
            />
          </div>
        </div>

        <button type="button" className="ct-btn ct-btn-secondary" onClick={handleApplyCustomDuration}>
          Apply Custom Duration
        </button>
      </div>

      {message && (
        <p className={`ct-message ${messageType === 'error' ? 'error' : 'success'}`}>
          {message}
        </p>
      )}

      <div className="ct-table-wrapper">
        <table className="ct-table">
          <thead>
            <tr>
              <th>Course Code</th>
              <th>Course Title</th>
              <th>Duration (Periods)</th>
            </tr>
          </thead>
          <tbody>
            {courses.map((course) => (
              <tr key={course.code}>
                <td>{course.code}</td>
                <td>{course.title}</td>
                <td>{durations[course.code] || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CourseTime() {
  return (
    <div className="course-time-container">
      <div className="ct-sections-grid">
        <CourseDurationSection
          sectionKey="theory"
          title="Theory"
          courses={theoryCourses}
        />
        <CourseDurationSection
          sectionKey="lab"
          title="Lab"
          courses={labCourses}
        />
      </div>
    </div>
  );
}

export default CourseTime;
