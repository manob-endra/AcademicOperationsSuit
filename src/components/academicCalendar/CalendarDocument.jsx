import { useMemo } from 'react';
import CalendarGrid from './CalendarGrid';
import {
  CELL_TYPES, TOOLBAR_TYPES,
  generateWeeks, calculateSummary,
} from './calendarUtils';
import '../../styles/AcademicCalendar.css';
import './CalendarDocument.css';

/**
 * The publishable / print-ready academic calendar document.
 *
 * Renders in the exact format of the official sample: a title, the
 * #ActiveWeek grid (reusing the read-only CalendarGrid so the layout is
 * identical to the admin editor), a summary strip, the legend, and the
 * department signature block.
 *
 * One source of truth used by the admin preview, the admin published view,
 * the student/teacher portals and the print-to-PDF output.
 */
export default function CalendarDocument({
  config, entries, semesterLabel, publishedAt, forPrint = false,
}) {
  const startDate  = config?.startDate;
  const totalWeeks = config?.totalWeeks || 26;

  const weeks = useMemo(
    () => (startDate ? generateWeeks(startDate, totalWeeks) : []),
    [startDate, totalWeeks]
  );
  const summary = useMemo(
    () => (weeks.length ? calculateSummary(weeks, entries || {}) : null),
    [weeks, entries]
  );

  if (!startDate) {
    return <p className="ac-doc-empty">Calendar configuration incomplete.</p>;
  }

  const publishedLabel = publishedAt
    ? new Date(publishedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : null;

  return (
    <div className={`ac-doc${forPrint ? ' ac-doc--print' : ''}`}>
      {/* Title */}
      <div className="ac-doc-titlebar">
        <h2 className="ac-doc-title">
          Tentative Academic Calendar{semesterLabel ? ` (${semesterLabel})` : ''}
        </h2>
        {publishedLabel && (
          <span className="ac-doc-published">Published: {publishedLabel}</span>
        )}
      </div>

      {/* Grid in the official #ActiveWeek format */}
      <div className="ac-doc-grid">
        <CalendarGrid weeks={weeks} entries={entries || {}} selectedCells={new Set()} readOnly />
      </div>

      {/* Summary */}
      {summary && (
        <div className="ac-doc-summary">
          <span><strong>{summary.classWeeks}</strong> Class Weeks</span>
          <span><strong>{summary.classDays}</strong> Class Days</span>
          <span><strong>{summary.vacationDays}</strong> Vacation Days</span>
          <span><strong>{summary.plDays}</strong> Prep Leave Days</span>
          <span><strong>{summary.examDays}</strong> Exam Days</span>
          <span><strong>{summary.holidayDays}</strong> Total Holidays</span>
        </div>
      )}

      {/* Legend */}
      <div className="ac-doc-legend">
        <span className="ac-doc-legend-title">Legends</span>
        <div className="ac-doc-legend-items">
          {TOOLBAR_TYPES.map(type => {
            const ct = CELL_TYPES[type];
            return (
              <span key={type} className="ac-doc-legend-item">
                <span
                  className="ac-doc-legend-swatch"
                  style={{ background: ct.bg, border: `1px solid ${ct.border}` }}
                />
                {ct.label}
              </span>
            );
          })}
          <span className="ac-doc-legend-item">
            <span className="ac-doc-legend-swatch" style={{ background: '#f3f4f6', border: '1px solid #e5e7eb' }} />
            Weekend (Fri–Sat)
          </span>
        </div>
      </div>

      {/* Signature / department block */}
      <div className="ac-doc-signature">
        <div className="ac-doc-sign-line">Signatured/-</div>
        <div className="ac-doc-sign-name">Chairman</div>
        <div className="ac-doc-sign-dept">Department of Computer Science and Engineering</div>
        <div className="ac-doc-sign-dept">University of Dhaka</div>
      </div>
    </div>
  );
}
