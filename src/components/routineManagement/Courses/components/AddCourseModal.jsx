import { useState } from 'react';
import { validateCourseFields } from '../utils/courseUtils';
import '../styles/Modal.css';

const yearOptions = ['1st Year', '2nd Year', '3rd Year', '4th Year', 'Master'];
const semesterOptions = ['1st Semester', '2nd Semester', 'A1', 'A3', 'B2', 'B4'];
const typeOptions = ['Theory', 'Lab'];

function AddCourseModal({ isOpen, onClose, onAddCourse }) {
  const [formData, setFormData] = useState({
    code: '',
    title: '',
    type: '',
    year: '',
    semester: '',
    credit: '',
  });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    setError('');
  };

  const handleConfirm = async () => {
    const validation = validateCourseFields(formData);
    if (!validation.isValid) {
      setError(validation.message);
      return;
    }

    setIsSubmitting(true);
    try {
      await onAddCourse({
        ...formData,
        credit: parseFloat(formData.credit)
      });

      setFormData({
        code: '',
        title: '',
        type: '',
        year: '',
        semester: '',
        credit: '',
      });
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to add course');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      code: '',
      title: '',
      type: '',
      year: '',
      semester: '',
      credit: '',
    });
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleCancel}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Add New Course</h2>
          <button className="modal-close-btn" onClick={handleCancel}>×</button>
        </div>

        <div className="modal-body">
          {error && <div className="error-message">{error}</div>}

          <div className="form-group">
            <label>Course Code *</label>
            <input
              type="text"
              name="code"
              value={formData.code}
              onChange={handleInputChange}
              placeholder="e.g., CSE101"
              disabled={isSubmitting}
            />
          </div>

          <div className="form-group">
            <label>Title *</label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              placeholder="e.g., Introduction to Programming"
              disabled={isSubmitting}
            />
          </div>

          <div className="form-group">
            <label>Type *</label>
            <select
              name="type"
              value={formData.type}
              onChange={handleInputChange}
              disabled={isSubmitting}
            >
              <option value="">Select Type</option>
              {typeOptions.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Year *</label>
            <select
              name="year"
              value={formData.year}
              onChange={handleInputChange}
              disabled={isSubmitting}
            >
              <option value="">Select Year</option>
              {yearOptions.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Semester *</label>
            <select
              name="semester"
              value={formData.semester}
              onChange={handleInputChange}
              disabled={isSubmitting}
            >
              <option value="">Select Semester</option>
              {semesterOptions.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Credit *</label>
            <input
              type="number"
              name="credit"
              value={formData.credit}
              onChange={handleInputChange}
              placeholder="e.g., 3"
              step="0.5"
              disabled={isSubmitting}
            />
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
            className="btn btn-confirm" 
            onClick={handleConfirm}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Adding...' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default AddCourseModal;
