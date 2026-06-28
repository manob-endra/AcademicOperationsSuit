/**
 * Read-only rendered view of a published academic calendar.
 * Used by both student and teacher portals.
 */

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

const CELL_TYPES = {
  class:            { label: 'Regular Class',        bg: '#ffffff', border: '#d1d5db', text: '#374151' },
  class_start_end:  { label: 'Class Start/End',      bg: '#00bcd4', border: '#0097a7', text: '#ffffff' },
  class_office_off: { label: 'Class + Office Off',   bg: '#fda4af', border: '#fb7185', text: '#881337' },
  possible_off:     { label: 'Possible Class Off',   bg: '#fef08a', border: '#facc15', text: '#713f12' },
  class_off:        { label: 'Class Off',            bg: '#fca5a5', border: '#ef4444', text: '#7f1d1d' },
  vacation:         { label: 'Vacation / Holiday',   bg: '#ef4444', border: '#b91c1c', text: '#ffffff' },
  incourse:         { label: 'Incourse Exam',        bg: '#fed7aa', border: '#fb923c', text: '#7c2d12' },
  pl:               { label: 'Preparation Leave',    bg: '#d8b4fe', border: '#a855f7', text: '#3b0764' },
  exam:             { label: 'Final Exam',           bg: '#93c5fd', border: '#3b82f6', text: '#1e3a8a' },
  event:            { label: 'Event',                bg: '#6ee7b7', border: '#10b981', text: '#064e3b' },
  weekend:          { label: 'Weekend',              bg: '#f3f4f6', border: '#e5e7eb', text: '#9ca3af' },
};
const LEGEND_KEYS = ['class_start_end','class_off','vacation','incourse','pl','exam','event','possible_off'];

function isWeekend(date) { const d = date.getDay(); return d === 5 || d === 6; }
function toDS(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
function getType(date, entries) {
  if (!entries) return isWeekend(date) ? 'weekend' : 'class';
  return entries[toDS(date)]?.type || (isWeekend(date) ? 'weekend' : 'class');
}

function buildWeeks(startDate, totalWeeks) {
  const sunday = new Date(startDate + 'T00:00:00');
  sunday.setDate(sunday.getDate() - sunday.getDay());
  return Array.from({ length: totalWeeks }, (_, w) =>
    Array.from({ length: 7 }, (__, d) => {
      const dt = new Date(sunday);
      dt.setDate(sunday.getDate() + w * 7 + d);
      return dt;
    })
  );
}

function calcStats(weeks, entries) {
  let classDays = 0, vacationDays = 0, plDays = 0, examDays = 0, incourseDays = 0, holidayDays = 0;
  weeks.flat().forEach(d => {
    if (isWeekend(d)) return;
    const t = getType(d, entries);
    if (['class','class_start_end','class_office_off'].includes(t)) classDays++;
    else if (['vacation','class_off'].includes(t)) { vacationDays++; holidayDays++; }
    else if (t === 'possible_off') holidayDays++;
    else if (t === 'pl') plDays++;
    else if (t === 'exam') examDays++;
    else if (t === 'incourse') incourseDays++;
  });
  return { classDays, vacationDays, plDays, examDays, incourseDays, holidayDays };
}

function groupByMonth(weeks) {
  const byMonth = new Map();
  weeks.forEach(week => {
    const counts = {};
    week.forEach(d => {
      if (!isWeekend(d)) {
        const k = `${d.getFullYear()}-${d.getMonth()}`;
        counts[k] = (counts[k] || 0) + 1;
      }
    });
    const dominant = Object.entries(counts).sort((a,b)=>b[1]-a[1])[0]?.[0]
      || `${week[0].getFullYear()}-${week[0].getMonth()}`;
    if (!byMonth.has(dominant)) byMonth.set(dominant, []);
    byMonth.get(dominant).push(week);
  });
  return byMonth;
}

const S = {
  page:  { padding: '20px 20px 40px', maxWidth: 860, margin: '0 auto' },
  card:  { background: 'white', borderRadius: 14, boxShadow: '0 2px 10px rgba(0,0,0,.08)', padding: '20px 22px', marginBottom: 20 },
  h2:    { margin: '0 0 14px', fontSize: 16, fontWeight: 700, color: '#1a3a52' },
  stats: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(100px,1fr))', gap: 10, marginBottom: 18 },
  statBox: (bg, clr) => ({ background: bg, borderRadius: 10, padding: '10px 8px', textAlign: 'center' }),
  statNum:  (clr) => ({ fontSize: 24, fontWeight: 700, color: clr, display: 'block' }),
  statLbl:  (clr) => ({ fontSize: 11, fontWeight: 600, color: clr, display: 'block' }),
  monthTitle: { fontSize: 14, fontWeight: 700, color: '#1a3a52', marginBottom: 8, paddingTop: 4 },
  table:  { borderCollapse: 'collapse', width: '100%', fontSize: 12 },
  thDay:  { padding: '6px 4px', border: '1px solid #e5e7eb', background: '#f8fafc', textAlign: 'center', fontWeight: 700, fontSize: 11, color: '#374151', minWidth: 44 },
  legendRow: { display: 'flex', flexWrap: 'wrap', gap: '6px 12px', marginTop: 4 },
};

