import { useState, useEffect, useMemo } from 'react';
import { useContext } from 'react';
import { AuthContext }            from '../../contexts/AuthContext';
import { studentAPI }             from '../../services/studentAPI';
import { routineAPI }             from '../../services/routineAPI';
import { courseAPI }              from '../../services/courseAPI';
import { teacherAPI }             from '../../services/teacherAPI';
import { classTimeSettingsAPI }   from '../../services/classTimeSettingsAPI';

const WEEK_DAYS = ['Saturday','Sunday','Monday','Tuesday','Wednesday','Thursday','Friday'];

// student.academic_year → routine semester keys
const YEAR_TO_SEMS = {
  '1st': ['Y1-S1','Y1-S2'],
  '2nd': ['Y2-S1','Y2-S2'],
  '3rd': ['Y3-S1','Y3-S2'],
  '4th': ['Y4-S1','Y4-S2'],
  'ms':  ['MS-S1','MS-S2'],
};
const SEM_LABEL = {
  'Y1-S1':'1st Year · 1st Semester', 'Y1-S2':'1st Year · 2nd Semester',
  'Y2-S1':'2nd Year · 1st Semester', 'Y2-S2':'2nd Year · 2nd Semester',
  'Y3-S1':'3rd Year · 1st Semester', 'Y3-S2':'3rd Year · 2nd Semester',
  'Y4-S1':'4th Year · 1st Semester', 'Y4-S2':'4th Year · 2nd Semester',
  'MS-S1':'MS · 1st Semester',       'MS-S2':'MS · 2nd Semester',
};

