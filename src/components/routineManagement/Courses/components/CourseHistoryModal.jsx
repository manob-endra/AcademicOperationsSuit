import '../styles/Modal.css';

function formatDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt)) return '';
  return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Shows which teachers taught this course in previous semesters.
 * Entries come from the course_history table, written automatically
 * when the admin creates a new semester with rollover.
 */
function CourseHistoryModal({ isOpen, onClose, courseCode, courseTitle, history = [], loading = false }) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Course History</h2>
          <button className="modal-close-btn" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div className="course-header">
            <h3>{courseCode}</h3>
            <p>{courseTitle}</p>
          </div>

          <div className="history-list">
            <h4>Teaching History:</h4>
            {loading ? (
              <p className="no-history">Loading history…</p>
            ) : history.length > 0 ? (
              <table className="history-table">
                <thead>
                  <tr>
                    <th>Semester</th>
                    <th>Teacher(s)</th>
                    <th>Archived</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((item, index) => (
                    <tr key={index}>
                      <td>{item.semester_label}</td>
                      <td>
                        {Array.isArray(item.teacher_names) && item.teacher_names.length > 0
                          ? item.teacher_names.join(', ')
                          : '—'}
                      </td>
                      <td>{formatDate(item.archived_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="no-history">
                No history yet. When a new semester is created with rollover,
                this course&apos;s assigned teachers are archived here.
              </p>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-cancel" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

export default CourseHistoryModal;
