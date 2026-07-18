import CalendarGrid from './CalendarGrid';
import { CELL_TYPES, TOOLBAR_TYPES, calculateSummary } from './calendarUtils';

export default function PublishModal({ weeks, entries, semester, saving, alreadyPublished = false, onConfirm, onCancel }) {
  const summary = calculateSummary(weeks, entries);

  const title = semester
    ? `Tentative Academic Calendar (${semester.name} Semester ${semester.year})`
    : 'Tentative Academic Calendar';

  return (
    <div className="ac-overlay" onClick={e => e.target === e.currentTarget && !saving && onCancel()}>
      <div className="ac-publish-modal">
        {/* Header */}
        <div className="ac-pm-header">
          <div>
            <h2 className="ac-pm-title">{title}</h2>
            <p className="ac-pm-sub">
              {alreadyPublished
                ? 'This calendar is already published. Republishing will update it everywhere and email all users again.'
                : 'Review before publishing. This will be visible to all users and emailed to them.'}
            </p>
          </div>
          <button className="ac-pm-close" onClick={onCancel} disabled={saving}>✕</button>
        </div>

        {/* Summary strip */}
        <div className="ac-pm-summary">
          <div className="ac-pm-stat">
            <span className="ac-pm-stat-val">{summary.classWeeks}</span>
            <span className="ac-pm-stat-lbl">Class Weeks</span>
          </div>
          <div className="ac-pm-stat">
            <span className="ac-pm-stat-val">{summary.classDays}</span>
            <span className="ac-pm-stat-lbl">Class Days</span>
          </div>
          <div className="ac-pm-stat">
            <span className="ac-pm-stat-val">{summary.vacationDays}</span>
            <span className="ac-pm-stat-lbl">Vacation Days</span>
          </div>
          <div className="ac-pm-stat">
            <span className="ac-pm-stat-val">{summary.plDays}</span>
            <span className="ac-pm-stat-lbl">Prep Leave Days</span>
          </div>
          <div className="ac-pm-stat">
            <span className="ac-pm-stat-val">{summary.examDays}</span>
            <span className="ac-pm-stat-lbl">Exam Days</span>
          </div>
          <div className="ac-pm-stat">
            <span className="ac-pm-stat-val">{summary.holidayDays}</span>
            <span className="ac-pm-stat-lbl">Total Holidays</span>
          </div>
        </div>

        {/* Calendar preview */}
        <div className="ac-pm-grid-wrap">
          <CalendarGrid
            weeks={weeks}
            entries={entries}
            selectedCells={new Set()}
            readOnly
          />
        </div>

        {/* Legend */}
        <div className="ac-pm-legend">
          <span className="ac-pm-legend-title">Legends</span>
          <div className="ac-pm-legend-items">
            {TOOLBAR_TYPES.map(type => {
              const ct = CELL_TYPES[type];
              return (
                <span key={type} className="ac-pm-legend-item">
                  <span
                    className="ac-pm-legend-swatch"
                    style={{ background: ct.bg, border: `1px solid ${ct.border}` }}
                  />
                  {ct.label}
                </span>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="ac-pm-footer">
          <p className="ac-pm-footer-note">
            Dept. of Computer Science and Engineering, University of Dhaka
          </p>
          <div className="ac-pm-actions">
            <button className="ac-pm-cancel" onClick={onCancel} disabled={saving}>
              Cancel
            </button>
            <button className="ac-pm-confirm" onClick={onConfirm} disabled={saving}>
              {saving
                ? (alreadyPublished ? 'Republishing…' : 'Publishing…')
                : (alreadyPublished ? 'Confirm & Republish' : 'Confirm & Publish')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
