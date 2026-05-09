import { useState } from 'react';
import { validateTeacherFields } from '../utils/teacherUtils';

function AddTeacherModal({ isOpen, onClose, onAddTeacher }) {
  const [formData, setFormData] = useState({
    initials: '',
    name: '',
    theoryPreferences: 0,
    labPreferences: 0,
    timePreferences: 0,
    weeklyLoadHours: 0,
    loadLimit: 20,
    assignedCourses: [],
  });

  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name.includes('Preferences') || name === 'weeklyLoadHours' || name === 'loadLimit'
        ? parseInt(value) || 0
        : value,
    }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!validateTeacherFields(formData)) {
      setErrors({ submit: 'Please fill in all required fields correctly.' });
      return;
    }

    if (!formData.initials.trim()) {
      setErrors({ initials: 'Initials are required.' });
      return;
    }

    onAddTeacher(formData);
    resetForm();
  };

  const resetForm = () => {
    setFormData({
      initials: '',
      name: '',
      theoryPreferences: 0,
      labPreferences: 0,
      timePreferences: 0,
      weeklyLoadHours: 0,
      loadLimit: 20,
      assignedCourses: [],
    });
    setErrors({});
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content add-teacher-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Add New Teacher</h2>
          <button className="modal-close-btn" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label>Initials *</label>
            <input
              type="text"
              name="initials"
              value={formData.initials}
              onChange={handleChange}
              placeholder="e.g., AK"
              className={errors.initials ? 'input-error' : ''}
            />
            {errors.initials && <span className="error-text">{errors.initials}</span>}
          </div>

          <div className="form-group">
            <label>Name *</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="e.g., Dr. Ahmed Khan"
              className={errors.name ? 'input-error' : ''}
            />
            {errors.name && <span className="error-text">{errors.name}</span>}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Theory Preferences</label>
              <input
                type="number"
                name="theoryPreferences"
                value={formData.theoryPreferences}
                onChange={handleChange}
                min="0"
              />
            </div>

            <div className="form-group">
              <label>Lab Preferences</label>
              <input
                type="number"
                name="labPreferences"
                value={formData.labPreferences}
                onChange={handleChange}
                min="0"
              />
            </div>

            <div className="form-group">
              <label>Time Preferences</label>
              <input
                type="number"
                name="timePreferences"
                value={formData.timePreferences}
                onChange={handleChange}
                min="0"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Weekly Load Hours</label>
              <input
                type="number"
                name="weeklyLoadHours"
                value={formData.weeklyLoadHours}
                onChange={handleChange}
                min="0"
              />
            </div>

            <div className="form-group">
              <label>Load Limit (hours) *</label>
              <input
                type="number"
                name="loadLimit"
                value={formData.loadLimit}
                onChange={handleChange}
                min="1"
                className={errors.loadLimit ? 'input-error' : ''}
              />
              {errors.loadLimit && <span className="error-text">{errors.loadLimit}</span>}
            </div>
          </div>

          {errors.submit && <div className="error-message">{errors.submit}</div>}

          <div className="modal-buttons">
            <button type="button" className="btn-cancel" onClick={() => { resetForm(); onClose(); }}>
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
