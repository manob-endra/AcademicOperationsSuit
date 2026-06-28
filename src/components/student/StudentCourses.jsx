import { useState, useEffect, useMemo, useContext } from 'react';
import { AuthContext }           from '../../contexts/AuthContext';
import { studentAPI }            from '../../services/studentAPI';
import { routineAPI }            from '../../services/routineAPI';
import { courseAPI }             from '../../services/courseAPI';
import { teacherAPI }            from '../../services/teacherAPI';

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

const TYPE_STYLE = {
  theory: { bg: '#eff6ff', border: '#bfdbfe', badge: '#dbeafe', badgeText: '#1e40af', label: 'Theory' },
  lab:    { bg: '#f0fff4', border: '#bbf7d0', badge: '#d1fae5', badgeText: '#065f46', label: 'Lab'    },
  mixed:  { bg: '#fff7ed', border: '#fed7aa', badge: '#ffedd5', badgeText: '#9a3412', label: 'Mixed'  },
};

export default function StudentCourses() {
  const { user } = useContext(AuthContext);

  const [studentRecord, setStudentRecord] = useState(undefined);
  const [allEntries,    setAllEntries]    = useState([]);
  const [courseMap,     setCourseMap]     = useState({});
  const [teacherMap,    setTeacherMap]    = useState({});
  const [selectedSem,   setSelectedSem]   = useState('');
  const [loading,       setLoading]       = useState(true);

  useEffect(() => {
    if (user?.email) load(user.email);
    else setLoading(false);
  }, [user]);

  async function load(email) {
    setLoading(true);

    const [stuRes, routineRes, coursesRes, teachersRes] = await Promise.all([
      studentAPI.getStudentByEmail(email),
      routineAPI.getRoutine(),
      courseAPI.getAllCourses(),
      teacherAPI.getTeachers(),
    ]);

    const student = stuRes.success ? stuRes.data : null;
    setStudentRecord(student);

    if (coursesRes.success) {
      const cm = {};
      for (const c of (coursesRes.courses || [])) cm[c.id] = c;
      setCourseMap(cm);
    }

    if (teachersRes.success) {
      const tm = {};
      for (const t of (teachersRes.data || [])) tm[t.id] = t;
      setTeacherMap(tm);
    }

    if (routineRes.success) {
      const entries = routineRes.entries || [];
      setAllEntries(entries);

      // Auto-select first semester for this student's year
      const yr = student?.academic_year;
      if (yr) {
        const available = (YEAR_TO_SEMS[yr] || []).filter(s => entries.some(e => e.semester === s));
        if (available.length > 0) setSelectedSem(available[0]);
      }
    }

    setLoading(false);
  }

  const yr = studentRecord?.academic_year;

  const myYearSems = useMemo(() => {
    if (!yr) return [];
    return (YEAR_TO_SEMS[yr] || []).filter(s => allEntries.some(e => e.semester === s));
  }, [allEntries, yr]);

  // Build unique courses for the selected semester from routine entries
  const semCourses = useMemo(() => {
    if (!selectedSem) return [];
    const semEnts = allEntries.filter(e => e.semester === selectedSem);
    const seen = new Set();
    const result = [];
    for (const e of semEnts) {
      if (!e.course_id || seen.has(e.course_id)) continue;
      seen.add(e.course_id);
      const course = courseMap[e.course_id];
      if (!course) continue;

      // Gather all teachers for this course in this semester
      const teacherIds = [...new Set(
        semEnts.filter(x => x.course_id === e.course_id && x.teacher_id).map(x => x.teacher_id)
      )];
      const teachers = teacherIds.map(id => teacherMap[id]).filter(Boolean);
      result.push({ course, teachers });
    }
    // Sort: theory first, then lab, then by code
    result.sort((a, b) => {
      const typeOrder = { theory: 0, mixed: 1, lab: 2 };
      const to = (typeOrder[a.course.course_type] ?? 1) - (typeOrder[b.course.course_type] ?? 1);
      if (to !== 0) return to;
      return (a.course.code || '').localeCompare(b.course.code || '');
    });
    return result;
  }, [allEntries, selectedSem, courseMap, teacherMap]);

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div>
        <h2 className="sd-section-title">My Courses</h2>
        <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>
          Loading your courses…
        </div>
      </div>
    );
  }

  const yearLabel = yr ? `${yr.charAt(0).toUpperCase() + yr.slice(1)} Year` : '';

  // ── Not registered ────────────────────────────────────────────────────────────
  if (studentRecord === null) {
    return (
      <div>
        <h2 className="sd-section-title">My Courses</h2>
        <div style={{ textAlign: 'center', padding: '56px 20px', color: '#9ca3af' }}>
          <div style={{ fontSize: 52, marginBottom: 14 }}>📚</div>
          <p style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 600, color: '#374151' }}>
            Student record not linked
          </p>
          <p style={{ margin: 0, fontSize: 13, color: '#6b7280', maxWidth: 360, marginInline: 'auto' }}>
            Your institutional email <strong>{user?.email}</strong> is not registered in the student database.
            Please contact the admin to add your account.
          </p>
        </div>
      </div>
    );
  }

  // ── No courses published yet ──────────────────────────────────────────────────
  if (myYearSems.length === 0) {
    return (
      <div>
        <h2 className="sd-section-title">
          My Courses
          {yearLabel && (
            <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: '#dbeafe', color: '#1e40af', marginLeft: 10 }}>
              {yearLabel}
            </span>
          )}
        </h2>
        <p className="sd-section-subtitle">{studentRecord.name}</p>
        <div style={{ textAlign: 'center', padding: '56px 20px' }}>
          <div style={{ fontSize: 52, marginBottom: 14 }}>📚</div>
          <p style={{ margin: 0, fontSize: 14, color: '#6b7280' }}>
            No course schedule has been published for <strong>{yearLabel}</strong> yet.
          </p>
        </div>
      </div>
    );
  }

  const theoryCount = semCourses.filter(x => x.course.course_type !== 'lab').length;
  const labCount    = semCourses.filter(x => x.course.course_type === 'lab').length;

  // ── Course cards ──────────────────────────────────────────────────────────────
  return (
    <div style={{ paddingBottom: 32 }}>
      <h2 className="sd-section-title">
        My Courses
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Semester:</span>
          {myYearSems.map(s => (
            <button
              key={s}
              onClick={() => setSelectedSem(s)}
              style={{
                padding: '6px 16px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                cursor: 'pointer', border: '1.5px solid',
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

      {/* Summary bar */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          ['Total Courses', semCourses.length, '#f1f5f9', '#1e3a5f'],
          ['Theory',        theoryCount,       '#dbeafe', '#1e40af'],
          ['Lab',           labCount,          '#d1fae5', '#065f46'],
        ].map(([lbl, val, bg, clr]) => (
          <div key={lbl} style={{ background: bg, borderRadius: 10, padding: '10px 18px', minWidth: 90, textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: clr }}>{val}</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: clr }}>{lbl}</div>
          </div>
        ))}
      </div>

      {/* Course cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 14 }}>
        {semCourses.map(({ course, teachers }) => {
          const ts = TYPE_STYLE[course.course_type] || TYPE_STYLE.theory;
          return (
            <div
              key={course.id}
              style={{
                background: ts.bg,
                border: `1.5px solid ${ts.border}`,
                borderRadius: 12,
                padding: '16px 18px',
              }}
            >
              {/* Code + type badge */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: '#1a3a52', letterSpacing: .3 }}>
                  {course.code}
                </span>
                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: ts.badge, color: ts.badgeText, whiteSpace: 'nowrap' }}>
                  {ts.label}
                </span>
              </div>

              {/* Title */}
              <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 10, lineHeight: 1.4 }}>
                {course.title}
              </div>

              {/* Credit hours */}
              {course.credit_hours && (
                <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 8 }}>
                  Credit hours: <strong style={{ color: '#374151' }}>{course.credit_hours}</strong>
                </div>
              )}

              {/* Teachers */}
              {teachers.length > 0 && (
                <div style={{ borderTop: `1px solid ${ts.border}`, paddingTop: 10, marginTop: 4 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 6 }}>
                    {course.course_type === 'lab' ? 'Lab Teacher' : 'Course Teacher'}{teachers.length > 1 ? 's' : ''}
                  </div>
                  {teachers.map(t => (
                    <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ width: 26, height: 26, borderRadius: '50%', background: '#1a3a52', color: 'white', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
                        {t.initials || t.name?.split(' ').map(w=>w[0]).join('').slice(0,2) || '?'}
                      </span>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>{t.name}</div>
                        {t.designation && <div style={{ fontSize: 10, color: '#9ca3af' }}>{t.designation}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
