import { useState, useEffect, useMemo } from 'react';
import { routineAPI } from '../../services/routineAPI';
import { classTimeSettingsAPI } from '../../services/classTimeSettingsAPI';
import { courseAPI } from '../../services/courseAPI';
import { teacherAPI } from '../../services/teacherAPI';
import './Routine.css';

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

function buildSlotLabels(settings) {
  if (!settings) return {};
  const before    = parseInt(settings.classesBeforeLunch) || 3;
  const after     = parseInt(settings.classesAfterLunch)  || 2;
  const durMins   = parseDurationMins(settings.duration,      90);
  const skipMins  = parseInt(settings.skipTime)           || 5;
  const lunchMins = parseDurationMins(settings.lunchDuration, 60);
  let cur = parseMinutes(settings.startTime);

  const labels = {};
  for (let i = 0; i < before + after; i++) {
    const id     = `s${i + 1}`;
    const endMin = cur + durMins;
    labels[id]   = `${minsToLabel(cur)} – ${minsToLabel(endMin)}`;
    cur = (i === before - 1) ? endMin + lunchMins : endMin + skipMins;
  }
  return labels;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function Routine({ onNavigate }) {
  const [view, setView] = useState('generation');

  // data
  const [settings,  setSettings]  = useState(null);
  const [courses,   setCourses]   = useState([]);
  const [teachers,  setTeachers]  = useState([]);
  const [routine,   setRoutine]   = useState(null); // { entries, generatedAt }

  // UI states
  const [loading,    setLoading]    = useState(true);
  const [checking,   setChecking]   = useState(false);
  const [generating, setGenerating] = useState(false);
  const [conflicts,  setConflicts]  = useState(null); // null = not checked yet
  const [warnings,   setWarnings]   = useState([]);

  const [selectedSemester, setSelectedSemester] = useState(null);

  // -------------------------------------------------------------------------
  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    const [settingsRes, coursesRes, teachersRes, routineRes] = await Promise.all([
      classTimeSettingsAPI.getSettings(),
      courseAPI.getAllCourses(),
      teacherAPI.getTeachers(),
      routineAPI.getRoutine(),
    ]);
    if (settingsRes.success) setSettings(settingsRes.data);
    if (coursesRes.success)  setCourses(coursesRes.courses || []);
    if (teachersRes.success) setTeachers(teachersRes.data  || []);
    if (routineRes.success && (routineRes.entries?.length || 0) > 0) {
      setRoutine({ entries: routineRes.entries, generatedAt: routineRes.generatedAt });
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
  const slotLabels = useMemo(() => buildSlotLabels(settings), [settings]);

  const activeDays = useMemo(() => parseWorkingDays(settings?.classDay), [settings]);

  const slotIds = useMemo(() => {
    if (!settings) return [];
    const before = parseInt(settings.classesBeforeLunch) || 0;
    const after  = parseInt(settings.classesAfterLunch)  || 0;
    return Array.from({ length: before + after }, (_, i) => `s${i + 1}`);
  }, [settings]);

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

  const entriesBySemDaySlot = useMemo(() => {
    const map = {};
    for (const e of routine?.entries || []) {
      if (!map[e.semester]) map[e.semester] = {};
      map[e.semester][`${e.day_of_week}-${e.slot_id}`] = e;
    }
    return map;
  }, [routine]);

  const semesters = useMemo(() => {
    return [...new Set((routine?.entries || []).map(e => e.semester))].sort();
  }, [routine]);

  // -------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------
  const handleCheckConflicts = async () => {
    setChecking(true);
    const result = await routineAPI.checkConflicts();
    setChecking(false);
    if (result.success) {
      setConflicts(result.conflicts);
    } else {
      alert(`Error checking conflicts: ${result.error}`);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    const result = await routineAPI.generateRoutine();
    setGenerating(false);
    if (result.success) {
      setRoutine({ entries: result.entries, generatedAt: result.generatedAt });
      setWarnings(result.warnings || []);
      setConflicts(null);
      setView('daywise');
    } else {
      alert(`Generation failed: ${result.error}`);
    }
  };

  const handleClear = async () => {
    if (!window.confirm('Clear the generated routine?')) return;
    await routineAPI.clearRoutine();
    setRoutine(null);
    setWarnings([]);
    setConflicts(null);
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
        {routine && (
          <button className="routine-tab routine-tab--clear" onClick={handleClear}>
            Clear Routine
          </button>
        )}
      </div>

      {/* ════════════════════════════════════════
          Generation View
      ════════════════════════════════════════ */}
      {view === 'generation' && (
        <div className="routine-generation">

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

            {conflicts !== null && !hasErrors && (
              <button
                className="routine-btn routine-btn--generate"
                onClick={handleGenerate}
                disabled={generating}
              >
                {generating ? 'Generating…' : 'Generate Routine'}
              </button>
            )}
          </div>

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
                    {slotIds.map(slotId => (
                      <tr key={slotId}>
                        <td className="routine-td routine-td--period">
                          <div className="period-label">P{slotId.replace('s', '')}</div>
                          <div className="period-time">{slotLabels[slotId]}</div>
                        </td>
                        {activeDays.map(day => {
                          const cellEntries = entriesByDaySlot[`${day}-${slotId}`] || [];
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
                    ))}
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
                {semesters.map(sem => (
                  <button
                    key={sem}
                    className={`semester-btn${selectedSemester === sem ? ' active' : ''}`}
                    onClick={() => setSelectedSemester(sem === selectedSemester ? null : sem)}
                  >
                    {semLabel(sem)}
                  </button>
                ))}
              </div>

              {selectedSemester ? (
                <div className="batch-grid-wrapper">
                  <h4 className="batch-title">{semLabel(selectedSemester)}</h4>
                  <div className="routine-table-wrapper">
                    <table className="routine-table routine-table--batch">
                      <thead>
                        <tr>
                          <th className="routine-th routine-th--period">Period</th>
                          {activeDays.map(day => (
                            <th key={day} className="routine-th">{day}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {slotIds.map(slotId => (
                          <tr key={slotId}>
                            <td className="routine-td routine-td--period">
                              <div className="period-label">P{slotId.replace('s', '')}</div>
                              <div className="period-time">{slotLabels[slotId]}</div>
                            </td>
                            {activeDays.map(day => {
                              const e = entriesBySemDaySlot[selectedSemester]?.[`${day}-${slotId}`];
                              const c = e ? courseMap[e.course_id]  : null;
                              const t = e ? teacherMap[e.teacher_id] : null;
                              return (
                                <td key={day} className="routine-td">
                                  {e ? (
                                    <div className={`batch-entry${c?.course_type === 'lab' ? ' lab' : ''}`}>
                                      <span className="batch-entry-code">{c?.code}</span>
                                      <span className="batch-entry-title">{c?.title}</span>
                                      {e.room && (
                                        <span className="batch-entry-room">{e.room}</span>
                                      )}
                                      {t && (
                                        <span className="batch-entry-teacher">
                                          {t.initials || t.name}
                                        </span>
                                      )}
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
