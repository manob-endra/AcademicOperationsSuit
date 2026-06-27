// Shared form fields used by both Add and Edit modals

export const YEAR_OPTIONS = [
  { value: '1st', label: '1st Year' },
  { value: '2nd', label: '2nd Year' },
  { value: '3rd', label: '3rd Year' },
  { value: '4th', label: '4th Year' },
  { value: 'ms',  label: 'MS' },
];

export const EMPTY_FORM = {
  registration_no: '',
  name: '',
  hall: '',
  date_of_birth: '',
  roll: '',
  email: '',
  mobile: '',
  institutional_email: '',
  session: '',
  academic_year: '1st',
  parents_contact: '',
};

export function StudentFormFields({ form, set }) {
  return (
    <div className="sm-form-grid">
      <div className="sm-form-group sm-span-2">
        <label className="sm-label">Full Name <span className="sm-required">*</span></label>
        <input className="sm-input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Mohammad Hasan" />
      </div>

      <div className="sm-form-group">
        <label className="sm-label">Registration No</label>
        <input className="sm-input" value={form.registration_no} onChange={e => set('registration_no', e.target.value)} placeholder="e.g. 2019331001" />
      </div>

      <div className="sm-form-group">
        <label className="sm-label">Roll</label>
        <input className="sm-input" value={form.roll} onChange={e => set('roll', e.target.value)} placeholder="e.g. 001" />
      </div>

      <div className="sm-form-group">
        <label className="sm-label">Session</label>
        <input className="sm-input" value={form.session} onChange={e => set('session', e.target.value)} placeholder="e.g. 2019-20" />
      </div>

      <div className="sm-form-group">
        <label className="sm-label">Current Year</label>
        <select className="sm-input" value={form.academic_year} onChange={e => set('academic_year', e.target.value)}>
          {YEAR_OPTIONS.map(y => <option key={y.value} value={y.value}>{y.label}</option>)}
        </select>
      </div>

      <div className="sm-form-group sm-span-2">
        <label className="sm-label">Hall</label>
        <input className="sm-input" value={form.hall} onChange={e => set('hall', e.target.value)} placeholder="e.g. Fazlul Huq Muslim Hall" />
      </div>

      <div className="sm-form-group">
        <label className="sm-label">Date of Birth</label>
        <input className="sm-input" type="date" value={form.date_of_birth} onChange={e => set('date_of_birth', e.target.value)} />
      </div>

      <div className="sm-form-group">
        <label className="sm-label">Mobile</label>
        <input className="sm-input" type="tel" value={form.mobile} onChange={e => set('mobile', e.target.value)} placeholder="+8801XXXXXXXXX" />
      </div>

      <div className="sm-form-group sm-span-2">
        <label className="sm-label">Personal Email</label>
        <input className="sm-input" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="personal@gmail.com" />
      </div>

      <div className="sm-form-group sm-span-2">
        <label className="sm-label">Institutional Email</label>
        <input
          className="sm-input"
          type="email"
          value={form.institutional_email}
          onChange={e => set('institutional_email', e.target.value)}
          placeholder="username@cs.du.ac.bd"
        />
      </div>

      <div className="sm-form-group sm-span-2">
        <label className="sm-label">Parents Contact</label>
        <input className="sm-input" type="tel" value={form.parents_contact} onChange={e => set('parents_contact', e.target.value)} placeholder="+8801XXXXXXXXX" />
      </div>
    </div>
  );
}
