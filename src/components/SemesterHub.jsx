import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { academicSemesterAPI } from '../services/academicSemesterAPI';
import '../styles/ModulePages.css';
import '../styles/SemesterHub.css';

function SemesterHub() {
  const navigate = useNavigate();
  const [semesters, setSemesters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ year: '', name: '' });
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    loadSemesters();
  }, []);

  const loadSemesters = async () => {
    setLoading(true);
    setError('');
    const result = await academicSemesterAPI.getAllSemesters();
    if (result.success) {
      setSemesters(result.data);
    } else {
      setError(result.offline
        ? 'Backend server is not running. Start the server and refresh.'
        : result.error);
    }
    setLoading(false);
  };

  const openModal = () => {
    setForm({ year: new Date().getFullYear().toString(), name: '' });
    setFormError('');
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setFormError('');
  };

  const handleCreate = async () => {
    const year = form.year.trim();
    const name = form.name.trim();
    if (!year || !name) {
      setFormError('Both year and name are required.');
      return;
    }
    setCreating(true);
    setFormError('');
    const result = await academicSemesterAPI.createSemester(year, name);
    setCreating(false);
    if (result.success) {
      setSemesters(prev => [result.data, ...prev]);
      closeModal();
    } else {
      setFormError(result.error || 'Failed to create semester.');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleCreate();
    if (e.key === 'Escape') closeModal();
  };

  return (
    <main className="module-page">
      <header className="module-header">
        <button className="back-button" onClick={() => navigate('/admin-dashboard')}>
          ← Dashboard
        </button>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>Routine Management</h1>
          <p style={{ margin: '2px 0 0', fontSize: 13, opacity: 0.75 }}>
            Select a semester to manage routines or create a new one
          </p>
        </div>
      </header>

      <div className="module-content">
        {error && (
          <div className="sh-error-banner">
            {error}
            <button onClick={loadSemesters} className="sh-retry-btn">Retry</button>
          </div>
        )}

        <div className="sh-toolbar">
          <h2 className="sh-section-title">
            Academic Semesters
            {!loading && <span className="sh-count">{semesters.length}</span>}
          </h2>
          <button className="sh-create-btn" onClick={openModal}>
            + Create Semester
          </button>
        </div>

        {loading ? (
          <div className="sh-loading">Loading semesters…</div>
        ) : semesters.length === 0 ? (
          <div className="sh-empty">
            <div className="sh-empty-icon">📅</div>
            <p className="sh-empty-title">No semesters yet</p>
            <p className="sh-empty-sub">Create your first semester to get started.</p>
            <button className="sh-create-btn" onClick={openModal}>+ Create Semester</button>
          </div>
        ) : (
          <div className="sh-grid">
            {semesters.map(sem => (
              <div
                key={sem.id}
                className="sh-card"
                onClick={() => navigate(`/admin-dashboard/routine-management/${sem.id}`)}
                role="button"
                tabIndex={0}
                onKeyPress={e => e.key === 'Enter' && navigate(`/admin-dashboard/routine-management/${sem.id}`)}
              >
                <div className="sh-card-year">{sem.year}</div>
                <div className="sh-card-name">{sem.name}</div>
                <div className="sh-card-arrow">→</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="sh-overlay" onClick={e => e.target === e.currentTarget && closeModal()}>
          <div className="sh-modal" onKeyDown={handleKeyDown}>
            <h3 className="sh-modal-title">Create New Semester</h3>

            <label className="sh-label">Year</label>
            <input
              className="sh-input"
              type="text"
              placeholder="e.g. 2026"
              value={form.year}
              onChange={e => setForm(f => ({ ...f, year: e.target.value }))}
              autoFocus
            />

            <label className="sh-label">Name</label>
            <input
              className="sh-input"
              type="text"
              placeholder="e.g. Spring, Fall, Summer"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            />

            {formError && <p className="sh-form-error">{formError}</p>}

            <div className="sh-modal-actions">
              <button className="sh-cancel-btn" onClick={closeModal} disabled={creating}>
                Cancel
              </button>
              <button className="sh-confirm-btn" onClick={handleCreate} disabled={creating}>
                {creating ? 'Creating…' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default SemesterHub;
