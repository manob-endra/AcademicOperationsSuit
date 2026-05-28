import TeacherAvailabilityGrid from './TeacherAvailabilityGrid';

function TeacherPreferenceModal({ isOpen, onClose, teacher, preferenceType, prefsMap, courseMap, onAvailabilitySaved }) {
  if (!isOpen || !teacher) return null;

  const prefs = (prefsMap || {})[teacher.id] || {};

  const getPrefItems = () => {
    if (preferenceType === 'theory') {
      const items = [];
      if (prefs.first_preference)  items.push({ label: '1st Preference', id: prefs.first_preference });
      if (prefs.second_preference) items.push({ label: '2nd Preference', id: prefs.second_preference });
      if (prefs.third_preference)  items.push({ label: '3rd Preference', id: prefs.third_preference });
      (prefs.other_preferences || []).forEach(id => items.push({ label: 'Other', id }));
      return items;
    }
    if (preferenceType === 'lab') {
      return (prefs.lab_preferences || []).map(id => ({ label: 'Lab', id }));
    }
    return [];
  };

  const items = getPrefItems();
  const isTime = preferenceType === 'time';

  const getTitle = () => {
    if (preferenceType === 'theory') return 'Theory Course Preferences';
    if (preferenceType === 'lab')    return 'Lab Course Preferences';
    if (preferenceType === 'time')   return 'Time Slot Availability';
    return 'Preferences';
  };

  const theme = {
    theory: { header: '#e3f2fd', border: '#90caf9', badge: '#bbdefb' },
    lab:    { header: '#f3e5f5', border: '#ce93d8', badge: '#e1bee7' },
    time:   { header: '#e8f5e9', border: '#a5d6a7', badge: '#c8e6c9' },
  }[preferenceType] || { header: '#f5f5f5', border: '#e0e0e0', badge: '#eeeeee' };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className={`modal-content preference-modal${isTime ? ' preference-modal--time' : ''}`}
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header" style={{ backgroundColor: theme.header }}>
          <div>
            <h2>{getTitle()}</h2>
            <p className="preference-teacher-name">{teacher.name}</p>
          </div>
          <button className="modal-close-btn" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {isTime ? (
            <TeacherAvailabilityGrid teacherId={teacher.id} onSaved={onAvailabilitySaved} />
          ) : (
            <>
              <div className="preference-count-section">
                <div className="preference-count-display">
                  <span className="count-label">Total Preferences:</span>
                  <span className="count-badge" style={{ backgroundColor: theme.badge }}>
                    {items.length}
                  </span>
                </div>
              </div>

              {items.length > 0 ? (
                <div className="preference-items-section">
                  <p className="section-title">Preferred Courses:</p>
                  <div className="preference-items-list">
                    {items.map(({ label, id }, idx) => {
                      const course = (courseMap || {})[id];
                      return (
                        <div
                          key={idx}
                          className="preference-item"
                          style={{ borderLeft: `4px solid ${theme.border}` }}
                        >
                          <span className="pref-label-tag" style={{ background: theme.badge }}>
                            {label}
                          </span>
                          {course ? (
                            <>
                              <span className="pref-course-code">{course.code}</span>
                              <span className="pref-course-title">{course.title}</span>
                            </>
                          ) : (
                            <span className="pref-placeholder">Course not found</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="empty-preferences">
                  <p>No {preferenceType} preferences set yet.</p>
                  <p className="empty-hint">
                    Go to Teacher's Preference tab to add preferences.
                  </p>
                </div>
              )}
            </>
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
