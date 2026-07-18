import './IncourseDocument.css';

/**
 * Official incourse-exam notice, in English, sized for A4 portrait —
 * mirrors the department's published format:
 *   letterhead → title → intro paragraph → table (Sl / Date, Day & Time /
 *   Course / Invigilators / Room No.) → closing note → signature block.
 *
 * Used by the admin preview + download and by the student/teacher downloads.
 */

const fmtDate = (iso) => {
  if (!iso) return { date: '—', day: '' };
  const d = new Date(iso + 'T00:00:00');
  return {
    date: d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    day:  d.toLocaleDateString('en-US', { weekday: 'long' }),
  };
};

const fmtTime = (t) => {
  if (!t) return '';
  const [h, m] = String(t).split(':').map(Number);
  const ap = h >= 12 ? 'PM' : 'AM';
  const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${h12}:${String(m).padStart(2, '0')} ${ap}`;
};

export default function IncourseDocument({
  batchLabel, sessionYear, slots = [], courseMap = {}, teacherMap = {},
  examCommitteeChair, noticeDate,
}) {
  const dated = [...slots].filter(s => s.exam_date).sort((a, b) =>
    a.exam_date !== b.exam_date ? (a.exam_date < b.exam_date ? -1 : 1)
                                : (a.start_time < b.start_time ? -1 : 1)
  );

  const first = dated[0]?.exam_date;
  const last  = dated[dated.length - 1]?.exam_date;
  const range = first && last
    ? `${fmtDate(first).date} to ${fmtDate(last).date}`
    : '';

  return (
    <div className="inc-doc">
      {/* ── Letterhead ── */}
      <div className="inc-head">
        <div className="inc-dept">Department of Computer Science and Engineering</div>
        <div className="inc-uni">University of Dhaka, Dhaka-1000, Bangladesh</div>
        <div className="inc-contact">
          Web: www.du.ac.bd/body/CSE &nbsp;·&nbsp; Email: office@cse.du.ac.bd
        </div>
      </div>

      <div className="inc-meta">
        <span>Ref: ..............................</span>
        <span>Date: {noticeDate ? fmtDate(noticeDate).date : '.....................'}</span>
      </div>

      {/* ── Title ── */}
      <h2 className="inc-title">
        Notice for In-course Examination of {batchLabel}
        {sessionYear ? ` — ${sessionYear}` : ''}
      </h2>

      {/* ── Intro ── */}
      <p className="inc-intro">
        This is for the information of all concerned teachers and students of {batchLabel} of this
        department that the in-course examinations of the students will be held according to the
        following schedule.
      </p>

      {/* ── Table ── */}
      <table className="inc-table">
        <thead>
          <tr>
            <th className="inc-col-sl">Sl. No.</th>
            <th className="inc-col-date">Date, Day &amp; Time</th>
            <th className="inc-col-course">Course</th>
            <th className="inc-col-inv">Invigilators</th>
            <th className="inc-col-room">Room No.</th>
          </tr>
        </thead>
        <tbody>
          {dated.length === 0 ? (
            <tr><td colSpan={5} className="inc-empty">No exams scheduled yet.</td></tr>
          ) : dated.map((s, i) => {
            const c = courseMap[s.course_id];
            const d = fmtDate(s.exam_date);
            const invs = s.invigilators || [];
            return (
              <tr key={s.id || i}>
                <td className="inc-center">{i + 1}.</td>
                <td>
                  <div>{d.date}</div>
                  <div>{d.day}</div>
                  <div>{fmtTime(s.start_time)}</div>
                </td>
                <td>
                  {c ? `${c.code}: ${c.title}` : (s.course_id || '—')}
                </td>
                <td>
                  {invs.length === 0 ? <span className="inc-muted">—</span> : (
                    <ol className="inc-inv-list">
                      {invs.map((iv, k) => {
                        const t = teacherMap[iv.teacher_id];
                        return (
                          <li key={k}>
                            {t?.name || iv.teacher_id}
                            {iv.is_course_teacher && <span className="inc-ct"> (Course Teacher)</span>}
                          </li>
                        );
                      })}
                    </ol>
                  )}
                </td>
                <td className="inc-center">{s.rooms || '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* ── Closing note ── */}
      <p className="inc-note">
        It is mentioned here that during the in-course examination week
        {range ? ` (from ${range})` : ''} the examinations will be held according to the above
        schedule and all classes will remain suspended. The presence of all concerned at the
        scheduled time is highly appreciated.
      </p>

      {/* ── Signature ── */}
      <div className="inc-sign">
        <div className="inc-thanks">Thanking you,</div>
        <div className="inc-sign-space" />
        <div className="inc-sign-name">[{examCommitteeChair || 'Chairman, Examination Committee'}]</div>
        <div>Chairman, Examination Committee</div>
        <div>Department of Computer Science and Engineering</div>
        <div>University of Dhaka</div>
      </div>
    </div>
  );
}
