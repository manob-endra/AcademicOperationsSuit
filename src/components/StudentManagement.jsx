import { useState, useEffect, useMemo } from 'react';
import { studentAPI } from '../services/studentAPI';
import AddStudentModal from './studentManagement/AddStudentModal';
import EditStudentModal from './studentManagement/EditStudentModal';
import ImportModal from './studentManagement/ImportModal';
import RemovedModal from './studentManagement/RemovedModal';
import RemoveConfirmModal from './studentManagement/RemoveConfirmModal';
import PromoteBatchModal from './studentManagement/PromoteBatchModal';
import AdminHeader from './shared/layout/AdminHeader';
import AppFooter from './shared/layout/AppFooter';
import BackToDashboard from './shared/layout/BackToDashboard';
import '../styles/StudentManagement.css';

const YEAR_TABS = [
  { value: 'all',  label: 'All' },
  { value: '1st',  label: '1st Year' },
  { value: '2nd',  label: '2nd Year' },
  { value: '3rd',  label: '3rd Year' },
  { value: '4th',  label: '4th Year' },
  { value: 'ms',   label: 'MS' },
];

const YEAR_LABEL = { '1st':'1st Year','2nd':'2nd Year','3rd':'3rd Year','4th':'4th Year','ms':'MS' };

const formatDate = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  return isNaN(dt) ? d : dt.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
};

