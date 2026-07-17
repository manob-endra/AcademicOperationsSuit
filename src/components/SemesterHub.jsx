import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { academicSemesterAPI } from '../services/academicSemesterAPI';
import AdminHeader from './shared/layout/AdminHeader';
import AppFooter from './shared/layout/AppFooter';
import BackToDashboard from './shared/layout/BackToDashboard';
import '../styles/ModulePages.css';
import '../styles/SemesterHub.css';

// Season-aware visuals for the semester cards
function getSeasonTheme(name = '') {
  const n = name.toLowerCase();
  if (n.includes('spring')) return { icon: '🌸', cls: 'season-spring' };
  if (n.includes('summer')) return { icon: '☀️', cls: 'season-summer' };
  if (n.includes('fall') || n.includes('autumn')) return { icon: '🍂', cls: 'season-fall' };
  if (n.includes('winter')) return { icon: '❄️', cls: 'season-winter' };
  return { icon: '🎓', cls: 'season-default' };
}

function formatDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt)) return '';
  return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function SemesterHub() {
  const navigate = useNavigate();
  const [semesters, setSemesters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Create modal
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ year: '', name: '' });
  const [rollover, setRollover] = useState(true);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState('');

  // Remove / restore
  const [removeTarget, setRemoveTarget] = useState(null); // semester pending removal
  const [removing, setRemoving] = useState(false);
  const [showRemoved, setShowRemoved] = useState(false);
  const [removedSemesters, setRemovedSemesters] = useState([]);
  const [removedLoading, setRemovedLoading] = useState(false);
  const [removedBusyId, setRemovedBusyId] = useState(null);

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

  useEffect(() => {
    loadSemesters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Create ────────────────────────────────────────────────────────────────
  const openModal = () => {
    setForm({ year: new Date().getFullYear().toString(), name: '' });
    setRollover(true);
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
    const result = await academicSemesterAPI.createSemester(year, name, rollover);
    setCreating(false);
    if (result.success) {
      setSemesters(prev => [result.data, ...prev]);
      closeModal();
      if (result.rollover) {
        const { archivedCourses, hadPrevious } = result.rollover;
        setNotice(
          hadPrevious
            ? `Semester created. ${archivedCourses} course assignment${archivedCourses !== 1 ? 's' : ''} archived to course history, and class time / room / duration settings were copied over as a starting point. The previous semester is untouched.`
            : 'Semester created — first semester, nothing to carry forward.'
        );
      } else {
        setNotice('Semester created with empty routine data (no settings copied).');
      }
    } else {
      setFormError(result.error || 'Failed to create semester.');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleCreate();
    if (e.key === 'Escape') closeModal();
  };

  // ── Remove (soft delete) ──────────────────────────────────────────────────
  const confirmRemove = async () => {
    if (!removeTarget) return;
    setRemoving(true);
    const result = await academicSemesterAPI.removeSemester(removeTarget.id);
    setRemoving(false);
    if (result.success) {
      setSemesters(prev => prev.filter(s => s.id !== removeTarget.id));
      setNotice(`“${removeTarget.name} ${removeTarget.year}” moved to Removed Semesters — you can recover it anytime.`);
      setRemoveTarget(null);
    } else {
      setError(result.error || 'Failed to remove semester.');
      setRemoveTarget(null);
    }
  };

  // ── Removed list / restore ────────────────────────────────────────────────
  const openRemoved = async () => {
    setShowRemoved(true);
    setRemovedLoading(true);
    const result = await academicSemesterAPI.getRemovedSemesters();
    setRemovedSemesters(result.success ? result.data : []);
    setRemovedLoading(false);
  };

  const handleRestore = async (sem) => {
    setRemovedBusyId(sem.id);
    const result = await academicSemesterAPI.restoreSemester(sem.id);
    setRemovedBusyId(null);
    if (result.success) {
      setRemovedSemesters(prev => prev.filter(s => s.id !== sem.id));
      setSemesters(prev => [result.data, ...prev]);
      setNotice(`“${sem.name} ${sem.year}” was recovered.`);
    }
  };

  const handleDeleteForever = async (sem) => {
    setRemovedBusyId(sem.id);
    const result = await academicSemesterAPI.deleteSemester(sem.id);
    setRemovedBusyId(null);
    if (result.success) {
      setRemovedSemesters(prev => prev.filter(s => s.id !== sem.id));
    }
  };

  return (
    <main className="module-page page-shell">
      <BackToDashboard />
      <AdminHeader pageTitle="Routine Management" />

      <div className="module-title-bar">
        <h1>Routine Management</h1>
        <p>Select a semester to manage routines or create a new one</p>
      </div>

      <div className="module-content">
        {error && (
          <div className="sh-error-banner">
            {error}
            <button onClick={loadSemesters} className="sh-retry-btn">Retry</button>
          </div>
        )}

        {notice && (
          <div className="sh-notice-banner">
            <span>✅ {notice}</span>
            <button className="sh-notice-close" onClick={() => setNotice('')}>×</button>
          </div>
        )}

        <div className="sh-toolbar">
          <h2 className="sh-section-title">
            Academic Semesters
            {!loading && <span className="sh-count">{semesters.length}</span>}
          </h2>
          <div className="sh-toolbar-actions">
            <button className="sh-removed-btn" onClick={openRemoved}>
              🗂 Removed Semesters
            </button>
            <button className="sh-create-btn" onClick={openModal}>
              + Create Semester
            </button>
          </div>
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
            {semesters.map(sem => {
              const theme = getSeasonTheme(sem.name);
              return (
                <div
                  key={sem.id}
                  className={`sh-card ${theme.cls}`}
                  onClick={() => navigate(`/admin-dashboard/routine-management/${sem.id}`)}
                  role="button"
                  tabIndex={0}
                  onKeyPress={e => e.key === 'Enter' && navigate(`/admin-dashboard/routine-management/${sem.id}`)}
                >
                  <button
                    className="sh-card-remove"
                    title="Remove semester (recoverable)"
                    onClick={(e) => { e.stopPropagation(); setRemoveTarget(sem); }}
                  >
                    🗑
                  </button>
                  <div className="sh-card-top">
                    <div className="sh-card-icon">{theme.icon}</div>
                    <span className="sh-card-year-chip">{sem.year}</span>
                  </div>
                  <div className="sh-card-name">{sem.name}</div>
                  <div className="sh-card-meta">
                    {sem.created_at ? `Created ${formatDate(sem.created_at)}` : 'Academic semester'}
                  </div>
                  <div className="sh-card-footer">
                    <span>Manage semester</span>
                    <span className="sh-card-arrow">→</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Create modal ── */}
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

            <label className="sh-rollover-box">
              <input
                type="checkbox"
                checked={rollover}
                onChange={e => setRollover(e.target.checked)}
              />
              <div>
                <span className="sh-rollover-title">Carry forward from previous semester</span>
                <span className="sh-rollover-desc">
                  The new semester starts with empty routine data (teacher choices,
                  preferences, assignments, generated routine). Past course–teacher
                  assignments are saved to each course&apos;s history, and class time
                  settings, course durations and room allocation are copied over as a
                  starting point. The previous semester&apos;s data is never changed —
                  its own routine keeps working exactly as it did.
                </span>
              </div>
            </label>

            {formError && <p className="sh-form-error">{formError}</p>}

            <div className="sh-modal-actions">
              <button className="sh-cancel-btn" onClick={closeModal} disabled={creating}>
                Cancel
              </button>
              <button className="sh-confirm-btn" onClick={handleCreate} disabled={creating}>
                {creating ? 'Creating…' : rollover ? 'Create & Roll Over' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Remove confirmation modal ── */}
      {removeTarget && (
        <div className="sh-overlay" onClick={e => e.target === e.currentTarget && setRemoveTarget(null)}>
          <div className="sh-modal">
            <h3 className="sh-modal-title">Remove Semester?</h3>
            <p className="sh-remove-text">
              <strong>{removeTarget.name} {removeTarget.year}</strong> will be moved to
              Removed Semesters. Nothing is deleted permanently — you can recover it
              anytime from the “Removed Semesters” list.
            </p>
            <div className="sh-modal-actions">
              <button className="sh-cancel-btn" onClick={() => setRemoveTarget(null)} disabled={removing}>
                Cancel
              </button>
              <button className="sh-danger-btn" onClick={confirmRemove} disabled={removing}>
                {removing ? 'Removing…' : 'Remove Semester'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Removed semesters modal ── */}
      {showRemoved && (
        <div className="sh-overlay" onClick={e => e.target === e.currentTarget && setShowRemoved(false)}>
          <div className="sh-modal sh-modal-wide">
            <h3 className="sh-modal-title">Removed Semesters</h3>

            {removedLoading ? (
              <div className="sh-loading">Loading…</div>
            ) : removedSemesters.length === 0 ? (
              <p className="sh-removed-empty">No removed semesters. 🎉</p>
            ) : (
              <div className="sh-removed-list">
                {removedSemesters.map(sem => {
                  const theme = getSeasonTheme(sem.name);
                  const busy = removedBusyId === sem.id;
                  return (
                    <div key={sem.id} className="sh-removed-row">
                      <span className="sh-removed-icon">{theme.icon}</span>
                      <div className="sh-removed-info">
                        <span className="sh-removed-name">{sem.name} {sem.year}</span>
                        <span className="sh-removed-date">
                          {sem.removed_at ? `Removed ${formatDate(sem.removed_at)}` : 'Removed'}
                        </span>
                      </div>
                      <button
                        className="sh-restore-btn"
                        onClick={() => handleRestore(sem)}
                        disabled={busy}
                      >
                        {busy ? '…' : '↩ Recover'}
                      </button>
                      <button
                        className="sh-delete-forever-btn"
                        onClick={() => handleDeleteForever(sem)}
                        disabled={busy}
                        title="Delete permanently"
                      >
                        Delete Forever
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="sh-modal-actions">
              <button className="sh-cancel-btn" onClick={() => setShowRemoved(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      <AppFooter />
    </main>
  );
}

export default SemesterHub;
