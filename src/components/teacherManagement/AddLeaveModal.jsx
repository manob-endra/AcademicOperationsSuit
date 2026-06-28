import { useState } from 'react';

const LEAVE_TYPES = [
  { value: 'study_leave',  label: 'Study Leave' },
  { value: 'sick_leave',   label: 'Sick Leave' },
  { value: 'conference',   label: 'Conference' },
  { value: 'sabbatical',   label: 'Sabbatical' },
  { value: 'casual',       label: 'Casual Leave' },
];

function AddLeaveModal({ teachers, preselectedTeacherId, onClose, onAdd }) {
  const [form, setForm] = useState({
    teacher_id: preselectedTeacherId || '',
    leave_type: 'casual',
    start_date: '',
    end_date:   '',
    reason:     '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.teacher_id) { setError('Select a teacher.'); return; }
    if (!form.start_date || !form.end_date) { setError('Start and end date are required.'); return; }
    if (form.end_date < form.start_date) { setError('End date cannot be before start date.'); return; }
    setSaving(true);
    setError('');
    const result = await onAdd(form);
    setSaving(false);
    if (!result.success) setError(result.error || 'Failed to add leave.');
  };

  return (
    <div className="tm-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="tm-modal">
        <div className="tm-modal-header">
          <h2 className="tm-modal-title">Add Leave</h2>
          <button className="tm-modal-close" onClick={onClose}>×</button>
        </div>
        <form className="tm-modal-body" onSubmit={handleSubmit}>
          <div className="tm-form-grid">

            <div className="tm-form-group tm-span-2">
              <label className="tm-label">Teacher <span className="tm-required">*</span></label>
              <select
                className="tm-input"
                value={form.teacher_id}
                onChange={e => set('teacher_id', e.target.value)}
                disabled={!!preselectedTeacherId}
              >
                <option value="">— Select teacher —</option>
                {teachers.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name}{t.initials ? ` (${t.initials})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="tm-form-group tm-span-2">
              <label className="tm-label">Leave Type <span className="tm-required">*</span></label>
              <select
                className="tm-input"
                value={form.leave_type}
                onChange={e => set('leave_type', e.target.value)}
              >
                {LEAVE_TYPES.map(lt => (
                  <option key={lt.value} value={lt.value}>{lt.label}</option>
                ))}
              </select>
            </div>

            <div className="tm-form-group">
              <label className="tm-label">Start Date <span className="tm-required">*</span></label>
              <input
                className="tm-input"
                type="date"
                value={form.start_date}
                onChange={e => set('start_date', e.target.value)}
              />
            </div>

            <div className="tm-form-group">
              <label className="tm-label">End Date <span className="tm-required">*</span></label>
              <input
                className="tm-input"
                type="date"
                value={form.end_date}
                min={form.start_date || undefined}
                onChange={e => set('end_date', e.target.value)}
              />
            </div>

            <div className="tm-form-group tm-span-2">
              <label className="tm-label">Reason / Note</label>
              <textarea
                className="tm-input"
                rows={3}
                value={form.reason}
                onChange={e => set('reason', e.target.value)}
                placeholder="Optional note about this leave…"
                style={{ resize: 'vertical' }}
              />
            </div>
          </div>

          {error && <p className="tm-form-error">{error}</p>}

          <div className="tm-modal-footer">
            <button type="button" className="tm-btn tm-btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="tm-btn tm-btn-primary" disabled={saving}>
              {saving ? 'Adding…' : 'Add Leave'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddLeaveModal;
