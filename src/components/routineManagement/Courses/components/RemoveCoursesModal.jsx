import { useState } from 'react';
import '../styles/Modal.css';

function RemoveCoursesModal({ isOpen, onClose, courses, onRemoveCourses }) {
  const [selectedCourses, setSelectedCourses] = useState([]);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const handleSelectCourse = (courseCode) => {
    setSelectedCourses(prev => {
      if (prev.includes(courseCode)) {
        return prev.filter(code => code !== courseCode);
      } else {
        return [...prev, courseCode];
      }
    });
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedCourses(filteredCourses.map(course => course.code));
    } else {
      setSelectedCourses([]);
    }
  };

  const handleRemove = () => {
    if (selectedCourses.length === 0) {
      return;
    }
    setShowConfirmation(true);
  };

  const handleConfirmRemoval = async () => {
    setIsSubmitting(true);
    try {
      await onRemoveCourses(selectedCourses);
    } catch (err) {
      console.error('Error removing courses:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setSelectedCourses([]);
    setShowConfirmation(false);
    setSearchTerm('');
    onClose();
  };

  // Filter courses based on search term
  const filteredCourses = courses.filter(course => {
    const searchLower = searchTerm.toLowerCase();
    return (
      course.code.toLowerCase().includes(searchLower) ||
      course.title.toLowerCase().includes(searchLower) ||
      course.type.toLowerCase().includes(searchLower) ||
      course.year.toLowerCase().includes(searchLower)
    );
  });

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleCancel}>
      <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
        {!showConfirmation ? (
          <>
            <div className="modal-header">
              <h2>Remove Courses</h2>
              <button className="modal-close-btn" onClick={handleCancel}>×</button>
            </div>

            <div className="modal-body">
              <p className="remove-info">Select courses to remove:</p>

              <div className="search-box-container" style={{ marginBottom: '16px' }}>
                <input
                  type="text"
                  placeholder="Search by code, title, type, or year..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="search-box"
                  disabled={isSubmitting}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '4px',
                    border: '1px solid #ccc',
                    fontSize: '14px',
                    fontFamily: 'inherit'
                  }}
                />
              </div>

              <div className="checkbox-group-header">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={filteredCourses.length > 0 && selectedCourses.length === filteredCourses.length}
                    onChange={handleSelectAll}
                    disabled={isSubmitting || filteredCourses.length === 0}
                  />
                  Select All
                </label>
              </div>

              <div className="remove-courses-list">
                {filteredCourses.length > 0 ? (
                  filteredCourses.map(course => (
                    <div key={course.code} className="course-checkbox-item">
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={selectedCourses.includes(course.code)}
                          onChange={() => handleSelectCourse(course.code)}
                          disabled={isSubmitting}
                        />
                        <span className="course-info">
                          <strong>{course.code}</strong> - {course.title}
                          <small>({course.type} • {course.year})</small>
                        </span>
                      </label>
                    </div>
                  ))
                ) : courses.length === 0 ? (
                  <p className="no-courses">No courses available</p>
                ) : (
                  <p className="no-courses">No courses match your search.</p>
                )}
              </div>

              <div className="selection-info">
                {selectedCourses.length} course(s) selected
              </div>
            </div>

            <div className="modal-footer">
              <button 
                className="btn btn-cancel" 
                onClick={handleCancel}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                className="btn btn-danger"
                onClick={handleRemove}
                disabled={selectedCourses.length === 0 || isSubmitting}
              >
                Remove ({selectedCourses.length})
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="modal-header">
              <h2>Confirm Removal</h2>
              <button className="modal-close-btn" onClick={handleCancel} disabled={isSubmitting}>×</button>
            </div>

            <div className="modal-body">
              <div className="confirmation-alert">
                <p className="alert-title">⚠️ Confirm Removal</p>
                <p>
                  You are about to remove <strong>{selectedCourses.length}</strong> course(s). 
                  These courses will be moved to the Removed Courses section and can be restored later.
                </p>
                <div className="courses-to-remove">
                  {courses
                    .filter(c => selectedCourses.includes(c.code))
                    .map(course => (
                      <div key={course.code} className="course-item">
                        {course.code} - {course.title}
                      </div>
                    ))}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="btn btn-cancel"
                onClick={() => setShowConfirmation(false)}
                disabled={isSubmitting}
              >
                Back
              </button>
              <button
                className="btn btn-danger"
                onClick={handleConfirmRemoval}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Removing...' : 'Yes, Remove'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default RemoveCoursesModal;
