import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { teacherAPI } from '../../../services/teacherAPI';
import { courseAPI } from '../../../services/courseAPI';
import { courseTimeAPI } from '../../../services/courseTimeAPI';
import { courseTeacherAPI } from '../../../services/courseTeacherAPI';
import { classTimeSettingsAPI } from '../../../services/classTimeSettingsAPI';
import { compareTeachersByRank } from '../../../utils/teacherRank';
import { generateSlots, getWorkingDays } from './timeSlotUtils';
import './styles/TeachersTime.css';

/* ─── helpers ───────────────────────────────────────────────────────────── */

const generateInitials = (name) =>
  name.trim().split(/\s+/).map((w) => w[0]?.toUpperCase() ?? '').join('').slice(0, 5);

const parseCSV = (text) => {
  const lines = text.trim().split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const values = line.split(',').map((v) => v.trim());
    const obj = {};
    headers.forEach((h, i) => { obj[h] = values[i] || ''; });
    return obj;
  }).filter((t) => t.name);
};

const parseXML = (text) => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, 'text/xml');
  const nodes = doc.getElementsByTagName('teacher');
  const result = [];
  for (const node of nodes) {
    const get = (tag) => node.getElementsByTagName(tag)[0]?.textContent?.trim() || '';
    const name = get('name');
    if (name) {
      result.push({
        name,
        initials: get('initials'),
        department: get('department'),
        email: get('email'),
        load_limit: get('load_limit') || '20',
      });
    }
  }
  return result;
};

/* ─── AlertModal ─────────────────────────────────────────────────────────── */

function AlertModal({ open, message, onClose }) {
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Enter' || e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="tt-overlay tt-alert-overlay" onClick={onClose}>
      <div className="tt-modal" onClick={(e) => e.stopPropagation()}>
        <p className="tt-modal-message">{message}</p>
        <div className="tt-modal-actions">
          <button type="button" className="tt-btn tt-btn-primary" onClick={onClose}>OK</button>
        </div>
      </div>
    </div>
  );
}

/* ─── ConfirmModal ───────────────────────────────────────────────────────── */

