import { useState, useEffect } from 'react';
import { teacherAPI } from '../../services/teacherAPI';
import { sortTeachersByRank } from '../../utils/teacherRank';

function RemovedModal({ onClose, onRestored }) {
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [restoringId, setRestoringId] = useState(null);

  useEffect(() => {
    teacherAPI.getRemovedTeachers().then(result => {
      if (result.success) setTeachers(sortTeachersByRank(result.data));
      else setError(result.error || 'Failed to load removed teachers.');
      setLoading(false);
    });
  }, []);

  const handleRestore = async (id) => {
    setRestoringId(id);
    const result = await teacherAPI.restoreTeacher(id);
    if (result.success) {
      setTeachers(prev => prev.filter(t => t.id !== id));
      onRestored();
    } else {
      setError(result.error || 'Restore failed.');
    }
    setRestoringId(null);
  };

  const AVAIL_LABEL = {
    available: 'Available',
    unavailable: 'Unavailable',
    study_leave: 'Study Leave',
    medical_leave: 'Medical Leave',
    sabbatical: 'Sabbatical',
  };

  return (
    <div className="tm-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="tm-modal tm-modal--wide">
        <div className="tm-modal-header">
          <h2 className="tm-modal-title">Removed Teachers</h2>
          <button className="tm-modal-close" onClick={onClose}>×</button>
        </div>
        <div className="tm-modal-body">
          {loading && <p className="tm-loading-text">Loading…</p>}
          {error && <p className="tm-form-error">{error}</p>}
          {!loading && !error && teachers.length === 0 && (
            <p className="tm-empty-text">No removed teachers found.</p>
          )}
          {!loading && teachers.length > 0 && (
            <div className="tm-table-wrap">
              <table className="tm-table">
                <thead>
                  <tr>
                    <th>Initials</th>
                    <th>Name</th>
                    <th>Designation</th>
                    <th>Email</th>
                    <th>Special Post</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {teachers.map(t => (
                    <tr key={t.id} className="tm-row-removed">
                      <td><span className="tm-initials-badge tm-initials-badge--removed">{t.initials || '—'}</span></td>
                      <td>{t.name}</td>
                      <td>{t.designation || '—'}</td>
                      <td>{t.email || '—'}</td>
                      <td>{t.special_post || '—'}</td>
                      <td>
                        <span className={`tm-status-badge tm-status-${t.availability_status || 'available'}`}>
                          {AVAIL_LABEL[t.availability_status] || 'Available'}
                        </span>
                      </td>
                      <td>
                        <button
                          className="tm-btn-icon tm-btn-icon--restore"
                          title="Restore teacher"
                          onClick={() => handleRestore(t.id)}
                          disabled={restoringId === t.id}
                        >
                          {restoringId === t.id ? '…' : '↩'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="tm-modal-footer">
          <button className="tm-btn tm-btn-ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

export default RemovedModal;