function LegendItem({ type }) {
  const ct = CELL_TYPES[type];
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#374151' }}>
      <span style={{ width: 14, height: 14, borderRadius: 3, background: ct.bg, border: `1.5px solid ${ct.border}`, flexShrink: 0 }} />
      {ct.label}
    </span>
  );
}

function MonthBlock({ monthKey, monthWeeks, entries }) {
  const [yr, mo] = monthKey.split('-').map(Number);
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={S.monthTitle}>{MONTHS[mo]} {yr}</div>
      <div style={{ overflowX: 'auto' }}>
        <table style={S.table}>
          <thead>
            <tr>
              {DAYS.map(d => <th key={d} style={S.thDay}>{d}</th>)}
            </tr>
          </thead>
          <tbody>
            {monthWeeks.map((week, wi) => (
              <tr key={wi}>
                {week.map((date, di) => {
                  const type = getType(date, entries);
                  const ct   = CELL_TYPES[type] || CELL_TYPES.class;
                  const dim  = date.getMonth() !== mo;
                  const lbl  = entries?.[toDS(date)]?.label || '';
                  return (
                    <td
                      key={di}
                      title={lbl || ct.label}
                      style={{
                        padding: '5px 3px',
                        border: '1px solid #e5e7eb',
                        background: ct.bg,
                        textAlign: 'center',
                        verticalAlign: 'top',
                        opacity: dim ? 0.3 : 1,
                        minWidth: 44,
                      }}
                    >
                      <span style={{ fontSize: 13, fontWeight: 600, color: ct.text }}>{date.getDate()}</span>
                      {lbl && (
                        <div style={{ fontSize: 9, color: ct.text, lineHeight: 1.2, marginTop: 2, overflow: 'hidden', maxHeight: 26 }}>
                          {lbl}
                        </div>
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
  );
}

export default function PublishedCalendarView({ calendarData, semesterLabel }) {
  if (!calendarData) return null;

  const config  = calendarData.config  || {};
  const entries = calendarData.entries || {};
  const startDate  = config.startDate;
  const totalWeeks = config.totalWeeks || 26;

  if (!startDate) {
    return <p style={{ color: '#9ca3af', fontSize: 13, padding: 20 }}>Calendar configuration incomplete.</p>;
  }

  const weeks   = buildWeeks(startDate, totalWeeks);
  const stats   = calcStats(weeks, entries);
  const byMonth = groupByMonth(weeks);

  const publishedAt = calendarData.published_at
    ? new Date(calendarData.published_at).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })
    : null;

  return (
    <div style={S.page}>
      {/* Header card */}
      <div style={S.card}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <h2 style={S.h2}>Academic Calendar — {semesterLabel}</h2>
            <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>
              Start date: <strong>{new Date(startDate + 'T00:00:00').toLocaleDateString('en-GB', { day:'2-digit', month:'long', year:'numeric' })}</strong>
              {' · '}{totalWeeks} weeks
              {publishedAt && <span style={{ marginLeft: 10 }}>Published: {publishedAt}</span>}
            </p>
          </div>
          <span style={{ background: '#dcfce7', color: '#166534', fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20 }}>
            Published
          </span>
        </div>
      </div>

      {/* Stats */}
      <div style={S.card}>
        <h2 style={S.h2}>Summary</h2>
        <div style={S.stats}>
          {[
            ['Class Days',    stats.classDays,    '#dbeafe', '#1e40af'],
            ['Vacation Days', stats.vacationDays, '#fee2e2', '#991b1b'],
            ['Incourse Exam', stats.incourseDays, '#ffedd5', '#9a3412'],
            ['Prep Leave',    stats.plDays,       '#f3e8ff', '#6b21a8'],
            ['Final Exam',    stats.examDays,     '#bfdbfe', '#1e3a8a'],
          ].map(([lbl, val, bg, clr]) => (
            <div key={lbl} style={S.statBox(bg, clr)}>
              <span style={S.statNum(clr)}>{val}</span>
              <span style={S.statLbl(clr)}>{lbl}</span>
            </div>
          ))}
        </div>

        {/* Legend */}
        <div style={S.legendRow}>
          {LEGEND_KEYS.map(k => <LegendItem key={k} type={k} />)}
        </div>
      </div>

      {/* Monthly blocks */}
      <div style={S.card}>
        <h2 style={S.h2}>Calendar</h2>
        {[...byMonth.entries()].map(([key, monthWeeks]) => (
          <MonthBlock key={key} monthKey={key} monthWeeks={monthWeeks} entries={entries} />
        ))}
      </div>
    </div>
  );
}