function ConfirmModal({ open, message, confirmLabel = 'Confirm', onConfirm, onCancel }) {
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (e.key === 'Enter') onConfirm();
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onConfirm, onCancel]);

  if (!open) return null;
  return (
    <div className="tt-overlay" onClick={onCancel}>
      <div className="tt-modal" onClick={(e) => e.stopPropagation()}>
        <p className="tt-modal-message">{message}</p>
        <div className="tt-modal-actions">
          <button type="button" className="tt-btn tt-btn-danger" onClick={onConfirm}>
            {confirmLabel}
          </button>
          <button type="button" className="tt-btn tt-btn-secondary" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── AddTeacherModal ────────────────────────────────────────────────────── */

function AddTeacherModal({ open, onClose, onAdd }) {
  const [form, setForm]           = useState({ name: '', initials: '', department: '', email: '', load_limit: '20' });
  const [autoInitials, setAuto]   = useState(true);
  const [saving, setSaving]       = useState(false);

  useEffect(() => {
    if (open) {
      setForm({ name: '', initials: '', department: '', email: '', load_limit: '20' });
      setAuto(true);
      setSaving(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const handleNameChange = (value) => {
    setForm((prev) => ({
      ...prev,
      name: value,
      initials: autoInitials ? generateInitials(value) : prev.initials,
    }));
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!form.name.trim() || saving) return;
    setSaving(true);
    await onAdd(form);
    setSaving(false);
  };

  if (!open) return null;
  return (
    <div className="tt-overlay" onClick={onClose}>
      <div className="tt-modal tt-add-modal" onClick={(e) => e.stopPropagation()}>
        <div className="tt-modal-header">
          <h3>Add Teacher</h3>
          <button type="button" className="tt-modal-close" onClick={onClose}>&times;</button>
        </div>
        <form className="tt-form" onSubmit={handleSubmit}>
          <div className="tt-form-row">
            <div className="tt-form-group tt-form-grow">
              <label>Name <span className="tt-required">*</span></label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Dr. Jane Doe"
                autoFocus
                required
              />
            </div>
            <div className="tt-form-group">
              <label>Initials</label>
              <input
                type="text"
                value={form.initials}
                onChange={(e) => {
                  setAuto(false);
                  setForm((p) => ({ ...p, initials: e.target.value.toUpperCase().slice(0, 5) }));
                }}
                placeholder="Auto"
                maxLength={5}
              />
            </div>
          </div>
          <div className="tt-form-row">
            <div className="tt-form-group tt-form-grow">
              <label>Department</label>
              <input
                type="text"
                value={form.department}
                onChange={(e) => setForm((p) => ({ ...p, department: e.target.value }))}
                placeholder="e.g. CSE"
              />
            </div>
            <div className="tt-form-group tt-form-grow">
              <label>Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                placeholder="jane@university.edu"
              />
            </div>
          </div>
          <div className="tt-form-group" style={{ maxWidth: 180 }}>
            <label>Load Limit (hrs/week)</label>
            <input
              type="number"
              min="1"
              value={form.load_limit}
              onChange={(e) => setForm((p) => ({ ...p, load_limit: e.target.value }))}
              placeholder="20"
            />
          </div>
          <div className="tt-modal-actions">
            <button type="submit" className="tt-btn tt-btn-primary" disabled={!form.name.trim() || saving}>
              {saving ? 'Adding…' : 'Add Teacher'}
            </button>
            <button type="button" className="tt-btn tt-btn-secondary" onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Main component ─────────────────────────────────────────────────────── */

function TeachersTime({ semesterId }) {
  const [teachers, setTeachers]         = useState([]);
  const [availability, setAvailability] = useState({});  // { [teacherId]: string[] }
  const [requiredPeriods, setRequiredPeriods] = useState({}); // { [teacherId]: periods needed/week }
  const [avoidedSet, setAvoidedSet] = useState(new Set()); // "Day-sN" blocked by Class Time Details
  const [settings, setSettings] = useState(null);          // class time settings (drives the grid)
  const [editingTeacherId, setEditing]  = useState(null);
  const [draftSlots, setDraftSlots]     = useState([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState(null);
  const [saving, setSaving]             = useState(false);
  const [searchTerm, setSearchTerm]     = useState('');

  const [alertState, setAlertState]     = useState({ open: false, message: '' });
  const [confirmState, setConfirmState] = useState({ open: false, message: '', confirmLabel: 'Confirm' });
  const confirmResolveRef               = useRef(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const importFileRef                   = useRef(null);

  const feedbackTimerRef = useRef(null);
  const [feedbackMsg, setFeedbackMsg]   = useState({ text: '', type: 'success' });

  /* ── stable handler ref so the Enter-key listener never goes stale ── */
  const handleOKRef = useRef(null);
  handleOKRef.current = async () => {
    if (!editingTeacherId || saving) return;
    setSaving(true);
    const result = await teacherAPI.saveAvailability(semesterId, editingTeacherId, draftSlots);
    setSaving(false);
    if (result.success) {
      setAvailability((prev) => ({ ...prev, [editingTeacherId]: draftSlots }));
      setEditing(null);
      setDraftSlots([]);
    } else {
      setAlertState({ open: true, message: `Failed to save availability: ${result.error}` });
    }
  };

  /* ── Enter key = OK when in edit mode ── */
  useEffect(() => {
    if (!editingTeacherId) return;
    const onKeyDown = (e) => {
      if (e.key === 'Enter' && !e.target.classList.contains('teacher-slot-cell')) {
        handleOKRef.current?.();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [editingTeacherId]);

  /* ── load data ── */
  const loadData = async () => {
    if (!semesterId) return;
    setLoading(true);
    setError(null);

    const [teachersResult, availResult, assignResult, durationsResult, coursesResult, settingsResult] = await Promise.all([
      teacherAPI.getTeachers(semesterId),
      teacherAPI.getAllAvailability(semesterId),
      courseTeacherAPI.getAllAssignments(semesterId),
      courseTimeAPI.getDurations(semesterId),
      courseAPI.getAllCourses(),
      classTimeSettingsAPI.getSettings(semesterId),
    ]);

    // Class time settings drive the grid columns/days and the avoided periods,
    // so the Teacher's Time grid always matches Class Time Details.
    if (settingsResult.success && settingsResult.data) {
      setSettings(settingsResult.data);
      setAvoidedSet(new Set(settingsResult.data.avoidPeriods || []));
    } else {
      setSettings(null);
      setAvoidedSet(new Set());
    }

    if (!teachersResult.success) {
      setError(
        teachersResult.offline
          ? 'Backend server is not running. Please start it with: npm run dev'
          : teachersResult.error
      );
      setLoading(false);
      return;
    }

    setTeachers(teachersResult.data || []);

    if (availResult.success) {
      const map = {};
      (availResult.data || []).forEach(({ teacher_id, day_of_week, slot_id }) => {
        if (!map[teacher_id]) map[teacher_id] = [];
        map[teacher_id].push(`${day_of_week}-${slot_id}`);
      });
      setAvailability(map);
    }

    // ── Required weekly periods per teacher ──
    // For each course a teacher is assigned, count the periods it occupies in a
    // week = periods-per-class × classes-per-week. Lab courses run twice (two
    // sections taught separately), so their periods are doubled.
    if (assignResult.success && durationsResult.success && coursesResult.success) {
      const durMap = {}; // courseId → { periods, weekly }
      (durationsResult.data || []).forEach((d) => {
        durMap[d.course_id] = {
          periods: Number(d.duration_periods) || 1,
          weekly:  Number(d.weekly_classes)   || 1,
        };
      });
      const typeMap = {}; // courseId → course_type
      (coursesResult.courses || []).forEach((c) => { typeMap[c.id] = c.course_type; });

      const req = {};
      (assignResult.data || []).forEach(({ course_id, teacher_assignments }) => {
        const dur = durMap[course_id];
        if (!dur) return; // no Course Time set → contributes nothing yet
        const isLab = typeMap[course_id] === 'lab';
        const perWeek = dur.periods * dur.weekly * (isLab ? 2 : 1);
        (teacher_assignments || []).forEach((tid) => {
          req[tid] = (req[tid] || 0) + perWeek;
        });
      });
      setRequiredPeriods(req);
    }

    setLoading(false);
  };

  useEffect(() => { loadData(); }, [semesterId]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── helpers ── */

  const showAlert = (message) => setAlertState({ open: true, message });

  const showConfirm = (message, confirmLabel = 'Confirm') =>
    new Promise((resolve) => {
      confirmResolveRef.current = resolve;
      setConfirmState({ open: true, message, confirmLabel });
    });

  const handleConfirmYes = () => {
    setConfirmState((s) => ({ ...s, open: false }));
    confirmResolveRef.current?.(true);
    confirmResolveRef.current = null;
  };

  const handleConfirmNo = () => {
    setConfirmState((s) => ({ ...s, open: false }));
    confirmResolveRef.current?.(false);
    confirmResolveRef.current = null;
  };

  const showFeedback = (text, type = 'success') => {
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    setFeedbackMsg({ text, type });
    feedbackTimerRef.current = setTimeout(
      () => setFeedbackMsg({ text: '', type: 'success' }),
      4000
    );
  };

  /* ── teacher actions ── */

  const handleEdit = (teacherId) => {
    setEditing(teacherId);
    setDraftSlots([...(availability[teacherId] || [])]);
  };

  const handleSlotToggle = (day, slot) => {
    if (slot.isBreak) return;
    const key = `${day}-${slot.id}`;
    setDraftSlots((prev) =>
      prev.includes(key) ? prev.filter((s) => s !== key) : [...prev, key]
    );
  };

  // Grid columns + working days come from Class Time Details, so the Teacher's
  // Time grid stays in sync with the configured periods and start times.
  const timeSlots = useMemo(() => generateSlots(settings || undefined), [settings]);
  const workingDays = useMemo(
    () => getWorkingDays(settings?.classDay || 'Sunday-Thursday'),
    [settings]
  );
  const totalSelectableSlots = useMemo(
    () => workingDays.length * timeSlots.filter((s) => !s.isBreak).length,
    [workingDays, timeSlots]
  );

  const handleAddTeacher = async (formData) => {
    const result = await teacherAPI.createTeacher(formData);
    if (result.success) {
      setTeachers((prev) =>
        [...prev, result.data].sort((a, b) => a.name.localeCompare(b.name))
      );
      setShowAddModal(false);
    } else {
      showAlert(`Failed to add teacher: ${result.error}`);
    }
  };

  const handleDeleteTeacher = async (teacher) => {
    const confirmed = await showConfirm(
      `Remove "${teacher.name}" from the teachers list?\n\nThis will hide them from scheduling.`,
      'Remove'
    );
    if (!confirmed) return;
    const result = await teacherAPI.deleteTeacher(teacher.id);
    if (result.success) {
      setTeachers((prev) => prev.filter((t) => t.id !== teacher.id));
      setAvailability((prev) => { const next = { ...prev }; delete next[teacher.id]; return next; });
      if (editingTeacherId === teacher.id) { setEditing(null); setDraftSlots([]); }
    } else {
      showAlert(`Failed to remove teacher: ${result.error}`);
    }
  };

  /* ── file import ── */

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    let parsedTeachers = [];
    const text = await file.text();

    if (file.name.toLowerCase().endsWith('.csv')) {
      parsedTeachers = parseCSV(text);
    } else if (file.name.toLowerCase().endsWith('.xml')) {
      parsedTeachers = parseXML(text);
    } else {
      showAlert('Please select a CSV (.csv) or XML (.xml) file.');
      return;
    }

    if (parsedTeachers.length === 0) {
      showAlert('No valid teacher records were found in the file.\n\nFor CSV: ensure the first row has a "name" column.\nFor XML: use <teacher><name>…</name></teacher> tags.');
      return;
    }

    const result = await teacherAPI.importTeachers(parsedTeachers);
    if (result.success) {
      showFeedback(`Successfully imported ${result.count} teacher(s).`, 'success');
      await loadData();
    } else {
      showAlert(`Import failed: ${result.error}`);
    }
  };

  /* ── derived ── */

  const filteredTeachers = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const list = q ? teachers.filter((t) => t.name.toLowerCase().includes(q)) : teachers;
    // Seniority order: Dean → Chairman → Professor → Assoc. → Asst. → Lecturer
    return [...list].sort(compareTeachersByRank);
  }, [teachers, searchTerm]);

  /* ── loading / error states ── */

  if (loading) {
    return (
      <div className="teachers-time-container">
        <div className="tt-status-box">Loading teachers…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="teachers-time-container">
        <div className="tt-status-box tt-status-error">
          <p>{error}</p>
          <button type="button" className="tt-btn tt-btn-primary" onClick={loadData}>Retry</button>
        </div>
      </div>
    );
  }

  /* ── render ── */

  return (
    <div className="teachers-time-container">
      <AlertModal
        open={alertState.open}
        message={alertState.message}
        onClose={() => setAlertState({ open: false, message: '' })}
      />
      <ConfirmModal
        open={confirmState.open}
        message={confirmState.message}
        confirmLabel={confirmState.confirmLabel}
        onConfirm={handleConfirmYes}
        onCancel={handleConfirmNo}
      />
      <AddTeacherModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={handleAddTeacher}
      />

      {/* hidden file input for import */}
      <input
        ref={importFileRef}
        type="file"
        accept=".csv,.xml"
        style={{ display: 'none' }}
        onChange={handleImportFile}
      />

      {/* ── header ── */}
      <div className="tt-page-header">
        <div className="tt-header-actions">
          <button
            type="button"
            className="tt-btn tt-btn-primary"
            onClick={() => setShowAddModal(true)}
          >
            + Add Teacher
          </button>
          <button
            type="button"
            className="tt-btn tt-btn-import"
            onClick={() => importFileRef.current?.click()}
          >
            Import (CSV / XML)
          </button>
        </div>
      </div>

      {/* ── import feedback ── */}
      {feedbackMsg.text && (
        <p className={`tt-feedback ${feedbackMsg.type === 'error' ? 'error' : 'success'}`}>
          {feedbackMsg.text}
        </p>
      )}

      {/* ── search ── */}
      <div className="teachers-time-search-block">
        <label htmlFor="teacher-search" className="teachers-time-search-label">
          Search Teacher
        </label>
        <input
          id="teacher-search"
          type="text"
          className="teachers-time-search"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by teacher name"
        />
      </div>

      {/* ── teacher cards ── */}
      {teachers.length === 0 ? (
        <div className="tt-status-box">
          <p>No teachers found. Add teachers using the button above.</p>
        </div>
      ) : (
        <div className="teacher-cards-grid">
          {filteredTeachers.map((teacher) => {
            const isEditing      = editingTeacherId === teacher.id;
            const currentSlots   = isEditing ? draftSlots : (availability[teacher.id] || []);
            // Avoided slots never count as usable availability (even if saved
            // before the period was blocked). Capacity excludes them too.
            const usableSlots    = currentSlots.filter((k) => !avoidedSet.has(k));
            const selectedCount  = usableSlots.length;
            const capacity       = Math.max(0, totalSelectableSlots - avoidedSet.size);
            const percentage     = capacity > 0 ? Math.round((selectedCount / capacity) * 100) : 0;

            // Weekly periods this teacher must teach, computed from their
            // assigned courses × Course Time settings (labs counted twice for
            // their two sections). They must mark at least this many slots.
            const needed = requiredPeriods[teacher.id] || 0;
            const shortBy = Math.max(0, needed - selectedCount);

            return (
              <article key={teacher.id} className="teacher-card">
                <div className="teacher-card-header">
                  <div className="teacher-card-title">
                    <h3>{teacher.name}</h3>
                    {teacher.initials && (
                      <span className="teacher-initials">{teacher.initials}</span>
                    )}
                  </div>
                  <div className="teacher-card-meta">
                    <span className="teacher-availability">{percentage}%</span>
                    <button
                      type="button"
                      className="teacher-delete-btn"
                      onClick={() => handleDeleteTeacher(teacher)}
                      title="Remove teacher"
                    >
                      &times;
                    </button>
                  </div>
                </div>

                {/* Required weekly periods (from assigned courses × Course
                    Time; labs doubled) vs the slots marked available. */}
                <div className="teacher-load-row">
                  <span className="teacher-load-chip" title="Weekly periods needed = assigned courses' periods × classes/week (labs counted twice for two sections)">
                    Needs <strong>{needed}</strong> period{needed !== 1 ? 's' : ''}/week
                  </span>
                  <span
                    className={`teacher-need-chip ${shortBy > 0 ? 'short' : 'ok'}`}
                    title="Minimum available slots the teacher must mark to fit the assigned classes"
                  >
                    {needed === 0
                      ? 'No classes assigned'
                      : shortBy > 0
                        ? `Need ${shortBy} more slot${shortBy !== 1 ? 's' : ''}`
                        : 'Enough slots ✓'}
                  </span>
                </div>

                <div className="teacher-grid-scroll">
                  <div
                    className="teacher-time-grid"
                    style={{
                      gridTemplateColumns: `58px repeat(${timeSlots.length}, minmax(52px, 1fr))`,
                      gridTemplateRows: `40px repeat(${workingDays.length}, 30px)`,
                    }}
                  >
                    <div className="teacher-grid-head day-head">Day</div>
                    {timeSlots.map((slot) => (
                      <div
                        key={`head-${teacher.id}-${slot.id}`}
                        className={`teacher-grid-head ${slot.isBreak ? 'break-head' : ''}`}
                      >
                        {slot.isBreak ? (
                          <span className="slot-break-label">Break</span>
                        ) : (
                          <span className="slot-time-range">
                            <span>{slot.startPeriod}</span>
                            <span>{slot.endPeriod}</span>
                          </span>
                        )}
                      </div>
                    ))}

                    {workingDays.map((day) => (
                      <Fragment key={`${teacher.id}-${day}`}>
                        <div className="teacher-day-cell">{day.slice(0, 3)}</div>
                        {timeSlots.map((slot) => {
                          const slotKey    = `${day}-${slot.id}`;
                          const isAvoided  = !slot.isBreak && avoidedSet.has(slotKey);
                          const isSelected = !isAvoided && currentSlots.includes(slotKey);
                          const isClickable = isEditing && !slot.isBreak && !isAvoided;

                          return (
                            <button
                              key={`${teacher.id}-${slotKey}`}
                              type="button"
                              className={`teacher-slot-cell${slot.isBreak ? ' break-cell' : ''}${isAvoided ? ' avoided-cell' : ''}${isSelected ? ' selected' : ''}`}
                              onClick={() => isClickable && handleSlotToggle(day, slot)}
                              disabled={!isClickable}
                              title={isAvoided ? 'Blocked in Class Time Details — not available' : undefined}
                              aria-label={`${teacher.name} ${day} ${slot.label}${isAvoided ? ' (blocked)' : ''}`}
                            />
                          );
                        })}
                      </Fragment>
                    ))}
                  </div>
                </div>

                <div className="teacher-progress-head">
                  <span>Available Slots {needed > 0 && <em className="teacher-min-note">(min {needed})</em>}</span>
                  <span className={shortBy > 0 ? 'teacher-count-short' : ''}>{selectedCount}/{capacity}</span>
                </div>
                <div className="teacher-progress-track">
                  <div
                    className={`teacher-progress-fill${shortBy > 0 ? ' short' : ''}`}
                    style={{ width: `${capacity > 0 ? (selectedCount / capacity) * 100 : 0}%` }}
                  />
                </div>

                <button
                  type="button"
                  className={`teacher-edit-btn${isEditing ? ' teacher-edit-btn--ok' : ''}`}
                  onClick={() => isEditing ? handleOKRef.current?.() : handleEdit(teacher.id)}
                  disabled={saving && isEditing}
                >
                  {isEditing ? (saving ? 'Saving…' : 'OK') : 'Edit'}
                </button>
              </article>
            );
          })}
        </div>
      )}

      {teachers.length > 0 && filteredTeachers.length === 0 && (
        <div className="teacher-no-results">No teacher found with this name.</div>
      )}
    </div>
  );
}

export default TeachersTime;
