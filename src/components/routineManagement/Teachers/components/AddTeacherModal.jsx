import { useState, useMemo } from 'react';
import { generateUniqueInitials } from '../utils/teacherUtils';

function AddTeacherModal({ isOpen, onClose, onAddTeacher, existingInitials = [] }) {
  const [name, setName]   = useState('');
  const [error, setError] = useState('');

  // Live preview of what initials will be assigned
  const previewInitials = useMemo(
    () => (name.trim() ? generateUniqueInitials(name, existingInitials) : ''),
    [name, existingInitials]
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Teacher name is required.');
      return;
    }

    const initials = generateUniqueInitials(name, existingInitials);

    onAddTeacher({
      name:              name.trim(),
      initials,
      theoryPreferences: 0,
      labPreferences:    0,
      timePreferences:   0,
      weeklyLoadHours:   0,
      loadLimit:         10,
      assignedCourses:   [],
    });

    setName('');
    setError('');
  };

  const handleClose = () => {
    setName('');
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content add-teacher-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Add New Teacher</h2>
          <button className="modal-close-btn" onClick={handleClose}>×</button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label>Name <span style={{ color: '#e74c3c' }}>*</span></label>
            <input
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setError(''); }}
              placeholder="e.g., Dr. Ahmed Khan"
              autoFocus
            />
            {error && <span className="error-text">{error}</span>}
          </div>

          {previewInitials && (
            <p className="initials-preview">
              Initials will be: <strong>{previewInitials}</strong>
            </p>
          )}

          <p className="form-note">
            Defaults: load&nbsp;0&nbsp;hrs · limit&nbsp;10&nbsp;hrs · preferences&nbsp;0
          </p>

          <div className="modal-buttons">
            <button type="button" className="btn-cancel" onClick={handleClose}>
              Cancel
            </button>
            <button type="submit" className="btn-confirm">
              Add Teacher
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddTeacherModal;
