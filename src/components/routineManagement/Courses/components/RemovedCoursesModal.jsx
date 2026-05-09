import { useState } from 'react';
import '../styles/Modal.css';

function RemovedCoursesModal({ isOpen, onClose, removedCourses, onRestoreCourse }) {
  const [selectedForRestore, setSelectedForRestore] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSelectCourse = (courseCode) => {
    setSelectedForRestore(prev => {
      if (prev.includes(courseCode)) {
        return prev.filter(code => code !== courseCode);
      } else {
        return [...prev, courseCode];
      }
    });
  };

  const handleRestore = async () => {
    if (selectedForRestore.length === 0) return;
    
    setIsSubmitting(true);
    try {
      await onRestoreCourse(selectedForRestore);
      setSelectedForRestore([]);
    } catch (err) {
      console.error('Error restoring courses:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Removed Courses</h2>
          <button className="modal-close-btn" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {removedCourses.length > 0 ? (
            <>
              <div className="removed-courses-list">
                {removedCourses.map(course => (
                  <div key={course.code} className="course-checkbox-item">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={selectedForRestore.includes(course.code)}
                        onChange={() => handleSelectCourse(course.code)}
                        disabled={isSubmitting}
                      />
                      <span className="course-info">
                        <strong>{course.code}</strong> - {course.title}
                        <small>({course.type} • {course.year} • {course.semester})</small>
                      </span>
                    </label>
                  </div>
                ))}
              </div>

              <div className="selection-info">
                {selectedForRestore.length} course(s) selected for restoration
              </div>
            </>
          ) : (
            <div className="no-courses-message">
              <p>No removed courses yet.</p>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button 
            className="btn btn-cancel" 
            onClick={onClose}
            disabled={isSubmitting}
          >
            Close
          </button>
          {removedCourses.length > 0 && (
            <button
              className="btn btn-confirm"
              onClick={handleRestore}
              disabled={selectedForRestore.length === 0 || isSubmitting}
            >
              {isSubmitting ? 'Restoring...' : `Restore (${selectedForRestore.length})`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default RemovedCoursesModal;
