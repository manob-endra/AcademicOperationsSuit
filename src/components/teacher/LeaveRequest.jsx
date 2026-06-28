import { useState, useEffect, useCallback } from 'react';
import { teacherLeaveAPI } from '../../services/teacherLeaveAPI';

const LEAVE_TYPES = [
  { value: 'study_leave',  label: 'Study Leave' },
  { value: 'sick_leave',   label: 'Sick Leave' },
  { value: 'conference',   label: 'Conference' },
  { value: 'sabbatical',   label: 'Sabbatical' },
  { value: 'casual',       label: 'Casual Leave' },
];

const LEAVE_LABEL = Object.fromEntries(LEAVE_TYPES.map(l => [l.value, l.label]));

const STATUS_STYLE = {
  approved: { background: '#dcfce7', color: '#166534', label: 'Approved' },
  pending:  { background: '#fef3c7', color: '#92400e', label: 'Pending' },
  rejected: { background: '#fef2f2', color: '#dc2626', label: 'Rejected' },
};

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function duration(s, e) {
  if (!s || !e) return '';
  const days = Math.round((new Date(e) - new Date(s)) / 86400000) + 1;
  return `${days} day${days !== 1 ? 's' : ''}`;
}

const S = {
  page: { padding: 24, maxWidth: 860, margin: '0 auto' },
  card: {
    background: 'white',
    borderRadius: 14,
    boxShadow: '0 2px 10px rgba(0,0,0,.08)',
    padding: '24px 28px',
    marginBottom: 24,
  },
  h2: { margin: '0 0 18px', fontSize: 17, fontWeight: 700, color: '#1a3a52' },
  label: { fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4, display: 'block' },
  input: {
    width: '100%',
    padding: '8px 12px',
    border: '1.5px solid #d1d5db',
    borderRadius: 8,
    fontSize: 13,
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
  },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 16px', marginBottom: 14 },
  span2: { gridColumn: 'span 2' },
  submitBtn: {
    padding: '9px 22px',
    background: 'linear-gradient(135deg,#1a3a52,#2c5f8a)',
    color: 'white',
    border: 'none',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
  },
};

