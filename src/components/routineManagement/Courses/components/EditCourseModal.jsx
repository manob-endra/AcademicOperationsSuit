import { useState, useMemo, useEffect, useRef } from 'react';
import { validateCourseFields, ALL_COURSE_TYPES, isNonClassType } from '../utils/courseUtils';
import '../styles/Modal.css';
import '../styles/EditCourseModal.css';

const yearOptions     = ['1st Year', '2nd Year', '3rd Year', '4th Year', 'Master'];
const semesterOptions = ['1st Semester', '2nd Semester', 'A1', 'A3', 'B2', 'B4'];
const typeOptions     = ALL_COURSE_TYPES;

function EditCourseModal({ isOpen, onClose, courses = [], onEditCourse, syllabi = [], optionGroups = [] }) {
  const [search,          setSearch]          = useState('');
  const [selectedCourse,  setSelectedCourse]  = useState(null);
  const [formData,        setFormData]        = useState({});
  const [error,           setError]           = useState('');
  const [isSubmitting,    setIsSubmitting]     = useState(false);
  const [saveSuccess,     setSaveSuccess]      = useState(false);

  const searchRef = useRef(null);

  // Reset everything when the modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setSelectedCourse(null);
      setFormData({});
      setError('');
      setSaveSuccess(false);
      setTimeout(() => searchRef.current?.focus(), 80);
    }
  }, [isOpen]);

  // Filtered course list based on search term
  const filteredCourses = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return courses;
    return courses.filter(c =>
      c.code.toLowerCase().includes(q) ||
      c.title.toLowerCase().includes(q) ||
      c.year.toLowerCase().includes(q) ||
      c.semester.toLowerCase().includes(q)
    );
  }, [courses, search]);

  const handleSelectCourse = (course) => {
    setSelectedCourse(course);
    setFormData({
      code:          course.code,
      title:         course.title,
      type:          course.type,
      year:          course.year,
      semester:      course.semester,
      credit:        String(course.credit),
      weeklyClasses: course.weeklyClasses != null ? String(course.weeklyClasses) : '',
      syllabusId:    course.syllabusId || '',
      optionGroupId: course.optionGroupId || '',
    });
    setError('');
    setSaveSuccess(false);
  };

  const handleBack = () => {
    setSelectedCourse(null);
    setFormData({});
    setError('');
    setSaveSuccess(false);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const next = { ...prev, [name]: value };
      if (name === 'type' && isNonClassType(value)) next.weeklyClasses = '0';
      if (name === 'syllabusId') next.optionGroupId = '';
      return next;
    });
    setError('');
    setSaveSuccess(false);
  };

  const handleSave = async () => {
    const validation = validateCourseFields(formData);
    if (!validation.isValid) { setError(validation.message); return; }

    setIsSubmitting(true);
    setError('');
    try {
      const nonClass = isNonClassType(formData.type);
      await onEditCourse(selectedCourse.id, {
        ...formData,
        credit: parseFloat(formData.credit),
        weeklyClasses: nonClass
          ? 0
          : (formData.weeklyClasses === '' ? null : parseInt(formData.weeklyClasses)),
        syllabusId: formData.syllabusId || null,
        optionGroupId: formData.optionGroupId || null,
      });
      setSaveSuccess(true);
      // Update the local selectedCourse so the list reflects the new values
      setSelectedCourse(prev => ({ ...prev, ...formData, credit: parseFloat(formData.credit) }));
    } catch (err) {
      setError(err.message || 'Failed to save changes.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Option groups matching the chosen syllabus + year + semester
  const availableGroups = useMemo(() => {
    if (!formData.syllabusId) return [];
    return optionGroups.filter(g =>
      g.syllabus_id === formData.syllabusId &&
      (!formData.year || g.year === formData.year) &&
      (!formData.semester || g.semester === formData.semester)
    );
  }, [optionGroups, formData.syllabusId, formData.year, formData.semester]);

  const handleClose = () => {
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div
        className="modal-content modal-large ecm-modal"
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ─────────────────────────────────────────── */}
        <div className="modal-header">
          <h2>
            {selectedCourse
              ? <><button className="ecm-back-btn" onClick={handleBack} title="Back to list">&#8592;</button> Edit Course</>
              : 'Edit Course'}
          </h2>
          <button className="modal-close-btn" onClick={handleClose}>×</button>
        </div>

        {/* ── Body ───────────────────────────────────────────── */}
        <div className="modal-body ecm-body">

          {/* STEP 1 — course picker */}
          {!selectedCourse && (
            <>
              <p className="ecm-hint">Search for a course and click it to edit its details.</p>

              <input
                ref={searchRef}
                type="text"
                className="ecm-search"
                placeholder="Search by code, title, year or semester…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />

              <div className="ecm-course-list">
                {filteredCourses.length === 0 ? (
                  <p className="no-courses">No courses match your search.</p>
                ) : (
                  filteredCourses.map(course => (
                    <button
                      type="button"
                      key={course.id}
                      className="ecm-course-item"
                      onClick={() => handleSelectCourse(course)}
                    >
                      <span className="ecm-course-code">{course.code}</span>
                      <span className="ecm-course-title">{course.title}</span>
                      <span className="ecm-course-meta">{course.year} &bull; {course.semester} &bull; {course.type} &bull; {course.credit} cr</span>
                    </button>
                  ))
                )}
              </div>

              <p className="ecm-count">{filteredCourses.length} course{filteredCourses.length !== 1 ? 's' : ''} shown</p>
            </>
          )}

          {/* STEP 2 — edit form */}
          {selectedCourse && (
            <>
              {error      && <div className="error-message">{error}</div>}
              {saveSuccess && (
                <div className="ecm-success-msg">
                  Changes saved successfully.
                </div>
              )}

              <div className="ecm-form-grid">
                <div className="form-group">
                  <label>Course Code *</label>
                  <input
                    type="text"
                    name="code"
                    value={formData.code}
                    onChange={handleChange}
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
                    onChange={handleChange}
                    placeholder="e.g., Introduction to Programming"
                    disabled={isSubmitting}
                  />
                </div>

                <div className="form-group">
                  <label>Type *</label>
                  <select name="type" value={formData.type} onChange={handleChange} disabled={isSubmitting}>
                    <option value="">Select Type</option>
                    {typeOptions.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label>Year *</label>
                  <select name="year" value={formData.year} onChange={handleChange} disabled={isSubmitting}>
                    <option value="">Select Year</option>
                    {yearOptions.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label>Semester *</label>
                  <select name="semester" value={formData.semester} onChange={handleChange} disabled={isSubmitting}>
                    <option value="">Select Semester</option>
                    {semesterOptions.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label>Credit Hours *</label>
                  <input
                    type="number"
                    name="credit"
                    value={formData.credit}
                    onChange={handleChange}
                    placeholder="e.g., 3 or 0.75"
                    step="0.25"
                    min="0"
                    disabled={isSubmitting}
                  />
                </div>

                {!isNonClassType(formData.type) && (
                  <div className="form-group">
                    <label>Weekly Classes</label>
                    <input
                      type="number"
                      name="weeklyClasses"
                      value={formData.weeklyClasses}
                      onChange={handleChange}
                      placeholder="3 theory · 1 lab"
                      min="0"
                      disabled={isSubmitting}
                    />
                  </div>
                )}

                {syllabi.length > 0 && (
                  <div className="form-group">
                    <label>Syllabus</label>
                    <select name="syllabusId" value={formData.syllabusId} onChange={handleChange} disabled={isSubmitting}>
                      <option value="">No syllabus (legacy)</option>
                      {syllabi.map(s => (
                        <option key={s.id} value={s.id}>{s.title} ({s.effective_session})</option>
                      ))}
                    </select>
                  </div>
                )}

                {formData.syllabusId && (
                  <div className="form-group">
                    <label>Option Group</label>
                    <select name="optionGroupId" value={formData.optionGroupId} onChange={handleChange} disabled={isSubmitting}>
                      <option value="">Compulsory (no group)</option>
                      {availableGroups.map(g => (
                        <option key={g.id} value={g.id}>
                          {g.name} — {g.year} {g.semester} (choose {g.choose_count})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* ── Footer ─────────────────────────────────────────── */}
        {selectedCourse && (
          <div className="modal-footer">
            <button className="btn btn-cancel" onClick={handleBack} disabled={isSubmitting}>
              Back to List
            </button>
            <button className="btn btn-confirm" onClick={handleSave} disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default EditCourseModal;
