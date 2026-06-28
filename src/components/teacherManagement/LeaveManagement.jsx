import { useState, useEffect, useCallback } from 'react';
import { teacherLeaveAPI } from '../../services/teacherLeaveAPI';
import AddLeaveModal from './AddLeaveModal';

const LEAVE_TYPES = {
  study_leave: 'Study Leave',
  sick_leave:  'Sick Leave',
  conference:  'Conference',
  sabbatical:  'Sabbatical',
  casual:      'Casual Leave',
};

const STATUS_STYLE = {
  approved: { background: '#dcfce7', color: '#166534' },
  pending:  { background: '#fef3c7', color: '#92400e' },
  rejected: { background: '#fef2f2', color: '#dc2626' },
};

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function duration(s, e) {
  if (!s || !e) return '—';
  const days = Math.round((new Date(e) - new Date(s)) / 86400000) + 1;
  return `${days} day${days !== 1 ? 's' : ''}`;
}

// ── All Leaves tab ────────────────────────────────────────────────────────────
function AllLeavesTab({ teachers }) {
  const [leaves,   setLeaves]   = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [addModal, setAddModal] = useState(null); // null | { teacherId }
  const [filterTeacher, setFilterTeacher] = useState('');
  const [filterType, setFilterType]       = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const r = await teacherLeaveAPI.getAllLeaves();
    if (r.success) setLeaves(r.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async (data) => {
    const result = await teacherLeaveAPI.addLeave(data);
    if (result.success) { await load(); setAddModal(null); }
    return result;
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Remove this leave record?')) return;
    await teacherLeaveAPI.deleteLeave(id);
    setLeaves(prev => prev.filter(l => l.id !== id));
  };

  const filtered = leaves.filter(l => {
    if (filterTeacher && l.teacher_id !== filterTeacher) return false;
    if (filterType    && l.leave_type !== filterType) return false;
    return true;
  });

  return (
    <>
      <div className="lm-toolbar">
        <select className="lm-select" value={filterTeacher} onChange={e => setFilterTeacher(e.target.value)}>
          <option value="">All Teachers</option>
          {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <select className="lm-select" value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="">All Types</option>
          {Object.entries(LEAVE_TYPES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <button className="lm-btn-refresh" onClick={load}>↻ Refresh</button>
        <button className="lm-btn-add" onClick={() => setAddModal({})}>+ Add Leave</button>
      </div>

      {loading && <div className="lm-loading">Loading…</div>}
      {!loading && filtered.length === 0 && (
        <div className="lm-empty">No leave records found.</div>
      )}
      {!loading && filtered.length > 0 && (
        <div className="lm-table-wrap">
          <table className="lm-table">
            <thead>
              <tr>
                <th>Teacher</th>
                <th>Leave Type</th>
                <th>Start Date</th>
                <th>End Date</th>
                <th>Duration</th>
                <th>Status</th>
                <th>Added By</th>
                <th>Reason</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(l => {
                const teacher = l.teachers || teachers.find(t => t.id === l.teacher_id);
                return (
                  <tr key={l.id}>
                    <td>
                      <div className="lm-teacher-cell">
                        <span className="lm-init-badge">{teacher?.initials || '?'}</span>
                        <span>{teacher?.name || '—'}</span>
                      </div>
                    </td>
                    <td><span className="lm-type-badge">{LEAVE_TYPES[l.leave_type] || l.leave_type}</span></td>
                    <td>{fmtDate(l.start_date)}</td>
                    <td>{fmtDate(l.end_date)}</td>
                    <td style={{ color: '#6b7280', fontSize: 12 }}>{duration(l.start_date, l.end_date)}</td>
                    <td>
                      <span className="lm-status-badge" style={STATUS_STYLE[l.status] || {}}>
                        {l.status?.charAt(0).toUpperCase() + l.status?.slice(1)}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, color: '#6b7280', textTransform: 'capitalize' }}>{l.added_by}</td>
                    <td style={{ fontSize: 12, color: '#374151', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {l.reason || '—'}
                    </td>
                    <td>
                      <button
                        className="tm-btn-icon tm-btn-icon--remove"
                        title="Delete leave"
                        onClick={() => handleDelete(l.id)}
                      >✕</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {addModal !== null && (
        <AddLeaveModal
          teachers={teachers}
          preselectedTeacherId={addModal.teacherId || ''}
          onClose={() => setAddModal(null)}
          onAdd={handleAdd}
        />
      )}
    </>
  );
}

// ── Leave Requests tab ────────────────────────────────────────────────────────
function RequestsTab({ teachers }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading]   = useState(false);
  const [noteModal, setNoteModal] = useState(null); // { id, action }
  const [note, setNote]           = useState('');
  const [processing, setProcessing] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await teacherLeaveAPI.getRequests();
    if (r.success) setRequests(r.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDecision = async (id, action, adminNote = '') => {
    setProcessing(id);
    if (action === 'approve') await teacherLeaveAPI.approveRequest(id, adminNote);
    else                      await teacherLeaveAPI.rejectRequest(id, adminNote);
    setProcessing(null);
    setNoteModal(null);
    setNote('');
    await load();
  };

  return (
    <>
      <div className="lm-toolbar">
        <button className="lm-btn-refresh" onClick={load}>↻ Refresh</button>
        {requests.length > 0 && (
          <span className="lm-badge-count">{requests.length} pending</span>
        )}
      </div>

      {loading && <div className="lm-loading">Loading…</div>}
      {!loading && requests.length === 0 && (
        <div className="lm-empty">No pending leave requests.</div>
      )}
      {!loading && requests.length > 0 && (
        <div className="lm-table-wrap">
          <table className="lm-table">
            <thead>
              <tr>
                <th>Teacher</th>
                <th>Leave Type</th>
                <th>Start Date</th>
                <th>End Date</th>
                <th>Duration</th>
                <th>Reason</th>
                <th>Submitted</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.map(r => {
                const teacher = r.teachers || teachers.find(t => t.id === r.teacher_id);
                const isProc  = processing === r.id;
                return (
                  <tr key={r.id}>
                    <td>
                      <div className="lm-teacher-cell">
                        <span className="lm-init-badge">{teacher?.initials || '?'}</span>
                        <span>{teacher?.name || '—'}</span>
                      </div>
                    </td>
                    <td><span className="lm-type-badge">{LEAVE_TYPES[r.leave_type] || r.leave_type}</span></td>
                    <td>{fmtDate(r.start_date)}</td>
                    <td>{fmtDate(r.end_date)}</td>
                    <td style={{ fontSize: 12, color: '#6b7280' }}>{duration(r.start_date, r.end_date)}</td>
                    <td style={{ fontSize: 12, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.reason || '—'}
                    </td>
                    <td style={{ fontSize: 12, color: '#6b7280' }}>{fmtDate(r.created_at)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          className="lm-btn-approve"
                          disabled={isProc}
                          onClick={() => setNoteModal({ id: r.id, action: 'approve' })}
                        >
                          {isProc ? '…' : '✓ Approve'}
                        </button>
                        <button
                          className="lm-btn-reject"
                          disabled={isProc}
                          onClick={() => setNoteModal({ id: r.id, action: 'reject' })}
                        >
                          {isProc ? '…' : '✕ Reject'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Note / confirm modal */}
      {noteModal && (
        <div className="tm-overlay" onClick={e => e.target === e.currentTarget && setNoteModal(null)}>
          <div className="tm-modal" style={{ maxWidth: 420 }}>
            <div className="tm-modal-header">
              <h2 className="tm-modal-title">
                {noteModal.action === 'approve' ? '✓ Approve' : '✕ Reject'} Request
              </h2>
              <button className="tm-modal-close" onClick={() => setNoteModal(null)}>×</button>
            </div>
            <div className="tm-modal-body">
              <div className="tm-form-group">
                <label className="tm-label">Admin Note (optional)</label>
                <textarea
                  className="tm-input"
                  rows={3}
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="Leave a note for the teacher…"
                  style={{ resize: 'vertical' }}
                />
              </div>
              <div className="tm-modal-footer">
                <button className="tm-btn tm-btn-ghost" onClick={() => setNoteModal(null)}>Cancel</button>
                <button
                  className={`tm-btn ${noteModal.action === 'approve' ? 'tm-btn-primary' : 'tm-btn-danger'}`}
                  onClick={() => handleDecision(noteModal.id, noteModal.action, note)}
                >
                  {noteModal.action === 'approve' ? 'Approve' : 'Reject'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── By Teacher tab ────────────────────────────────────────────────────────────
function ByTeacherTab({ teachers }) {
  const [selectedId, setSelectedId] = useState('');
  const [leaves,     setLeaves]     = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [addModal,   setAddModal]   = useState(false);

  const load = useCallback(async (id) => {
    if (!id) { setLeaves([]); return; }
    setLoading(true);
    const r = await teacherLeaveAPI.getTeacherLeaves(id);
    if (r.success) setLeaves(r.data || []);
    setLoading(false);
  }, []);

  const handleSelect = (id) => { setSelectedId(id); load(id); };

  const handleAdd = async (data) => {
    const result = await teacherLeaveAPI.addLeave(data);
    if (result.success) { await load(selectedId); setAddModal(false); }
    return result;
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Remove this leave record?')) return;
    await teacherLeaveAPI.deleteLeave(id);
    setLeaves(prev => prev.filter(l => l.id !== id));
  };

  const teacher = teachers.find(t => t.id === selectedId);

  return (
    <>
      <div className="lm-toolbar">
        <select className="lm-select lm-select--wide" value={selectedId} onChange={e => handleSelect(e.target.value)}>
          <option value="">— Select a teacher —</option>
          {teachers.map(t => <option key={t.id} value={t.id}>{t.name}{t.initials ? ` (${t.initials})` : ''}</option>)}
        </select>
        {selectedId && (
          <button className="lm-btn-add" onClick={() => setAddModal(true)}>+ Add Leave</button>
        )}
      </div>

      {!selectedId && <div className="lm-empty">Select a teacher to view their leaves.</div>}

      {selectedId && (
        <>
          {teacher && (
            <div className="lm-teacher-header">
              <span className="lm-init-badge lm-init-badge--lg">{teacher.initials || '?'}</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16, color: '#1a3a52' }}>{teacher.name}</div>
                <div style={{ fontSize: 13, color: '#6b7280' }}>{teacher.designation || teacher.email || ''}</div>
              </div>
              <span className="lm-badge-count" style={{ marginLeft: 'auto' }}>{leaves.length} leave record{leaves.length !== 1 ? 's' : ''}</span>
            </div>
          )}

          {loading && <div className="lm-loading">Loading…</div>}
          {!loading && leaves.length === 0 && (
            <div className="lm-empty">No leaves recorded for this teacher.</div>
          )}
          {!loading && leaves.length > 0 && (
            <div className="lm-table-wrap">
              <table className="lm-table">
                <thead>
                  <tr>
                    <th>Leave Type</th>
                    <th>Start Date</th>
                    <th>End Date</th>
                    <th>Duration</th>
                    <th>Status</th>
                    <th>Source</th>
                    <th>Reason</th>
                    <th>Admin Note</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {leaves.map(l => (
                    <tr key={l.id}>
                      <td><span className="lm-type-badge">{LEAVE_TYPES[l.leave_type] || l.leave_type}</span></td>
                      <td>{fmtDate(l.start_date)}</td>
                      <td>{fmtDate(l.end_date)}</td>
                      <td style={{ fontSize: 12, color: '#6b7280' }}>{duration(l.start_date, l.end_date)}</td>
                      <td>
                        <span className="lm-status-badge" style={STATUS_STYLE[l.status] || {}}>
                          {l.status?.charAt(0).toUpperCase() + l.status?.slice(1)}
                        </span>
                      </td>
                      <td style={{ fontSize: 12, color: '#6b7280', textTransform: 'capitalize' }}>{l.added_by}</td>
                      <td style={{ fontSize: 12, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.reason || '—'}</td>
                      <td style={{ fontSize: 12, color: '#6b7280', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.admin_note || '—'}</td>
                      <td>
                        <button className="tm-btn-icon tm-btn-icon--remove" title="Delete" onClick={() => handleDelete(l.id)}>✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {addModal && (
        <AddLeaveModal
          teachers={teachers}
          preselectedTeacherId={selectedId}
          onClose={() => setAddModal(false)}
          onAdd={handleAdd}
        />
      )}
    </>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────
const TABS = [
  { key: 'all',     label: 'All Leaves' },
  { key: 'by-teacher', label: 'By Teacher' },
  { key: 'requests', label: 'Leave Requests' },
];

function LeaveManagement({ teachers }) {
  const [activeTab, setActiveTab] = useState('all');

  return (
    <div className="lm-page">
      <div className="lm-tabs">
        {TABS.map(t => (
          <button
            key={t.key}
            className={`lm-tab${activeTab === t.key ? ' lm-tab--active' : ''}`}
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="lm-content">
        {activeTab === 'all'        && <AllLeavesTab teachers={teachers} />}
        {activeTab === 'by-teacher' && <ByTeacherTab teachers={teachers} />}
        {activeTab === 'requests'   && <RequestsTab  teachers={teachers} />}
      </div>
    </div>
  );
}

export default LeaveManagement;