export default function LeaveRequest({ teacherRecord, userEmail }) {
  const [form, setForm] = useState({
    leave_type: 'casual',
    start_date: '',
    end_date:   '',
    reason:     '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg]   = useState(null); // { ok, text }
  const [myLeaves, setMyLeaves]     = useState([]);
  const [loadingLeaves, setLoadingLeaves] = useState(false);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const loadLeaves = useCallback(async () => {
    if (!userEmail) return;
    setLoadingLeaves(true);
    const r = await teacherLeaveAPI.getMyLeaves(userEmail);
    if (r.success) setMyLeaves(r.data || []);
    setLoadingLeaves(false);
  }, [userEmail]);

  useEffect(() => { loadLeaves(); }, [loadLeaves]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!teacherRecord?.id) { setSubmitMsg({ ok: false, text: 'Your teacher profile is not set up yet.' }); return; }
    if (!form.start_date || !form.end_date) { setSubmitMsg({ ok: false, text: 'Please provide start and end dates.' }); return; }
    if (form.end_date < form.start_date) { setSubmitMsg({ ok: false, text: 'End date cannot be before start date.' }); return; }

    setSubmitting(true);
    setSubmitMsg(null);
    const r = await teacherLeaveAPI.submitRequest({
      teacher_id: teacherRecord.id,
      leave_type: form.leave_type,
      start_date: form.start_date,
      end_date:   form.end_date,
      reason:     form.reason,
    });
    setSubmitting(false);
    if (r.success) {
      setSubmitMsg({ ok: true, text: 'Leave request submitted. The admin will review it shortly.' });
      setForm({ leave_type: 'casual', start_date: '', end_date: '', reason: '' });
      loadLeaves();
    } else {
      setSubmitMsg({ ok: false, text: r.error || 'Submission failed.' });
    }
  };

  return (
    <div style={S.page}>

      {/* ── Request Form ── */}
      <div style={S.card}>
        <h2 style={S.h2}>Submit Leave Request</h2>
        <form onSubmit={handleSubmit}>
          <div style={S.grid}>

            <div style={S.span2}>
              <label style={S.label}>Leave Type</label>
              <select
                style={S.input}
                value={form.leave_type}
                onChange={e => set('leave_type', e.target.value)}
              >
                {LEAVE_TYPES.map(lt => (
                  <option key={lt.value} value={lt.value}>{lt.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={S.label}>Start Date *</label>
              <input
                style={S.input}
                type="date"
                value={form.start_date}
                onChange={e => set('start_date', e.target.value)}
                required
              />
            </div>

            <div>
              <label style={S.label}>End Date *</label>
              <input
                style={S.input}
                type="date"
                value={form.end_date}
                min={form.start_date || undefined}
                onChange={e => set('end_date', e.target.value)}
                required
              />
            </div>

            {form.start_date && form.end_date && form.end_date >= form.start_date && (
              <div style={S.span2}>
                <span style={{ fontSize: 12, color: '#6b7280' }}>
                  Duration: <strong>{duration(form.start_date, form.end_date)}</strong>
                </span>
              </div>
            )}

            <div style={S.span2}>
              <label style={S.label}>Reason (optional)</label>
              <textarea
                style={{ ...S.input, resize: 'vertical' }}
                rows={3}
                value={form.reason}
                onChange={e => set('reason', e.target.value)}
                placeholder="Brief reason for the leave…"
              />
            </div>
          </div>

          {submitMsg && (
            <div style={{
              padding: '10px 14px',
              borderRadius: 8,
              marginBottom: 14,
              background: submitMsg.ok ? '#dcfce7' : '#fef2f2',
              color:      submitMsg.ok ? '#166534' : '#dc2626',
              fontSize: 13,
              fontWeight: 600,
            }}>
              {submitMsg.text}
            </div>
          )}

          <button type="submit" style={S.submitBtn} disabled={submitting}>
            {submitting ? 'Submitting…' : 'Submit Request'}
          </button>
        </form>
      </div>

      {/* ── My Leaves History ── */}
      <div style={S.card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ ...S.h2, margin: 0 }}>My Leave History</h2>
          <button
            onClick={loadLeaves}
            style={{ background: '#f3f4f6', border: '1.5px solid #d1d5db', borderRadius: 8, padding: '6px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#374151' }}
          >
            ↻ Refresh
          </button>
        </div>

        {loadingLeaves && <p style={{ color: '#6b7280', fontSize: 13 }}>Loading…</p>}

        {!loadingLeaves && myLeaves.length === 0 && (
          <p style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center', padding: '28px 0' }}>
            No leave records yet.
          </p>
        )}

        {!loadingLeaves && myLeaves.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  {['Leave Type','Start','End','Duration','Status','Source','Admin Note'].map(h => (
                    <th key={h} style={{ background: '#f8fafc', padding: '9px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: '#6b7280', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {myLeaves.map(l => {
                  const st = STATUS_STYLE[l.status] || {};
                  return (
                    <tr key={l.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ background: '#ede9fe', color: '#5b21b6', padding: '3px 8px', borderRadius: 6, fontSize: 11.5, fontWeight: 600 }}>
                          {LEAVE_LABEL[l.leave_type] || l.leave_type}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px' }}>{fmtDate(l.start_date)}</td>
                      <td style={{ padding: '10px 12px' }}>{fmtDate(l.end_date)}</td>
                      <td style={{ padding: '10px 12px', color: '#6b7280', fontSize: 12 }}>{duration(l.start_date, l.end_date)}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ ...st, padding: '3px 9px', borderRadius: 20, fontSize: 11.5, fontWeight: 700, display: 'inline-block' }}>
                          {st.label || l.status}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', color: '#6b7280', fontSize: 12, textTransform: 'capitalize' }}>{l.added_by}</td>
                      <td style={{ padding: '10px 12px', color: '#374151', fontSize: 12 }}>{l.admin_note || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
