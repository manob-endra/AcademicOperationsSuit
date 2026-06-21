import { useState, useEffect, useMemo } from 'react';
import { teacherAPI } from '../../services/teacherAPI';
import { courseAPI } from '../../services/courseAPI';
import { teacherPrefAPI } from '../../services/teacherPrefAPI';

// ── Time-slot constants (matches admin availability grid) ──────────────────
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];
const TIME_SLOTS = [
  { id: 's1', label: '8:30 – 9:20' },
  { id: 's2', label: '9:25 – 10:15' },
  { id: 's3', label: '10:20 – 11:10' },
  { id: 's4', label: '11:40 – 12:30' },
  { id: 's5', label: '12:35 – 1:25' },
];

const MAX_CHOICES = 5;
const ORDINALS = ['1st', '2nd', '3rd', '4th', '5th'];

// ── Helpers ──────────────────────────────────────────────────────────────────

// Build a Set of "Day-slotId" strings from the availability data
function buildSelectedSet(availabilityRows, teacherId) {
  return new Set(
    (availabilityRows || [])
      .filter(r => r.teacher_id === teacherId)
      .map(r => `${r.day_of_week}-${r.slot_id}`)
  );
}

// Convert ranked choices array to the prefs payload expected by the backend
function buildPrefsPayload(rankedChoices, existingAssigned) {
  return {
    firstPreference:  rankedChoices[0] || null,
    secondPreference: rankedChoices[1] || null,
    thirdPreference:  rankedChoices[2] || null,
    otherPreferences: rankedChoices.slice(3),
    labPreferences:   [],                     // kept empty — teacher uses ranked list only
    assignedCourses:  existingAssigned || [], // preserve admin-assigned courses untouched
  };
}

// Decode saved prefs back to an ordered array of up to 5 course IDs
function decodeRankedChoices(pref) {
  if (!pref) return [];
  const result = [];
  if (pref.first_preference)  result.push(pref.first_preference);
  if (pref.second_preference) result.push(pref.second_preference);
  if (pref.third_preference)  result.push(pref.third_preference);
  for (const id of (pref.other_preferences || [])) {
    if (result.length < MAX_CHOICES) result.push(id);
  }
  return result;
}

// ── Component ─────────────────────────────────────────────────────────────────

