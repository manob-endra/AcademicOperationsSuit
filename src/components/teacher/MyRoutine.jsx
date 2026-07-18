import { useState, useEffect, useMemo, useRef } from 'react';
import { routineAPI } from '../../services/routineAPI';
import { courseAPI } from '../../services/courseAPI';
import { classTimeSettingsAPI } from '../../services/classTimeSettingsAPI';
import { printCalendarNode } from '../academicCalendar/printCalendar';

const WEEK_DAYS = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const SEMESTER_LABELS = {
  'Y1-S1': '1st Yr / 1st Sem', 'Y1-S2': '1st Yr / 2nd Sem',
  'Y2-S1': '2nd Yr / 1st Sem', 'Y2-S2': '2nd Yr / 2nd Sem',
  'Y3-S1': '3rd Yr / 1st Sem', 'Y3-S2': '3rd Yr / 2nd Sem',
  'Y4-S1': '4th Yr / 1st Sem', 'Y4-S2': '4th Yr / 2nd Sem',
  'MS-S1': 'MS / 1st Sem',     'MS-S2': 'MS / 2nd Sem',
};

function parseMinutes(t) {
  if (!t) return 8 * 60 + 30;
  const [h, m] = String(t).split(':').map(Number);
  return h * 60 + (m || 0);
}
function parseDurMins(v, fb) {
  if (!v) return fb;
  const s = String(v);
  if (s.includes(':')) { const [h, m] = s.split(':').map(Number); return h * 60 + (m || 0); }
  return parseInt(s) || fb;
}
function minsToLabel(m) {
  const h = Math.floor(m / 60), mn = m % 60;
  const ap = h >= 12 ? 'PM' : 'AM';
  const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${h12}:${String(mn).padStart(2, '0')} ${ap}`;
}
function buildColumns(s) {
  if (!s) return [];
  const before = parseInt(s.classesBeforeLunch) || 0;
  const after  = parseInt(s.classesAfterLunch)  || 0;
  const dur    = parseDurMins(s.duration, 90);
  const skip   = parseInt(s.skipTime) || 0;
  const lunch  = parseDurMins(s.lunchDuration, 60);
  let cur = parseMinutes(s.startTime);
  const cols = [];
  for (let i = 0; i < before; i++) {
    const end = cur + dur;
    cols.push({ type: 'class', slotId: `s${i + 1}`, label: `P${i + 1}`, timeLabel: `${minsToLabel(cur)} – ${minsToLabel(end)}` });
    cur = i < before - 1 ? end + skip : end;
  }
  if (before > 0 && lunch > 0) {
    const be = cur + lunch;
    cols.push({ type: 'break', slotId: 'lunch', label: 'Break', timeLabel: `${minsToLabel(cur)} – ${minsToLabel(be)}` });
    cur = be;
  }
  for (let i = 0; i < after; i++) {
    const end = cur + dur;
    cols.push({ type: 'class', slotId: `s${before + 1 + i}`, label: `P${before + 1 + i}`, timeLabel: `${minsToLabel(cur)} – ${minsToLabel(end)}` });
    cur = end + skip;
  }
  return cols;
}
function parseWorkingDays(str) {
  if (!str) return [];
  const parts = str.split('-').map(s => s.trim());
  if (parts.length < 2) return [];
  const si = WEEK_DAYS.indexOf(parts[0]), ei = WEEK_DAYS.indexOf(parts[1]);
  if (si === -1 || ei === -1) return [];
  const days = []; let cur = si;
  while (true) { days.push(WEEK_DAYS[cur]); if (cur === ei) break; cur = (cur + 1) % WEEK_DAYS.length; }
  return days;
}

function MyRoutine({ teacherRecord }) {
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  const [settings,  setSettings]  = useState(null);
  const [entries,   setEntries]   = useState([]);
  const [courseMap, setCourseMap] = useState({});

  useEffect(() => {
    if (teacherRecord?.id) load();
    else { setLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacherRecord]);

  const load = async () => {
    setLoading(true);
    setError('');
    // No semester context of our own — find it from the most recently
    // published routine, then load that semester's class time settings.
    const [routineRes, coursesRes] = await Promise.all([
      routineAPI.getPublishedRoutine(),
      courseAPI.getAllCourses(),
    ]);
    const settingsRes = routineRes.success && routineRes.semesterId
      ? await classTimeSettingsAPI.getSettings(routineRes.semesterId)
      : { success: false };
    if (settingsRes.success) setSettings(settingsRes.data);
    if (coursesRes.success) {
      const cm = {};
      for (const c of (coursesRes.courses || [])) cm[c.id] = c;
      setCourseMap(cm);
    }
    if (routineRes.success) {
      // A course may have several teachers — match either the legacy single
      // teacher_id or the full teacher_ids list.
      setEntries((routineRes.entries || []).filter(e =>
        e.teacher_id === teacherRecord.id ||
        (Array.isArray(e.teacher_ids) && e.teacher_ids.includes(teacherRecord.id))
      ));
    } else {
      setError(routineRes.offline ? 'Cannot reach server.' : routineRes.error || 'Failed to load routine.');
    }
    setLoading(false);
  };
  const printRef = useRef(null);

  const columns    = useMemo(() => buildColumns(settings), [settings]);
  const activeDays = useMemo(() => parseWorkingDays(settings?.classDay), [settings]);
  const entryMap   = useMemo(() => {
    const map = {};
    for (const e of entries) map[`${e.day_of_week}-${e.slot_id}`] = e;
    return map;
  }, [entries]);

  if (loading) {
    return <div className="td-loading"><div className="td-loading-spinner" />Loading routine…</div>;
  }

  return (
    <div>
      <h2 className="td-section-title">My Routine</h2>
      <p className="td-section-subtitle">
        Your personal class schedule{teacherRecord?.name ? ` — ${teacherRecord.name}` : ''}.
      </p>

      {error && <div className="td-alert error">{error}</div>}

      {!error && entries.length === 0 && (
        <div className="td-empty-state">
          <div className="td-empty-icon">📅</div>
          <p>No classes are assigned to you in the current routine.</p>
        </div>
      )}

      {!error && entries.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
          <button
            onClick={() => printRef.current && printCalendarNode(printRef.current, `My Routine - ${teacherRecord?.name || ''}`)}
            style={{
              padding: '7px 16px', border: '1.5px solid #1a3a52', background: '#1a3a52',
              color: '#fff', borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
            }}
          >
            ⬇ Download PDF
          </button>
        </div>
      )}

      {!error && entries.length > 0 && (
        <div className="td-routine-wrap" ref={printRef}>
          <table className="td-routine-table">
            <thead>
              <tr>
                <th>Day</th>
                {columns.map(col => (
                  <th key={col.slotId}>
                    {col.label}
                    <br />
                    <span style={{ fontSize: '10px', fontWeight: 400, opacity: 0.8 }}>{col.timeLabel}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activeDays.map(day => (
                <tr key={day}>
                  <td>{day}</td>
                  {columns.map(col => {
                    if (col.type === 'break') return <td key={col.slotId} className="td-break-cell">Break</td>;
                    const e = entryMap[`${day}-${col.slotId}`];
                    if (!e) return <td key={col.slotId} />;
                    const course = courseMap[e.course_id];
                    return (
                      <td key={col.slotId}>
                        <div className="td-cell-entry">
                          <div className="td-cell-course">{course?.code || e.course_id}</div>
                          <div className="td-cell-room">{e.room || '—'}</div>
                          <div className="td-cell-sem">{SEMESTER_LABELS[e.semester] || e.semester}</div>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default MyRoutine;
