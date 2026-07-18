import { useState, useEffect, useRef } from 'react';
import { academicCalendarAPI } from '../../services/academicCalendarAPI';
import { academicSemesterAPI  } from '../../services/academicSemesterAPI';
import CalendarDocument from '../academicCalendar/CalendarDocument';
import { printCalendarNode } from '../academicCalendar/printCalendar';

const S = {
  wrap: { padding: '24px 20px 40px', maxWidth: 900, margin: '0 auto' },
  hdr:  { marginBottom: 20 },
  h1:   { margin: '0 0 4px', fontSize: 20, fontWeight: 700, color: '#1a3a52' },
  sub:  { margin: 0, fontSize: 13, color: '#6b7280' },
  selRow: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, flexWrap: 'wrap' },
  label:  { fontSize: 13, fontWeight: 600, color: '#374151' },
  select: {
    padding: '8px 14px', border: '1.5px solid #d1d5db', borderRadius: 8,
    fontSize: 13, outline: 'none', background: 'white', cursor: 'pointer', minWidth: 200,
  },
  empty: {
    background: 'white', borderRadius: 14, boxShadow: '0 2px 8px rgba(0,0,0,.06)',
    padding: '48px 32px', textAlign: 'center', color: '#9ca3af', fontSize: 14,
  },
  badge: (published) => ({
    fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20,
    background: published ? '#dcfce7' : '#f1f5f9',
    color:      published ? '#166534' : '#6b7280',
    marginLeft: 8,
  }),
};

export default function TeacherAcademicCalendar() {
  const [semesters,    setSemesters]    = useState([]);
  const [publishedMap, setPublishedMap] = useState({});
  const [selectedId,   setSelectedId]   = useState('');
  const [calendarData, setCalendarData] = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [calLoading,   setCalLoading]   = useState(false);
  const printRef = useRef(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      academicSemesterAPI.getAllSemesters(),
      academicCalendarAPI.getPublishedCalendars(),
    ]).then(([semRes, calRes]) => {
      if (!active) return;
      const sems = semRes.success ? (semRes.data || []) : [];
      setSemesters(sems);

      const pMap = {};
      if (calRes.success) {
        (calRes.data || []).forEach(c => { pMap[c.semester_id] = c; });
      }
      setPublishedMap(pMap);

      const firstPublished = sems.find(s => pMap[s.id]);
      if (firstPublished) {
        setSelectedId(firstPublished.id);
        setCalendarData(pMap[firstPublished.id]);
      }
      setLoading(false);
    });
    return () => { active = false; };
  }, []);

  const handleSemesterChange = async (semId) => {
    setSelectedId(semId);
    if (!semId) { setCalendarData(null); return; }
    if (publishedMap[semId]) { setCalendarData(publishedMap[semId]); return; }
    setCalLoading(true);
    const r = await academicCalendarAPI.getCalendar(semId);
    setCalLoading(false);
    setCalendarData(r.success && r.data?.published ? r.data : null);
  };

  const selectedSem = semesters.find(s => s.id === selectedId);
  const semLabel    = selectedSem ? `${selectedSem.name} ${selectedSem.year}` : '';
  const hasPublished = Object.keys(publishedMap).length > 0;

  const handleDownload = () => {
    if (printRef.current) printCalendarNode(printRef.current, `Academic Calendar - ${semLabel}`);
  };

  if (loading) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>
        Loading academic calendars…
      </div>
    );
  }

  return (
    <div style={S.wrap}>
      <div style={S.hdr}>
        <h1 style={S.h1}>Academic Calendar</h1>
        <p style={S.sub}>Published academic calendars. You receive an email notification when a new calendar is published.</p>
      </div>

      {!hasPublished && (
        <div style={S.empty}>
          No academic calendar has been published yet.<br />You will be notified by email when one is available.
        </div>
      )}

      {hasPublished && (
        <>
          <div style={S.selRow}>
            <label style={S.label}>Select Semester</label>
            <select
              style={S.select}
              value={selectedId}
              onChange={e => handleSemesterChange(e.target.value)}
            >
              <option value="">— Choose a semester —</option>
              {semesters.map(sem => (
                <option key={sem.id} value={sem.id}>
                  {sem.name} {sem.year}
                  {publishedMap[sem.id] ? ' ✓' : ''}
                </option>
              ))}
            </select>
            {selectedId && (
              <span style={S.badge(!!publishedMap[selectedId])}>
                {publishedMap[selectedId] ? 'Published' : 'Not published'}
              </span>
            )}
          </div>

          {calLoading && (
            <div style={{ textAlign: 'center', color: '#9ca3af', padding: 24 }}>Loading…</div>
          )}

          {!calLoading && selectedId && !calendarData && (
            <div style={S.empty}>
              The academic calendar for this semester has not been published yet.
            </div>
          )}

          {!calLoading && calendarData && (
            <>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                <button
                  onClick={handleDownload}
                  style={{
                    padding: '8px 16px', border: '1.5px solid #1a3a52', background: '#1a3a52',
                    color: '#fff', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  ⬇ Download PDF
                </button>
              </div>
              <div ref={printRef}>
                <CalendarDocument
                  config={calendarData.config}
                  entries={calendarData.entries}
                  semesterLabel={semLabel}
                  publishedAt={calendarData.published_at}
                />
              </div>
            </>
          )}

          {!calLoading && !selectedId && (
            <div style={S.empty}>
              Please select a semester above to view its academic calendar.
            </div>
          )}
        </>
      )}
    </div>
  );
}
