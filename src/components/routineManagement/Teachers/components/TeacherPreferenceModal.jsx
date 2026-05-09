import { useState } from 'react';

function TeacherPreferenceModal({ isOpen, onClose, teacher, preferenceType }) {
  const [preferences, setPreferences] = useState([]);
  const [newPreference, setNewPreference] = useState('');

  const getPreferencesData = () => {
    if (!teacher) return [];

    if (preferenceType === 'theory') {
      return teacher.theoryPreferences || 0;
    } else if (preferenceType === 'lab') {
      return teacher.labPreferences || 0;
    } else if (preferenceType === 'time') {
      return teacher.timePreferences || 0;
    }
    return [];
  };

  const getPreferenceTitle = () => {
    if (preferenceType === 'theory') return 'Theory Course Preferences';
    if (preferenceType === 'lab') return 'Lab Course Preferences';
    if (preferenceType === 'time') return 'Time Slot Preferences';
    return 'Preferences';
  };

  const getPreferenceColor = () => {
    if (preferenceType === 'theory') return '#e3f2fd';
    if (preferenceType === 'lab') return '#f3e5f5';
    if (preferenceType === 'time') return '#e8f5e9';
    return '#fafafa';
  };

  if (!isOpen || !teacher) return null;

  const prefCount = getPreferencesData();

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content preference-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header" style={{ backgroundColor: getPreferenceColor() }}>
          <div>
            <h2>{getPreferenceTitle()}</h2>
            <p className="preference-teacher-name">{teacher.name}</p>
          </div>
          <button className="modal-close-btn" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div className="preference-count-section">
            <div className="preference-count-display">
              <span className="count-label">Total Preferences:</span>
              <span className="count-badge" style={{ backgroundColor: getPreferenceColor() }}>
                {prefCount}
              </span>
            </div>
          </div>

          {prefCount > 0 ? (
            <div className="preference-items-section">
              <p className="section-title">
                {preferenceType === 'time' ? 'Preferred Time Slots:' : 'Preferred Courses:'}
              </p>
              <div className="preference-items-list">
                {Array.from({ length: prefCount }).map((_, idx) => (
                  <div key={idx} className="preference-item" style={{ borderLeft: `4px solid ${getPreferenceColor().replace(/[0-9a-f]{2}(?=(?:[0-9a-f]{2}){2})/gi, '0')}` }}>
                    <span className="pref-number">{idx + 1}.</span>
                    <span className="pref-placeholder">
                      {preferenceType === 'time' ? 'Time Slot ' : 'Course '} - {idx + 1}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="empty-preferences">
              <p>No {preferenceType} preferences added yet.</p>
            </div>
          )}

          <div className="modal-buttons">
            <button type="button" className="btn-cancel" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TeacherPreferenceModal;