function StudentManagement() {
  const [students, setStudents]       = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');
  const [search, setSearch]           = useState('');
  const [yearTab, setYearTab]         = useState('all');

  const [showAdd, setShowAdd]           = useState(false);
  const [editStudent, setEditStudent]   = useState(null);
  const [removeStudent, setRemoveStudent] = useState(null);
  const [removing, setRemoving]         = useState(false);
  const [showImport, setShowImport]     = useState(false);
  const [showRemoved, setShowRemoved]   = useState(false);
  const [showPromote, setShowPromote]   = useState(false);

  const load = async () => {
    setLoading(true);
    const result = await studentAPI.getStudents();
    if (result.success) setStudents(result.data);
    else setError(result.error || 'Failed to load students.');
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const yearCounts = useMemo(() => {
    const counts = { '1st':0,'2nd':0,'3rd':0,'4th':0,'ms':0 };
    students.forEach(s => { if (counts[s.academic_year] !== undefined) counts[s.academic_year]++; });
    return counts;
  }, [students]);

  const filtered = useMemo(() => {
    let list = yearTab === 'all' ? students : students.filter(s => s.academic_year === yearTab);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(s =>
        s.name?.toLowerCase().includes(q) ||
        s.registration_no?.toLowerCase().includes(q) ||
        s.roll?.toLowerCase().includes(q) ||
        s.email?.toLowerCase().includes(q) ||
        s.institutional_email?.toLowerCase().includes(q) ||
        s.session?.toLowerCase().includes(q) ||
        s.hall?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [students, yearTab, search]);

  const handleAdd = async (data) => {
    const result = await studentAPI.createStudent(data);
    if (result.success) { await load(); setShowAdd(false); }
    return result;
  };

  const handleEdit = async (id, data) => {
    const result = await studentAPI.updateStudent(id, data);
    if (result.success) {
      setStudents(prev => prev.map(s => s.id === id ? { ...s, ...data } : s));
      setEditStudent(null);
    }
    return result;
  };

  const handleRemove = async () => {
    if (!removeStudent) return;
    setRemoving(true);
    const result = await studentAPI.deleteStudent(removeStudent.id);
    if (result.success) {
      setStudents(prev => prev.filter(s => s.id !== removeStudent.id));
      setRemoveStudent(null);
    }
    setRemoving(false);
  };

  const handleImport = async (rows) => {
    const result = await studentAPI.importStudents(rows);
    if (result.success) { await load(); setShowImport(false); }
    return result;
  };

  const handlePromote = async (fromYear, toYear) => {
    const result = await studentAPI.promoteBatch(fromYear, toYear);
    if (result.success) await load();
    return result;
  };

  return (
    <main className="sm-page page-shell">
      <BackToDashboard />
      <AdminHeader pageTitle="Student Management" />
      <header className="sm-header">
        <div className="sm-header-left">
          <div>
            <h1 className="sm-title">Student Management</h1>
            <p className="sm-subtitle">{students.length} student{students.length !== 1 ? 's' : ''} registered</p>
          </div>
        </div>
        <div className="sm-header-actions">
          <button className="sm-btn sm-btn-ghost" onClick={() => setShowRemoved(true)}>Removed Students</button>
          <button className="sm-btn sm-btn-promote" onClick={() => setShowPromote(true)}>↑ Promote Batch</button>
          <button className="sm-btn sm-btn-secondary" onClick={() => setShowImport(true)}>Import</button>
          <button className="sm-btn sm-btn-primary" onClick={() => setShowAdd(true)}>+ Add Student</button>
        </div>
      </header>

      <div className="sm-content">
        {error && <div className="sm-error-banner">{error}</div>}

        {/* Year tabs */}
        <div className="sm-year-tabs">
          {YEAR_TABS.map(t => (
            <button
              key={t.value}
              className={`sm-year-tab${yearTab === t.value ? ' sm-year-tab--active' : ''}`}
              onClick={() => setYearTab(t.value)}
            >
              {t.label}
              {t.value !== 'all' && (
                <span className="sm-year-tab-count">{yearCounts[t.value] ?? 0}</span>
              )}
              {t.value === 'all' && (
                <span className="sm-year-tab-count">{students.length}</span>
              )}
            </button>
          ))}
        </div>

        {/* Search bar */}
        <div className="sm-toolbar">
          <input
            className="sm-search"
            type="text"
            placeholder="Search by name, reg no, roll, email, session, hall…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <span className="sm-result-count">
            {filtered.length} result{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>

        {loading ? (
          <div className="sm-loading">Loading students…</div>
        ) : filtered.length === 0 ? (
          <div className="sm-empty">
            {search || yearTab !== 'all'
              ? 'No students match your search.'
              : 'No students yet. Click "+ Add Student" to get started.'}
          </div>
        ) : (
          <div className="sm-table-wrap">
            <table className="sm-table">
              <thead>
                <tr>
                  <th>Reg No</th>
                  <th>Name</th>
                  <th>Roll</th>
                  <th>Session</th>
                  <th>Year</th>
                  <th>Hall</th>
                  <th>Date of Birth</th>
                  <th>Email</th>
                  <th>Inst. Email</th>
                  <th>Mobile</th>
                  <th>Parents Contact</th>
                  <th className="sm-th-actions"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => (
                  <tr key={s.id} className="sm-row">
                    <td className="sm-cell-reg">{s.registration_no || <span className="sm-none">—</span>}</td>
                    <td className="sm-cell-name">{s.name}</td>
                    <td>{s.roll || <span className="sm-none">—</span>}</td>
                    <td>{s.session || <span className="sm-none">—</span>}</td>
                    <td>
                      <span className={`sm-year-badge sm-year-${s.academic_year || '1st'}`}>
                        {YEAR_LABEL[s.academic_year] || s.academic_year || '—'}
                      </span>
                    </td>
                    <td>{s.hall || <span className="sm-none">—</span>}</td>
                    <td className="sm-cell-date">{formatDate(s.date_of_birth)}</td>
                    <td>
                      {s.email
                        ? <a href={`mailto:${s.email}`} className="sm-email-link">{s.email}</a>
                        : <span className="sm-none">—</span>}
                    </td>
                    <td>
                      {s.institutional_email
                        ? <a href={`mailto:${s.institutional_email}`} className="sm-email-link">{s.institutional_email}</a>
                        : <span className="sm-none">—</span>}
                    </td>
                    <td>{s.mobile || <span className="sm-none">—</span>}</td>
                    <td>{s.parents_contact || <span className="sm-none">—</span>}</td>
                    <td className="sm-cell-actions">
                      <button className="sm-btn-icon sm-btn-icon--edit" title="Edit" onClick={() => setEditStudent(s)}>✎</button>
                      <button className="sm-btn-icon sm-btn-icon--remove" title="Remove" onClick={() => setRemoveStudent(s)}>✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="sm-footer-stats">
          <span>Total: {students.length}</span>
          {YEAR_TABS.slice(1).map(t => (
            <span key={t.value}> · {t.label}: {yearCounts[t.value] ?? 0}</span>
          ))}
        </div>
      </div>

      {showAdd      && <AddStudentModal onClose={() => setShowAdd(false)} onAdd={handleAdd} />}
      {editStudent  && <EditStudentModal student={editStudent} onClose={() => setEditStudent(null)} onSave={handleEdit} />}
      {removeStudent && <RemoveConfirmModal student={removeStudent} onClose={() => setRemoveStudent(null)} onConfirm={handleRemove} removing={removing} />}
      {showImport   && <ImportModal onClose={() => setShowImport(false)} onImport={handleImport} />}
      {showRemoved  && <RemovedModal onClose={() => setShowRemoved(false)} onRestored={load} />}
      {showPromote  && <PromoteBatchModal students={students} onClose={() => setShowPromote(false)} onPromote={handlePromote} />}

      <AppFooter />
    </main>
  );
}

export default StudentManagement;
