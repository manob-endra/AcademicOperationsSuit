import { useState, Fragment } from 'react';
import { syllabusAPI } from '../../../../services/syllabusAPI';
import { courseAPI } from '../../../../services/courseAPI';
import '../styles/Modal.css';
import '../styles/SyllabusManager.css';

const yearOptions = ['1st Year', '2nd Year', '3rd Year', '4th Year', 'Master'];
const semesterOptions = ['1st Semester', '2nd Semester'];

/**
 * Syllabus & option-group manager.
 *
 * A syllabus is a versioned catalog — when the department publishes a new
 * syllabus, ADD it here as a new entry (never edit an old one into it) and
 * import its courses under that version. Older batches keep following the
 * syllabus they were admitted under.
 */
function SyllabusManager({ syllabi, optionGroups, courses, onChanged }) {
  const [showAdd, setShowAdd] = useState(false);
  const [editTarget, setEditTarget] = useState(null); // syllabus being edited
  const [form, setForm] = useState({ title: '', effective_session: '', starting_year: '', notes: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  // Option-group form (inside an expanded syllabus)
  const [groupForm, setGroupForm] = useState({ name: '', year: '', semester: '', choose_count: 1 });
  const [groupBusy, setGroupBusy] = useState(false);

  // Membership editor: which group is open, and the course-picker search text
  const [membersFor, setMembersFor] = useState(null); // group id whose members are being edited
  const [memberSearch, setMemberSearch] = useState('');
  const [memberBusyId, setMemberBusyId] = useState(null);

  const openAdd = () => {
    setForm({ title: '', effective_session: '', starting_year: '', notes: '' });
    setEditTarget(null);
    setError('');
    setShowAdd(true);
  };

  const openEdit = (s) => {
    setForm({
      title: s.title || '',
      effective_session: s.effective_session || '',
      starting_year: s.starting_year || '',
      notes: s.notes || '',
    });
    setEditTarget(s);
    setError('');
    setShowAdd(true);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.effective_session.trim()) {
      setError('Title and effective session are required.');
      return;
    }
    setBusy(true);
    const r = editTarget
      ? await syllabusAPI.updateSyllabus(editTarget.id, form)
      : await syllabusAPI.createSyllabus(form);
    setBusy(false);
    if (r.success) {
      setShowAdd(false);
      onChanged();
    } else {
      setError(r.error || 'Failed to save syllabus.');
    }
  };

  const handleDelete = async (s) => {
    if (!window.confirm(`Delete syllabus "${s.title}"? Its courses stay in the catalog without a syllabus. This cannot be undone.`)) return;
    const r = await syllabusAPI.deleteSyllabus(s.id);
    if (r.success) onChanged();
    else alert(r.error || 'Failed to delete syllabus.');
  };

  const handleAddGroup = async (syllabusId) => {
    if (!groupForm.name.trim() || !groupForm.year || !groupForm.semester) {
      alert('Group name, year and semester are required.');
      return;
    }
    setGroupBusy(true);
    const r = await syllabusAPI.createOptionGroup({ syllabus_id: syllabusId, ...groupForm });
    setGroupBusy(false);
    if (r.success) {
      setGroupForm({ name: '', year: '', semester: '', choose_count: 1 });
      onChanged();
    } else {
      alert(r.error || 'Failed to create option group.');
    }
  };

  const handleDeleteGroup = async (g) => {
    const memberCount = courses.filter(c => c.optionGroupId === g.id).length;
    const msg = memberCount > 0
      ? `Delete option group "${g.name}"? Its ${memberCount} course(s) will become compulsory — reassign them afterwards.`
      : `Delete option group "${g.name}"?`;
    if (!window.confirm(msg)) return;
    const r = await syllabusAPI.deleteOptionGroup(g.id);
    if (r.success) onChanged();
    else alert(r.error || 'Failed to delete option group.');
  };

  const groupsFor = (syllabusId) => optionGroups.filter(g => g.syllabus_id === syllabusId);
  const coursesFor = (syllabusId) => courses.filter(c => c.syllabusId === syllabusId);

  // Add or remove one course from a group (option_group_id set / cleared).
  const setCourseGroup = async (courseId, groupId) => {
    setMemberBusyId(courseId);
    const r = await courseAPI.assignToGroup([courseId], groupId);
    setMemberBusyId(null);
    if (r.success) onChanged();
    else alert(r.error || 'Failed to update course group.');
  };

  // Courses eligible to be added to a group: same syllabus + year + semester,
  // not already in this group.
  const eligibleForGroup = (group) => {
    const q = memberSearch.trim().toLowerCase();
    return courses.filter(c =>
      c.syllabusId === group.syllabus_id &&
      c.year === group.year &&
      c.semester === group.semester &&
      c.optionGroupId !== group.id &&
      (!q || `${c.code} ${c.title}`.toLowerCase().includes(q))
    );
  };

  return (
    <div className="sylm-wrap">
      <div className="sylm-toolbar">
        <p className="sylm-hint">
          Each syllabus is a separate versioned catalog. When a new syllabus is published,
          add it here and import its courses under it — never overwrite an old one, because
          older batches keep following theirs.
        </p>
        <button className="action-btn add-btn" onClick={openAdd}>+ Add Syllabus</button>
      </div>

      {syllabi.length === 0 ? (
        <div className="sylm-empty">
          <p>No syllabi yet. Add your first syllabus (e.g. “BSc Hons Syllabus — 2023-24 and onward”), then import or assign courses to it.</p>
        </div>
      ) : (
        <div className="sylm-list">
          {syllabi.map(s => {
            const groups = groupsFor(s.id);
            const myCourses = coursesFor(s.id);
            const expanded = expandedId === s.id;
            return (
              <div key={s.id} className={`sylm-card${expanded ? ' expanded' : ''}`}>
                <div className="sylm-card-head" onClick={() => setExpandedId(expanded ? null : s.id)}>
                  <div className="sylm-card-info">
                    <span className="sylm-card-title">{s.title}</span>
                    <span className="sylm-card-session">{s.effective_session}{s.starting_year ? ` · from ${s.starting_year}` : ''}</span>
                  </div>
                  <div className="sylm-card-meta">
                    <span className="sylm-chip">{myCourses.length} courses</span>
                    <span className="sylm-chip">{groups.length} option group{groups.length !== 1 ? 's' : ''}</span>
                    <button className="sylm-mini-btn" onClick={(e) => { e.stopPropagation(); openEdit(s); }}>✎ Edit</button>
                    <button className="sylm-mini-btn danger" onClick={(e) => { e.stopPropagation(); handleDelete(s); }}>🗑</button>
                    <span className="sylm-expand-arrow">{expanded ? '▲' : '▼'}</span>
                  </div>
                </div>

                {expanded && (
                  <div className="sylm-card-body">
                    {s.notes && <p className="sylm-notes">{s.notes}</p>}

                    <h4 className="sylm-section-title">Option Groups</h4>
                    <p className="sylm-hint">
                      Optional-course containers (e.g. “Option-A” in 4th Year 1st Semester, choose 1).
                      Use “Manage courses” to add or remove courses from a group. You can also select
                      courses in the Course Catalog and group them there. Which option actually runs
                      each semester is decided in the Semester Syllabus tab.
                    </p>

                    {groups.length > 0 && (
                      <table className="sylm-group-table">
                        <thead>
                          <tr><th>Name</th><th>Year</th><th>Semester</th><th>Choose</th><th>Courses</th><th></th></tr>
                        </thead>
                        <tbody>
                          {groups.map(g => {
                            const members = courses.filter(c => c.optionGroupId === g.id);
                            const editing = membersFor === g.id;
                            return (
                              <Fragment key={g.id}>
                                <tr>
                                  <td>{g.name}</td>
                                  <td>{g.year}</td>
                                  <td>{g.semester}</td>
                                  <td>{g.choose_count}</td>
                                  <td>{members.map(c => c.code).join(', ') || '—'}</td>
                                  <td style={{ whiteSpace: 'nowrap' }}>
                                    <button
                                      className="sylm-mini-btn"
                                      onClick={() => { setMembersFor(editing ? null : g.id); setMemberSearch(''); }}
                                    >
                                      {editing ? 'Close' : 'Manage courses'}
                                    </button>
                                    <button className="sylm-mini-btn danger" onClick={() => handleDeleteGroup(g)}>🗑</button>
                                  </td>
                                </tr>
                                {editing && (
                                  <tr className="sylm-members-row">
                                    <td colSpan={6}>
                                      <div className="sylm-members-editor">
                                        <div className="sylm-members-col">
                                          <h5>In this group ({members.length})</h5>
                                          {members.length === 0 ? (
                                            <p className="sylm-hint">No courses yet.</p>
                                          ) : members.map(c => (
                                            <div key={c.id} className="sylm-member-chip">
                                              <span><strong>{c.code}</strong> {c.title}</span>
                                              <button
                                                className="sylm-mini-btn danger"
                                                disabled={memberBusyId === c.id}
                                                onClick={() => setCourseGroup(c.id, null)}
                                                title="Remove from group"
                                              >
                                                ✕
                                              </button>
                                            </div>
                                          ))}
                                        </div>
                                        <div className="sylm-members-col">
                                          <h5>Add a course</h5>
                                          <input
                                            type="text"
                                            className="sylm-member-search"
                                            placeholder="Search this syllabus/year/semester…"
                                            value={memberSearch}
                                            onChange={e => setMemberSearch(e.target.value)}
                                          />
                                          <div className="sylm-member-pick-list">
                                            {eligibleForGroup(g).length === 0 ? (
                                              <p className="sylm-hint">No eligible courses. They must be in the same syllabus, year and semester as the group.</p>
                                            ) : eligibleForGroup(g).slice(0, 40).map(c => (
                                              <button
                                                key={c.id}
                                                className="sylm-member-add-btn"
                                                disabled={memberBusyId === c.id}
                                                onClick={() => setCourseGroup(c.id, g.id)}
                                              >
                                                + <strong>{c.code}</strong> {c.title}
                                                {c.optionGroupId && <span className="sylm-hint"> (moves from another group)</span>}
                                              </button>
                                            ))}
                                          </div>
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    )}

                    <div className="sylm-group-form">
                      <input
                        type="text"
                        placeholder="Group name (e.g. Option-A)"
                        value={groupForm.name}
                        onChange={e => setGroupForm(f => ({ ...f, name: e.target.value }))}
                      />
                      <select value={groupForm.year} onChange={e => setGroupForm(f => ({ ...f, year: e.target.value }))}>
                        <option value="">Year</option>
                        {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                      </select>
                      <select value={groupForm.semester} onChange={e => setGroupForm(f => ({ ...f, semester: e.target.value }))}>
                        <option value="">Semester</option>
                        {semesterOptions.map(x => <option key={x} value={x}>{x}</option>)}
                      </select>
                      <input
                        type="number"
                        min="1"
                        title="How many courses a student takes from this group"
                        value={groupForm.choose_count}
                        onChange={e => setGroupForm(f => ({ ...f, choose_count: Number(e.target.value) || 1 }))}
                        style={{ width: 70 }}
                      />
                      <button className="action-btn add-btn" disabled={groupBusy} onClick={() => handleAddGroup(s.id)}>
                        {groupBusy ? 'Adding…' : '+ Add Group'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add / edit syllabus modal */}
      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editTarget ? 'Edit Syllabus' : 'Add Syllabus'}</h2>
              <button className="modal-close-btn" onClick={() => setShowAdd(false)}>×</button>
            </div>
            <div className="modal-body">
              {error && <div className="error-message">{error}</div>}
              <div className="form-group">
                <label>Title *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="e.g., BSc Hons Syllabus 2023"
                />
              </div>
              <div className="form-group">
                <label>Effective Session *</label>
                <input
                  type="text"
                  value={form.effective_session}
                  onChange={e => setForm(f => ({ ...f, effective_session: e.target.value }))}
                  placeholder="e.g., 2023-24 and onward"
                />
              </div>
              <div className="form-group">
                <label>Starting Year</label>
                <input
                  type="text"
                  value={form.starting_year}
                  onChange={e => setForm(f => ({ ...f, starting_year: e.target.value }))}
                  placeholder="e.g., 2023"
                />
              </div>
              <div className="form-group">
                <label>Notes</label>
                <textarea
                  rows={3}
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Optional notes about this syllabus version"
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-cancel" onClick={() => setShowAdd(false)} disabled={busy}>Cancel</button>
              <button className="btn btn-confirm" onClick={handleSave} disabled={busy}>
                {busy ? 'Saving…' : editTarget ? 'Save Changes' : 'Add Syllabus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SyllabusManager;
