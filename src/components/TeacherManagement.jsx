import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { teacherAPI } from '../services/teacherAPI';
import AddTeacherModal from './teacherManagement/AddTeacherModal';
import EditTeacherModal from './teacherManagement/EditTeacherModal';
import ImportModal from './teacherManagement/ImportModal';
import RemovedModal from './teacherManagement/RemovedModal';
import RemoveConfirmModal from './teacherManagement/RemoveConfirmModal';
import LeaveManagement from './teacherManagement/LeaveManagement';
import '../styles/TeacherManagement.css';

const AVAIL_LABEL = {
  available: 'Available',
  unavailable: 'Unavailable',
  study_leave: 'Study Leave',
  medical_leave: 'Medical Leave',
  sabbatical: 'Sabbatical',
};

const FILTER_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'available', label: 'Available' },
  { value: 'unavailable', label: 'Unavailable' },
  { value: 'study_leave', label: 'Study Leave' },
  { value: 'medical_leave', label: 'Medical Leave' },
  { value: 'sabbatical', label: 'Sabbatical' },
];

function TeacherManagement() {
  const navigate = useNavigate();
  const [activePage, setActivePage] = useState('details'); // 'details' | 'leave'
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  const [showAdd, setShowAdd] = useState(false);
  const [editTeacher, setEditTeacher] = useState(null);
  const [removeTeacher, setRemoveTeacher] = useState(null);
  const [removing, setRemoving] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showRemoved, setShowRemoved] = useState(false);

  const load = async () => {
    setLoading(true);
    const result = await teacherAPI.getTeachers();
    if (result.success) setTeachers(result.data);
    else setError(result.error || 'Failed to load teachers.');
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    let list = teachers;
    if (filterStatus !== 'all') {
      list = list.filter(t => (t.availability_status || 'available') === filterStatus);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(t =>
        t.name?.toLowerCase().includes(q) ||
        t.initials?.toLowerCase().includes(q) ||
        t.designation?.toLowerCase().includes(q) ||
        t.email?.toLowerCase().includes(q) ||
        t.special_post?.toLowerCase().includes(q) ||
        t.contact_number?.includes(q)
      );
    }
    return list;
  }, [teachers, search, filterStatus]);

  const handleAdd = async (data) => {
    const result = await teacherAPI.createTeacher(data);
    if (result.success) { await load(); setShowAdd(false); }
    return result;
  };

  const handleEdit = async (id, data) => {
    const result = await teacherAPI.updateTeacher(id, data);
    if (result.success) {
      setTeachers(prev => prev.map(t => t.id === id ? { ...t, ...data } : t));
      setEditTeacher(null);
    }
    return result;
  };

  const handleRemove = async () => {
    if (!removeTeacher) return;
    setRemoving(true);
    const result = await teacherAPI.deleteTeacher(removeTeacher.id);
    if (result.success) {
      setTeachers(prev => prev.filter(t => t.id !== removeTeacher.id));
      setRemoveTeacher(null);
    }
    setRemoving(false);
  };

  const handleImport = async (rows) => {
    const result = await teacherAPI.importTeachers(rows);
    if (result.success) { await load(); setShowImport(false); }
    return result;
  };

  const formatDate = (d) => {
    if (!d) return '—';
    const dt = new Date(d);
    if (isNaN(dt)) return d;
    return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <main className="tm-page">
      <header className="tm-header">
        <div className="tm-header-left">
          <button className="tm-back-btn" onClick={() => navigate('/admin-dashboard')}>
            ← Dashboard
          </button>
          <div>
            <h1 className="tm-title">Teacher Management</h1>
            <p className="tm-subtitle">{teachers.length} teacher{teachers.length !== 1 ? 's' : ''} registered</p>
          </div>
        </div>
        {activePage === 'details' && (
          <div className="tm-header-actions">
            <button className="tm-btn tm-btn-ghost" onClick={() => setShowRemoved(true)}>
              Removed Teachers
            </button>
            <button className="tm-btn tm-btn-secondary" onClick={() => setShowImport(true)}>
              Import
            </button>
            <button className="tm-btn tm-btn-primary" onClick={() => setShowAdd(true)}>
              + Add Teacher
            </button>
          </div>
        )}
      </header>

      {/* Page-level tabs */}
      <div className="tm-page-tabs">
        <button
          className={`tm-page-tab${activePage === 'details' ? ' active' : ''}`}
          onClick={() => setActivePage('details')}
        >
          Details
        </button>
        <button
          className={`tm-page-tab${activePage === 'leave' ? ' active' : ''}`}
          onClick={() => setActivePage('leave')}
        >
          Leave Management
        </button>
      </div>

      {/* Leave Management page */}
      {activePage === 'leave' && !loading && (
        <LeaveManagement teachers={teachers} />
      )}

      {/* Details page */}
      {activePage === 'details' && (
      <div className="tm-content">
        {error && <div className="tm-error-banner">{error}</div>}

        <div className="tm-toolbar">
          <input
            className="tm-search"
            type="text"
            placeholder="Search by name, initials, email, post…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <div className="tm-filter-tabs">
            {FILTER_OPTIONS.map(f => (
              <button
                key={f.value}
                className={`tm-filter-tab${filterStatus === f.value ? ' tm-filter-tab--active' : ''}`}
                onClick={() => setFilterStatus(f.value)}
              >
                {f.label}
                {f.value !== 'all' && (
                  <span className="tm-filter-count">
                    {teachers.filter(t => (t.availability_status || 'available') === f.value).length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="tm-loading">Loading teachers…</div>
        ) : filtered.length === 0 ? (
          <div className="tm-empty">
            {search || filterStatus !== 'all'
              ? 'No teachers match your search.'
              : 'No teachers yet. Click "Add Teacher" to get started.'}
          </div>
        ) : (
          <div className="tm-table-wrap">
            <table className="tm-table">
              <thead>
                <tr>
                  <th className="tm-th-init">Initials</th>
                  <th>Name</th>
                  <th>Designation</th>
                  <th>Email</th>
                  <th>Joining Date</th>
                  <th>Special / Dept. Position</th>
                  <th>Contact</th>
                  <th>Availability</th>
                  <th className="tm-th-actions"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(t => (
                  <tr key={t.id} className="tm-row">
                    <td>
                      <span className="tm-initials-badge">{t.initials || '?'}</span>
                    </td>
                    <td className="tm-cell-name">{t.name}</td>
                    <td className="tm-cell-desg">{t.designation || <span className="tm-none">—</span>}</td>
                    <td className="tm-cell-email">
                      {t.email ? (
                        <a href={`mailto:${t.email}`} className="tm-email-link">{t.email}</a>
                      ) : (
                        <span className="tm-none">—</span>
                      )}
                    </td>
                    <td className="tm-cell-date">{formatDate(t.joining_date)}</td>
                    <td className="tm-cell-post">{t.special_post || <span className="tm-none">—</span>}</td>
                    <td className="tm-cell-contact">{t.contact_number || <span className="tm-none">—</span>}</td>
                    <td>
                      <span className={`tm-status-badge tm-status-${t.availability_status || 'available'}`}>
                        {AVAIL_LABEL[t.availability_status] || 'Available'}
                      </span>
                    </td>
                    <td className="tm-cell-actions">
                      <button
                        className="tm-btn-icon tm-btn-icon--edit"
                        title="Edit teacher"
                        onClick={() => setEditTeacher(t)}
                      >
                        ✎
                      </button>
                      <button
                        className="tm-btn-icon tm-btn-icon--remove"
                        title="Remove teacher"
                        onClick={() => setRemoveTeacher(t)}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="tm-footer-stats">
          <span>Total: {teachers.length}</span>
          {filterStatus !== 'all' && <span> · Showing: {filtered.length}</span>}
          <span> · Available: {teachers.filter(t => !t.availability_status || t.availability_status === 'available').length}</span>
          <span> · On Leave: {teachers.filter(t => ['study_leave', 'medical_leave', 'sabbatical'].includes(t.availability_status)).length}</span>
          <span> · Unavailable: {teachers.filter(t => t.availability_status === 'unavailable').length}</span>
        </div>
      </div>
      )} {/* end activePage === 'details' */}

      {showAdd && (
        <AddTeacherModal onClose={() => setShowAdd(false)} onAdd={handleAdd} />
      )}
      {editTeacher && (
        <EditTeacherModal
          teacher={editTeacher}
          onClose={() => setEditTeacher(null)}
          onSave={handleEdit}
        />
      )}
      {removeTeacher && (
        <RemoveConfirmModal
          teacher={removeTeacher}
          onClose={() => setRemoveTeacher(null)}
          onConfirm={handleRemove}
          removing={removing}
        />
      )}
      {showImport && (
        <ImportModal onClose={() => setShowImport(false)} onImport={handleImport} />
      )}
      {showRemoved && (
        <RemovedModal onClose={() => setShowRemoved(false)} onRestored={load} />
      )}
    </main>
  );
}

export default TeacherManagement;
