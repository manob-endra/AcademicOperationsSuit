import { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { academicCalendarAPI } from '../services/academicCalendarAPI';
import { academicSemesterAPI }  from '../services/academicSemesterAPI';
import CalendarGrid  from './academicCalendar/CalendarGrid';
import PublishModal  from './academicCalendar/PublishModal';
import {
  CELL_TYPES, TOOLBAR_TYPES,
  generateWeeks, getAllDates, calculateSummary, toDateStr,
} from './academicCalendar/calendarUtils';
import '../styles/AcademicCalendar.css';
import '../styles/ModulePages.css';

// ── Setup defaults ────────────────────────────────────────────────────────────
const DEFAULT_WEEKS = 26; // within 16–35 range
const MIN_WEEKS = 16;
const MAX_WEEKS = 35;

export default function AcademicCalendar() {
  const { semesterId } = useParams();
  const navigate = useNavigate();

  // ── Remote data ──────────────────────────────────────────────────────────
  const [semester,   setSemester]   = useState(null);
  const [loadingCal, setLoadingCal] = useState(true);
  const [remoteErr,  setRemoteErr]  = useState('');

  // ── Config (setup panel) ─────────────────────────────────────────────────
  const [startDate,    setStartDate]    = useState('');
  const [totalWeeks,   setTotalWeeks]   = useState(String(DEFAULT_WEEKS));
  const [configReady,  setConfigReady]  = useState(false);
  const [configEdit,   setConfigEdit]   = useState(false);

  // ── Grid entries: { 'YYYY-MM-DD': { type, label } } ─────────────────────
  const [entries,   setEntries]   = useState({});

  // ── Cell selection ───────────────────────────────────────────────────────
  const [selectedCells,  setSelectedCells]  = useState(new Set());
  const [lastClicked,    setLastClicked]    = useState(null);

  // ── Toolbar ──────────────────────────────────────────────────────────────
  const [pendingType,       setPendingType]       = useState('vacation');
  const [showLabelPrompt,   setShowLabelPrompt]   = useState(false);
  const [pendingLabel,      setPendingLabel]      = useState('');

  // ── Publish / save ───────────────────────────────────────────────────────
  const [showPublish, setShowPublish] = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [saveMsg,     setSaveMsg]     = useState('');

  // ── Load existing calendar + semester meta ───────────────────────────────
  useEffect(() => {
    let active = true;
    Promise.all([
      academicSemesterAPI.getSemesterById(semesterId),
      academicCalendarAPI.getCalendar(semesterId),
    ]).then(([semRes, calRes]) => {
      if (!active) return;
      if (semRes.success) setSemester(semRes.data);
      if (calRes.success && calRes.data) {
        const cal = calRes.data;
        const cfg = cal.config || {};
        if (cfg.startDate) {
          setStartDate(cfg.startDate);
          setTotalWeeks(String(Math.min(MAX_WEEKS, Math.max(MIN_WEEKS, cfg.totalWeeks || DEFAULT_WEEKS))));
          setEntries(cal.entries || {});
          setConfigReady(true);
        }
      } else if (!calRes.success && !calRes.offline) {
        // non-offline error — still allow creating fresh
      }
      if (!semRes.success) setRemoteErr('Could not load semester info.');
      setLoadingCal(false);
    });
    return () => { active = false; };
  }, [semesterId]);

  // Resolved numeric value — always within bounds, falls back to MIN if empty
  const totalWeeksNum = Math.min(MAX_WEEKS, Math.max(MIN_WEEKS, parseInt(totalWeeks) || MIN_WEEKS));

  // ── Derived: calendar weeks ───────────────────────────────────────────────
  const weeks = useMemo(
    () => (configReady && startDate ? generateWeeks(startDate, totalWeeksNum) : []),
    [startDate, totalWeeksNum, configReady]
  );

  const allDates = useMemo(() => getAllDates(weeks), [weeks]);

  const summary = useMemo(
    () => (weeks.length ? calculateSummary(weeks, entries) : null),
    [weeks, entries]
  );

  // ── Handlers ─────────────────────────────────────────────────────────────

  const applyConfig = () => {
    if (!startDate) return;
    setConfigReady(true);
    setConfigEdit(false);
    setSelectedCells(new Set());
  };

  const handleCellClick = useCallback((ds, isShift, isCtrl) => {
    setSelectedCells(prev => {
      const next = new Set(prev);
      if (isCtrl) {
        if (next.has(ds)) next.delete(ds); else next.add(ds);
      } else if (isShift && lastClicked) {
        const si = allDates.indexOf(lastClicked);
        const ei = allDates.indexOf(ds);
        if (si !== -1 && ei !== -1) {
          const [lo, hi] = si < ei ? [si, ei] : [ei, si];
          for (let i = lo; i <= hi; i++) next.add(allDates[i]);
        }
      } else {
        if (next.size === 1 && next.has(ds)) next.clear();
        else { next.clear(); next.add(ds); }
      }
      return next;
    });
    setLastClicked(ds);
  }, [allDates, lastClicked]);

  const handleWeekLabelClick = useCallback((dateStrs) => {
    setSelectedCells(prev => {
      const next = new Set(prev);
      const allSel = dateStrs.every(d => next.has(d));
      dateStrs.forEach(d => allSel ? next.delete(d) : next.add(d));
      return next;
    });
  }, []);

  const handleDragSelect = useCallback((dates) => {
    setSelectedCells(new Set(dates));
    if (dates.length) setLastClicked(dates[dates.length - 1]);
  }, []);

  // Opens label prompt; called by Apply button and Enter key
  const triggerApply = useCallback(() => {
    if (!selectedCells.size) return;
    setPendingLabel('');
    setShowLabelPrompt(true);
  }, [selectedCells]);

  // Actually commits the type + label to entries
  const applyType = useCallback((label = '') => {
    if (!selectedCells.size) return;
    setEntries(prev => {
      const next = { ...prev };
      selectedCells.forEach(ds => {
        next[ds] = { type: pendingType, label: label.trim() };
      });
      return next;
    });
    setSelectedCells(new Set());
    setShowLabelPrompt(false);
    setPendingLabel('');
  }, [selectedCells, pendingType]);

  const clearSelected = useCallback(() => {
    if (!selectedCells.size) return;
    setEntries(prev => {
      const next = { ...prev };
      selectedCells.forEach(ds => delete next[ds]);
      return next;
    });
    setSelectedCells(new Set());
  }, [selectedCells]);

  const selectAll = useCallback(() => setSelectedCells(new Set(allDates)), [allDates]);
  const clearSel  = useCallback(() => setSelectedCells(new Set()), []);

  const handleSaveDraft = async () => {
    setSaving(true);
    const res = await academicCalendarAPI.saveCalendar(
      semesterId, { startDate, totalWeeks: totalWeeksNum }, entries, false
    );
    setSaving(false);
    setSaveMsg(res.success ? 'Draft saved!' : `Error: ${res.error}`);
    setTimeout(() => setSaveMsg(''), 3000);
  };

  const handlePublishConfirm = async () => {
    setSaving(true);
    const res = await academicCalendarAPI.publishCalendar(
      semesterId, { startDate, totalWeeks: totalWeeksNum }, entries
    );
    setSaving(false);
    if (res.success) {
      setShowPublish(false);
      navigate(`/admin-dashboard/routine-management/${semesterId}`);
    } else {
      alert('Failed to publish: ' + res.error);
    }
  };

  // ── Global Enter key → open label prompt when cells are selected ─────────
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape' && showLabelPrompt) {
        setShowLabelPrompt(false);
        return;
      }
      if (e.key === 'Enter' && selectedCells.size > 0 && !showLabelPrompt) {
        const tag = document.activeElement?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        e.preventDefault();
        triggerApply();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedCells, triggerApply, showLabelPrompt]);

  // ── Render ────────────────────────────────────────────────────────────────
  if (loadingCal) {
    return (
      <main className="module-page">
        <header className="module-header">
          <button className="back-button" onClick={() => navigate(`/admin-dashboard/routine-management/${semesterId}`)}>
            ← Back
          </button>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>Loading…</h1>
        </header>
      </main>
    );
  }

  const semTitle = semester ? `${semester.name} ${semester.year}` : 'Academic Calendar';

  return (
    <main className="ac-page">
      {/* ── Header ── */}
      <header className="ac-header">
        <button
          className="ac-back-btn"
          onClick={() => navigate(`/admin-dashboard/routine-management/${semesterId}`)}
        >
          ← Back
        </button>
        <div className="ac-header-info">
          <h1 className="ac-header-title">Academic Calendar</h1>
          <span className="ac-header-sem">{semTitle}</span>
        </div>
      </header>

      <div className="ac-body">
        {/* ── Setup Panel ── */}
        {(!configReady || configEdit) && (
          <section className="ac-setup-card">
            <h2 className="ac-setup-title">
              {configEdit ? 'Edit Configuration' : 'Calendar Setup'}
            </h2>
            <p className="ac-setup-sub">
              Set the class start date and how many weeks to display. You can fine-tune everything on the grid.
            </p>

            <div className="ac-setup-fields">
              <div className="ac-field">
                <label className="ac-label">Class Start Date</label>
                <input
                  type="date"
                  className="ac-input"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                />
              </div>
              <div className="ac-field">
                <label className="ac-label">Total Weeks to Display</label>
                <input
                  type="number"
                  className="ac-input"
                  min={16}
                  max={35}
                  value={totalWeeks}
                  onChange={e => setTotalWeeks(e.target.value)}
                  onBlur={e => {
                    const val = parseInt(e.target.value);
                    if (isNaN(val) || val < MIN_WEEKS) setTotalWeeks(String(MIN_WEEKS));
                    else if (val > MAX_WEEKS) setTotalWeeks(String(MAX_WEEKS));
                    else setTotalWeeks(String(val));
                  }}
                  onFocus={e => e.target.select()}
                />
                <span className="ac-input-hint">16–35 weeks. Includes class weeks, vacations, prep leave &amp; exams.</span>
              </div>
            </div>

            <div className="ac-setup-foot">
              {configEdit && (
                <button className="ac-btn ac-btn--ghost" onClick={() => setConfigEdit(false)}>
                  Cancel
                </button>
              )}
              <button
                className="ac-btn ac-btn--primary"
                onClick={applyConfig}
                disabled={!startDate}
              >
                {configEdit ? 'Apply Changes' : 'Generate Calendar →'}
              </button>
            </div>
          </section>
        )}

        {/* ── Main grid area ── */}
        {configReady && !configEdit && (
          <>
            {/* Config strip */}
            <div className="ac-config-strip">
              <span>
                Start: <strong>{new Date(startDate + 'T00:00:00').toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric' })}</strong>
              </span>
              <span>Weeks displayed: <strong>{totalWeeksNum}</strong></span>
              <button className="ac-config-edit-btn" onClick={() => setConfigEdit(true)}>
                Edit Config
              </button>
            </div>

            {/* ── Type Toolbar ── */}
            <div className="ac-toolbar">
              <div className="ac-toolbar-left">
                <span className="ac-toolbar-label">
                  {selectedCells.size > 0
                    ? `${selectedCells.size} cell${selectedCells.size > 1 ? 's' : ''} selected`
                    : 'Click cells to select'}
                </span>
                <button className="ac-tb-mini" onClick={selectAll}>Select All</button>
                <button className="ac-tb-mini" onClick={clearSel} disabled={!selectedCells.size}>
                  Clear Selection
                </button>
              </div>
              <div className="ac-toolbar-right">
                <button
                  className="ac-tb-mini ac-tb-mini--danger"
                  onClick={clearSelected}
                  disabled={!selectedCells.size}
                  title="Reset selected cells to default"
                >
                  Reset to Default
                </button>
              </div>
            </div>

            {/* Type buttons + label + apply */}
            <div className="ac-type-bar">
              <div className="ac-type-buttons">
                {TOOLBAR_TYPES.map(type => {
                  const ct = CELL_TYPES[type];
                  return (
                    <button
                      key={type}
                      className={`ac-type-btn ${pendingType === type ? 'ac-type-btn--active' : ''}`}
                      style={{
                        background: ct.bg,
                        color: ct.text,
                        borderColor: pendingType === type ? '#1e3a5f' : ct.border,
                        boxShadow: pendingType === type ? '0 0 0 2px #1e3a5f' : 'none',
                      }}
                      onClick={() => setPendingType(type)}
                    >
                      {ct.label}
                    </button>
                  );
                })}
              </div>

              <div className="ac-type-apply-row">
                <button
                  className="ac-btn ac-btn--apply"
                  onClick={triggerApply}
                  disabled={!selectedCells.size}
                >
                  Apply to {selectedCells.size || 0} cell{selectedCells.size !== 1 ? 's' : ''}
                </button>
                {selectedCells.size > 0 && (
                  <span className="ac-apply-hint">or press Enter</span>
                )}
              </div>
            </div>

            {/* ── Summary Bar ── */}
            {summary && (
              <div className="ac-summary">
                <div className="ac-sum-card ac-sum-card--blue">
                  <span className="ac-sum-val">{summary.classWeeks}</span>
                  <span className="ac-sum-lbl">Class Weeks</span>
                </div>
                <div className="ac-sum-card ac-sum-card--green">
                  <span className="ac-sum-val">{summary.classDays}</span>
                  <span className="ac-sum-lbl">Class Days</span>
                </div>
                <div className="ac-sum-card ac-sum-card--red">
                  <span className="ac-sum-val">{summary.vacationDays}</span>
                  <span className="ac-sum-lbl">Vacation Days</span>
                </div>
                <div className="ac-sum-card ac-sum-card--purple">
                  <span className="ac-sum-val">{summary.plDays}</span>
                  <span className="ac-sum-lbl">Prep Leave Days</span>
                </div>
                <div className="ac-sum-card ac-sum-card--sky">
                  <span className="ac-sum-val">{summary.examDays}</span>
                  <span className="ac-sum-lbl">Exam Days</span>
                </div>
                <div className="ac-sum-card ac-sum-card--orange">
                  <span className="ac-sum-val">{summary.holidayDays}</span>
                  <span className="ac-sum-lbl">Total Holidays</span>
                </div>
              </div>
            )}

            {/* ── Legend ── */}
            <div className="ac-legend">
              {TOOLBAR_TYPES.map(type => {
                const ct = CELL_TYPES[type];
                return (
                  <span key={type} className="ac-legend-item">
                    <span
                      className="ac-legend-swatch"
                      style={{ background: ct.bg, border: `1.5px solid ${ct.border}` }}
                    />
                    <span className="ac-legend-text">{ct.label}</span>
                  </span>
                );
              })}
              <span className="ac-legend-item">
                <span
                  className="ac-legend-swatch"
                  style={{ background: '#f3f4f6', border: '1.5px solid #e5e7eb' }}
                />
                <span className="ac-legend-text">Weekend (Fri–Sat)</span>
              </span>
            </div>

            {/* ── Calendar Grid ── */}
            <div className="ac-grid-section">
              <p className="ac-grid-hint">
                <strong>Tip:</strong> Click to select a cell • Shift+click to select a range •
                Ctrl+click to toggle • Click the <em>#ActiveWeek</em> cell to select an entire week •
                Drag across cells to select multiple
              </p>
              <CalendarGrid
                weeks={weeks}
                entries={entries}
                selectedCells={selectedCells}
                onCellClick={handleCellClick}
                onWeekLabelClick={handleWeekLabelClick}
                onDragSelect={handleDragSelect}
              />

              {/* ── Add / Remove weeks at the end ── */}
              <div className="ac-week-controls">
                <button
                  className="ac-wc-btn ac-wc-btn--remove"
                  onClick={() => setTotalWeeks(prev => String(Math.max(MIN_WEEKS, parseInt(prev) - 1)))}
                  disabled={totalWeeksNum <= MIN_WEEKS}
                  title="Remove last week"
                >
                  − Remove Last Week
                </button>
                <span className="ac-wc-label">{totalWeeksNum} week{totalWeeksNum !== 1 ? 's' : ''}</span>
                <button
                  className="ac-wc-btn ac-wc-btn--add"
                  onClick={() => setTotalWeeks(prev => String(Math.min(MAX_WEEKS, parseInt(prev) + 1)))}
                  disabled={totalWeeksNum >= MAX_WEEKS}
                  title="Add a week"
                >
                  + Add Week
                </button>
              </div>
            </div>

            {/* ── Bottom action bar ── */}
            <div className="ac-bottom-bar">
              {saveMsg && <span className="ac-save-msg-bottom">{saveMsg}</span>}
              <button className="ac-btn-bottom ac-btn-bottom--draft" onClick={handleSaveDraft} disabled={saving}>
                {saving ? 'Saving…' : 'Save Draft'}
              </button>
              <button className="ac-btn-bottom ac-btn-bottom--publish" onClick={() => setShowPublish(true)} disabled={saving}>
                Publish
              </button>
            </div>
          </>
        )}
      </div>

      {/* ── Label Prompt Modal ── */}
      {showLabelPrompt && (
        <div
          className="ac-overlay"
          onClick={e => e.target === e.currentTarget && setShowLabelPrompt(false)}
        >
          <div className="ac-label-modal">
            <p className="ac-lm-title">
              Apply <strong>{CELL_TYPES[pendingType]?.label}</strong> to{' '}
              {selectedCells.size} cell{selectedCells.size !== 1 ? 's' : ''}
            </p>
            <label className="ac-label">Label / event name <span style={{ fontWeight: 400, color: '#9ca3af' }}>(optional)</span></label>
            <input
              className="ac-input"
              type="text"
              placeholder="e.g. Eid ul Fitr, Mid-term Exam…"
              value={pendingLabel}
              onChange={e => setPendingLabel(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') applyType(pendingLabel);
                if (e.key === 'Escape') setShowLabelPrompt(false);
              }}
              autoFocus
            />
            <div className="ac-lm-actions">
              <button
                className="ac-btn ac-btn--ghost-dark"
                onClick={() => applyType('')}
              >
                Skip Label
              </button>
              <button
                className="ac-btn ac-btn--apply"
                onClick={() => applyType(pendingLabel)}
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Publish Modal ── */}
      {showPublish && (
        <PublishModal
          weeks={weeks}
          entries={entries}
          semester={semester}
          saving={saving}
          onConfirm={handlePublishConfirm}
          onCancel={() => setShowPublish(false)}
        />
      )}
    </main>
  );
}