// ── time helpers ──────────────────────────────────────────────────────────────
function parseMin(t) {
  if (!t) return 8 * 60 + 30;
  const [h, m] = String(t).split(':').map(Number);
  return h * 60 + (m || 0);
}
function parseDur(v, fb) {
  if (!v) return fb;
  const s = String(v);
  if (s.includes(':')) { const [h, m] = s.split(':').map(Number); return h * 60 + (m || 0); }
  return parseInt(s) || fb;
}
function toLabel(m) {
  const h = Math.floor(m / 60), mn = m % 60;
  const ap = h >= 12 ? 'PM' : 'AM', h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${h12}:${String(mn).padStart(2,'0')} ${ap}`;
}
function buildCols(s) {
  if (!s) return [];
  const before = parseInt(s.classesBeforeLunch) || 0;
  const after  = parseInt(s.classesAfterLunch)  || 0;
  const dur    = parseDur(s.duration, 90);
  const skip   = parseInt(s.skipTime) || 0;
  const lunch  = parseDur(s.lunchDuration, 60);
  let cur = parseMin(s.startTime);
  const cols = [];
  for (let i = 0; i < before; i++) {
    const end = cur + dur;
    cols.push({ type:'class', slotId:`s${i+1}`, label:`P${i+1}`, time:`${toLabel(cur)} – ${toLabel(end)}` });
    cur = i < before - 1 ? end + skip : end;
  }
  if (before > 0 && lunch > 0) {
    const be = cur + lunch;
    cols.push({ type:'break', slotId:'lunch', label:'Break', time:`${toLabel(cur)} – ${toLabel(be)}` });
    cur = be;
  }
  for (let i = 0; i < after; i++) {
    const end = cur + dur;
    cols.push({ type:'class', slotId:`s${before+1+i}`, label:`P${before+1+i}`, time:`${toLabel(cur)} – ${toLabel(end)}` });
    cur = end + skip;
  }
  return cols;
}
function parseWorkDays(str) {
  if (!str) return [];
  const parts = str.split('-').map(s => s.trim());
  if (parts.length < 2) return [];
  const si = WEEK_DAYS.indexOf(parts[0]), ei = WEEK_DAYS.indexOf(parts[1]);
  if (si === -1 || ei === -1) return [];
  const days = []; let c = si;
  while (true) { days.push(WEEK_DAYS[c]); if (c === ei) break; c = (c+1) % WEEK_DAYS.length; }
  return days;
}

export default function StudentRoutine() {
  const { user } = useContext(AuthContext);

  const [studentRecord, setStudentRecord] = useState(undefined); // undefined = loading
  const [allEntries,    setAllEntries]    = useState([]);
  const [courseMap,     setCourseMap]     = useState({});
  const [teacherMap,    setTeacherMap]    = useState({});
  const [settings,      setSettings]      = useState(null);
  const [selectedSem,   setSelectedSem]   = useState('');
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState('');

  useEffect(() => {
    if (user?.email) load(user.email);
    else setLoading(false);
  }, [user]);

  async function load(email) {
    setLoading(true);
    setError('');

    // No semester context of our own — find it from the most recently
    // published routine, then load that semester's settings/teachers.
    const [stuRes, coursesRes, routineRes] = await Promise.all([
      studentAPI.getStudentByEmail(email),
      courseAPI.getAllCourses(),
      routineAPI.getPublishedRoutine(),
    ]);

    // Student record
    setStudentRecord(stuRes.success ? (stuRes.data || null) : null);

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

      // Auto-select first semester with entries for this student's year
      const yr = stuRes.data?.academic_year;
      if (yr) {
        const yearSems = YEAR_TO_SEMS[yr] || [];
        const available = yearSems.filter(s => entries.some(e => e.semester === s));
        if (available.length > 0) setSelectedSem(available[0]);
      }
    } else {
      setError(routineRes.offline ? 'Cannot reach server.' : (routineRes.error || 'Failed to load routine.'));
    }

    setLoading(false);
  }

  const cols      = useMemo(() => buildCols(settings), [settings]);
  const workDays  = useMemo(() => parseWorkDays(settings?.classDay), [settings]);

  // Semesters relevant to this student that have entries in the routine
  const myYearSems = useMemo(() => {
    const yr = studentRecord?.academic_year;
    if (!yr) return [];
    return (YEAR_TO_SEMS[yr] || []).filter(s => allEntries.some(e => e.semester === s));
  }, [allEntries, studentRecord]);

  const semEntries = useMemo(
    () => allEntries.filter(e => e.semester === selectedSem),
    [allEntries, selectedSem]
  );

  // Build entry map: "day-slotId" → entry[]  (multiple courses can share a slot)
  const entryMap = useMemo(() => {
    const m = {};
    for (const e of semEntries) {
      const k = `${e.day_of_week}-${e.slot_id}`;
      if (!m[k]) m[k] = [];
      m[k].push(e);
    }
    return m;
  }, [semEntries]);

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div>
        <h2 className="sd-section-title">My Routine</h2>
        <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>
          Loading your routine…
        </div>
      </div>
    );
  }

  // ── Student not found in system ──────────────────────────────────────────────
  if (studentRecord === null) {
    return (
      <div>
        <h2 className="sd-section-title">My Routine</h2>
        <div style={{ textAlign: 'center', padding: '56px 20px', color: '#9ca3af' }}>
          <div style={{ fontSize: 52, marginBottom: 14 }}>🎓</div>
          <p style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 600, color: '#374151' }}>
            Student record not linked
          </p>
          <p style={{ margin: 0, fontSize: 13, color: '#6b7280', maxWidth: 340, marginLeft: 'auto', marginRight: 'auto' }}>
            Your institutional email <strong>{user?.email}</strong> is not yet registered in the student database.
            Please contact the admin to add your account.
          </p>
        </div>
      </div>
    );
  }

  const yr = studentRecord?.academic_year;
  const yearLabel = yr ? `${yr.charAt(0).toUpperCase() + yr.slice(1)} Year` : '';

  // ── No routine published for this year yet ───────────────────────────────────
  if (myYearSems.length === 0) {
    return (
      <div>
        <h2 className="sd-section-title">
          My Routine
          {yearLabel && (
            <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: '#dbeafe', color: '#1e40af', marginLeft: 10 }}>
              {yearLabel}
            </span>
          )}
        </h2>
        <p className="sd-section-subtitle">
          {studentRecord.name} · {studentRecord.session ? `Session ${studentRecord.session}` : ''}
        </p>
        <div style={{ textAlign: 'center', padding: '56px 20px' }}>
          <div style={{ fontSize: 52, marginBottom: 14 }}>📅</div>
          <p style={{ margin: 0, fontSize: 14, color: '#6b7280' }}>
            No routine has been published for <strong>{yearLabel}</strong> yet.
            You will receive an email notification once it is available.
          </p>
        </div>
      </div>
    );
  }

  // ── Routine table ─────────────────────────────────────────────────────────────
  return (
    <div style={{ paddingBottom: 32 }}>
      <h2 className="sd-section-title">
        My Routine
        {yearLabel && (
          <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: '#dbeafe', color: '#1e40af', marginLeft: 10 }}>
            {yearLabel}
          </span>
        )}
      </h2>
      <p className="sd-section-subtitle">
        {studentRecord.name}
        {studentRecord.session ? ` · Session ${studentRecord.session}` : ''}
      </p>

      {/* Semester selector */}
      {myYearSems.length > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Semester:</span>
          {myYearSems.map(s => (
            <button
              key={s}
              onClick={() => setSelectedSem(s)}
              style={{
                padding: '6px 16px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                cursor: 'pointer', transition: 'all .15s',
                border: '1.5px solid',
                borderColor:  selectedSem === s ? '#1a3a52' : '#d1d5db',
                background:   selectedSem === s ? '#1a3a52' : 'white',
                color:        selectedSem === s ? 'white'   : '#374151',
              }}
            >
              {SEM_LABEL[s] || s}
            </button>
          ))}
        </div>
      )}

      {error && (
        <div style={{ background: '#fef2f2', color: '#dc2626', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 13 }}>
          {error}
        </div>
      )}

      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 12 }}>
        <strong>{SEM_LABEL[selectedSem] || selectedSem}</strong>
        {' · '}{semEntries.length} class slot{semEntries.length !== 1 ? 's' : ''}
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              <th style={{ background: '#1a3a52', color: 'white', padding: '10px 14px', textAlign: 'left', fontWeight: 700, fontSize: 12, border: '1px solid #1e4a6e', minWidth: 90 }}>
                Day
              </th>
              {cols.map(col => (
                <th key={col.slotId} style={{ background: '#1a3a52', color: 'white', padding: '8px 10px', textAlign: 'center', fontWeight: 700, fontSize: 11, border: '1px solid #1e4a6e', minWidth: 90 }}>
                  {col.label}
                  <span style={{ display: 'block', fontWeight: 400, fontSize: 9, opacity: .78, marginTop: 2 }}>{col.time}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {workDays.map(day => (
              <tr key={day}>
                <td style={{ background: '#f8fafc', padding: '10px 14px', fontWeight: 700, fontSize: 12, color: '#1a3a52', border: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>
                  {day}
                </td>
                {cols.map(col => {
                  if (col.type === 'break') {
                    return (
                      <td key={col.slotId} style={{ background: '#f0f4f8', border: '1px solid #e5e7eb', textAlign: 'center', color: '#9ca3af', fontSize: 11, padding: 6 }}>
                        Break
                      </td>
                    );
                  }
                  const cellEnts = entryMap[`${day}-${col.slotId}`] || [];
                  if (!cellEnts.length) {
                    return <td key={col.slotId} style={{ border: '1px solid #e5e7eb', padding: 6 }} />;
                  }
                  return (
                    <td key={col.slotId} style={{ border: '1px solid #e5e7eb', padding: '6px 8px', verticalAlign: 'top' }}>
                      {cellEnts.map((e, i) => {
                        const course  = courseMap[e.course_id];
                        const teacher = teacherMap[e.teacher_id];
                        const isLab   = course?.course_type === 'lab';
                        return (
                          <div
                            key={i}
                            style={{
                              background:   isLab ? '#f0fff4' : '#eff6ff',
                              border:       `1px solid ${isLab ? '#bbf7d0' : '#bfdbfe'}`,
                              borderRadius: 6,
                              padding:      '5px 8px',
                              marginBottom: i < cellEnts.length - 1 ? 4 : 0,
                            }}
                          >
                            <div style={{ fontSize: 12, fontWeight: 700, color: '#1a3a52', display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                              {course?.code || '?'}
                              {isLab && (
                                <span style={{ fontSize: 9, background: '#d1fae5', color: '#065f46', padding: '1px 5px', borderRadius: 4, fontWeight: 600 }}>
                                  LAB
                                </span>
                              )}
                            </div>
                            {course?.title && (
                              <div style={{ fontSize: 10, color: '#6b7280', marginTop: 1, lineHeight: 1.3 }}>{course.title}</div>
                            )}
                            <div style={{ fontSize: 10, color: '#374151', marginTop: 3 }}>
                              {teacher?.name || teacher?.initials || '—'}
                              {e.room ? ` · Rm ${e.room}` : ''}
                            </div>
                          </div>
                        );
                      })}
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
}
