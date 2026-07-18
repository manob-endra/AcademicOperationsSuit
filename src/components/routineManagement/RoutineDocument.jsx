import { useMemo } from 'react';
import './RoutineDocument.css';

/**
 * Official class-routine document, matching the department's published
 * format: DU header, title lines, day-rows × time-columns grid with the
 * break column, Course / Course Teacher tables (theory + lab separately)
 * and the chairman signature block.
 *
 * Used by the admin preview + download, and by student/teacher downloads.
 *
 * Props:
 *   batchId      'Y4-S1'
 *   entries      routine entries for THIS batch only
 *   columns      [{ type:'class'|'break', slotId, label, timeLabel }]
 *   days         working day names
 *   courseMap    { id: course }
 *   teacherMap   { id: teacher }
 *   semesterLabel  academic semester label e.g. 'Fall 2026'
 *   roomNo       optional fixed room number for the batch
 */

const BATCH_TITLES = {
  'Y1-S1': '1st Year 1st Semester', 'Y1-S2': '1st Year 2nd Semester',
  'Y2-S1': '2nd Year 1st Semester', 'Y2-S2': '2nd Year 2nd Semester',
  'Y3-S1': '3rd Year 1st Semester', 'Y3-S2': '3rd Year 2nd Semester',
  'Y4-S1': '4th Year 1st Semester', 'Y4-S2': '4th Year 2nd Semester',
  'MS-S1': 'MS 1st Semester',       'MS-S2': 'MS 2nd Semester',
};

export default function RoutineDocument({
  batchId, entries, columns, days, courseMap, teacherMap, semesterLabel, roomNo,
}) {
  // "day-slot" → entries (a cell can hold Group A of one lab + Group B of another)
  const cellMap = useMemo(() => {
    const m = {};
    for (const e of entries) {
      const k = `${e.day_of_week}-${e.slot_id}`;
      if (!m[k]) m[k] = [];
      m[k].push(e);
    }
    return m;
  }, [entries]);

  const teacherInitials = (tid) => teacherMap[tid]?.initials || teacherMap[tid]?.name || '?';
  const entryTeacherIds = (e) => (e.teacher_ids?.length ? e.teacher_ids : (e.teacher_id ? [e.teacher_id] : []));

  // Course + teacher listings (unique courses in this batch's entries)
  const { theoryCourses, labCourses } = useMemo(() => {
    const seen = new Map(); // courseId → Set(teacherId)
    for (const e of entries) {
      if (!seen.has(e.course_id)) seen.set(e.course_id, new Set());
      entryTeacherIds(e).forEach(tid => seen.get(e.course_id).add(tid));
    }
    const theory = [], lab = [];
    for (const [cid, tids] of seen.entries()) {
      const c = courseMap[cid];
      if (!c) continue;
      const row = { course: c, teacherIds: [...tids] };
      (c.course_type === 'lab' ? lab : theory).push(row);
    }
    const byCode = (a, b) => String(a.course.code).localeCompare(String(b.course.code));
    theory.sort(byCode); lab.sort(byCode);
    return { theoryCourses: theory, labCourses: lab };
  }, [entries, courseMap]); // eslint-disable-line react-hooks/exhaustive-deps

  // Room shown in the top-right ("Room No.") — the batch's dominant theory room
  const dominantRoom = useMemo(() => {
    if (roomNo) return roomNo;
    const counts = {};
    entries.forEach(e => { if (e.room) counts[e.room] = (counts[e.room] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
  }, [entries, roomNo]);

  const cellText = (e) => {
    const c = courseMap[e.course_id];
    const inits = entryTeacherIds(e).map(teacherInitials).join('+');
    const grp = e.group && e.group !== 'alt' ? ` [G${e.group}]` : e.group === 'alt' ? ' [G-alt]' : '';
    const room = e.room ? ` [R# ${e.room}]` : '';
    return `${c?.code || '?'} [${inits}]${grp}${room}`;
  };

  return (
    <div className="rd-doc">
      {/* ── Letterhead ── */}
      <div className="rd-letterhead">
        <div className="rd-letterhead-name">Department of Computer Science and Engineering</div>
        <div className="rd-letterhead-uni">University of Dhaka</div>
        <div className="rd-title">
          Class Schedule for {BATCH_TITLES[batchId] || batchId}
          {semesterLabel ? ` — ${semesterLabel}` : ''}
        </div>
        <div className="rd-subtitle">Class Routine</div>
      </div>

      {/* ── Info line above the grid (start info left, room right) ── */}
      {dominantRoom && (
        <div className="rd-info-line">
          <span />
          <span className="rd-room-no">Room No.: {dominantRoom}</span>
        </div>
      )}

      {/* ── Grid ── */}
      <table className="rd-grid">
        <thead>
          <tr>
            <th className="rd-corner">Day</th>
            {columns.map(col => (
              <th key={col.slotId} className={col.type === 'break' ? 'rd-break-head' : ''}>
                {col.type === 'break' ? (
                  <span className="rd-break-title">Break</span>
                ) : null}
                <span className="rd-col-time">{col.timeLabel}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {days.map(day => (
            <tr key={day}>
              <td className="rd-day">{day}</td>
              {columns.map(col => {
                if (col.type === 'break') {
                  return <td key={col.slotId} className="rd-break-cell" />;
                }
                const es = cellMap[`${day}-${col.slotId}`] || [];
                return (
                  <td key={col.slotId} className="rd-cell">
                    {es.map((e, i) => (
                      <div key={i} className={`rd-entry${(courseMap[e.course_id]?.course_type === 'lab') ? ' lab' : ''}`}>
                        {cellText(e)}
                        {e.alternating ? <span className="rd-alt"> (alt week)</span> : null}
                      </div>
                    ))}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {/* ── Course tables ── */}
      {theoryCourses.length > 0 && (
        <table className="rd-course-table">
          <thead>
            <tr><th>Course</th><th>Course Teacher</th></tr>
          </thead>
          <tbody>
            {theoryCourses.map(({ course, teacherIds }) => (
              <tr key={course.id}>
                <td>{course.code}: {course.title}</td>
                <td>
                  {teacherIds.map(tid => {
                    const t = teacherMap[tid];
                    return t ? `(${t.initials || '?'}): ${t.name}` : tid;
                  }).join('; ')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {labCourses.length > 0 && (
        <table className="rd-course-table">
          <thead>
            <tr><th>Lab</th><th>Lab Teacher</th></tr>
          </thead>
          <tbody>
            {labCourses.map(({ course, teacherIds }) => (
              <tr key={course.id}>
                <td>{course.code}: {course.title}</td>
                <td>
                  {teacherIds.map(tid => {
                    const t = teacherMap[tid];
                    return t ? `(${t.initials || '?'}): ${t.name}` : tid;
                  }).map((s, i) => <div key={i}>{s}</div>)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* ── Signature ── */}
      <div className="rd-signature">
        <div className="rd-sign-line">Signatured/-</div>
        <div className="rd-sign-name">Chairman</div>
        <div>Department of Computer Science &amp; Engineering</div>
        <div>University of Dhaka</div>
      </div>
    </div>
  );
}