function Preference({ teacherRecord }) {
  const [activeTab, setActiveTab] = useState('time');

  // ── Time preference state ──
  const [selectedSlots, setSelectedSlots] = useState(new Set());
  const [timeSaving,    setTimeSaving]    = useState(false);
  const [timeMsg,       setTimeMsg]       = useState({ type: '', text: '' });

  // ── Course preference state ──
  const [courses,        setCourses]        = useState([]);
  const [rankedChoices,  setRankedChoices]  = useState([]);   // ordered array of courseIds
  const [existingAssigned, setExistingAssigned] = useState([]);
  const [showPicker,     setShowPicker]     = useState(false);
  const [courseSaving,   setCourseSaving]   = useState(false);
  const [courseMsg,      setCourseMsg]      = useState({ type: '', text: '' });

  const teacherId = teacherRecord?.id;

  useEffect(() => {
    if (teacherId) load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacherId]);

  const load = async () => {
    const [availRes, coursesRes, prefsRes] = await Promise.all([
      teacherAPI.getAllAvailability(),
      courseAPI.getAllCourses(),
      teacherPrefAPI.getAllPreferences(),
    ]);

    if (availRes.success) {
      setSelectedSlots(buildSelectedSet(availRes.data, teacherId));
    }

    if (coursesRes.success) {
      setCourses((coursesRes.courses || []).filter(c => c.is_active !== false));
    }

    if (prefsRes.success) {
      const myPref = (prefsRes.data || []).find(p => p.teacher_id === teacherId);
      if (myPref) {
        setRankedChoices(decodeRankedChoices(myPref));
        setExistingAssigned(myPref.assigned_courses || []);
      }
    }
  };

  // ── Time grid handlers ────────────────────────────────────────────────────
  const toggleSlot = (day, slotId) => {
    const key = `${day}-${slotId}`;
    setSelectedSlots(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const saveTime = async () => {
    setTimeSaving(true);
    setTimeMsg({ type: '', text: '' });
    const slots = [...selectedSlots];
    const r = await teacherAPI.saveAvailability(teacherId, slots);
    setTimeMsg(r.success
      ? { type: 'success', text: 'Time preferences saved.' }
      : { type: 'error',   text: r.error || 'Failed to save.' }
    );
    setTimeSaving(false);
  };

  // ── Course choice handlers ────────────────────────────────────────────────
  const courseMap = useMemo(
    () => Object.fromEntries(courses.map(c => [c.id, c])),
    [courses]
  );

  // Courses not yet chosen
  const pickableCourses = useMemo(
    () => courses.filter(c => !rankedChoices.includes(c.id)),
    [courses, rankedChoices]
  );

  const addChoice = (courseId) => {
    if (rankedChoices.length >= MAX_CHOICES) return;
    setRankedChoices(prev => [...prev, courseId]);
    setShowPicker(false);
  };

  const removeChoice = (idx) => {
    setRankedChoices(prev => prev.filter((_, i) => i !== idx));
  };

  const moveUp = (idx) => {
    if (idx === 0) return;
    setRankedChoices(prev => {
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return next;
    });
  };

  const moveDown = (idx) => {
    setRankedChoices(prev => {
      if (idx >= prev.length - 1) return prev;
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return next;
    });
  };

  const saveCoursePrefs = async () => {
    setCourseSaving(true);
    setCourseMsg({ type: '', text: '' });
    const payload = buildPrefsPayload(rankedChoices, existingAssigned);
    const r = await teacherPrefAPI.savePreferences(teacherId, payload);
    setCourseMsg(r.success
      ? { type: 'success', text: 'Course preferences saved.' }
      : { type: 'error',   text: r.error || 'Failed to save.' }
    );
    setCourseSaving(false);
  };

  if (!teacherId) {
    return (
      <div className="td-empty-state">
        <div className="td-empty-icon">🔒</div>
        <p>Preferences will be available once the admin admits you as a teacher.</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="td-section-title">Preferences</h2>
      <p className="td-section-subtitle">
        Set your time availability and course preferences.
      </p>

      {/* Sub-tabs */}
      <div className="pref-tabs">
        <button
          className={`pref-tab${activeTab === 'time' ? ' active' : ''}`}
          onClick={() => setActiveTab('time')}
        >
          Time Preference
        </button>
        <button
          className={`pref-tab${activeTab === 'course' ? ' active' : ''}`}
          onClick={() => setActiveTab('course')}
        >
          Course Preference
        </button>
      </div>

      {/* ── TIME PREFERENCE ── */}
      {activeTab === 'time' && (
        <div className="pref-section">
          <p className="pref-section-desc">
            Click the cells to mark the time slots when you are <strong>available</strong> to teach.
          </p>

          {timeMsg.text && (
            <div className={`td-alert ${timeMsg.type}`}>{timeMsg.text}</div>
          )}

          <div className="avail-grid-wrap">
            {/* Header row */}
            <div className="avail-grid" style={{ gridTemplateColumns: `100px repeat(${TIME_SLOTS.length}, 1fr)` }}>
              <div className="avail-hdr-cell corner">Day / Slot</div>
              {TIME_SLOTS.map(s => (
                <div key={s.id} className="avail-hdr-cell">{s.label}</div>
              ))}

              {/* Day rows */}
              {DAYS.map(day => (
                <>
                  <div key={`${day}-label`} className="avail-day-label">{day}</div>
                  {TIME_SLOTS.map(slot => {
                    const key = `${day}-${slot.id}`;
                    const sel = selectedSlots.has(key);
                    return (
                      <button
                        key={key}
                        className={`avail-cell${sel ? ' selected' : ''}`}
                        onClick={() => toggleSlot(day, slot.id)}
                        title={`${day} ${slot.label}`}
                      >
                        {sel ? '✓' : ''}
                      </button>
                    );
                  })}
                </>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 20, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <button className="td-save-btn" onClick={saveTime} disabled={timeSaving}>
              {timeSaving ? 'Saving…' : 'Save Time Preferences'}
            </button>
            <span style={{ fontSize: 13, color: '#6b7280' }}>
              {selectedSlots.size} slot{selectedSlots.size !== 1 ? 's' : ''} selected
            </span>
          </div>
        </div>
      )}

      {/* ── COURSE PREFERENCE ── */}
      {activeTab === 'course' && (
        <div className="pref-section">
          <p className="pref-section-desc">
            Add up to <strong>5 ranked course choices</strong>. The 1st choice has the highest priority.
            Use the arrows to reorder.
          </p>

          {courseMsg.text && (
            <div className={`td-alert ${courseMsg.type}`}>{courseMsg.text}</div>
          )}

          {/* Ranked list */}
          <div className="course-choices-list">
            {rankedChoices.map((cid, idx) => {
              const c = courseMap[cid];
              return (
                <div key={cid} className="course-choice-item">
                  <div className="choice-rank">{ORDINALS[idx]}</div>
                  <div className="choice-info">
                    <span className="choice-code">{c?.code || cid}</span>
                    <span className="choice-title">{c?.title || ''}</span>
                    {c?.year && c?.semester && (
                      <span className="choice-sem">{c.year} · {c.semester}</span>
                    )}
                  </div>
                  <div className="choice-actions">
                    <button className="choice-move-btn" onClick={() => moveUp(idx)}   disabled={idx === 0} title="Move up">↑</button>
                    <button className="choice-move-btn" onClick={() => moveDown(idx)} disabled={idx === rankedChoices.length - 1} title="Move down">↓</button>
                    <button className="choice-remove-btn" onClick={() => removeChoice(idx)} title="Remove">✕</button>
                  </div>
                </div>
              );
            })}

            {rankedChoices.length === 0 && (
              <div className="td-empty-state" style={{ padding: '30px 20px' }}>
                <div className="td-empty-icon">📚</div>
                <p>No course choices added yet. Click &ldquo;Add Course Choice&rdquo; below.</p>
              </div>
            )}
          </div>

          {/* Add course button */}
          {rankedChoices.length < MAX_CHOICES && (
            <button
              className="choice-add-btn"
              onClick={() => setShowPicker(v => !v)}
            >
              {showPicker ? 'Cancel' : '+ Add Course Choice'}
            </button>
          )}

          {rankedChoices.length >= MAX_CHOICES && (
            <p style={{ fontSize: 13, color: '#6b7280', marginTop: 10 }}>
              Maximum of 5 choices reached.
            </p>
          )}

          {/* Course picker */}
          {showPicker && (
            <div className="course-picker">
              <div className="course-picker-header">
                Select a course to add as {ORDINALS[rankedChoices.length]} choice
              </div>
              <div className="course-picker-list">
                {pickableCourses.length === 0 && (
                  <div style={{ padding: '14px', color: '#9ca3af', fontSize: 13 }}>
                    All available courses are already in your list.
                  </div>
                )}
                {pickableCourses.map(c => (
                  <button
                    key={c.id}
                    className="course-picker-item"
                    onClick={() => addChoice(c.id)}
                  >
                    <span className="picker-code">{c.code}</span>
                    <span className="picker-title">{c.title}</span>
                    <span className="picker-meta">{c.year} · {c.semester}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            className="td-save-btn"
            style={{ marginTop: 20 }}
            onClick={saveCoursePrefs}
            disabled={courseSaving}
          >
            {courseSaving ? 'Saving…' : 'Save Course Preferences'}
          </button>
        </div>
      )}
    </div>
  );
}

export default Preference;
