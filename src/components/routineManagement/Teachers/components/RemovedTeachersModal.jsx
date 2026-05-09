import { useState } from 'react';

function RemovedTeachersModal({ isOpen, onClose, removedTeachers, onRestoreTeachers }) {
  const [selectedTeachers, setSelectedTeachers] = useState([]);

  const handleSelectTeacher = (teacherInitials) => {
    setSelectedTeachers(prev =>
      prev.includes(teacherInitials)
        ? prev.filter(t => t !== teacherInitials)
        : [...prev, teacherInitials]
    );
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedTeachers(removedTeachers.map(t => t.initials));
    } else {
      setSelectedTeachers([]);
    }
  };

  const handleRestore = () => {
    if (selectedTeachers.length > 0) {
      const teachersToRestore = removedTeachers.filter(t =>
        selectedTeachers.includes(t.initials)
      );
      onRestoreTeachers(teachersToRestore);
      setSelectedTeachers([]);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content removed-teachers-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Removed Teachers</h2>
          <button className="modal-close-btn" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {removedTeachers.length === 0 ? (
            <div className="empty-state">
              <p>No removed teachers.</p>
            </div>
          ) : (
            <>
              <p className="modal-instruction">Select teachers to restore:</p>

              <div className="selection-controls">
                <label className="select-all-label">
                  <input
                    type="checkbox"
                    checked={selectedTeachers.length === removedTeachers.length && removedTeachers.length > 0}
                    onChange={handleSelectAll}
                  />
                  Select All
                </label>
                {selectedTeachers.length > 0 && (
                  <span className="selected-count">{selectedTeachers.length} selected</span>
                )}
              </div>

              <div className="teachers-selection-list">
                {removedTeachers.map(teacher => (
                  <label key={teacher.initials} className="teacher-selection-item">
                    <input
                      type="checkbox"
                      checked={selectedTeachers.includes(teacher.initials)}
                      onChange={() => handleSelectTeacher(teacher.initials)}
                    />
                    <div className="teacher-info">
                      <strong>{teacher.name}</strong>
                      <span className="teacher-initials">({teacher.initials})</span>
                    </div>
                  </label>
                ))}
              </div>

              <div className="modal-buttons">
                <button type="button" className="btn-cancel" onClick={onClose}>
                  Close
                </button>
                <button
                  type="button"
                  className="btn-restore"
                  onClick={handleRestore}
                  disabled={selectedTeachers.length === 0}
                >
                  Restore Selected
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default RemovedTeachersModal;
