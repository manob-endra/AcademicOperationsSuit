import { useState, useEffect, useMemo, useRef } from 'react';
import { routineAPI } from '../../services/routineAPI';
import { classTimeSettingsAPI } from '../../services/classTimeSettingsAPI';
import { courseAPI } from '../../services/courseAPI';
import { teacherAPI } from '../../services/teacherAPI';
import RoutineDocument from './RoutineDocument';
import { printCalendarNode } from '../academicCalendar/printCalendar';
import { buildBlocks, blocksToEntries, checkMove } from './routineEdit';
import { academicSemesterAPI } from '../../services/academicSemesterAPI';
import { batchFingerprint } from '../../utils/routineFingerprint';
import './Routine.css';

// ── Publish Confirmation Modal ─────────────────────────────────────────────────
// semesterId = academic semester UUID (routine scope); batchId = student batch
// short code (e.g. 'Y4-S1') identifying which entries within it to publish.
function PublishModal({ semesterId, batchId, semLabel, state = 'unpublished', onPublished, onCancel }) {
  const [publishing, setPublishing] = useState(false);
  const [done, setDone]             = useState(null); // null | { ok, msg }

  const COPY = {
    unpublished: {
      icon: '📢', title: 'Publish Routine',
      body: 'This will send the routine to all students of this batch (to their institutional email) and to all teachers assigned to courses in this semester.',
      cta: 'Confirm & Send Emails', busy: 'Sending…',
    },
    published: {
      icon: '🔁', title: 'Republish Routine?',
      body: 'This routine is already published. Republishing sends it again to all students of this batch and the teachers taking its classes.',
      cta: 'Confirm & Republish', busy: 'Republishing…',
    },
    edited: {
      icon: '📤', title: 'Publish Edited Routine?',
      body: 'This routine has changed since it was last published. Publishing sends the updated version to all students of this batch and the teachers taking its classes.',
      cta: 'Confirm & Send Update', busy: 'Publishing…',
    },
  };
  const copy = COPY[state] || COPY.unpublished;

  const handleConfirm = async () => {
    setPublishing(true);
    const r = await routineAPI.publishRoutine(semesterId, batchId, semLabel);
    setPublishing(false);
    if (r.success) {
      if (r.publishedBatches) onPublished?.(r.publishedBatches);
      setDone({
        ok: true,
        msg: r.duplicate
          ? 'Already published in the last minute (no duplicate email job created).'
          : state === 'unpublished'
            ? 'Routine published! Emails are being sent.'
            : 'Routine republished! Updated emails are being sent.',
      });
    } else {
      setDone({ ok: false, msg: r.error || 'Publish failed.' });
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
    }}>
      <div style={{
        background: 'white', borderRadius: 14, padding: '32px 36px',
        maxWidth: 460, width: '94%', boxShadow: '0 16px 48px rgba(0,0,0,.22)',
        fontFamily: "'Segoe UI', Arial, sans-serif",
      }}>
        {!done ? (
          <>
            <div style={{ fontSize: 36, textAlign: 'center', marginBottom: 10 }}>{copy.icon}</div>
            <h2 style={{ margin: '0 0 8px', fontSize: 18, color: '#1a3a52', textAlign: 'center' }}>
              {copy.title}
            </h2>
            <p style={{ margin: '0 0 6px', fontSize: 14, color: '#374151', textAlign: 'center' }}>
              Semester: <strong>{semLabel}</strong>
            </p>
            <p style={{ margin: '0 0 24px', fontSize: 13, color: '#6b7280', textAlign: 'center', lineHeight: 1.6 }}>
              {copy.body}
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button
                onClick={onCancel}
                style={{ padding: '9px 24px', border: '1.5px solid #d1d5db', borderRadius: 8, background: 'white', fontSize: 14, cursor: 'pointer', fontWeight: 600, color: '#374151' }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={publishing}
                style={{ padding: '9px 24px', border: 'none', borderRadius: 8, background: 'linear-gradient(135deg,#1a3a52,#2c5f8a)', color: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer', opacity: publishing ? .6 : 1 }}
              >
                {publishing ? copy.busy : copy.cta}
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 40, textAlign: 'center', marginBottom: 10 }}>
              {done.ok ? '✅' : '❌'}
            </div>
            <p style={{ margin: '0 0 20px', fontSize: 14, color: done.ok ? '#166534' : '#dc2626', textAlign: 'center', fontWeight: 600 }}>
              {done.msg}
            </p>
            {done.ok && (
              <p style={{ margin: '0 0 20px', fontSize: 13, color: '#6b7280', textAlign: 'center' }}>
                You can track delivery status in the <strong>Notification Center</strong>.
              </p>
            )}
            <div style={{ textAlign: 'center' }}>
              <button
                onClick={onCancel}
                style={{ padding: '9px 28px', border: 'none', borderRadius: 8, background: '#1a3a52', color: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
              >
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const WEEK_DAYS = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const SEMESTER_LABELS = {
  'Y1-S1': '1st Year • 1st Sem',
  'Y1-S2': '1st Year • 2nd Sem',
  'Y2-S1': '2nd Year • 1st Sem',
  'Y2-S2': '2nd Year • 2nd Sem',
  'Y3-S1': '3rd Year • 1st Sem',
  'Y3-S2': '3rd Year • 2nd Sem',
  'Y4-S1': '4th Year • 1st Sem',
  'Y4-S2': '4th Year • 2nd Sem',
  'MS-S1': 'MS • 1st Sem',
  'MS-S2': 'MS • 2nd Sem',
};
const semLabel = id => SEMESTER_LABELS[id] || id;

// Parse "Sunday-Thursday" → ["Sunday","Monday","Tuesday","Wednesday","Thursday"]
function parseWorkingDays(classDayStr) {
  if (!classDayStr || typeof classDayStr !== 'string') return [];
  const parts = classDayStr.split('-').map(s => s.trim());
  if (parts.length < 2) return [];
  const si = WEEK_DAYS.indexOf(parts[0]);
  const ei = WEEK_DAYS.indexOf(parts[1]);
  if (si === -1 || ei === -1) return [];
  const days = [];
  let cur = si;
  while (true) {
    days.push(WEEK_DAYS[cur]);
    if (cur === ei) break;
    cur = (cur + 1) % WEEK_DAYS.length;
  }
  return days;
}

function parseMinutes(timeStr) {
  if (!timeStr) return 8 * 60 + 30;
  const [h, m] = String(timeStr).split(':').map(Number);
  return h * 60 + (m || 0);
}

// Parse either "HH:MM" or a plain number (minutes) to total minutes
function parseDurationMins(val, fallback) {
  if (!val) return fallback;
  const s = String(val);
  if (s.includes(':')) {
    const [h, m] = s.split(':').map(Number);
    return h * 60 + (m || 0);
  }
  return parseInt(s) || fallback;
}

function minsToLabel(totalMins) {
  const h   = Math.floor(totalMins / 60);
  const m   = totalMins % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12  = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

// Returns an ordered array of column descriptors for the routine grid.
// Each entry is either a class slot: { type:'class', slotId, label, timeLabel }
// or a break:                        { type:'break', slotId:'lunch', label, timeLabel }
function buildColumns(settings) {
  if (!settings) return [];
  const before    = parseInt(settings.classesBeforeLunch) || 0;
  const after     = parseInt(settings.classesAfterLunch)  || 0;
  const durMins   = parseDurationMins(settings.duration,      90);
  const rawSkip   = parseInt(settings.skipTime);
  const skipMins  = isNaN(rawSkip) ? 0 : rawSkip;
  const lunchMins = parseDurationMins(settings.lunchDuration, 60);
  let cur = parseMinutes(settings.startTime);

  const cols = [];

  // Morning class periods
  for (let i = 0; i < before; i++) {
    const endMin = cur + durMins;
    cols.push({
      type: 'class',
      slotId: `s${i + 1}`,
      label: `P${i + 1}`,
      timeLabel: `${minsToLabel(cur)} – ${minsToLabel(endMin)}`,
    });
    // No skip after the last morning class (break starts right when class ends)
    cur = i < before - 1 ? endMin + skipMins : endMin;
  }

  // Lunch break column (only if there are morning classes and lunch duration > 0)
  if (before > 0 && lunchMins > 0) {
    const breakEnd = cur + lunchMins;
    cols.push({
      type: 'break',
      slotId: 'lunch',
      label: 'Break',
      timeLabel: `${minsToLabel(cur)} – ${minsToLabel(breakEnd)}`,
    });
    cur = breakEnd;
  }

  // Afternoon class periods
  for (let i = 0; i < after; i++) {
    const endMin = cur + durMins;
    cols.push({
      type: 'class',
      slotId: `s${before + 1 + i}`,
      label: `P${before + 1 + i}`,
      timeLabel: `${minsToLabel(cur)} – ${minsToLabel(endMin)}`,
    });
    cur = endMin + skipMins;
  }

  return cols;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function Routine({ semesterId, onNavigate }) {
  const [view, setView] = useState('generation');

  // data
  const [settings,  setSettings]  = useState(null);
  const [courses,   setCourses]   = useState([]);
  const [teachers,  setTeachers]  = useState([]);
  const [routine,   setRoutine]   = useState(null); // { entries, generatedAt, saved }

  // UI states
  const [loading,    setLoading]    = useState(true);
  const [checking,   setChecking]   = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [conflicts,  setConflicts]  = useState(null); // null = not checked yet
  const [warnings,   setWarnings]   = useState([]);
  const [gaReport,   setGaReport]   = useState(null); // GA result report (violations, stats)
  const [seedInput,  setSeedInput]  = useState('');   // optional reproducibility seed

  const [selectedSemester, setSelectedSemester] = useState(null);
  const [selectedTeacher,  setSelectedTeacher]  = useState(null);
  const [publishModal,     setPublishModal]      = useState(null); // null | { batchId, semLabel, all }

  // Manual editing (batch-wise view): pick a class block, then click a target
  // cell. Violating placements raise a confirm dialog instead of a hard stop.
  const [editMode,     setEditMode]     = useState(false);
  const [pickedBlock,  setPickedBlock]  = useState(null); // block object being moved
  const [moveWarning,  setMoveWarning]  = useState(null); // { violations, apply }
  const [dirty,        setDirty]        = useState(false); // unsaved manual edits

  // Preview modal (official document) + print source
  const [previewBatch, setPreviewBatch] = useState(null); // batchId | null
  const printRef = useRef(null);
  const [publishingAll, setPublishingAll] = useState(false);
  const [publishAllResult, setPublishAllResult] = useState(null); // { ok: [], failed: [{sem,error}] }
  // { batchCode: { publishedAt, fingerprint } } — drives Publish / Republish /
  // Publish Edited button states.
  const [publishedBatches, setPublishedBatches] = useState({});
  const [availability, setAvailability] = useState([]);   // teacher availability (for H8 checks)
  const [semesterMeta, setSemesterMeta] = useState(null); // academic semester row (label)

  // -------------------------------------------------------------------------
  useEffect(() => {
    if (semesterId) loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [semesterId]);

  const loadAll = async () => {
    setLoading(true);
    const [settingsRes, coursesRes, teachersRes, routineRes, availRes, semRes] = await Promise.all([
      classTimeSettingsAPI.getSettings(semesterId),
      courseAPI.getAllCourses(),
      teacherAPI.getTeachers(semesterId),
      routineAPI.getRoutine(semesterId),
      teacherAPI.getAllAvailability(semesterId),
      academicSemesterAPI.getSemesterById(semesterId),
    ]);
    if (settingsRes.success) setSettings(settingsRes.data);
    if (coursesRes.success)  setCourses(coursesRes.courses || []);
    if (teachersRes.success) setTeachers(teachersRes.data  || []);
    if (availRes.success)    setAvailability(availRes.data || []);
    if (semRes.success)      setSemesterMeta(semRes.data);
    if (routineRes.success) setPublishedBatches(routineRes.publishedBatches || {});
    if (routineRes.success && (routineRes.entries?.length || 0) > 0) {
      setRoutine({ entries: routineRes.entries, generatedAt: routineRes.generatedAt, saved: true });
      setView('batchwise'); // show saved routine immediately on revisit
    }
    setLoading(false);
  };

  // -------------------------------------------------------------------------
  // Derived data
  // -------------------------------------------------------------------------
  const courseMap = useMemo(
    () => Object.fromEntries(courses.map(c => [c.id, c])),
    [courses]
  );
  const teacherMap = useMemo(
    () => Object.fromEntries(teachers.map(t => [t.id, t])),
    [teachers]
  );
  const columns = useMemo(() => buildColumns(settings), [settings]);

  const activeDays = useMemo(() => parseWorkingDays(settings?.classDay), [settings]);

  // Organised routine: day-wise and semester-wise
  const entriesByDaySlot = useMemo(() => {
    const map = {};
    for (const e of routine?.entries || []) {
      const key = `${e.day_of_week}-${e.slot_id}`;
      if (!map[key]) map[key] = [];
      map[key].push(e);
    }
    return map;
  }, [routine]);

  // sem → 'day-slot' → [entries] (Group A of one lab may legally sit beside
  // Group B of another, so a cell can hold more than one entry)
  const entriesBySemDaySlot = useMemo(() => {
    const map = {};
    for (const e of routine?.entries || []) {
      if (!map[e.semester]) map[e.semester] = {};
      const key = `${e.day_of_week}-${e.slot_id}`;
      if (!map[e.semester][key]) map[e.semester][key] = [];
      map[e.semester][key].push(e);
    }
    return map;
  }, [routine]);

  const semesters = useMemo(() => {
    return [...new Set((routine?.entries || []).map(e => e.semester))].sort();
  }, [routine]);

  // teacher_id → { 'day-slot' → entry } — a course may have several teachers
  const entriesByTeacherDaySlot = useMemo(() => {
    const map = {};
    for (const e of routine?.entries || []) {
      const tids = e.teacher_ids?.length ? e.teacher_ids : (e.teacher_id ? [e.teacher_id] : []);
      for (const tid of tids) {
        if (!map[tid]) map[tid] = {};
        map[tid][`${e.day_of_week}-${e.slot_id}`] = e;
      }
    }
    return map;
  }, [routine]);

  // Display helpers for the new entry fields
  const entryTeachers = (e) => {
    const tids = e.teacher_ids?.length ? e.teacher_ids : (e.teacher_id ? [e.teacher_id] : []);
    return tids.map(id => teacherMap[id]?.initials || teacherMap[id]?.name).filter(Boolean).join(', ');
  };
  const groupLabel = (g) =>
    g === 'alt' ? 'Group A/B · alt weeks' : g ? `Group ${g}` : null;

  // Sorted list of teachers who actually appear in the routine
  const teachersInRoutine = useMemo(() => {
    const ids = Object.keys(entriesByTeacherDaySlot);
    return ids
      .map(id => teacherMap[id])
      .filter(Boolean)
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [entriesByTeacherDaySlot, teacherMap]);

  // ── Manual-edit derived data ──
  const blocks = useMemo(
    () => (routine ? buildBlocks(routine.entries) : []),
    [routine]
  );

  const availMap = useMemo(() => {
    const m = {};
    for (const a of availability) {
      if (!m[a.teacher_id]) m[a.teacher_id] = new Set();
      m[a.teacher_id].add(`${a.day_of_week}-${a.slot_id}`);
    }
    return m;
  }, [availability]);

  const editCtx = useMemo(() => ({
    slotCount: (parseInt(settings?.classesBeforeLunch) || 0) + (parseInt(settings?.classesAfterLunch) || 0),
    before: parseInt(settings?.classesBeforeLunch) || 0,
    days: activeDays,
    avoidedSet: new Set(settings?.avoidPeriods || []),
    courseMap,
    teacherMap,
    hardAvailabilityRanks: ['Professor', 'Associate Professor'],
    availMap,
  }), [settings, activeDays, courseMap, teacherMap, availMap]);

  // Move `pickedBlock` to (day, startSlotNum); confirm through the violation
  // dialog when the placement breaks hard constraints.
  const applyMove = (day, start) => {
    if (!pickedBlock) return;
    const doApply = () => {
      const next = blocks.map(b =>
        b.id === pickedBlock.id ? { ...b, day, start } : b
      );
      setRoutine(prev => ({ ...prev, entries: blocksToEntries(next), saved: false }));
      setDirty(true);
      setPickedBlock(null);
      setMoveWarning(null);
    };
    const violations = checkMove(pickedBlock, day, start, blocks, editCtx);
    if (violations.length > 0) {
      setMoveWarning({ violations, apply: doApply });
    } else {
      doApply();
    }
  };

  const handleCellClick = (day, slotNumTarget, cellBlocks) => {
    if (!editMode) return;
    if (!pickedBlock) {
      // Pick up the (first) block in this cell
      if (cellBlocks.length > 0) setPickedBlock(cellBlocks[0]);
      return;
    }
    // Clicking the picked block again cancels the pick
    if (cellBlocks.some(b => b.id === pickedBlock.id)) {
      setPickedBlock(null);
      return;
    }
    applyMove(day, slotNumTarget);
  };

  // Blocks by cell for the batch-wise editor
  const blocksBySemDaySlot = useMemo(() => {
    const m = {};
    for (const b of blocks) {
      if (!m[b.semester]) m[b.semester] = {};
      for (let p = 0; p < b.periods; p++) {
        const k = `${b.day}-s${b.start + p}`;
        if (!m[b.semester][k]) m[b.semester][k] = [];
        m[b.semester][k].push(b);
      }
    }
    return m;
  }, [blocks]);

  // Publish state per batch: 'unpublished' | 'published' | 'edited'
  // ('edited' = published before, but its entries changed since.)
  const publishStateOf = (batchId) => {
    const rec = publishedBatches[batchId];
    if (!rec) return 'unpublished';
    // No stored fingerprint (published before per-batch tracking existed, or
    // the migration hasn't run) — we know it was published but can't detect
    // edits, so report plain "published" rather than a false "edited".
    if (!rec.fingerprint) return 'published';
    const current = batchFingerprint((routine?.entries || []).filter(e => e.semester === batchId));
    return current === rec.fingerprint ? 'published' : 'edited';
  };

  const PUBLISH_BTN = {
    unpublished: { label: '📢 Publish & Notify',      cls: 'rt-pub-btn--new' },
    published:   { label: '🔁 Republish',             cls: 'rt-pub-btn--republish' },
    edited:      { label: '📤 Publish Edited Routine', cls: 'rt-pub-btn--edited' },
  };

  // ── Download / preview helpers ──
  const semLabelFull = semesterMeta ? `${semesterMeta.name} ${semesterMeta.year}` : '';
  const handleDownloadBatch = () => {
    if (printRef.current) {
      printCalendarNode(printRef.current, `Class Routine - ${previewBatch || ''}`);
    }
  };

  // Publish every batch that has entries, sequentially (email jobs are queued
  // per batch on the backend). Re-running republishes.
  const handlePublishAll = async () => {
    if (!routine?.saved || publishingAll) return;
    const anyPublished = semesters.some(s => publishStateOf(s) !== 'unpublished');
    const verb = anyPublished ? 'Publish / republish' : 'Publish';
    if (!window.confirm(`${verb} ${semesters.length} batch routine${semesters.length !== 1 ? 's' : ''} and notify all students & teachers?`)) return;
    setPublishingAll(true);
    setPublishAllResult(null);
    const ok = [], failed = [];
    let latestMap = null;
    for (const sem of semesters) {
      const r = await routineAPI.publishRoutine(semesterId, sem, semLabel(sem));
      if (r.success) { ok.push(sem); if (r.publishedBatches) latestMap = r.publishedBatches; }
      else failed.push({ sem, error: r.error || 'failed' });
    }
    if (latestMap) setPublishedBatches(latestMap);
    setPublishingAll(false);
    setPublishAllResult({ ok, failed });
  };

  // -------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------
  const handleCheckConflicts = async () => {
    setChecking(true);
    const result = await routineAPI.checkConflicts(semesterId);
    setChecking(false);
    if (result.success) {
      setConflicts(result.conflicts);
    } else {
      alert(`Error checking conflicts: ${result.error}`);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    const seed = seedInput.trim() === '' ? undefined : Number(seedInput);
    const result = await routineAPI.generateRoutine(semesterId, seed);
    setGenerating(false);
    if (result.success) {
      // Preview only — the admin saves explicitly before publishing
      setRoutine({ entries: result.entries, generatedAt: result.generatedAt, saved: false });
      setGaReport(result.report || null);
      setWarnings(result.report?.inputProblems || result.warnings || []);
      setConflicts(null);
      setView('batchwise');
    } else {
      alert(`Generation failed: ${result.error}`);
    }
  };

  const handleSave = async () => {
    if (!routine || routine.saved) return;
    setSaving(true);
    const r = await routineAPI.saveRoutine(semesterId, routine.entries, routine.generatedAt);
    setSaving(false);
    if (r.success) {
      setRoutine(prev => ({ ...prev, saved: true, generatedAt: r.generatedAt || prev.generatedAt }));
    } else {
      alert(`Save failed: ${r.error}`);
    }
  };

  const handleClear = async () => {
    if (!window.confirm('Clear the generated routine?')) return;
    if (routine?.saved) await routineAPI.clearRoutine(semesterId);
    setRoutine(null);
    setWarnings([]);
    setConflicts(null);
    setGaReport(null);
    setView('generation');
  };

  // -------------------------------------------------------------------------
  const hasErrors    = (conflicts || []).some(c => c.severity === 'error');
  const errorCount   = (conflicts || []).filter(c => c.severity === 'error').length;
  const warningCount = (conflicts || []).filter(c => c.severity === 'warning').length;

  // -------------------------------------------------------------------------
  if (loading) {
    return <div className="routine-loading"><p>Loading routine data…</p></div>;
  }

  return (
    <div className="routine-page">

      {/* ── Tab Bar ── */}
      <div className="routine-tabs">
        <button
          className={`routine-tab${view === 'generation' ? ' active' : ''}`}
          onClick={() => setView('generation')}
        >
          Generate
        </button>
        <button
          className={`routine-tab${view === 'daywise' ? ' active' : ''}`}
          onClick={() => setView('daywise')}
          disabled={!routine}
          title={!routine ? 'Generate a routine first' : ''}
        >
          Day-Wise
        </button>
        <button
          className={`routine-tab${view === 'batchwise' ? ' active' : ''}`}
          onClick={() => setView('batchwise')}
          disabled={!routine}
          title={!routine ? 'Generate a routine first' : ''}
        >
          Batch-Wise
        </button>
        <button
          className={`routine-tab${view === 'teacherwise' ? ' active' : ''}`}
          onClick={() => setView('teacherwise')}
          disabled={!routine}
          title={!routine ? 'Generate a routine first' : ''}
        >
          Teacher-Wise
        </button>
        {routine && (
          <button className="routine-tab routine-tab--clear" onClick={handleClear}>
            Clear Routine
          </button>
        )}
      </div>

      {/* ── Preview / Save bar ── */}
      {routine && (
        <div className={`routine-preview-bar${routine.saved ? ' routine-preview-bar--saved' : ''}`}>
          {routine.saved ? (
            <span className="rpb-text">
              ✓ Routine saved{routine.generatedAt ? ` — ${new Date(routine.generatedAt).toLocaleString()}` : ''}. You can publish it per semester from the Batch-Wise view.
            </span>
          ) : (
            <>
              <span className="rpb-text">
                👁 <strong>Preview</strong> — this routine is <strong>not saved yet</strong>. Save it to enable publishing, or regenerate for a different layout.
              </span>
              <div className="rpb-actions">
                <button
                  className="rpb-btn rpb-btn--regen"
                  onClick={handleGenerate}
                  disabled={generating || saving}
                >
                  {generating ? 'Regenerating…' : '🔄 Regenerate'}
                </button>
                <button
                  className="rpb-btn rpb-btn--save"
                  onClick={handleSave}
                  disabled={saving || generating}
                >
                  {saving ? 'Saving…' : '💾 Save Routine'}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════
          Generation View
      ════════════════════════════════════════ */}
      {view === 'generation' && (
        <div className="routine-generation">

          {(generating || checking) && (
            <div className="routine-wait-banner">
              <span className="routine-wait-spinner" />
              Please wait, finding the best possible routine…
            </div>
          )}

          {routine && (
            <div className="routine-generated-notice">
              Routine generated on {new Date(routine.generatedAt).toLocaleString()}.{' '}
              <button className="link-btn" onClick={() => setView('daywise')}>Day-Wise</button>
              {' · '}
              <button className="link-btn" onClick={() => setView('batchwise')}>Batch-Wise</button>
            </div>
          )}

          <div className="routine-actions">
            <button
              className="routine-btn routine-btn--check"
              onClick={handleCheckConflicts}
              disabled={checking}
            >
              {checking ? 'Checking…' : 'Check Conflicts'}
            </button>

            <button
              className="routine-btn routine-btn--generate"
              onClick={handleGenerate}
              disabled={generating}
              title={routine ? 'Discard the current layout and search for a new one' : undefined}
            >
              {generating
                ? 'Please wait, finding the best possible routine…'
                : routine ? '🔄 Regenerate Routine' : 'Generate Routine'}
            </button>

            <input
              className="routine-seed-input"
              type="number"
              placeholder="Seed (optional)"
              title="Enter a number to make the generation reproducible — the same seed always produces the same routine."
              value={seedInput}
              onChange={e => setSeedInput(e.target.value)}
            />
          </div>

          {/* GA result report */}
          {gaReport && (
            <div className={`ga-report${gaReport.feasible ? ' ga-report--ok' : ' ga-report--bad'}`}>
              <div className="ga-report-head">
                {gaReport.feasible
                  ? '✓ Conflict-free routine generated (all hard constraints satisfied).'
                  : gaReport.timedOut
                    ? `⏱ Time limit reached — showing the best routine found. ${gaReport.hardCount} hard constraint${gaReport.hardCount !== 1 ? 's' : ''} could not be fulfilled (listed below).`
                    : `✕ ${gaReport.hardCount} hard violation${gaReport.hardCount !== 1 ? 's' : ''} could not be resolved — the input may be infeasible.`}
              </div>
              <div className="ga-report-stats">
                {gaReport.stats.events} events · {gaReport.stats.entries} routine slots ·{' '}
                {gaReport.stats.generations} generations · {(gaReport.stats.elapsedMs / 1000).toFixed(1)}s ·{' '}
                soft score {gaReport.softCost} · seed {gaReport.stats.seed}
              </div>
              {gaReport.hardViolations.length > 0 && (
                <ul className="ga-report-violations">
                  {gaReport.hardViolations.map((v, i) => (
                    <li key={i}><strong>{v.type}</strong> — {v.message}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Conflict results */}
          {conflicts !== null && (
            <div className="conflict-section">
              {conflicts.length === 0 ? (
                <div className="conflict-none">
                  ✓ No conflicts found — ready to generate the routine.
                </div>
              ) : (
                <ConflictPanel
                  conflicts={conflicts}
                  hasErrors={hasErrors}
                  errorCount={errorCount}
                  warningCount={warningCount}
                  generating={generating}
                  onNavigate={onNavigate}
                  onGenerate={handleGenerate}
                />
              )}
            </div>
          )}

          {/* Generation warnings */}
          {warnings.length > 0 && (
            <div className="routine-warnings">
              <p className="warnings-title">Generation warnings ({warnings.length}):</p>
              <ul className="warnings-list">
                {warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════
          Day-Wise View
      ════════════════════════════════════════ */}
      {view === 'daywise' && (
        <div className="routine-daywise">
          {routine ? (
            <>
              <div className="routine-view-header">
                <h3>Day-Wise Routine</h3>
                <span className="generated-at">
                  Generated: {new Date(routine.generatedAt).toLocaleString()}
                </span>
              </div>

              <div className="routine-table-wrapper">
                <table className="routine-table">
                  <thead>
                    <tr>
                      <th className="routine-th routine-th--period">Period</th>
                      {activeDays.map(day => (
                        <th key={day} className="routine-th">{day}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {columns.map(col => {
                      if (col.type === 'break') {
                        return (
                          <tr key="lunch" className="routine-tr--break">
                            <td className="routine-td routine-td--break-label">
                              <div className="break-label-text">Break</div>
                              <div className="period-time">{col.timeLabel}</div>
                            </td>
                            {activeDays.map(day => (
                              <td key={day} className="routine-td routine-td--break" />
                            ))}
                          </tr>
                        );
                      }
                      return (
                        <tr key={col.slotId}>
                          <td className="routine-td routine-td--period">
                            <div className="period-label">{col.label}</div>
                            <div className="period-time">{col.timeLabel}</div>
                          </td>
                          {activeDays.map(day => {
                            const cellEntries = entriesByDaySlot[`${day}-${col.slotId}`] || [];
                            return (
                              <td key={day} className="routine-td">
                                {cellEntries.length === 0 ? (
                                  <span className="routine-empty">—</span>
                                ) : (
                                  cellEntries.map((e, idx) => {
                                    const c = courseMap[e.course_id];
                                    return (
                                      <div
                                        key={idx}
                                        className={`day-entry${c?.course_type === 'lab' ? ' lab' : ''}`}
                                      >
                                        <span className="day-entry-title">
                                          {c?.title || c?.code || '?'}
                                        </span>
                                        {e.group && (
                                          <span className="entry-group-chip">{groupLabel(e.group)}</span>
                                        )}
                                        <span className="day-entry-sem">{semLabel(e.semester)}</span>
                                        {e.room && (
                                          <span className="day-entry-room">{e.room}</span>
                                        )}
                                      </div>
                                    );
                                  })
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <EmptyState onBack={() => setView('generation')} />
          )}
        </div>
      )}

      {/* ════════════════════════════════════════
          Teacher-Wise View
      ════════════════════════════════════════ */}
      {view === 'teacherwise' && (
        <div className="routine-teacherwise">
          {routine ? (
            <>
              <div className="routine-view-header">
                <h3>Teacher-Wise Routine</h3>
                <span className="generated-at">
                  Generated: {new Date(routine.generatedAt).toLocaleString()}
                </span>
              </div>

              {teachersInRoutine.length === 0 ? (
                <p className="select-semester-hint">No teacher assignments found in this routine.</p>
              ) : (
                <>
                  <div className="semester-list">
                    {teachersInRoutine.map(t => (
                      <button
                        key={t.id}
                        className={`semester-btn teacher-pill${selectedTeacher === t.id ? ' active' : ''}`}
                        onClick={() => setSelectedTeacher(t.id === selectedTeacher ? null : t.id)}
                      >
                        <span className="teacher-pill-initials">{t.initials || t.name?.charAt(0)}</span>
                        {t.name}
                      </button>
                    ))}
                  </div>

                  {selectedTeacher ? (() => {
                    const t = teacherMap[selectedTeacher];
                    const teacherEntries = entriesByTeacherDaySlot[selectedTeacher] || {};
                    // Count total classes for this teacher
                    const totalClasses = Object.keys(teacherEntries).length;
                    return (
                      <div className="batch-grid-wrapper">
                        <div className="teacher-schedule-header">
                          <h4 className="batch-title">
                            {t?.initials && <span className="tw-initials">{t.initials}</span>}
                            {t?.name}
                          </h4>
                          <span className="tw-class-count">{totalClasses} class{totalClasses !== 1 ? 'es' : ''} / week</span>
                        </div>
                        <div className="routine-table-wrapper">
                          <table className="routine-table routine-table--batch">
                            <thead>
                              <tr>
                                <th className="routine-th routine-th--day-col">Day</th>
                                {columns.map(col => (
                                  col.type === 'break' ? (
                                    <th key="lunch" className="routine-th routine-th--break-col">
                                      <div className="break-col-label">{col.label}</div>
                                      <div className="break-col-time">{col.timeLabel}</div>
                                    </th>
                                  ) : (
                                    <th key={col.slotId} className="routine-th routine-th--period-col">
                                      <div className="period-label">{col.label}</div>
                                      <div className="period-time">{col.timeLabel}</div>
                                    </th>
                                  )
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {activeDays.map(day => (
                                <tr key={day}>
                                  <td className="routine-td routine-td--day-col">
                                    <div className="day-name-label">{day}</div>
                                  </td>
                                  {columns.map(col => {
                                    if (col.type === 'break') {
                                      return <td key="lunch" className="routine-td routine-td--break" />;
                                    }
                                    const e = teacherEntries[`${day}-${col.slotId}`];
                                    const c = e ? courseMap[e.course_id] : null;
                                    return (
                                      <td key={col.slotId} className="routine-td">
                                        {e ? (
                                          <div className={`batch-entry tw-entry${c?.course_type === 'lab' ? ' lab' : ''}`}>
                                            <span className="batch-entry-code">{c?.code}</span>
                                            <span className="batch-entry-title">{c?.title}</span>
                                            {e.group && (
                                              <span className="entry-group-chip">{groupLabel(e.group)}</span>
                                            )}
                                            {e.room && <span className="batch-entry-room">{e.room}</span>}
                                            <span className="tw-semester-tag">{semLabel(e.semester)}</span>
                                          </div>
                                        ) : (
                                          <span className="routine-empty">—</span>
                                        )}
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })() : (
                    <p className="select-semester-hint">Select a teacher above to view their schedule.</p>
                  )}
                </>
              )}
            </>
          ) : (
            <EmptyState onBack={() => setView('generation')} />
          )}
        </div>
      )}

      {/* Publish confirmation modal */}
      {publishModal && (
        <PublishModal
          semesterId={semesterId}
          batchId={publishModal.batchId}
          semLabel={publishModal.semLabel}
          state={publishModal.state}
          onPublished={(map) => setPublishedBatches(map)}
          onCancel={() => setPublishModal(null)}
        />
      )}

      {/* Hard-constraint warning for manual edits */}
      {moveWarning && (
        <div className="rt-overlay">
          <div className="rt-warn-modal">
            <h4 className="rt-warn-title">⚠ This change breaks hard constraints</h4>
            <ul className="rt-warn-list">
              {moveWarning.violations.map((v, i) => <li key={i}>{v}</li>)}
            </ul>
            <p className="rt-warn-note">
              You can apply it anyway — the routine will contain these conflicts until you fix them.
            </p>
            <div className="rt-warn-actions">
              <button className="rt-warn-btn cancel" onClick={() => setMoveWarning(null)}>Cancel</button>
              <button className="rt-warn-btn apply" onClick={moveWarning.apply}>Apply Anyway</button>
            </div>
          </div>
        </div>
      )}

      {/* Official-format preview modal + download */}
      {previewBatch && (
        <div className="rt-overlay" onClick={e => e.target === e.currentTarget && setPreviewBatch(null)}>
          <div className="rt-preview-modal">
            <div className="rt-preview-head">
              <span className="rt-preview-title">Preview — {semLabel(previewBatch)} routine</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="rt-tool-btn" onClick={handleDownloadBatch}>⬇ Download PDF</button>
                <button className="rt-tool-btn" onClick={() => setPreviewBatch(null)}>✕ Close</button>
              </div>
            </div>
            <div className="rt-preview-body">
              <div ref={printRef}>
                <RoutineDocument
                  batchId={previewBatch}
                  entries={(routine?.entries || []).filter(e => e.semester === previewBatch)}
                  columns={columns}
                  days={activeDays}
                  courseMap={courseMap}
                  teacherMap={teacherMap}
                  semesterLabel={semLabelFull}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════
          Batch-Wise View
      ════════════════════════════════════════ */}
      {view === 'batchwise' && (
        <div className="routine-batchwise">
          {routine ? (
            <>
              <div className="routine-view-header">
                <h3>Batch-Wise Routine</h3>
              </div>

              <div className="semester-list">
                {semesters.map(sem => {
                  const st = publishStateOf(sem);
                  return (
                    <button
                      key={sem}
                      className={`semester-btn${selectedSemester === sem ? ' active' : ''}`}
                      onClick={() => setSelectedSemester(sem === selectedSemester ? null : sem)}
                    >
                      {semLabel(sem)}
                      {st !== 'unpublished' && (
                        <span className={`rt-pub-dot rt-pub-dot--${st}`} title={st === 'edited' ? 'Published, then edited' : 'Published'}>
                          {st === 'edited' ? '✎' : '✓'}
                        </span>
                      )}
                    </button>
                  );
                })}
                {semesters.length > 1 && (() => {
                  const allPublished = semesters.every(s => publishStateOf(s) === 'published');
                  const anyEdited    = semesters.some(s => publishStateOf(s) === 'edited');
                  const label = publishingAll
                    ? 'Publishing…'
                    : anyEdited    ? '📤 Publish All Edited'
                    : allPublished ? '🔁 Republish All'
                    :                '📢 Publish All';
                  return (
                    <button
                      className="semester-btn rt-publish-all-btn"
                      disabled={!routine?.saved || publishingAll}
                      title={routine?.saved
                        ? 'Publish every batch routine and notify everyone'
                        : 'Save the routine first'}
                      onClick={handlePublishAll}
                    >
                      {label}
                    </button>
                  );
                })()}
              </div>
              {publishAllResult && (
                <div className={`rt-publish-all-result${publishAllResult.failed.length ? ' has-fail' : ''}`}>
                  {publishAllResult.ok.length > 0 && (
                    <span>✓ Published: {publishAllResult.ok.map(semLabel).join(', ')}.</span>
                  )}
                  {publishAllResult.failed.length > 0 && (
                    <span> ✕ Failed: {publishAllResult.failed.map(f => `${semLabel(f.sem)} (${f.error})`).join('; ')}</span>
                  )}
                </div>
              )}

              {selectedSemester ? (
                <div className="batch-grid-wrapper">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 8 }}>
                    <h4 className="batch-title" style={{ margin: 0 }}>{semLabel(selectedSemester)}</h4>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button
                        className={`rt-tool-btn${editMode ? ' rt-tool-btn--active' : ''}`}
                        onClick={() => { setEditMode(m => !m); setPickedBlock(null); }}
                        title="Manually move classes: click a class, then click its new cell. Hard-constraint breaks are warned."
                      >
                        {editMode ? '✓ Done Editing' : '✎ Edit Routine'}
                      </button>
                      <button
                        className="rt-tool-btn"
                        onClick={() => setPreviewBatch(selectedSemester)}
                        title="Preview the official routine document"
                      >
                        👁 Preview
                      </button>
                      {(() => {
                        const st  = publishStateOf(selectedSemester);
                        const btn = PUBLISH_BTN[st];
                        return (
                          <button
                            className={`rt-pub-btn ${btn.cls}`}
                            onClick={() => setPublishModal({
                              batchId: selectedSemester,
                              semLabel: semLabel(selectedSemester),
                              state: st,
                            })}
                            disabled={!routine?.saved}
                            title={routine?.saved
                              ? (st === 'unpublished'
                                  ? `Publish ${semLabel(selectedSemester)} and notify students & teachers`
                                  : st === 'edited'
                                    ? 'This routine changed after it was published — send the updated version'
                                    : 'Already published — send it again')
                              : 'Save the routine first — publishing sends the saved routine'}
                          >
                            {btn.label}
                          </button>
                        );
                      })()}
                    </div>
                  </div>

                  {editMode && (
                    <div className="rt-edit-hint">
                      {pickedBlock
                        ? <>Moving <strong>{courseMap[pickedBlock.courseId]?.code || 'class'}</strong>{pickedBlock.group ? ` (Group ${pickedBlock.group})` : ''} — click a target cell, or click it again to cancel.</>
                        : 'Click a class to pick it up, then click the cell to move it to. Violating moves ask for confirmation.'}
                      {dirty && <span className="rt-edit-dirty"> · Unsaved manual changes — use 💾 Save Routine above.</span>}
                    </div>
                  )}

                  <div className="routine-table-wrapper">
                    <table className="routine-table routine-table--batch">
                      <thead>
                        <tr>
                          <th className="routine-th routine-th--day-col">Day</th>
                          {columns.map(col => (
                            col.type === 'break' ? (
                              <th key="lunch" className="routine-th routine-th--break-col">
                                <div className="break-col-label">{col.label}</div>
                                <div className="break-col-time">{col.timeLabel}</div>
                              </th>
                            ) : (
                              <th key={col.slotId} className="routine-th routine-th--period-col">
                                <div className="period-label">{col.label}</div>
                                <div className="period-time">{col.timeLabel}</div>
                              </th>
                            )
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {activeDays.map(day => (
                          <tr key={day}>
                            <td className="routine-td routine-td--day-col">
                              <div className="day-name-label">{day}</div>
                            </td>
                            {columns.map(col => {
                              if (col.type === 'break') {
                                return <td key="lunch" className="routine-td routine-td--break" />;
                              }
                              const slotN = parseInt(col.slotId.replace('s', ''), 10);
                              const cellBlocks = blocksBySemDaySlot[selectedSemester]?.[`${day}-${col.slotId}`] || [];
                              const es = entriesBySemDaySlot[selectedSemester]?.[`${day}-${col.slotId}`] || [];
                              const isPickedHere = pickedBlock && cellBlocks.some(b => b.id === pickedBlock.id);
                              return (
                                <td
                                  key={col.slotId}
                                  className={[
                                    'routine-td',
                                    editMode ? 'rt-cell--editable' : '',
                                    isPickedHere ? 'rt-cell--picked' : '',
                                    editMode && pickedBlock && !isPickedHere ? 'rt-cell--target' : '',
                                  ].filter(Boolean).join(' ')}
                                  onClick={() => handleCellClick(day, slotN, cellBlocks)}
                                >
                                  {es.length === 0 ? (
                                    <span className="routine-empty">—</span>
                                  ) : (
                                    es.map((e, i) => {
                                      const c = courseMap[e.course_id];
                                      const tNames = entryTeachers(e);
                                      return (
                                        <div key={i} className={`batch-entry${c?.course_type === 'lab' ? ' lab' : ''}`}>
                                          <span className="batch-entry-code">{c?.code}</span>
                                          <span className="batch-entry-title">{c?.title}</span>
                                          {e.group && (
                                            <span className="entry-group-chip">{groupLabel(e.group)}</span>
                                          )}
                                          {e.room && <span className="batch-entry-room">{e.room}</span>}
                                          {tNames && <span className="batch-entry-teacher">{tNames}</span>}
                                        </div>
                                      );
                                    })
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <p className="select-semester-hint">
                  Select a semester above to view its routine.
                </p>
              )}
            </>
          ) : (
            <EmptyState onBack={() => setView('generation')} />
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ConflictPanel — groups teacher-assignment conflicts prominently, plus
//                 per-semester slot-capacity summary
// ---------------------------------------------------------------------------
function ConflictPanel({ conflicts, hasErrors, errorCount, warningCount, generating, onNavigate, onGenerate }) {
  const teacherConflicts = conflicts.filter(c =>
    c.id?.startsWith('no_teacher_') || c.id?.startsWith('teacher_inactive_')
  );

  // Per-semester capacity items (both OK and overloaded)
  const capacityConflicts = conflicts.filter(c =>
    c.id?.startsWith('sem_capacity_ok_') || c.id?.startsWith('sem_overloaded_')
  );

  // Everything else (errors/warnings that are not teacher or capacity)
  const otherConflicts = conflicts.filter(c =>
    !c.id?.startsWith('no_teacher_') &&
    !c.id?.startsWith('teacher_inactive_') &&
    !c.id?.startsWith('sem_capacity_ok_') &&
    !c.id?.startsWith('sem_overloaded_')
  );

  return (
    <div className="conflict-panel">
      {/* ── Teacher assignment block ── */}
      {teacherConflicts.length > 0 && (
        <div className="conflict-teacher-block">
          <div className="conflict-block-header conflict-block-header--error">
            <span className="cb-icon">✕</span>
            <span className="cb-title">
              {teacherConflicts.length} course{teacherConflicts.length > 1 ? 's' : ''} without a teacher assigned
            </span>
          </div>
          <div className="conflict-teacher-list">
            {teacherConflicts.map(c => (
              <div key={c.id} className="conflict-teacher-row">
                <span className="ctr-message">{c.message}</span>
                {onNavigate && (
                  <button
                    className="conflict-assign-btn"
                    onClick={() => onNavigate('allocation')}
                  >
                    Assign Teacher →
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Semester slot-capacity block ── */}
      {capacityConflicts.length > 0 && (
        <div className="conflict-capacity-block">
          <div className="conflict-block-header conflict-block-header--capacity">
            <span className="cb-icon cb-icon--capacity">◷</span>
            <span className="cb-title">Semester Slot Capacity</span>
          </div>
          <div className="conflict-capacity-list">
            {capacityConflicts.map(c => {
              const isOver = c.severity === 'error';
              // Parse "X of Y" or "X periods/week but only Y" from the message
              const matchOk   = c.message.match(/uses (\d+) of (\d+)/);
              const matchOver = c.message.match(/requires (\d+) periods\/week but only (\d+)/);
              const used  = matchOk   ? parseInt(matchOk[1])   : matchOver ? parseInt(matchOver[1]) : null;
              const total = matchOk   ? parseInt(matchOk[2])   : matchOver ? parseInt(matchOver[2]) : null;
              const pct   = used != null && total > 0 ? Math.min((used / total) * 100, 100) : 0;

              return (
                <div key={c.id} className={`conflict-capacity-row${isOver ? ' capacity-over' : ' capacity-ok'}`}>
                  <div className="cap-label">{c.message.match(/"([^"]+)"/)?.[1] ?? ''}</div>
                  <div className="cap-bar-wrap">
                    <div className="cap-bar">
                      <div
                        className={`cap-bar-fill${isOver ? ' cap-bar-fill--over' : ''}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="cap-stat">
                      {used != null ? `${used} / ${total} slots` : ''}
                    </span>
                  </div>
                  {isOver && onNavigate && (
                    <button className="conflict-go-btn" onClick={() => onNavigate('timeslot')}>
                      Fix →
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Other conflicts ── */}
      {otherConflicts.length > 0 && (
        <div className="conflict-list">
          {otherConflicts.map(c => (
            <div key={c.id} className={`conflict-item conflict-item--${c.severity}`}>
              <div className="conflict-icon">{c.severity === 'error' ? '✕' : '!'}</div>
              <div className="conflict-body">
                <p className="conflict-message">{c.message}</p>
                <p className="conflict-hint">{c.hint}</p>
              </div>
              {onNavigate && c.navigateTo && (
                <button
                  className="conflict-go-btn"
                  onClick={() => onNavigate(c.navigateTo)}
                >
                  Go Fix →
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Summary bar ── */}
      <div className={`conflict-summary${hasErrors ? ' has-errors' : ''}`}>
        {hasErrors
          ? `${errorCount} error${errorCount > 1 ? 's' : ''} must be resolved before generating.`
          : `${warningCount} warning${warningCount > 1 ? 's' : ''} (non-blocking) — you can still generate.`}
      </div>

      {!hasErrors && (
        <div style={{ marginTop: 12 }}>
          <button
            className="routine-btn routine-btn--generate"
            onClick={onGenerate}
            disabled={generating}
          >
            {generating ? 'Generating…' : 'Generate Anyway'}
          </button>
        </div>
      )}
    </div>
  );
}

function EmptyState({ onBack }) {
  return (
    <div className="routine-empty-state">
      <p>No routine generated yet.</p>
      <button className="routine-btn routine-btn--check" onClick={onBack}>
        Go to Generation
      </button>
    </div>
  );
}

export default Routine;
