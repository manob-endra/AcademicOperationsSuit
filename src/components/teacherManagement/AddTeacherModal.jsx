import { useState } from 'react';

const SPECIAL_POSITIONS = [
  'None',
  'Chairman',
  'Dean',
  'Student Advisor',
  'Exam Committee Chair',
  'Exam Committee Member',
];

const DESIGNATIONS = [
  'Professor',
  'Associate Professor',
  'Assistant Professor',
  'Senior Lecturer',
  'Lecturer',
  'Adjunct Professor',
];

const AVAILABILITY_OPTIONS = [
  { value: 'available', label: 'Available' },
  { value: 'unavailable', label: 'Exceptionally Unavailable' },
  { value: 'study_leave', label: 'Study Leave' },
  { value: 'medical_leave', label: 'Medical Leave' },
  { value: 'sabbatical', label: 'Sabbatical' },
];

const EMPTY_FORM = {
  name: '',
  initials: '',
  designation: '',
  email: '',
  joining_date: '',
  special_post: '',
  contact_number: '',
  availability_status: 'available',
  department: '',
};

function AddTeacherModal({ onClose, onAdd }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Name is required.'); return; }
    setSaving(true);
    setError('');
    const result = await onAdd({
      ...form,
      name: form.name.trim(),
      initials: form.initials.trim(),
      joining_date: form.joining_date || null,
    });
    setSaving(false);
    if (!result.success) setError(result.error || 'Failed to add teacher.');
  };

  return (
    <div className="tm-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="tm-modal">
        <div className="tm-modal-header">
          <h2 className="tm-modal-title">Add Teacher</h2>
          <button className="tm-modal-close" onClick={onClose}>×</button>
        </div>
        <form className="tm-modal-body" onSubmit={handleSubmit}>
          <div className="tm-form-grid">
            <div className="tm-form-group tm-span-2">
              <label className="tm-label">Full Name <span className="tm-required">*</span></label>
              <input
                className="tm-input"
                value={form.name}
                onChange={e => set('name', e.target.value)}
                placeholder="e.g. Dr. Mohammad Hossain"
              />
            </div>

            <div className="tm-form-group">
              <label className="tm-label">Initials</label>
              <input
                className="tm-input"
                value={form.initials}
                onChange={e => set('initials', e.target.value.toUpperCase())}
                placeholder="e.g. MH"
                maxLength={10}
              />
            </div>

            <div className="tm-form-group">
              <label className="tm-label">Designation</label>
              <select
                className="tm-input"
                value={form.designation}
                onChange={e => set('designation', e.target.value)}
              >
                <option value="">— Select —</option>
                {DESIGNATIONS.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            <div className="tm-form-group tm-span-2">
              <label className="tm-label">Email</label>
              <input
                className="tm-input"
                type="email"
                value={form.email}
                onChange={e => set('email', e.target.value)}
                placeholder="e.g. mhossain@university.edu"
              />
            </div>

            <div className="tm-form-group">
              <label className="tm-label">Joining Date</label>
              <input
                className="tm-input"
                type="date"
                value={form.joining_date}
                onChange={e => set('joining_date', e.target.value)}
              />
            </div>

            <div className="tm-form-group">
              <label className="tm-label">Contact Number</label>
              <input
                className="tm-input"
                type="tel"
                value={form.contact_number}
                onChange={e => set('contact_number', e.target.value)}
                placeholder="e.g. +8801XXXXXXXXX"
              />
            </div>

            <div className="tm-form-group tm-span-2">
              <label className="tm-label">Department</label>
              <input
                className="tm-input"
                value={form.department}
                onChange={e => set('department', e.target.value)}
                placeholder="e.g. Computer Science & Engineering"
              />
            </div>

            <div className="tm-form-group tm-span-2">
              <label className="tm-label">Special / Departmental Position</label>
              <select
                className="tm-input"
                value={form.special_post}
                onChange={e => set('special_post', e.target.value === 'None' ? '' : e.target.value)}
              >
                {SPECIAL_POSITIONS.map(p => (
                  <option key={p} value={p === 'None' ? '' : p}>{p}</option>
                ))}
              </select>
            </div>

            <div className="tm-form-group tm-span-2">
              <label className="tm-label">Availability Status</label>
              <div className="tm-radio-group">
                {AVAILABILITY_OPTIONS.map(opt => (
                  <label key={opt.value} className="tm-radio-label">
                    <input
                      type="radio"
                      name="availability_status"
                      value={opt.value}
                      checked={form.availability_status === opt.value}
                      onChange={() => set('availability_status', opt.value)}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>
          </div>

          {error && <p className="tm-form-error">{error}</p>}

          <div className="tm-modal-footer">
            <button type="button" className="tm-btn tm-btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="tm-btn tm-btn-primary" disabled={saving}>
              {saving ? 'Adding…' : 'Add Teacher'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddTeacherModal;
