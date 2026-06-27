import { useState } from 'react';
import { StudentFormFields } from './StudentFormFields';

function EditStudentModal({ student, onClose, onSave }) {
  const [form, setForm] = useState({
    registration_no:     student.registration_no || '',
    name:                student.name || '',
    hall:                student.hall || '',
    date_of_birth:       student.date_of_birth ? student.date_of_birth.split('T')[0] : '',
    roll:                student.roll || '',
    email:               student.email || '',
    mobile:              student.mobile || '',
    institutional_email: student.institutional_email || '',
    session:             student.session || '',
    academic_year:       student.academic_year || '1st',
    parents_contact:     student.parents_contact || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Name is required.'); return; }
    setSaving(true);
    setError('');
    const result = await onSave(student.id, {
      ...form,
      date_of_birth: form.date_of_birth || null,
    });
    setSaving(false);
    if (!result.success) setError(result.error || 'Failed to save changes.');
  };

  return (
    <div className="sm-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="sm-modal sm-modal--wide">
        <div className="sm-modal-header">
          <h2 className="sm-modal-title">Edit Student</h2>
          <button className="sm-modal-close" onClick={onClose}>×</button>
        </div>
        <form className="sm-modal-body" onSubmit={handleSubmit}>
          <StudentFormFields form={form} set={set} />
          {error && <p className="sm-form-error">{error}</p>}
          <div className="sm-modal-footer">
            <button type="button" className="sm-btn sm-btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="sm-btn sm-btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EditStudentModal;
