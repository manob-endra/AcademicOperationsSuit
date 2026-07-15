import { useState, useEffect, useContext } from 'react';
import { AuthContext }    from '../../contexts/AuthContext';
import { studentAPI }     from '../../services/studentAPI';
import { examRoutineAPI } from '../../services/examRoutineAPI';

const YEAR_TO_SEMS = {
  '1st': ['Y1-S1','Y1-S2'], '2nd': ['Y2-S1','Y2-S2'],
  '3rd': ['Y3-S1','Y3-S2'], '4th': ['Y4-S1','Y4-S2'], 'ms': ['MS-S1','MS-S2'],
};

const SEM_FULL = {
  'Y1-S1':'1st Year 1st Semester', 'Y1-S2':'1st Year 2nd Semester',
  'Y2-S1':'2nd Year 1st Semester', 'Y2-S2':'2nd Year 2nd Semester',
  'Y3-S1':'3rd Year 1st Semester', 'Y3-S2':'3rd Year 2nd Semester',
  'Y4-S1':'4th Year 1st Semester', 'Y4-S2':'4th Year 2nd Semester',
  'MS-S1':'MS 1st Semester',       'MS-S2':'MS 2nd Semester',
};

function fmtDate(d) {
  if (!d) return '';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
}
function fmtTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ap = h >= 12 ? 'PM' : 'AM', h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${h12}:${String(m).padStart(2, '0')} ${ap}`;
}

export default function StudentExamRoutine() {
  const { user } = useContext(AuthContext);
  const [studentRecord, setStudentRecord] = useState(undefined);
  const [courses,       setCourses]       = useState({});
  const [selectedSem,   setSelectedSem]   = useState('');
  const [examType,      setExamType]      = useState('incourse');
  const [sessionData,   setSessionData]   = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [loadingExam,   setLoadingExam]   = useState(false);

  // ── Initial load: student record + courses + auto-select semester ─────────────
  useEffect(() => {
    if (!user?.email) { setLoading(false); return; }
    (async () => {
      const [stuRes, coursesRes, pubRes] = await Promise.all([
        studentAPI.getStudentByEmail(user.email),
        fetch(`${import.meta.env.VITE_API_URL}/courses`).then(r => r.json()).catch(() => ({})),
        examRoutineAPI.getAllPublished('incourse'),
      ]);

      const student = stuRes.success ? stuRes.data : null;
      setStudentRecord(student);

      const courseMap = {};
      for (const c of (coursesRes.data || coursesRes.courses || [])) courseMap[c.id] = c;
      setCourses(courseMap);

      // Auto-select: prefer the semester that already has a published incourse routine
      if (student?.academic_year) {
        const yearSems  = YEAR_TO_SEMS[student.academic_year] || [];
        const pubSemIds = new Set((pubRes.data || []).map(s => s.semester_id));
        const best      = yearSems.find(s => pubSemIds.has(s)) || yearSems[0] || '';
        setSelectedSem(best);
      }

      setLoading(false);
    })();
  }, [user]);

  // ── Fetch published session whenever semester or type changes ─────────────────
  useEffect(() => {
    if (!selectedSem) return;
    setLoadingExam(true);
    setSessionData(null);
    examRoutineAPI.getPublished(examType, selectedSem).then(res => {
      setSessionData(res.success && res.data ? res.data : null);
      setLoadingExam(false);
    });
  }, [selectedSem, examType]);

  // ── Loading / no-record states ────────────────────────────────────────────────
  if (loading) {
    return (
      <div>
        <h2 className="sd-section-title">Exam Schedule</h2>
        <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>Loading…</div>
      </div>
    );
  }

  if (studentRecord === null) {
    return (
      <div>
        <h2 className="sd-section-title">Exam Schedule</h2>
        <div style={{ textAlign: 'center', padding: '56px 20px', color: '#9ca3af' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📝</div>
          <p style={{ fontSize: 14, color: '#374151', fontWeight: 600, margin: '0 0 6px' }}>Student record not linked</p>
          <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>
            Your institutional email <strong>{user?.email}</strong> is not registered. Please contact the admin.
          </p>
        </div>
      </div>
    );
  }

  const yr       = studentRecord?.academic_year;
  const yearLabel = yr ? `${yr.charAt(0).toUpperCase() + yr.slice(1)} Year` : '';
  const yearSems  = YEAR_TO_SEMS[yr || ''] || [];
  const slots     = sessionData?.slots || [];

  return (
    <div style={{ paddingBottom: 32 }}>
      <h2 className="sd-section-title">
        Exam Schedule
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

      {/* ── Controls ── */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 20 }}>
        {/* Incourse / Final toggle */}
        <div style={{ display: 'flex', gap: 0, border: '1.5px solid #d1d5db', borderRadius: 8, overflow: 'hidden' }}>
          {[['incourse','Incourse'],['final','Final']].map(([k, lbl]) => (
            <button key={k} onClick={() => setExamType(k)} style={{
              padding: '7px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none',
              background: examType === k ? '#1a3a52' : 'white',
              color:      examType === k ? 'white'   : '#374151',
            }}>{lbl} Exam</button>
          ))}
        </div>

        {/* Semester selector — only shown if student has multiple semesters */}
        {yearSems.length > 1 && (
          <select value={selectedSem} onChange={e => setSelectedSem(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 8, border: '1.5px solid #d1d5db', fontSize: 13, background: 'white', color: '#111827' }}>
            {yearSems.map(s => <option key={s} value={s}>{SEM_FULL[s] || s}</option>)}
          </select>
        )}

        {selectedSem && (
          <span style={{ fontSize: 12, color: '#6b7280' }}>{SEM_FULL[selectedSem] || selectedSem}</span>
        )}
      </div>

      {/* ── Content ── */}
      {loadingExam ? (
        <div style={{ padding: 32, textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>Loading schedule…</div>
      ) : !sessionData || !slots.length ? (
        <div style={{ textAlign: 'center', padding: '56px 20px' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
          <p style={{ fontSize: 14, color: '#6b7280', margin: 0 }}>
            No {examType === 'final' ? 'final' : 'incourse'} exam schedule published yet
            {selectedSem ? ` for ${SEM_FULL[selectedSem] || selectedSem}` : ''}.
          </p>
        </div>
      ) : (
        <>
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 14 }}>
            Published {new Date(sessionData.published_at).toLocaleString()}
            {sessionData.title && <> · {sessionData.title}</>}
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#1a3a52', color: 'white' }}>
                  {['#', 'Date', 'Course Code', 'Course Title', 'Time', 'Room(s)'].map(h => (
                    <th key={h} style={{ padding: '9px 14px', textAlign: 'left', fontSize: 12, fontWeight: 700, border: '1px solid #1e4a6e', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...slots]
                  .sort((a, b) => {
                    if (a.exam_date !== b.exam_date) return a.exam_date < b.exam_date ? -1 : 1;
                    return a.start_time < b.start_time ? -1 : 1;
                  })
                  .map((slot, idx) => {
                    const course = courses[slot.course_id];
                    return (
                      <tr key={slot.id || idx} style={{ background: idx % 2 === 0 ? 'white' : '#f8fafc' }}>
                        <td style={{ padding: '10px 14px', border: '1px solid #e5e7eb', textAlign: 'center', fontWeight: 700, color: '#6b7280', width: 36 }}>
                          {idx + 1}
                        </td>
                        <td style={{ padding: '10px 14px', border: '1px solid #e5e7eb', fontWeight: 600, color: '#1a3a52', whiteSpace: 'nowrap' }}>
                          {fmtDate(slot.exam_date)}
                        </td>
                        <td style={{ padding: '10px 14px', border: '1px solid #e5e7eb', fontWeight: 700, color: '#374151' }}>
                          {course?.code || '—'}
                        </td>
                        <td style={{ padding: '10px 14px', border: '1px solid #e5e7eb', color: '#374151' }}>
                          {course?.title || '—'}
                        </td>
                        <td style={{ padding: '10px 14px', border: '1px solid #e5e7eb', whiteSpace: 'nowrap', color: '#374151' }}>
                          {fmtTime(slot.start_time)} – {fmtTime(slot.end_time)}
                        </td>
                        <td style={{ padding: '10px 14px', border: '1px solid #e5e7eb', color: '#6b7280' }}>
                          {slot.rooms || '—'}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
