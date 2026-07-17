import { useState, useEffect, useMemo } from 'react';
import { validateCourseFields, ALL_COURSE_TYPES, isNonClassType } from '../utils/courseUtils';
import '../styles/Modal.css';

const yearOptions = ['1st Year', '2nd Year', '3rd Year', '4th Year', 'Master'];
const semesterOptions = ['1st Semester', '2nd Semester', 'A1', 'A3', 'B2', 'B4'];

const EMPTY_FORM = {
  code: '',
  title: '',
  type: '',
  year: '',
  semester: '',
  credit: '',
  weeklyClasses: '',
  syllabusId: '',
  optionGroupId: '',
};

function AddCourseModal({ isOpen, onClose, onAddCourse, syllabi = [], optionGroups = [], defaultSyllabusId = '' }) {
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setFormData({ ...EMPTY_FORM, syllabusId: defaultSyllabusId || '' });
      setError('');
    }
  }, [isOpen, defaultSyllabusId]);

  const nonClass = isNonClassType(formData.type);

  // Option groups belonging to the chosen syllabus + year + semester
  const availableGroups = useMemo(() => {
    if (!formData.syllabusId) return [];
    return optionGroups.filter(g =>
      g.syllabus_id === formData.syllabusId &&
      (!formData.year || g.year === formData.year) &&
      (!formData.semester || g.semester === formData.semester)
    );
  }, [optionGroups, formData.syllabusId, formData.year, formData.semester]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const next = { ...prev, [name]: value };
      // Project/internship/viva never get weekly classes
      if (name === 'type' && isNonClassType(value)) next.weeklyClasses = '0';
      // Changing syllabus invalidates a chosen option group
      if (name === 'syllabusId') next.optionGroupId = '';
      return next;
    });
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
        credit: parseFloat(formData.credit),
        weeklyClasses: nonClass
          ? 0
          : (formData.weeklyClasses === '' ? null : parseInt(formData.weeklyClasses)),
        syllabusId: formData.syllabusId || null,
        optionGroupId: formData.optionGroupId || null,
      });

      setFormData({ ...EMPTY_FORM, syllabusId: formData.syllabusId });
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to add course');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setFormData(EMPTY_FORM);
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

          {syllabi.length > 0 && (
            <div className="form-group">
              <label>Syllabus</label>
              <select
                name="syllabusId"
                value={formData.syllabusId}
                onChange={handleInputChange}
                disabled={isSubmitting}
              >
                <option value="">No syllabus (legacy catalog)</option>
                {syllabi.map(s => (
                  <option key={s.id} value={s.id}>{s.title} ({s.effective_session})</option>
                ))}
              </select>
            </div>
          )}

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
              {ALL_COURSE_TYPES.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
            {nonClass && (
              <p style={{ fontSize: 12, color: '#6b7280', margin: '4px 0 0' }}>
                {formData.type} courses carry credits but get no routine classes.
              </p>
            )}
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
              placeholder="e.g., 3 or 0.75"
              step="0.25"
              min="0"
              disabled={isSubmitting}
            />
          </div>

          {!nonClass && (
            <div className="form-group">
              <label>Weekly Classes</label>
              <input
                type="number"
                name="weeklyClasses"
                value={formData.weeklyClasses}
                onChange={handleInputChange}
                placeholder="Default: 3 theory · 1 lab"
                min="0"
                disabled={isSubmitting}
              />
            </div>
          )}

          {formData.syllabusId && (
            <div className="form-group">
              <label>Option Group (optional courses only)</label>
              <select
                name="optionGroupId"
                value={formData.optionGroupId}
                onChange={handleInputChange}
                disabled={isSubmitting}
              >
                <option value="">Compulsory (no group)</option>
                {availableGroups.map(g => (
                  <option key={g.id} value={g.id}>
                    {g.name} — {g.year} {g.semester} (choose {g.choose_count})
                  </option>
                ))}
              </select>
              {availableGroups.length === 0 && (
                <p style={{ fontSize: 12, color: '#6b7280', margin: '4px 0 0' }}>
                  No option groups for this syllabus/year/semester yet — create one in the
                  Syllabi &amp; Options tab.
                </p>
              )}
            </div>
          )}
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
