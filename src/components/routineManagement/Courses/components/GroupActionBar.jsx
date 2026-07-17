import { useState } from 'react';

const yearOptions = ['1st Year', '2nd Year', '3rd Year', '4th Year', 'Master'];
const semesterOptions = ['1st Semester', '2nd Semester'];

/**
 * Action bar shown when one or more courses are selected in the Course
 * Catalog. Lets the admin group the selection: create a new option group
 * from them, add them to an existing group, or clear their group.
 *
 * Groups here ARE the syllabus option-groups (elective baskets), so creating
 * one needs a syllabus + year + semester + choose-count.
 */
function GroupActionBar({
  count, optionGroups, syllabi, saving, actionOpen, setActionOpen,
  onAddToGroup, onCreateGroup, onRemoveFromGroup, onClear,
}) {
  const [existingGroupId, setExistingGroupId] = useState('');
  const [form, setForm] = useState({
    syllabus_id: '', name: '', year: '', semester: '', choose_count: 1,
  });

  const submitCreate = () => {
    if (!form.syllabus_id || !form.name.trim() || !form.year || !form.semester) {
      alert('Syllabus, group name, year and semester are all required.');
      return;
    }
    onCreateGroup({ ...form, name: form.name.trim() });
  };

  return (
    <div className="group-action-bar">
      <div className="group-action-head">
        <span className="group-action-count">{count} course{count !== 1 ? 's' : ''} selected</span>
        <div className="group-action-btns">
          <button
            className="action-btn add-btn"
            onClick={() => setActionOpen(actionOpen === 'existing' ? null : 'existing')}
          >
            Add to Existing Group
          </button>
          <button
            className="action-btn add-btn"
            onClick={() => setActionOpen(actionOpen === 'create' ? null : 'create')}
          >
            Create New Group
          </button>
          <button
            className="action-btn"
            disabled={saving}
            onClick={onRemoveFromGroup}
            title="Remove the selected courses from any option group"
          >
            Remove from Group
          </button>
          <button className="action-btn" onClick={onClear}>Clear selection</button>
        </div>
      </div>

      {actionOpen === 'existing' && (
        <div className="group-action-form">
          <select value={existingGroupId} onChange={e => setExistingGroupId(e.target.value)}>
            <option value="">— Select a group —</option>
            {optionGroups.map(g => {
              const syl = syllabi.find(s => s.id === g.syllabus_id);
              return (
                <option key={g.id} value={g.id}>
                  {g.name} · {g.year} {g.semester}{syl ? ` · ${syl.title}` : ''} (choose {g.choose_count})
                </option>
              );
            })}
          </select>
          <button
            className="action-btn add-btn"
            disabled={saving || !existingGroupId}
            onClick={() => onAddToGroup(existingGroupId)}
          >
            {saving ? 'Adding…' : 'Add to Group'}
          </button>
          {optionGroups.length === 0 && (
            <span className="group-action-hint">No groups yet — create one instead.</span>
          )}
        </div>
      )}

      {actionOpen === 'create' && (
        <div className="group-action-form group-action-form--create">
          <select
            value={form.syllabus_id}
            onChange={e => setForm(f => ({ ...f, syllabus_id: e.target.value }))}
          >
            <option value="">— Syllabus —</option>
            {syllabi.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
          </select>
          <input
            type="text"
            placeholder="Group name (e.g. Option-A)"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          />
          <select value={form.year} onChange={e => setForm(f => ({ ...f, year: e.target.value }))}>
            <option value="">Year</option>
            {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <select value={form.semester} onChange={e => setForm(f => ({ ...f, semester: e.target.value }))}>
            <option value="">Semester</option>
            {semesterOptions.map(x => <option key={x} value={x}>{x}</option>)}
          </select>
          <input
            type="number"
            min="1"
            title="How many courses a student takes from this group"
            value={form.choose_count}
            onChange={e => setForm(f => ({ ...f, choose_count: Number(e.target.value) || 1 }))}
            style={{ width: 66 }}
          />
          <button className="action-btn add-btn" disabled={saving} onClick={submitCreate}>
            {saving ? 'Creating…' : 'Create & Add'}
          </button>
          {syllabi.length === 0 && (
            <span className="group-action-hint">Add a syllabus first (Syllabi &amp; Options tab).</span>
          )}
        </div>
      )}
    </div>
  );
}

export default GroupActionBar;
