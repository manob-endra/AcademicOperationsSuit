import { useState } from 'react';

function RemoveTeachersModal({ isOpen, onClose, teachers, onRemoveTeachers }) {
  const [selectedTeachers, setSelectedTeachers] = useState([]);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const handleSelectTeacher = (teacherInitials) => {
    setSelectedTeachers(prev =>
      prev.includes(teacherInitials)
        ? prev.filter(t => t !== teacherInitials)
        : [...prev, teacherInitials]
    );
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedTeachers(teachers.map(t => t.initials));
    } else {
      setSelectedTeachers([]);
    }
  };

  const handleRemove = () => {
    if (selectedTeachers.length > 0) {
      setShowConfirmation(true);
    }
  };

  const handleConfirmRemove = () => {
    const teachersToRemove = teachers.filter(t => selectedTeachers.includes(t.initials));
    onRemoveTeachers(teachersToRemove);
    resetModal();
  };

  const resetModal = () => {
    setSelectedTeachers([]);
    setShowConfirmation(false);
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content remove-teachers-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Remove Teachers</h2>
          <button className="modal-close-btn" onClick={onClose}>×</button>
        </div>

        {!showConfirmation ? (
          <div className="modal-body">
            <p className="modal-instruction">Select teachers to remove:</p>

            <div className="selection-controls">
              <label className="select-all-label">
                <input
                  type="checkbox"
                  checked={selectedTeachers.length === teachers.length && teachers.length > 0}
                  onChange={handleSelectAll}
                />
                Select All
              </label>
              {selectedTeachers.length > 0 && (
                <span className="selected-count">{selectedTeachers.length} selected</span>
              )}
            </div>

            <div className="teachers-selection-list">
              {teachers.map(teacher => (
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
                Cancel
              </button>
              <button
                type="button"
                className="btn-remove"
                onClick={handleRemove}
                disabled={selectedTeachers.length === 0}
              >
                Remove Selected
              </button>
            </div>
          </div>
        ) : (
          <div className="modal-body confirmation-body">
            <div className="confirmation-icon">⚠️</div>
            <p className="confirmation-message">
              Are you sure you want to remove {selectedTeachers.length} teacher{selectedTeachers.length !== 1 ? 's' : ''}?
            </p>
            <div className="confirmation-list">
              {teachers.filter(t => selectedTeachers.includes(t.initials)).map(teacher => (
                <div key={teacher.initials} className="confirmation-item">
                  {teacher.name}
                </div>
              ))}
            </div>
            <p className="confirmation-note">These teachers will be moved to the removed list.</p>

            <div className="modal-buttons">
              <button
                type="button"
                className="btn-cancel"
                onClick={() => setShowConfirmation(false)}
              >
                Cancel
              </button>
              <button type="button" className="btn-remove" onClick={handleConfirmRemove}>
                Confirm Remove
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default RemoveTeachersModal;
