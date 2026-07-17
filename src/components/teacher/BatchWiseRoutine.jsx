import { useState, useEffect, useMemo } from 'react';
import { routineAPI } from '../../services/routineAPI';
import { classTimeSettingsAPI } from '../../services/classTimeSettingsAPI';
import { courseAPI } from '../../services/courseAPI';
import { teacherAPI } from '../../services/teacherAPI';

const WEEK_DAYS = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const SEMESTER_LABELS = {
  'Y1-S1': '1st Year / 1st Semester', 'Y1-S2': '1st Year / 2nd Semester',
  'Y2-S1': '2nd Year / 1st Semester', 'Y2-S2': '2nd Year / 2nd Semester',
  'Y3-S1': '3rd Year / 1st Semester', 'Y3-S2': '3rd Year / 2nd Semester',
  'Y4-S1': '4th Year / 1st Semester', 'Y4-S2': '4th Year / 2nd Semester',
  'MS-S1': 'MS / 1st Semester',       'MS-S2': 'MS / 2nd Semester',
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

function BatchWiseRoutine() {
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [settings, setSettings] = useState(null);
  const [allEntries, setAllEntries] = useState([]);
  const [courseMap, setCourseMap]   = useState({});
  const [teacherMap, setTeacherMap] = useState({});
  const [selectedSem, setSelectedSem] = useState('');

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    setError('');

    // No semester context of our own — find it from the most recently
    // published routine, then load that semester's settings/teachers.
    const [routineRes, coursesRes] = await Promise.all([
      routineAPI.getPublishedRoutine(),
      courseAPI.getAllCourses(),
    ]);

    if (coursesRes.success) {
      const cm = {};
      for (const c of (coursesRes.courses || [])) cm[c.id] = c;
      setCourseMap(cm);
    }

    const semesterId = routineRes.success ? routineRes.semesterId : null;
    const [settingsRes, teachersRes] = semesterId
      ? await Promise.all([
          classTimeSettingsAPI.getSettings(semesterId),
          teacherAPI.getTeachers(semesterId),
        ])
      : [{ success: false }, { success: false }];

    if (settingsRes.success) setSettings(settingsRes.data);

    if (teachersRes.success) {
      const tm = {};
      for (const t of (teachersRes.data || [])) tm[t.id] = t;
      setTeacherMap(tm);
    }

    if (routineRes.success) {
      const entries = routineRes.entries || [];
      setAllEntries(entries);
      // Default to first semester in routine
      const sems = [...new Set(entries.map(e => e.semester))].sort();
      if (sems.length > 0) setSelectedSem(sems[0]);
    } else {
      setError(routineRes.offline ? 'Cannot reach server.' : routineRes.error || 'Failed to load routine.');
    }

    setLoading(false);
  };

  const columns   = useMemo(() => buildColumns(settings), [settings]);
  const activeDays = useMemo(() => parseWorkingDays(settings?.classDay), [settings]);

  const semesters = useMemo(
    () => [...new Set(allEntries.map(e => e.semester))].sort(),
    [allEntries]
  );

  const semEntries = useMemo(
    () => allEntries.filter(e => e.semester === selectedSem),
    [allEntries, selectedSem]
  );

  const entryMap = useMemo(() => {
    const map = {};
    for (const e of semEntries) map[`${e.day_of_week}-${e.slot_id}`] = e;
    return map;
  }, [semEntries]);

  if (loading) {
    return (
      <div className="td-loading">
        <div className="td-loading-spinner" />
        Loading routine…
      </div>
    );
  }

  return (
    <div>
      <h2 className="td-section-title">Batch Wise Routine</h2>
      <p className="td-section-subtitle">View the class schedule for a specific student batch.</p>

      {error && <div className="td-alert error">{error}</div>}

      {!error && semesters.length === 0 && (
        <div className="td-empty-state">
          <div className="td-empty-icon">📅</div>
          <p>No routine has been generated yet. Ask the admin to generate the routine.</p>
        </div>
      )}

      {semesters.length > 0 && (
        <>
          <div className="td-filter-bar">
            <span className="td-filter-label">Select Batch:</span>
            <select
              className="td-filter-select"
              value={selectedSem}
              onChange={e => setSelectedSem(e.target.value)}
            >
              {semesters.map(s => (
                <option key={s} value={s}>{SEMESTER_LABELS[s] || s}</option>
              ))}
            </select>
          </div>

          <div className="td-routine-wrap">
            <table className="td-routine-table">
              <thead>
                <tr>
                  <th>Day</th>
                  {columns.map(col => (
                    <th key={col.slotId}>
                      {col.label}
                      <br />
                      <span style={{ fontSize: '10.5px', fontWeight: 400, opacity: 0.8 }}>{col.timeLabel}</span>
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
                      const course  = courseMap[e.course_id];
                      const teacher = teacherMap[e.teacher_id];
                      return (
                        <td key={col.slotId}>
                          <div className="td-cell-entry">
                            <div className="td-cell-course">
                              {course?.code || e.course_id}
                            </div>
                            <div className="td-cell-room">
                              {teacher?.initials || teacher?.name || '—'} &bull; {e.room || '—'}
                            </div>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

export default BatchWiseRoutine;
