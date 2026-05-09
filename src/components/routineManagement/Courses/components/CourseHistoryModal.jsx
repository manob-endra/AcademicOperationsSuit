import '../styles/Modal.css';

function CourseHistoryModal({ isOpen, onClose, courseCode, courseTitle, history }) {
  const defaultHistory = [
    { semester: 'Jun-2025', teacher: 'Dr. John Smith', students: 45 },
    { semester: 'Dec-2024', teacher: 'Prof. Sarah Johnson', students: 52 },
    { semester: 'Jun-2024', teacher: 'Dr. John Smith', students: 48 },
  ];

  const courseHistory = history || defaultHistory;

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
            {courseHistory.length > 0 ? (
              <table className="history-table">
                <thead>
                  <tr>
                    <th>Semester</th>
                    <th>Teacher</th>
                    <th>Students</th>
                  </tr>
                </thead>
                <tbody>
                  {courseHistory.map((item, index) => (
                    <tr key={index}>
                      <td>{item.semester}</td>
                      <td>{item.teacher}</td>
                      <td>{item.students}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="no-history">No history available for this course.</p>
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
