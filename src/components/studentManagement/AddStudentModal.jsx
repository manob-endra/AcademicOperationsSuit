import { useState } from 'react';
import { EMPTY_FORM, StudentFormFields } from './StudentFormFields';

function AddStudentModal({ onClose, onAdd }) {
  const [form, setForm] = useState({ ...EMPTY_FORM });
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
      date_of_birth: form.date_of_birth || null,
    });
    setSaving(false);
    if (!result.success) setError(result.error || 'Failed to add student.');
  };

  return (
    <div className="sm-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="sm-modal sm-modal--wide">
        <div className="sm-modal-header">
          <h2 className="sm-modal-title">Add Student</h2>
          <button className="sm-modal-close" onClick={onClose}>×</button>
        </div>
        <form className="sm-modal-body" onSubmit={handleSubmit}>
          <StudentFormFields form={form} set={set} />
          {error && <p className="sm-form-error">{error}</p>}
          <div className="sm-modal-footer">
            <button type="button" className="sm-btn sm-btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="sm-btn sm-btn-primary" disabled={saving}>
              {saving ? 'Adding…' : 'Add Student'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddStudentModal;
