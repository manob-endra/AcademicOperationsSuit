import { useState, useEffect } from 'react';
import { studentAPI } from '../../services/studentAPI';

const YEAR_LABEL = { '1st':'1st Year','2nd':'2nd Year','3rd':'3rd Year','4th':'4th Year','ms':'MS' };

function RemovedModal({ onClose, onRestored }) {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [restoringId, setRestoringId] = useState(null);

  useEffect(() => {
    studentAPI.getRemovedStudents().then(result => {
      if (result.success) setStudents(result.data);
      else setError(result.error || 'Failed to load removed students.');
      setLoading(false);
    });
  }, []);

  const handleRestore = async (id) => {
    setRestoringId(id);
    const result = await studentAPI.restoreStudent(id);
    if (result.success) {
      setStudents(prev => prev.filter(s => s.id !== id));
      onRestored();
    } else {
      setError(result.error || 'Restore failed.');
    }
    setRestoringId(null);
  };

  return (
    <div className="sm-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="sm-modal sm-modal--xl">
        <div className="sm-modal-header">
          <h2 className="sm-modal-title">Removed Students</h2>
          <button className="sm-modal-close" onClick={onClose}>×</button>
        </div>
        <div className="sm-modal-body">
          {loading && <p className="sm-loading-text">Loading…</p>}
          {error && <p className="sm-form-error">{error}</p>}
          {!loading && !error && students.length === 0 && <p className="sm-empty-text">No removed students found.</p>}
          {!loading && students.length > 0 && (
            <div className="sm-table-wrap">
              <table className="sm-table">
                <thead><tr>
                  <th>Reg No</th><th>Name</th><th>Roll</th><th>Session</th>
                  <th>Year</th><th>Hall</th><th>Email</th><th></th>
                </tr></thead>
                <tbody>
                  {students.map(s => (
                    <tr key={s.id} className="sm-row-removed">
                      <td>{s.registration_no || '—'}</td>
                      <td>{s.name}</td>
                      <td>{s.roll || '—'}</td>
                      <td>{s.session || '—'}</td>
                      <td><span className="sm-year-badge">{YEAR_LABEL[s.academic_year] || s.academic_year || '—'}</span></td>
                      <td>{s.hall || '—'}</td>
                      <td>{s.email || '—'}</td>
                      <td>
                        <button
                          className="sm-btn-icon sm-btn-icon--restore"
                          title="Restore student"
                          onClick={() => handleRestore(s.id)}
                          disabled={restoringId === s.id}
                        >
                          {restoringId === s.id ? '…' : '↩'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="sm-modal-footer">
          <button className="sm-btn sm-btn-ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

export default RemovedModal;
