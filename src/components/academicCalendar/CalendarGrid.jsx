import { useState, useEffect, useRef } from 'react';
import {
  CELL_TYPES, DAYS_SHORT, MONTHS,
  ROW_TYPE_BG, ROW_LABEL_STYLE,
  toDateStr, isWeekend, getEffectiveType, getWeekRowType,
  computeWeekMonths, computeMonthRowspans,
} from './calendarUtils';

export default function CalendarGrid({
  weeks,
  entries,
  selectedCells,
  onCellClick,
  onWeekLabelClick,
  onDragSelect,
  readOnly = false,
}) {
  const isDragging = useRef(false);
  const dragStart  = useRef(null);
  const [dragCurrent, setDragCurrent] = useState(null);

  // Build flat date index for drag range calculation
  const allDates = weeks.flat().map(toDateStr);

  const getDragRange = () => {
    if (!isDragging.current || !dragStart.current || !dragCurrent) return new Set();
    const si = allDates.indexOf(dragStart.current);
    const ei = allDates.indexOf(dragCurrent);
    if (si === -1 || ei === -1) return new Set();
    const [lo, hi] = si < ei ? [si, ei] : [ei, si];
    return new Set(allDates.slice(lo, hi + 1));
  };

  const dragRange = getDragRange();

  const handleMouseDown = (ds, e) => {
    if (readOnly) return;
    e.preventDefault();
    isDragging.current = true;
    dragStart.current  = ds;
    setDragCurrent(ds);
  };

  const handleMouseOver = (ds) => {
    if (!isDragging.current || readOnly) return;
    setDragCurrent(ds);
  };

  const handleMouseUp = () => {
    if (!isDragging.current) return;
    const range = getDragRange();
    if (range.size > 1 && onDragSelect) {
      onDragSelect([...range]);
    }
    isDragging.current = false;
    dragStart.current  = null;
    setDragCurrent(null);
  };

  useEffect(() => {
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  });

  if (!weeks.length) return null;

  const weekMonths   = computeWeekMonths(weeks);
  const monthSpans   = computeMonthRowspans(weekMonths);
  let   classWeekNum = 0;

  const rowsData = weeks.map((weekDays, wi) => {
    const rowType = getWeekRowType(weekDays, entries);

    let label;
    if (rowType === 'vacation')       label = 'VACATION';
    else if (rowType === 'incourse') { classWeekNum++; label = 'IN-COURSE'; }
    else if (rowType === 'pl')        label = 'PL';
    else if (rowType === 'exam')      label = 'EXAM';
    else if (rowType === 'class' || rowType === 'mixed') { classWeekNum++; label = String(classWeekNum); }
    else                              label = '';

    // Collect unique holiday labels for this week
    const seen = new Set();
    const holidayLabels = [];
    weekDays.forEach(day => {
      const entry = entries[toDateStr(day)];
      if (entry?.label && !seen.has(entry.label)) {
        seen.add(entry.label);
        holidayLabels.push(entry.label);
      }
    });

    return {
      weekDays,
      rowType,
      label,
      holidays: holidayLabels.join(' • '),
      monthIdx:    weekMonths[wi],
      monthRowspan: monthSpans[wi],
    };
  });

  return (
    <div className="ac-grid-scroll" style={{ userSelect: 'none' }}>
      <table className="ac-table">
        <thead>
          <tr>
            <th className="ac-th ac-th-week">#ActiveWeek</th>
            {DAYS_SHORT.map(d => <th key={d} className="ac-th">{d}</th>)}
            <th className="ac-th ac-th-month">Month</th>
            <th className="ac-th ac-th-holidays">Holidays</th>
          </tr>
        </thead>
        <tbody>
          {rowsData.map((row, wi) => {
            const { weekDays, rowType, label, holidays, monthIdx, monthRowspan } = row;
            const lblStyle = ROW_LABEL_STYLE[rowType] || ROW_LABEL_STYLE.empty;

            return (
              <tr key={wi} style={{ background: ROW_TYPE_BG[rowType] || '#fff' }}>
                {/* Week label — click to select whole week */}
                <td
                  className={`ac-week-label ${!readOnly ? 'ac-week-label--btn' : ''}`}
                  style={lblStyle}
                  onClick={readOnly ? undefined : () => onWeekLabelClick(weekDays.map(toDateStr))}
                  title={readOnly ? undefined : 'Click to select / deselect entire week'}
                >
                  {label}
                </td>

                {/* Day cells */}
                {weekDays.map(day => {
                  const ds      = toDateStr(day);
                  const type    = getEffectiveType(day, entries);
                  const ct      = CELL_TYPES[type] || CELL_TYPES.class;
                  const isSel   = !readOnly && (selectedCells?.has(ds) || dragRange.has(ds));
                  const hasEntry = !!entries[ds];

                  return (
                    <td
                      key={ds}
                      className={[
                        'ac-cell',
                        isSel          ? 'ac-cell--selected' : '',
                        !readOnly      ? 'ac-cell--interactive' : '',
                        hasEntry       ? 'ac-cell--marked' : '',
                        isWeekend(day) ? 'ac-cell--weekend' : '',
                      ].filter(Boolean).join(' ')}
                      style={{
                        background: isSel ? '#dbeafe' : ct.bg,
                        color:      isSel ? '#1e3a5f' : ct.text,
                        outline:    isSel
                          ? '2px solid #1e3a5f'
                          : `1px solid ${ct.border}`,
                        outlineOffset: '-1px',
                      }}
                      onClick={readOnly ? undefined
                        : e => onCellClick(ds, e.shiftKey, e.ctrlKey || e.metaKey)}
                      onMouseDown={readOnly ? undefined : e => handleMouseDown(ds, e)}
                      onMouseOver={readOnly ? undefined : () => handleMouseOver(ds)}
                      title={entries[ds]?.label || undefined}
                    >
                      {day.getDate()}
                    </td>
                  );
                })}

                {/* Month cell with rowspan */}
                {monthRowspan > 0 && (
                  <td className="ac-month-cell" rowSpan={monthRowspan}>
                    {MONTHS[monthIdx]}
                  </td>
                )}

                {/* Holidays / labels column */}
                <td className="ac-holidays-cell">{holidays}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
