import { useState, useEffect, useContext, useRef } from 'react';
import { AuthContext }    from '../../contexts/AuthContext';
import { examRoutineAPI } from '../../services/examRoutineAPI';
import IncourseDocument   from '../routineManagement/IncourseDocument';
import { printCalendarNode } from '../academicCalendar/printCalendar';

const SEMESTERS_API = `${import.meta.env.VITE_API_URL}/academic-semesters`;

function fmtDate(d) {
  if (!d) return '';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}
function fmtTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ap = h >= 12 ? 'PM' : 'AM', h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${h12}:${String(m).padStart(2, '0')} ${ap}`;
}

export default function TeacherExamRoutine({ teacherRecord }) {
  const { user } = useContext(AuthContext);

  const [semesters,   setSemesters]   = useState([]);
  const [selectedSem, setSelectedSem] = useState('');
  const [examType,    setExamType]    = useState('incourse');
  const [sessionData, setSessionData] = useState(null);
  const [courses,     setCourses]     = useState({});
  const [loading,     setLoading]     = useState(true);
  const [loadingExam, setLoadingExam] = useState(false);

  useEffect(() => {
    (async () => {
      const [semRes, coursesRes] = await Promise.all([
        fetch(SEMESTERS_API).then(r => r.json()).catch(() => ({ data: [] })),
        fetch(`${import.meta.env.VITE_API_URL}/courses`).then(r => r.json()).catch(() => ({ courses: [] })),
      ]);
      if (semRes.data) setSemesters(semRes.data);
      const cm = {};
      for (const c of (coursesRes.data || coursesRes.courses || [])) cm[c.id] = c;
      setCourses(cm);
      if (semRes.data?.length) setSelectedSem(semRes.data[0].id);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!selectedSem) return;
    setLoadingExam(true);
    examRoutineAPI.getPublished(examType, selectedSem).then(res => {
      setSessionData(res.success ? res.data : null);
      setLoadingExam(false);
    });
  }, [selectedSem, examType]);

  const teacherId = teacherRecord?.id;
  const slots = sessionData?.slots || [];
  const printRef = useRef(null);

  // Teacher names for the invigilator column (returned with the published session)
  const teacherMap = {};
  for (const t of (sessionData?.teachers || [])) teacherMap[t.id] = t;

  // Teacher sees all slots but their duties are highlighted
  const mySlotIds = new Set(
    slots.flatMap(s => s.invigilators || [])
      .filter(i => i.teacher_id === teacherId)
      .map(i => i.slot_id)
  );

  if (loading) {
    return (
      <div>
        <h2 className="td-section-title">Exam Schedule</h2>
        <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>Loading…</div>
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: 32 }}>
      <h2 className="td-section-title">Exam Schedule</h2>
      <p className="td-section-subtitle">
        {teacherRecord?.name || ''}
        {mySlotIds.size > 0 && (
          <span style={{ marginLeft: 10, fontSize: 12, background: '#d1fae5', color: '#065f46', padding: '2px 8px', borderRadius: 10, fontWeight: 700 }}>
            {mySlotIds.size} invigilation {mySlotIds.size === 1 ? 'duty' : 'duties'}
          </span>
        )}
      </p>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 0, border: '1.5px solid #d1d5db', borderRadius: 8, overflow: 'hidden' }}>
          {[['incourse','Incourse'],['final','Final']].map(([k, lbl]) => (
            <button key={k} onClick={() => setExamType(k)} style={{
              padding: '7px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none',
              background: examType === k ? '#1a3a52' : 'white',
              color:      examType === k ? 'white'   : '#374151',
            }}>{lbl} Exam</button>
          ))}
        </div>

        <select value={selectedSem} onChange={e => setSelectedSem(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: 8, border: '1.5px solid #d1d5db', fontSize: 13, background: 'white', color: '#111827' }}>
          <option value=''>— Select semester —</option>
          {semesters.map(s => <option key={s.id} value={s.id}>{s.name} {s.year}</option>)}
        </select>

        {slots.length > 0 && (
          <button
            onClick={() => printRef.current && printCalendarNode(printRef.current, `${examType === 'final' ? 'Final' : 'Incourse'} Exam Routine`)}
            style={{ marginLeft: 'auto', padding: '7px 16px', border: '1.5px solid #1a3a52', background: '#1a3a52', color: '#fff', borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}
          >
            ⬇ Download PDF
          </button>
        )}
      </div>

      {/* Hidden official-format notice used for the PDF download */}
      {slots.length > 0 && (
        <div style={{ position: 'absolute', left: -99999, top: 0, width: 760 }} aria-hidden="true">
          <div ref={printRef}>
            <IncourseDocument
              batchLabel={sessionData?.title || 'In-course Examination'}
              slots={slots}
              courseMap={courses}
              teacherMap={teacherMap}
              noticeDate={sessionData?.published_at?.slice(0, 10)}
            />
          </div>
        </div>
      )}

      {loadingExam ? (
        <div style={{ padding: 32, textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>Loading schedule…</div>
      ) : !sessionData ? (
        <div style={{ textAlign: 'center', padding: '56px 20px' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
          <p style={{ fontSize: 14, color: '#6b7280', margin: 0 }}>
            No {examType} exam schedule has been published for this semester.
          </p>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: '#6b7280' }}>
              Published {new Date(sessionData.published_at).toLocaleString()}
            </span>
            {mySlotIds.size > 0 && (
              <span style={{ fontSize: 12, background: '#d1fae5', color: '#065f46', padding: '3px 10px', borderRadius: 10, fontWeight: 600 }}>
                ★ highlighted rows = your invigilation duties
              </span>
            )}
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#1a3a52', color: 'white' }}>
                  {['Date','Course Code','Course Title','Time','Room(s)','Your Duty'].map(h => (
                    <th key={h} style={{ padding: '9px 14px', textAlign: 'left', fontSize: 12, fontWeight: 700, border: '1px solid #1e4a6e' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...slots].sort((a, b) => {
                  if (a.exam_date !== b.exam_date) return a.exam_date < b.exam_date ? -1 : 1;
                  return a.start_time < b.start_time ? -1 : 1;
                }).map((slot, idx) => {
                  const course = courses[slot.course_id];
                  const isMyDuty = mySlotIds.has(slot.id);
                  const isCourseTeacher = (slot.invigilators || []).some(i => i.teacher_id === teacherId && i.is_course_teacher);
                  return (
                    <tr key={slot.id || idx} style={{ background: isMyDuty ? '#f0fdf4' : idx % 2 === 0 ? 'white' : '#f8fafc' }}>
                      <td style={{ padding: '10px 14px', border: '1px solid #e5e7eb', fontWeight: isMyDuty ? 700 : 400, color: '#1a3a52', whiteSpace: 'nowrap' }}>
                        {fmtDate(slot.exam_date)}
                      </td>
                      <td style={{ padding: '10px 14px', border: '1px solid #e5e7eb', fontWeight: 700 }}>
                        {course?.code || '—'}
                      </td>
                      <td style={{ padding: '10px 14px', border: '1px solid #e5e7eb' }}>
                        {course?.title || '—'}
                      </td>
                      <td style={{ padding: '10px 14px', border: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>
                        {fmtTime(slot.start_time)} – {fmtTime(slot.end_time)}
                      </td>
                      <td style={{ padding: '10px 14px', border: '1px solid #e5e7eb', color: '#6b7280' }}>
                        {slot.rooms || '—'}
                      </td>
                      <td style={{ padding: '10px 14px', border: '1px solid #e5e7eb', textAlign: 'center' }}>
                        {isMyDuty ? (
                          <span style={{ fontSize: 11, fontWeight: 700, background: isCourseTeacher ? '#dbeafe' : '#d1fae5', color: isCourseTeacher ? '#1e40af' : '#065f46', padding: '2px 8px', borderRadius: 10 }}>
                            {isCourseTeacher ? 'Course Teacher' : '★ Invigilator'}
                          </span>
                        ) : '—'}
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
