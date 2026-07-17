import { useState, useEffect, useCallback } from 'react';
import { notificationSystemAPI } from '../services/notificationSystemAPI';
import { academicSemesterAPI } from '../services/academicSemesterAPI';
import AdminHeader from './shared/layout/AdminHeader';
import AppFooter from './shared/layout/AppFooter';
import BackToDashboard from './shared/layout/BackToDashboard';
import '../styles/NotificationCenter.css';

const PAGE_SIZE = 50;

function StatusBadge({ value, prefix = '' }) {
  const cls = `nc-badge nc-badge-${(value || 'unknown').toLowerCase()}`;
  return <span className={cls}>{prefix}{value}</span>;
}

function ProgressBar({ sent, total }) {
  const pct = total > 0 ? Math.round((sent / total) * 100) : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div className="nc-progress-wrap">
        <div className="nc-progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <span style={{ fontSize: 12, color: '#6b7280' }}>{pct}%</span>
    </div>
  );
}

function fmtDate(str) {
  if (!str) return '—';
  return new Date(str).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ── Tab: Jobs ─────────────────────────────────────────────────────────────────
function JobsTab() {
  const [jobs, setJobs]     = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await notificationSystemAPI.getJobs(100);
    if (r.success) setJobs(r.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCancel = async (id) => {
    await notificationSystemAPI.cancelJob(id);
    load();
  };

  return (
    <>
      <div className="nc-filter-row">
        <button className="nc-refresh-btn" onClick={load}>↻ Refresh</button>
      </div>
      <div className="nc-card">
        <div className="nc-table-wrap">
          {loading && <div className="nc-empty">Loading…</div>}
          {!loading && !jobs.length && <div className="nc-empty">No jobs found.</div>}
          {!loading && jobs.length > 0 && (
            <table className="nc-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Label / Trigger</th>
                  <th>Status</th>
                  <th>Progress</th>
                  <th>Sent</th>
                  <th>Failed</th>
                  <th>Created</th>
                  <th>Completed</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {jobs.map(j => (
                  <tr key={j.id}>
                    <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{j.type}</td>
                    <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {j.trigger_ref?.label || j.trigger_id}
                    </td>
                    <td><StatusBadge value={j.status} /></td>
                    <td><ProgressBar sent={j.sent_count} total={j.total_recipients} /></td>
                    <td style={{ color: '#166534', fontWeight: 700 }}>{j.sent_count}</td>
                    <td style={{ color: j.failed_count > 0 ? '#dc2626' : '#6b7280', fontWeight: 700 }}>{j.failed_count}</td>
                    <td style={{ fontSize: 12 }}>{fmtDate(j.created_at)}</td>
                    <td style={{ fontSize: 12 }}>{fmtDate(j.completed_at)}</td>
                    <td>
                      {(j.status === 'pending' || j.status === 'processing') && (
                        <button className="nc-action-btn cancel" onClick={() => handleCancel(j.id)}>
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}

// ── Tab: Delivery Log ─────────────────────────────────────────────────────────
function DeliveryTab() {
  const [rows, setRows]       = useState([]);
  const [total, setTotal]     = useState(0);
  const [loading, setLoading] = useState(false);
  const [status, setStatus]   = useState('');
  const [offset, setOffset]   = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await notificationSystemAPI.getDeliveries({
      status: status || undefined,
      limit:  PAGE_SIZE,
      offset,
    });
    if (r.success) { setRows(r.rows || []); setTotal(r.total || 0); }
    setLoading(false);
  }, [status, offset]);

  useEffect(() => { load(); }, [load]);

  const handleStatusChange = (v) => { setStatus(v); setOffset(0); };

  const handleRetry = async (id) => {
    await notificationSystemAPI.retryDelivery(id);
    load();
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const curPage    = Math.floor(offset / PAGE_SIZE) + 1;

  const statusCounts = rows.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <>
      <div className="nc-stats-row">
        {['sent','failed','pending','skipped'].map(s => (
          <div key={s} className="nc-stat-chip">
            <StatusBadge value={s} />
            <strong>{statusCounts[s] || 0}</strong>
            <span style={{ color: '#9ca3af', fontSize: 12 }}>/ {total} total</span>
          </div>
        ))}
      </div>
      <div className="nc-filter-row">
        <select value={status} onChange={e => handleStatusChange(e.target.value)}>
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="sent">Sent</option>
          <option value="failed">Failed</option>
          <option value="skipped">Skipped</option>
          <option value="bounced">Bounced</option>
        </select>
        <button className="nc-refresh-btn" onClick={load}>↻ Refresh</button>
      </div>
      <div className="nc-card">
        <div className="nc-table-wrap">
          {loading && <div className="nc-empty">Loading…</div>}
          {!loading && !rows.length && <div className="nc-empty">No deliveries found.</div>}
          {!loading && rows.length > 0 && (
            <table className="nc-table">
              <thead>
                <tr>
                  <th>Recipient</th>
                  <th>Type</th>
                  <th>Email</th>
                  <th>Subject</th>
                  <th>Status</th>
                  <th>Attempts</th>
                  <th>Sent At</th>
                  <th>Last Error</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map(d => (
                  <tr key={d.id}>
                    <td style={{ fontWeight: 600 }}>{d.recipient_name || '—'}</td>
                    <td><StatusBadge value={d.recipient_type} /></td>
                    <td style={{ fontSize: 12 }}>{d.recipient_email}</td>
                    <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12 }}>
                      {d.subject || '—'}
                    </td>
                    <td><StatusBadge value={d.status} /></td>
                    <td style={{ textAlign: 'center' }}>{d.attempts}</td>
                    <td style={{ fontSize: 12 }}>{fmtDate(d.sent_at)}</td>
                    <td style={{ fontSize: 11, color: '#dc2626', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {d.last_error || '—'}
                    </td>
                    <td>
                      {d.status === 'failed' && d.attempts < 3 && (
                        <button className="nc-action-btn retry" onClick={() => handleRetry(d.id)}>
                          Retry
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {totalPages > 1 && (
          <div className="nc-pagination">
            <button className="nc-page-btn" disabled={curPage === 1} onClick={() => setOffset(o => o - PAGE_SIZE)}>← Prev</button>
            <span>Page {curPage} of {totalPages} ({total} total)</span>
            <button className="nc-page-btn" disabled={curPage === totalPages} onClick={() => setOffset(o => o + PAGE_SIZE)}>Next →</button>
          </div>
        )}
      </div>
    </>
  );
}

// ── Tab: Unsubscribe List ─────────────────────────────────────────────────────
function UnsubscribeTab() {
  const [list, setList]         = useState([]);
  const [loading, setLoading]   = useState(false);
  const [resending, setResending] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await notificationSystemAPI.getOptedOut();
    if (r.success) setList(r.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleResubscribe = async (email) => {
    setResending(email);
    await notificationSystemAPI.resubscribe(email);
    setResending(null);
    load();
  };

  return (
    <>
      <div className="nc-filter-row">
        <button className="nc-refresh-btn" onClick={load}>↻ Refresh</button>
      </div>
      {!loading && list.length === 0 && (
        <div className="nc-empty" style={{ background: 'white', borderRadius: 14, padding: 48 }}>
          No one has unsubscribed yet.
        </div>
      )}
      {list.length > 0 && (
        <div className="nc-card">
          <div className="nc-table-wrap">
            <table className="nc-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Notification Type</th>
                  <th>Opted Out</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {list.map(r => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 600 }}>{r.email}</td>
                    <td><StatusBadge value={r.notification_type} /></td>
                    <td style={{ fontSize: 12, color: '#6b7280' }}>{fmtDate(r.updated_at)}</td>
                    <td>
                      <button
                        className="nc-action-btn restore"
                        disabled={resending === r.email}
                        onClick={() => handleResubscribe(r.email)}
                      >
                        {resending === r.email ? '…' : 'Re-subscribe'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────
const TABS = [
  { key: 'jobs',       label: 'Notification Jobs' },
  { key: 'deliveries', label: 'Delivery Log' },
  { key: 'unsub',      label: 'Unsubscribe List' },
];

export default function NotificationCenter() {
  const [activeTab, setActiveTab] = useState('jobs');

  // ── Publish bar state ──────────────────────────────────────────────────────
  const SEMESTER_OPTIONS = [
    { id: 'Y1-S1', label: '1st Year – 1st Semester' },
    { id: 'Y1-S2', label: '1st Year – 2nd Semester' },
    { id: 'Y2-S1', label: '2nd Year – 1st Semester' },
    { id: 'Y2-S2', label: '2nd Year – 2nd Semester' },
    { id: 'Y3-S1', label: '3rd Year – 1st Semester' },
    { id: 'Y3-S2', label: '3rd Year – 2nd Semester' },
    { id: 'Y4-S1', label: '4th Year – 1st Semester' },
    { id: 'Y4-S2', label: '4th Year – 2nd Semester' },
    { id: 'MS-S1', label: 'Master – 1st Semester' },
    { id: 'MS-S2', label: 'Master – 2nd Semester' },
  ];
  const [semId,      setSemId]      = useState('Y4-S1'); // batch short code
  const [semLabel,   setSemLabel]   = useState('4th Year – 1st Semester Routine');
  const [publishing, setPublishing] = useState(false);
  const [publishMsg, setPublishMsg] = useState(null);
  // Academic semester UUID (routine data scope) — resolved to the current
  // (newest) semester, since that is the one whose routine gets published.
  const [academicSemesterId, setAcademicSemesterId] = useState(null);

  useEffect(() => {
    academicSemesterAPI.getAllSemesters().then(r => {
      if (r.success) setAcademicSemesterId(r.data?.[0]?.id || null);
    });
  }, []);

  const handleSemChange = (e) => {
    const id  = e.target.value;
    const opt = SEMESTER_OPTIONS.find(o => o.id === id);
    setSemId(id);
    if (opt) setSemLabel(`${opt.label} Routine`);
  };

  const handlePublish = async () => {
    if (!semId || !academicSemesterId) return;
    setPublishing(true);
    setPublishMsg(null);
    const r = await notificationSystemAPI.publishRoutine(academicSemesterId, semId, semLabel.trim() || semId);
    if (r.success) {
      setPublishMsg({ ok: true, text: r.duplicate ? 'Already published recently (no duplicate job created).' : 'Routine published! Notification job queued.' });
    } else {
      setPublishMsg({ ok: false, text: r.error || 'Publish failed.' });
    }
    setPublishing(false);
    if (r.success && !r.duplicate) setActiveTab('jobs');
  };

  return (
    <div className="nc-page page-shell">
      <BackToDashboard />
      <AdminHeader pageTitle="Notification Center" />
      <div className="nc-header">
        <div className="nc-header-titles">
          <h1>Notification Center</h1>
          <p>Publish routines and audit email delivery logs</p>
        </div>
      </div>

      {/* Publish Bar */}
      <div className="nc-publish-bar">
        <label>Publish Routine:</label>
        <select value={semId} onChange={handleSemChange}>
          {SEMESTER_OPTIONS.map(o => (
            <option key={o.id} value={o.id}>{o.label}</option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Email subject label"
          value={semLabel}
          onChange={e => setSemLabel(e.target.value)}
          style={{ minWidth: 200 }}
        />
        <button className="nc-publish-btn" disabled={publishing || !semId || !academicSemesterId} onClick={handlePublish}>
          {publishing ? 'Publishing…' : '📢 Publish & Notify'}
        </button>
        {publishMsg && (
          <span className={`nc-publish-msg ${publishMsg.ok ? 'success' : 'error'}`}>
            {publishMsg.text}
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="nc-tabs">
        {TABS.map(t => (
          <button
            key={t.key}
            className={`nc-tab-btn${activeTab === t.key ? ' active' : ''}`}
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="nc-content">
        {activeTab === 'jobs'       && <JobsTab />}
        {activeTab === 'deliveries' && <DeliveryTab />}
        {activeTab === 'unsub'      && <UnsubscribeTab />}
      </div>

      <AppFooter />
    </div>
  );
}
