import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { examRoutineAPI } from '../../services/examRoutineAPI';
import { academicCalendarAPI } from '../../services/academicCalendarAPI';
import { teacherRankIndex } from '../../utils/teacherRank';
import IncourseDocument from './IncourseDocument';
import { printCalendarNode } from '../academicCalendar/printCalendar';

const API = import.meta.env.VITE_API_URL || '';

const SEM_ORDER = ['Y1-S1','Y1-S2','Y2-S1','Y2-S2','Y3-S1','Y3-S2','Y4-S1','Y4-S2','MS-S1','MS-S2'];
const SEM_LABEL = {
  'Y1-S1':'1st Year · 1st Sem', 'Y1-S2':'1st Year · 2nd Sem',
  'Y2-S1':'2nd Year · 1st Sem', 'Y2-S2':'2nd Year · 2nd Sem',
  'Y3-S1':'3rd Year · 1st Sem', 'Y3-S2':'3rd Year · 2nd Sem',
  'Y4-S1':'4th Year · 1st Sem', 'Y4-S2':'4th Year · 2nd Sem',
  'MS-S1':'MS · 1st Sem',       'MS-S2':'MS · 2nd Sem',
};
const SEM_FULL = {
  'Y1-S1':'1st Year 1st Semester', 'Y1-S2':'1st Year 2nd Semester',
  'Y2-S1':'2nd Year 1st Semester', 'Y2-S2':'2nd Year 2nd Semester',
  'Y3-S1':'3rd Year 1st Semester', 'Y3-S2':'3rd Year 2nd Semester',
  'Y4-S1':'4th Year 1st Semester', 'Y4-S2':'4th Year 2nd Semester',
  'MS-S1':'MS 1st Semester',        'MS-S2':'MS 2nd Semester',
};

const WEIGHT_BORDER = { 0:'#fecaca', 1:'#fde68a', 2:'#bbf7d0' };
const WEIGHT_TEXT   = { 0:'#dc2626', 1:'#92400e', 2:'#166534' };
const WEIGHT_BG     = { 0:'#fef2f2', 1:'#fffbeb', 2:'#f0fdf4' };
const WEIGHT_LABEL  = { 0:'Excluded', 1:'Own course only', 2:'Full duty' };

// The department runs the whole in-course week Sun–Thu, so a batch can sit at
// most this many exams before the schedule spills past one week.
const MAX_EXAM_DAYS_PER_WEEK = 5;

function addMins(time, mins) {
  if (!time) return '';
  const [h,m] = time.split(':').map(Number);
  const t = h*60 + m + (mins||0);
  return `${String(Math.floor(t/60)).padStart(2,'0')}:${String(t%60).padStart(2,'0')}`;
}
function fmtTime(t) {
  if (!t) return '';
  const [h,m] = t.split(':').map(Number);
  return `${h>12?h-12:h===0?12:h}:${String(m).padStart(2,'0')} ${h>=12?'PM':'AM'}`;
}
function fmtDate(d) {
  if (!d) return null;
  const dt = new Date(d+'T00:00:00');
  return {
    date: dt.toLocaleDateString('en-GB',{day:'2-digit',month:'2-digit',year:'numeric'}),
    day:  dt.toLocaleDateString('en-US',{weekday:'long'}),
  };
}
// Inclusive span in days between the first and last exam date.
function spanDays(dates) {
  const valid = dates.filter(Boolean).sort();
  if (valid.length < 2) return valid.length;
  const a = new Date(valid[0]+'T00:00:00'), b = new Date(valid[valid.length-1]+'T00:00:00');
  return Math.round((b - a) / 86400000) + 1;
}

const TH = { padding:'10px 12px', textAlign:'left', fontSize:11, fontWeight:700, border:'1px solid #1e4a6e', whiteSpace:'nowrap', letterSpacing:'.02em' };
const TD = { padding:'9px 12px', border:'1px solid #e5e7eb', verticalAlign:'top' };
const INPUT = { padding:'5px 8px', borderRadius:6, border:'1px solid #d1d5db', fontSize:12 };
const BTN = { borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer' };

// Batch → shift. 1st + 3rd year sit together (shift 1); 2nd + 4th (shift 2).
const shiftOfBatch = (batchId) => {
  const y = String(batchId).slice(0, 2);
  return (y === 'Y1' || y === 'Y3') ? 1 : 2;
};

const initials = (t) =>
  t?.initials || String(t?.name || '?').split(' ').map(w => w[0]).join('').slice(0, 3);

export default function IncourseExamRoutine({ semesterId, selectedSemesters = [] }) {
  const sorted = [...selectedSemesters].sort((a,b) => SEM_ORDER.indexOf(a) - SEM_ORDER.indexOf(b));

  const [activeSem,   setActiveSem]   = useState(sorted[0] || '');
  const [allTeachers, setAllTeachers] = useState([]);
  const [allCourses,  setAllCourses]  = useState({});
  const [routineMap,  setRoutineMap]  = useState({});
  const [globalLoad,  setGlobalLoad]  = useState(true);

  const [semSessions,   setSemSessions]   = useState({}); // semId → { session, slots(DB), weightMap, leaveMap, loaded }
  const [editSlots,     setEditSlots]     = useState({}); // semId → [editable slot]
  const [invigState,    setInvigState]    = useState({}); // semId → { slotId: [invig] }
  const [configs,       setConfigs]       = useState({}); // semId → config
  const [calendarDates, setCalendarDates] = useState([]); // incourse dates from academic calendar
  const [dirty,         setDirty]         = useState({}); // semId → unsaved changes?

  const [saving,     setSaving]     = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [msg,        setMsg]        = useState({ type:'', text:'' });

  // Modals — settings and invigilator rules are secondary, so they live behind
  // buttons instead of competing with the schedule for vertical space.
  const [setupOpen,   setSetupOpen]   = useState(false);
  const [rulesOpen,   setRulesOpen]   = useState(false);
  const [genOpen,     setGenOpen]     = useState(false);
  const [genAllOpen,  setGenAllOpen]  = useState(false);
  const [previewSem,  setPreviewSem]  = useState(null);

  const [generating,    setGenerating]    = useState(false);
  const [genAllRunning, setGenAllRunning] = useState(false);
  const [publishingAll, setPublishingAll] = useState(false);

  const [genForm, setGenForm] = useState({
    startDate: '', shift1Time: '09:30', shift2Time: '11:30',
    rooms: '', perExam: 3, durationMins: 60,
  });
  const [batchRooms, setBatchRooms] = useState({}); // batchId → rooms text
  const printRef = useRef(null);

  // ── Global load ──────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      setGlobalLoad(true);
      const [cRes, tRes, rRes, calRes] = await Promise.all([
        fetch(`${API}/courses`).then(r => r.json()).catch(() => ({})),
        // Teachers and the class routine are scoped to the academic semester —
        // without semesterId these endpoints 400 and the page loads empty.
        fetch(`${API}/teachers?semesterId=${semesterId}`).then(r => r.json()).catch(() => ({})),
        fetch(`${API}/routine?semesterId=${semesterId}`).then(r => r.json()).catch(() => ({})),
        academicCalendarAPI.getPublishedCalendars().catch(() => ({ success: false })),
      ]);
      const cm = {};
      for (const c of (cRes.data || cRes.courses || [])) cm[c.id] = c;
      setAllCourses(cm);
      setAllTeachers(tRes.data || []);
      const rm = {};
      for (const e of (rRes.entries || [])) {
        if (!rm[e.semester]) rm[e.semester] = [];
        rm[e.semester].push(e);
      }
      setRoutineMap(rm);
      // Incourse week from the most recently published academic calendar.
      if (calRes.success && calRes.data?.length) {
        const latest = calRes.data[0]; // ordered by updated_at DESC
        setCalendarDates(
          Object.entries(latest.entries || {})
            .filter(([, v]) => v?.type === 'incourse')
            .map(([d]) => d)
            .sort()
        );
      }
      setGlobalLoad(false);
    })();
  }, [semesterId]);

  // ── Load session for a semester ──────────────────────────────────────────────
  const loadSession = useCallback(async (semId) => {
    if (!semId) return;
    const res = await examRoutineAPI.getSession('incourse', semId);
    if (!res.success) { setMsg({ type:'error', text: res.error || 'Failed to load session.' }); return; }
    const { slots = [], weightMap = {}, leaveMap = {}, teachers: _t, ...session } = res.data;
    setSemSessions(prev => ({ ...prev, [semId]: { session, slots, weightMap, leaveMap, loaded: true } }));
    setEditSlots(prev => ({
      ...prev, [semId]: slots.map(s => ({
        _id: s.id, course_id: s.course_id,
        exam_date: s.exam_date || '', start_time: s.start_time, end_time: s.end_time,
        rooms: s.rooms || '',
      })),
    }));
    const im = {};
    for (const s of slots) im[s.id] = s.invigilators || [];
    setInvigState(prev => ({ ...prev, [semId]: im }));
    setConfigs(prev => ({
      ...prev, [semId]: prev[semId] || {
        startTime:       session.default_start_time    || (shiftOfBatch(semId) === 2 ? '11:30' : '09:30'),
        durationMins:    session.default_duration_mins || 60,
        teachersPerExam: session.teachers_per_exam     || 3,
        rooms: slots[0]?.rooms || '',
      },
    }));
    setDirty(prev => ({ ...prev, [semId]: false }));
  }, []);

  useEffect(() => {
    if (globalLoad || !activeSem) return;
    if (!semSessions[activeSem]?.loaded) loadSession(activeSem);
  }, [activeSem, globalLoad, loadSession, semSessions]);

  // Load every selected batch once so the batch tabs show accurate state.
  useEffect(() => {
    if (globalLoad) return;
    for (const sid of sorted) if (!semSessions[sid]?.loaded) loadSession(sid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [globalLoad, sorted.join(',')]);

  // ── Accessors ─────────────────────────────────────────────────────────────────
  const cfg     = s => configs[s] || { startTime:'09:30', durationMins:60, teachersPerExam:3, rooms:'' };
  const sess    = s => semSessions[s]?.session;
  const dbSlots = s => semSessions[s]?.slots || [];
  const wMap    = s => semSessions[s]?.weightMap || {};
  const lMap    = s => semSessions[s]?.leaveMap  || {};
  const eSlots  = s => editSlots[s] || [];
  const iMap    = (s, slotId) => invigState[s]?.[slotId] || [];

  // Theory courses this batch sits an in-course exam for: taken from the
  // generated class routine (which already holds only the courses checked in
  // Courses → Routine Courses) and re-checked against in_routine so a stale
  // routine can never pull in courses from another syllabus.
  const theoryCourses = semId => {
    const seen = new Set(), result = [];
    for (const e of (routineMap[semId] || [])) {
      if (!e.course_id || seen.has(e.course_id)) continue;
      seen.add(e.course_id);
      const c = allCourses[e.course_id];
      if (!c || c.course_type === 'lab') continue;
      if (c.in_routine !== true) continue;   // opt-in only
      result.push(c);
    }
    return result.sort((a, b) => (a.code || '').localeCompare(b.code || ''));
  };

  const updCfg = (semId, field, val) =>
    setConfigs(prev => ({ ...prev, [semId]: { ...cfg(semId), [field]: val } }));

  const markDirty = semId => setDirty(prev => ({ ...prev, [semId]: true }));

  // ── Generation ────────────────────────────────────────────────────────────────
  const openGenerate = (semId) => {
    const c = cfg(semId);
    setGenForm(f => ({
      ...f,
      startDate: f.startDate || calendarDates[0] || '',
      rooms: c.rooms || f.rooms,
      perExam: c.teachersPerExam || f.perExam,
      durationMins: c.durationMins || f.durationMins,
    }));
    setGenOpen(true);
  };

  // Generate dates + shift + rooms + invigilators for ONE batch, in one pass.
  const runGenerate = async (semId) => {
    const session = sess(semId);
    if (!session?.id) { setMsg({ type:'error', text:'Session not ready yet.' }); return; }
    if (!genForm.startDate) { setMsg({ type:'error', text:'Please confirm the exam start date.' }); return; }

    setGenerating(true);
    const res = await examRoutineAPI.generateIncourse(session.id, {
      academicSemesterId: semesterId,
      batchId: semId,
      startDate: genForm.startDate,
      shiftTimes: { 1: genForm.shift1Time, 2: genForm.shift2Time },
      rooms: genForm.rooms,
      durationMins: parseInt(genForm.durationMins) || 60,
      perExam: parseInt(genForm.perExam) || 3,
      weightMap: wMap(semId),
    });
    setGenerating(false);

    if (!res.success) { setMsg({ type:'error', text: res.error || 'Generation failed.' }); return; }

    const { slots = [], invigilatorMap = {}, shift, skippedTuesday } = res.data || {};

    // Invigilators come back keyed by the temp ids (tmp-0, tmp-1 …) that match
    // slot_order; they are re-keyed onto real ids when the schedule is saved.
    setEditSlots(prev => ({
      ...prev,
      [semId]: slots.map((s, i) => ({
        _id: `tmp-${i}`, course_id: s.course_id, exam_date: s.exam_date,
        start_time: s.start_time, end_time: s.end_time, rooms: s.rooms,
      })),
    }));
    setInvigState(prev => ({ ...prev, [semId]: invigilatorMap }));
    updCfg(semId, 'rooms', genForm.rooms);
    updCfg(semId, 'teachersPerExam', parseInt(genForm.perExam) || 3);
    updCfg(semId, 'startTime', shift === 2 ? genForm.shift2Time : genForm.shift1Time);
    markDirty(semId);
    setGenOpen(false);
    setMsg({
      type: 'success',
      text: `Generated ${slots.length} exam${slots.length !== 1 ? 's' : ''} with invigilators (shift ${shift}${skippedTuesday ? ', Tuesday left as a gap day' : ''}). Review the table, then Save.`,
    });
  };

  // ── Per-batch status ──────────────────────────────────────────────────────────
  // 'published' | 'saved' | 'draft' (generated, unsaved) | 'none'
  const batchStatus = (sid) => {
    const savedSlots = semSessions[sid]?.slots || [];
    if (savedSlots.length && semSessions[sid]?.session?.published) return 'published';
    if (savedSlots.length) return 'saved';
    if ((editSlots[sid] || []).length) return 'draft';
    return 'none';
  };
  const anyBatchHasSlots    = sorted.some(sid => batchStatus(sid) !== 'none');
  const anyBatchSaved       = sorted.some(sid => ['saved','published'].includes(batchStatus(sid)));
  const allBatchesPublished = anyBatchSaved &&
    sorted.filter(sid => batchStatus(sid) !== 'none').every(sid => batchStatus(sid) === 'published');

  // ── Generate every batch, then save each ─────────────────────────────────────
  const generateAll = async () => {
    if (!genForm.startDate) { setMsg({ type:'error', text:'Please confirm the exam start date.' }); return; }
    setGenAllRunning(true);
    setMsg({ type:'info', text:'Generating the in-course routine for all batches…' });

    const done = [], failed = [];
    for (const sid of sorted) {
      if (!semSessions[sid]?.loaded) await loadSession(sid);
      const session = semSessions[sid]?.session || (await examRoutineAPI.getSession('incourse', sid)).data;
      if (!session?.id) { failed.push({ sid, error: 'no session' }); continue; }

      const res = await examRoutineAPI.generateIncourse(session.id, {
        academicSemesterId: semesterId,
        batchId: sid,
        startDate: genForm.startDate,
        shiftTimes: { 1: genForm.shift1Time, 2: genForm.shift2Time },
        rooms: batchRooms[sid] || '',
        durationMins: parseInt(genForm.durationMins) || 60,
        perExam: parseInt(genForm.perExam) || 3,
        weightMap: semSessions[sid]?.weightMap || {},
      });
      if (!res.success) { failed.push({ sid, error: res.error || 'failed' }); continue; }

      const { slots = [], invigilatorMap = {} } = res.data || {};

      // Persist immediately so a generated routine is never lost on reload.
      const saveRes = await examRoutineAPI.saveSlots('incourse', session.id, slots.map((s, i) => ({
        course_id: s.course_id, exam_date: s.exam_date,
        start_time: s.start_time, end_time: s.end_time,
        rooms: s.rooms, slot_order: i,
      })));
      if (!saveRes.success) { failed.push({ sid, error: saveRes.error || 'save failed' }); continue; }

      const savedRows = [...(saveRes.data || [])].sort((a, b) => (a.slot_order ?? 0) - (b.slot_order ?? 0));
      const remapped = {};
      savedRows.forEach((row, i) => {
        const list = invigilatorMap[`tmp-${i}`];
        if (list?.length) remapped[row.id] = list;
      });
      if (Object.keys(remapped).length) {
        await examRoutineAPI.saveInvigilators('incourse', session.id, remapped);
      }
      await examRoutineAPI.updateConfig('incourse', session.id, {
        teachers_per_exam: parseInt(genForm.perExam) || 3,
        default_start_time: shiftOfBatch(sid) === 2 ? genForm.shift2Time : genForm.shift1Time,
        default_duration_mins: parseInt(genForm.durationMins) || 60,
      });

      setSemSessions(prev => ({ ...prev, [sid]: { ...prev[sid], loaded: false } }));
      done.push(sid);
    }

    for (const sid of sorted) await loadSession(sid);

    setGenAllRunning(false);
    setGenAllOpen(false);
    setMsg({
      type: failed.length ? 'error' : 'success',
      text: failed.length
        ? `Generated ${done.length}/${sorted.length}. Failed: ${failed.map(f => `${SEM_LABEL[f.sid]} (${f.error})`).join('; ')}`
        : `Generated and saved the in-course routine for all ${done.length} batches. Review each batch, then publish.`,
    });
  };

  // ── Publish ───────────────────────────────────────────────────────────────────
  const publishAll = async () => {
    const targets = sorted.filter(sid => ['saved','published'].includes(batchStatus(sid)));
    if (!targets.length) return;
    if (!window.confirm(`Publish the in-course routine for ${targets.length} batch${targets.length !== 1 ? 'es' : ''} and notify students & teachers?`)) return;

    setPublishingAll(true);
    const ok = [], bad = [];
    for (const sid of targets) {
      const session = semSessions[sid]?.session;
      if (!session?.id) { bad.push(sid); continue; }
      const res = await examRoutineAPI.publish('incourse', session.id);
      if (res.success) ok.push(sid); else bad.push(sid);
    }
    for (const sid of targets) await loadSession(sid);
    setPublishingAll(false);
    setMsg({
      type: bad.length ? 'error' : 'success',
      text: bad.length
        ? `Published ${ok.length}/${targets.length}. Failed: ${bad.map(s => SEM_LABEL[s]).join(', ')}`
        : `Published ${ok.length} batch in-course routine${ok.length !== 1 ? 's' : ''}. Emails are being sent.`,
    });
  };

  const publish = async semId => {
    const session = sess(semId);
    if (!session?.id || !dbSlots(semId).length) { setMsg({ type:'error', text:'Save the schedule first.' }); return; }
    const isPub = !!session.published;
    if (!window.confirm(isPub
      ? `Re-publish the ${SEM_FULL[semId]} in-course routine? Students and teachers will see the updated version.`
      : `Publish the ${SEM_FULL[semId]} in-course routine and notify students & teachers?`)) return;

    setPublishing(true);
    const res = await examRoutineAPI.publish('incourse', session.id);
    if (res.success) {
      setMsg({ type:'success', text:'Published. Email notifications will be sent.' });
      setSemSessions(prev => ({ ...prev, [semId]: { ...prev[semId], loaded: false } }));
      await loadSession(semId);
    } else {
      setMsg({ type:'error', text: res.error || 'Publish failed.' });
    }
    setPublishing(false);
  };

  // ── Slot editing ──────────────────────────────────────────────────────────────
  const updEditSlot = (semId, idx, field, val) => {
    setEditSlots(prev => {
      const next = [...(prev[semId] || [])];
      next[idx] = { ...next[idx], [field]: val };
      if (field === 'start_time') next[idx].end_time = addMins(val, cfg(semId).durationMins);
      return { ...prev, [semId]: next };
    });
    markDirty(semId);
  };

  const removeEditSlot = (semId, idx) => {
    setEditSlots(prev => ({ ...prev, [semId]: (prev[semId] || []).filter((_, i) => i !== idx) }));
    markDirty(semId);
  };

  const addEditSlot = semId => {
    const c = cfg(semId), courses = theoryCourses(semId);
    const used = new Set(eSlots(semId).map(s => s.course_id));
    const nextCourse = courses.find(co => !used.has(co.id)) || courses[0];
    setEditSlots(prev => ({
      ...prev, [semId]: [...(prev[semId] || []), {
        _id: `new-${Date.now()}`, course_id: nextCourse?.id || '',
        exam_date: '', start_time: c.startTime,
        end_time: addMins(c.startTime, c.durationMins), rooms: c.rooms,
      }],
    }));
    markDirty(semId);
  };

  // ── Invigilator editing (inline, in the schedule table) ──────────────────────
  const addInvig = (semId, slotId, tid) => {
    if (!tid) return;
    setInvigState(prev => {
      const cur = prev[semId]?.[slotId] || [];
      if (cur.some(i => i.teacher_id === tid)) return prev;
      return { ...prev, [semId]: { ...prev[semId], [slotId]: [...cur, { teacher_id: tid, is_course_teacher: false, is_lead: false }] } };
    });
    markDirty(semId);
  };

  const removeInvig = (semId, slotId, tid) => {
    setInvigState(prev => ({
      ...prev,
      [semId]: { ...prev[semId], [slotId]: (prev[semId]?.[slotId] || []).filter(i => i.teacher_id !== tid) },
    }));
    markDirty(semId);
  };

  const cycleWeight = async (semId, tid) => {
    const cur = wMap(semId)[tid] ?? 2;
    const next = cur >= 2 ? 0 : cur + 1;
    setSemSessions(prev => ({
      ...prev, [semId]: { ...prev[semId], weightMap: { ...prev[semId]?.weightMap, [tid]: next } },
    }));
    const session = sess(semId);
    if (session?.id) await examRoutineAPI.setWeight('incourse', session.id, tid, next);
  };

  // ── Save schedule + invigilators together ────────────────────────────────────
  const saveAll = async semId => {
    const session = sess(semId);
    if (!session?.id) return;
    const slots = eSlots(semId);
    if (!slots.length) { setMsg({ type:'error', text:'Nothing to save.' }); return; }
    if (slots.some(s => !s.exam_date)) { setMsg({ type:'error', text:'Please fill the exam date for every row before saving.' }); return; }
    if (slots.some(s => !s.course_id)) { setMsg({ type:'error', text:'Please select a course for every row.' }); return; }

    setSaving(true);
    const c = cfg(semId);
    await examRoutineAPI.updateConfig('incourse', session.id, {
      teachers_per_exam: c.teachersPerExam,
      default_start_time: c.startTime,
      default_duration_mins: c.durationMins,
    });
    const res = await examRoutineAPI.saveSlots('incourse', session.id, slots.map((s, i) => ({
      course_id: s.course_id, exam_date: s.exam_date,
      start_time: s.start_time, end_time: s.end_time,
      rooms: s.rooms || c.rooms, slot_order: i,
    })));

    if (!res.success) {
      setMsg({ type:'error', text: res.error || 'Save failed.' });
      setSaving(false);
      return;
    }

    // Saving replaces every slot row, so ids change. Re-key invigilators from
    // the old row ids onto the new ones by position (slot_order === index).
    const savedRows = [...(res.data || [])].sort((a, b) => (a.slot_order ?? 0) - (b.slot_order ?? 0));
    const pending = invigState[semId] || {};
    const remapped = {};
    savedRows.forEach((row, i) => {
      const list = pending[slots[i]?._id];
      if (list?.length) remapped[row.id] = list;
    });
    await examRoutineAPI.saveInvigilators('incourse', session.id, remapped);

    setMsg({ type:'success', text:'Schedule and invigilators saved.' });
    setSemSessions(prev => ({ ...prev, [semId]: { ...prev[semId], loaded: false } }));
    await loadSession(semId);
    setSaving(false);
  };

  // ── Auto-assign invigilators onto the saved schedule ─────────────────────────
  const autoAssign = async semId => {
    const session = sess(semId);
    if (!session?.id || !dbSlots(semId).length) {
      setMsg({ type:'error', text:'Save the schedule first, then auto-assign.' }); return;
    }
    setSaving(true);
    const res = await examRoutineAPI.autoAssign('incourse', session.id, semId, wMap(semId), cfg(semId).teachersPerExam);
    if (res.success) {
      setMsg({ type:'success', text:'Invigilators re-assigned.' });
      setSemSessions(prev => ({ ...prev, [semId]: { ...prev[semId], loaded: false } }));
      await loadSession(semId);
    } else {
      setMsg({ type:'error', text: res.error || 'Auto-assign failed.' });
    }
    setSaving(false);
  };

  // ── Render ────────────────────────────────────────────────────────────────────
  const semId     = activeSem;
  const c         = cfg(semId);
  const session   = sess(semId);
  const slots     = eSlots(semId);
  const saved     = dbSlots(semId);
  const wm        = wMap(semId);
  const lm        = lMap(semId);
  const theory    = theoryCourses(semId);
  const isLoading = !semSessions[semId]?.loaded;
  const isDirty   = !!dirty[semId];
  const isPublished = !!session?.published && saved.length > 0;

  // Duty count per teacher across this batch — recomputed live as the admin
  // edits, so uneven distribution is visible immediately.
  const dutyCount = useMemo(() => {
    const counts = {};
    for (const list of Object.values(invigState[semId] || {})) {
      for (const inv of list) counts[inv.teacher_id] = (counts[inv.teacher_id] || 0) + 1;
    }
    return counts;
  }, [invigState, semId]);

  // Teachers eligible for a given slot, lowest rank first (Lecturers absorb
  // duty before seniors) then least-loaded, mirroring the generator.
  const eligibleFor = (slot) => {
    const assigned = new Set(iMap(semId, slot._id).map(i => i.teacher_id));
    return allTeachers
      .filter(t =>
        !assigned.has(t.id) &&
        (wm[t.id] ?? 2) >= 2 &&
        !(lm[t.id] || []).includes(slot.exam_date))
      .sort((a, b) => {
        // teacherRankIndex is seniority (0 = Dean), so descending puts the
        // most junior first — Lecturers are offered before Professors.
        const ra = teacherRankIndex(a), rb = teacherRankIndex(b);
        if (ra !== rb) return rb - ra;
        const la = dutyCount[a.id] || 0, lb = dutyCount[b.id] || 0;
        if (la !== lb) return la - lb;                 // then least-loaded peer
        return String(a.name || '').localeCompare(String(b.name || ''));
      });
  };

  const weekSpan   = spanDays(slots.map(s => s.exam_date));
  const overOneWeek = weekSpan > 7;
  const tooManyExams = theory.length > MAX_EXAM_DAYS_PER_WEEK;

  if (globalLoad) return <div style={{ padding:40, textAlign:'center', color:'#9ca3af' }}>Loading…</div>;
  if (!sorted.length) return (
    <div style={{ padding:'48px 24px', textAlign:'center', color:'#9ca3af' }}>
      No semesters selected. Go to <strong>Home</strong> and select semesters first.
    </div>
  );

  return (
    <div>
      {/* ── Page header: what this screen does + the two all-batch actions ── */}
      <div style={{ padding:'16px 24px', background:'linear-gradient(135deg,#f8fafc,#eef2f7)', borderBottom:'1px solid #e5e7eb' }}>
        <div style={{ display:'flex', alignItems:'flex-start', gap:16, flexWrap:'wrap' }}>
          <div style={{ flex:1, minWidth:260 }}>
            <h3 style={{ margin:'0 0 3px', fontSize:16, fontWeight:700, color:'#1a3a52' }}>In-course Exam Routine</h3>
            <p style={{ margin:0, fontSize:12.5, color:'#6b7280' }}>
              Theory courses only · one exam week · shift 1 (1st &amp; 3rd year) and shift 2 (2nd &amp; 4th year) sit simultaneously
            </p>
          </div>
          <div style={{ display:'flex', gap:9, flexWrap:'wrap' }}>
            <button
              onClick={() => {
                setGenForm(f => ({ ...f, startDate: f.startDate || calendarDates[0] || '' }));
                setBatchRooms(prev => {
                  const next = { ...prev };
                  for (const sid of sorted) if (!next[sid]) next[sid] = (semSessions[sid]?.slots || [])[0]?.rooms || '';
                  return next;
                });
                setGenAllOpen(true);
              }}
              disabled={genAllRunning}
              style={{ ...BTN, padding:'9px 18px', border:'none', background:'linear-gradient(135deg,#1a3a52,#2c5f8a)', color:'white', fontWeight:700, opacity: genAllRunning ? .6 : 1 }}>
              {genAllRunning ? 'Generating…' : anyBatchHasSlots ? '🔄 Regenerate all batches' : '⚙ Generate all batches'}
            </button>
            <button
              onClick={publishAll}
              disabled={publishingAll || !anyBatchSaved}
              title={anyBatchSaved ? 'Publish every batch that has a saved schedule' : 'Save at least one batch first'}
              style={{ ...BTN, padding:'9px 18px', border:'none', background:'linear-gradient(135deg,#166534,#22c55e)', color:'white', fontWeight:700, cursor: anyBatchSaved ? 'pointer' : 'not-allowed', opacity: publishingAll || !anyBatchSaved ? .55 : 1 }}>
              {publishingAll ? 'Publishing…' : allBatchesPublished ? '🔁 Re-publish all' : '📢 Publish all'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Batch tabs ── */}
      <div style={{ display:'flex', overflowX:'auto', borderBottom:'2px solid #e5e7eb', background:'#f8fafc', padding:'0 24px' }}>
        {sorted.map(sid => {
          const st = batchStatus(sid);
          const dot = { published:'#16a34a', saved:'#b45309', draft:'#9ca3af', none:'transparent' }[st];
          return (
            <button key={sid} onClick={() => { setActiveSem(sid); setMsg({ type:'', text:'' }); }}
              title={{ published:'Published', saved:'Saved, not published', draft:'Generated, not saved', none:'Nothing generated yet' }[st]}
              style={{
                display:'flex', alignItems:'center', gap:7,
                padding:'11px 18px', fontSize:13, fontWeight:600, cursor:'pointer', background:'none', border:'none',
                borderBottom: sid === semId ? '2.5px solid #1a3a52' : '2.5px solid transparent',
                color: sid === semId ? '#1a3a52' : '#6b7280', marginBottom:-2, whiteSpace:'nowrap',
              }}>
              <span style={{ width:7, height:7, borderRadius:'50%', background:dot, flexShrink:0 }} />
              {SEM_LABEL[sid] || sid}
              {dirty[sid] && <span title="Unsaved changes" style={{ color:'#b45309', fontSize:14, lineHeight:1 }}>•</span>}
            </button>
          );
        })}
      </div>

      <div style={{ padding:'18px 24px 32px' }}>
        {msg.text && (
          <div style={{
            padding:'10px 14px', borderRadius:8, marginBottom:16, fontSize:13,
            background: msg.type==='success'?'#f0fdf4':msg.type==='error'?'#fef2f2':'#eff6ff',
            color:       msg.type==='success'?'#166534':msg.type==='error'?'#dc2626':'#1e40af',
            border:`1px solid ${msg.type==='success'?'#bbf7d0':msg.type==='error'?'#fecaca':'#bfdbfe'}`,
          }}>
            {msg.text}
          </div>
        )}

        {isLoading ? (
          <div style={{ padding:40, textAlign:'center', color:'#9ca3af' }}>Loading session…</div>
        ) : (
          <>
            {/* ── Batch summary strip: settings live behind buttons, not inline ── */}
            <div style={{
              display:'flex', alignItems:'center', gap:12, flexWrap:'wrap',
              background:'white', border:'1px solid #e5e7eb', borderRadius:10,
              padding:'11px 15px', marginBottom:16,
            }}>
              <span style={{ fontSize:13.5, fontWeight:700, color:'#1a3a52' }}>{SEM_FULL[semId] || semId}</span>
              <span style={{ fontSize:11, fontWeight:700, background:'#eef2f7', color:'#1e3a5f', padding:'2px 8px', borderRadius:20 }}>
                Shift {shiftOfBatch(semId)}
              </span>
              <span style={{ fontSize:12.5, color:'#6b7280' }}>
                {fmtTime(c.startTime)} · {c.durationMins} min · {c.teachersPerExam} invigilator{c.teachersPerExam !== 1 ? 's' : ''}/exam
                {c.rooms ? <> · rooms <strong style={{ color:'#374151' }}>{c.rooms}</strong></> : <span style={{ color:'#b45309' }}> · no rooms set</span>}
              </span>
              <span style={{ fontSize:12, color:'#6b7280', marginLeft:'auto' }}>
                {theory.length} theory course{theory.length !== 1 ? 's' : ''}
              </span>
              <button onClick={() => setSetupOpen(true)}
                style={{ ...BTN, padding:'6px 13px', border:'1.5px solid #d1d5db', background:'white', fontSize:12, color:'#374151' }}>
                ⚙ Setup
              </button>
              <button onClick={() => setRulesOpen(true)}
                style={{ ...BTN, padding:'6px 13px', border:'1.5px solid #d1d5db', background:'white', fontSize:12, color:'#374151' }}>
                👥 Invigilator rules
              </button>
            </div>

            {/* ── Primary actions for this batch ── */}
            <div style={{ display:'flex', gap:9, marginBottom:14, flexWrap:'wrap', alignItems:'center' }}>
              <button onClick={() => openGenerate(semId)}
                style={{ ...BTN, padding:'9px 17px', border:'none', background:'#1a3a52', color:'white', fontWeight:700 }}>
                {slots.length ? '🔄 Regenerate this batch' : '⚙ Generate this batch'}
              </button>
              <button onClick={() => autoAssign(semId)} disabled={saving || !saved.length}
                title={saved.length ? 'Re-run invigilator assignment on the saved schedule' : 'Save the schedule first'}
                style={{ ...BTN, padding:'9px 15px', border:'1.5px solid #0d9488', background:'white', color:'#0d9488', cursor: saved.length ? 'pointer' : 'not-allowed', opacity: saved.length ? 1 : .5 }}>
                ⚡ Re-assign invigilators
              </button>
              <button onClick={() => addEditSlot(semId)}
                style={{ ...BTN, padding:'9px 14px', border:'1.5px solid #d1d5db', background:'white', color:'#374151' }}>
                + Add exam
              </button>
              <button onClick={() => setPreviewSem(semId)} disabled={!slots.length}
                style={{ ...BTN, padding:'9px 14px', border:'1.5px solid #d1d5db', background:'white', color:'#374151', cursor: slots.length ? 'pointer' : 'not-allowed', opacity: slots.length ? 1 : .5 }}>
                👁 Preview notice
              </button>

              <div style={{ marginLeft:'auto', display:'flex', gap:9, alignItems:'center' }}>
                {isDirty && <span style={{ fontSize:12, color:'#b45309', fontWeight:600 }}>Unsaved changes</span>}
                <button onClick={() => saveAll(semId)} disabled={saving || !slots.length}
                  style={{ ...BTN, padding:'9px 20px', border:'none', background: isDirty ? '#b45309' : '#374151', color:'white', fontWeight:700, cursor: slots.length ? 'pointer' : 'not-allowed', opacity: saving || !slots.length ? .6 : 1 }}>
                  {saving ? 'Saving…' : '💾 Save'}
                </button>
                <button onClick={() => publish(semId)} disabled={publishing || !saved.length || isDirty}
                  title={isDirty ? 'Save your changes before publishing' : !saved.length ? 'Save the schedule first' : undefined}
                  style={{ ...BTN, padding:'9px 20px', border:'none', background: isPublished ? '#334155' : '#0f5132', color:'white', fontWeight:700, cursor: (saved.length && !isDirty) ? 'pointer' : 'not-allowed', opacity: publishing || !saved.length || isDirty ? .55 : 1 }}>
                  {publishing ? 'Publishing…' : isPublished ? '🔁 Re-publish' : '📢 Publish'}
                </button>
              </div>
            </div>

            {/* ── Contextual notices ── */}
            <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:14 }}>
              {calendarDates.length > 0 ? (
                <div style={{ fontSize:12, color:'#1e40af', background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:7, padding:'7px 12px' }}>
                  📅 Academic calendar in-course week: <strong>{calendarDates.map(d => fmtDate(d)?.date || d).join(', ')}</strong> — used as the default start date.
                </div>
              ) : (
                <div style={{ fontSize:12, color:'#92400e', background:'#fffbeb', border:'1px solid #fde68a', borderRadius:7, padding:'7px 12px' }}>
                  No in-course week published in the academic calendar yet — set the start date manually when generating.
                </div>
              )}
              {tooManyExams && (
                <div style={{ fontSize:12, color:'#92400e', background:'#fffbeb', border:'1px solid #fde68a', borderRadius:7, padding:'7px 12px' }}>
                  ⚠ This batch has <strong>{theory.length} theory courses</strong> but only {MAX_EXAM_DAYS_PER_WEEK} exam days fit in one week (Sun–Thu). The schedule will run past the in-course week.
                </div>
              )}
              {overOneWeek && !tooManyExams && (
                <div style={{ fontSize:12, color:'#92400e', background:'#fffbeb', border:'1px solid #fde68a', borderRadius:7, padding:'7px 12px' }}>
                  ⚠ These exams span <strong>{weekSpan} days</strong>. Adjust the dates to keep the batch inside one week.
                </div>
              )}
              {isPublished && !isDirty && (
                <div style={{ fontSize:12, color:'#166534', background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:7, padding:'7px 12px' }}>
                  ✓ Published {session.published_at ? new Date(session.published_at).toLocaleString() : ''} — students and teachers can see and download this routine.
                </div>
              )}
            </div>

            {/* ── THE schedule: course, date, time, room and invigilators in one table ── */}
            {slots.length === 0 ? (
              <div style={{ textAlign:'center', padding:'52px 20px', color:'#9ca3af', fontSize:13, border:'1.5px dashed #e5e7eb', borderRadius:12 }}>
                <div style={{ fontSize:34, marginBottom:10 }}>🗓</div>
                No exams scheduled for this batch yet.<br />
                Click <strong>Generate this batch</strong> to build the schedule and assign invigilators in one step.
              </div>
            ) : (
              <div style={{ overflowX:'auto', border:'1px solid #e5e7eb', borderRadius:10 }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13, minWidth:940 }}>
                  <thead>
                    <tr style={{ background:'#1a3a52', color:'white' }}>
                      <th style={{ ...TH, width:34 }}>#</th>
                      <th style={{ ...TH, width:150 }}>Date &amp; Day</th>
                      <th style={{ ...TH, width:170 }}>Time</th>
                      <th style={TH}>Course</th>
                      <th style={{ ...TH, width:120 }}>Room(s)</th>
                      <th style={{ ...TH, minWidth:300 }}>Invigilators</th>
                      <th style={{ ...TH, width:34 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {slots.map((slot, idx) => {
                      const course  = allCourses[slot.course_id];
                      const df      = slot.exam_date ? fmtDate(slot.exam_date) : null;
                      const invigs  = iMap(semId, slot._id);
                      const short   = invigs.length < c.teachersPerExam;
                      const pool    = eligibleFor(slot);
                      const fromCal = slot.exam_date && calendarDates.includes(slot.exam_date);
                      return (
                        <tr key={slot._id || idx} style={{ background: idx%2===0 ? 'white' : '#fafbfc' }}>
                          <td style={{ ...TD, textAlign:'center', fontWeight:700, color:'#6b7280' }}>{idx+1}</td>

                          <td style={TD}>
                            <input type='date' value={slot.exam_date}
                              onChange={e => updEditSlot(semId, idx, 'exam_date', e.target.value)}
                              style={{ ...INPUT, width:'100%', border:`1px solid ${slot.exam_date ? '#d1d5db' : '#f59e0b'}` }} />
                            <div style={{ display:'flex', gap:5, alignItems:'center', marginTop:3 }}>
                              {df && <span style={{ fontSize:11, color:'#6b7280' }}>{df.day}</span>}
                              {fromCal && <span title="Inside the calendar's in-course week" style={{ fontSize:9.5, color:'#1e40af', background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:4, padding:'0 4px' }}>calendar</span>}
                            </div>
                          </td>

                          <td style={TD}>
                            <div style={{ display:'flex', gap:4, alignItems:'center' }}>
                              <input type='time' value={slot.start_time}
                                onChange={e => updEditSlot(semId, idx, 'start_time', e.target.value)}
                                style={{ ...INPUT, width:78 }} />
                              <span style={{ fontSize:11, color:'#9ca3af' }}>–</span>
                              <input type='time' value={slot.end_time}
                                onChange={e => updEditSlot(semId, idx, 'end_time', e.target.value)}
                                style={{ ...INPUT, width:78 }} />
                            </div>
                          </td>

                          <td style={TD}>
                            <select value={slot.course_id}
                              onChange={e => updEditSlot(semId, idx, 'course_id', e.target.value)}
                              style={{ ...INPUT, width:'100%', minWidth:200 }}>
                              <option value=''>— select course —</option>
                              {theory.map(co => <option key={co.id} value={co.id}>{co.code} – {co.title}</option>)}
                            </select>
                            {course && <div style={{ fontSize:10.5, color:'#9ca3af', marginTop:3 }}>{course.title}</div>}
                          </td>

                          <td style={TD}>
                            <input type='text' placeholder={c.rooms || '429 & 430'} value={slot.rooms}
                              onChange={e => updEditSlot(semId, idx, 'rooms', e.target.value)}
                              style={{ ...INPUT, width:'100%' }} />
                            {!slot.rooms && c.rooms && (
                              <button onClick={() => updEditSlot(semId, idx, 'rooms', c.rooms)}
                                style={{ marginTop:3, fontSize:10, cursor:'pointer', color:'#2563eb', background:'none', border:'none', padding:0, textDecoration:'underline' }}>
                                use {c.rooms}
                              </button>
                            )}
                          </td>

                          {/* Invigilators are edited right here — no separate tab. */}
                          <td style={TD}>
                            <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginBottom:6 }}>
                              {invigs.map(inv => {
                                const t = allTeachers.find(x => x.id === inv.teacher_id);
                                const onLeave = (lm[inv.teacher_id] || []).includes(slot.exam_date);
                                return (
                                  <span key={inv.teacher_id}
                                    title={`${t?.name || 'Unknown'}${inv.is_course_teacher ? ' — course teacher' : ''}${onLeave ? ' — ON LEAVE this date' : ''}`}
                                    style={{
                                      display:'inline-flex', alignItems:'center', gap:5, padding:'3px 6px 3px 9px',
                                      borderRadius:20, fontSize:11, fontWeight:600, maxWidth:200,
                                      border:`1.5px solid ${onLeave ? '#fca5a5' : inv.is_course_teacher ? '#93c5fd' : '#d1d5db'}`,
                                      background: onLeave ? '#fef2f2' : inv.is_course_teacher ? '#eff6ff' : '#f8fafc',
                                      color:      onLeave ? '#dc2626' : inv.is_course_teacher ? '#1e40af' : '#374151',
                                    }}>
                                    <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                                      {inv.is_course_teacher ? '★ ' : ''}{t?.name || 'Unknown'}{onLeave ? ' ⚠' : ''}
                                    </span>
                                    <button onClick={() => removeInvig(semId, slot._id, inv.teacher_id)}
                                      title="Remove"
                                      style={{ border:'none', background:'none', cursor:'pointer', color:'#9ca3af', fontSize:12, lineHeight:1, padding:0 }}>✕</button>
                                  </span>
                                );
                              })}
                              {invigs.length === 0 && <span style={{ fontSize:11.5, color:'#9ca3af' }}>none assigned</span>}
                            </div>
                            <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                              <select value='' onChange={e => { addInvig(semId, slot._id, e.target.value); e.target.value = ''; }}
                                style={{ ...INPUT, fontSize:11.5, maxWidth:190 }}>
                                <option value=''>+ add invigilator…</option>
                                {pool.map(t => (
                                  <option key={t.id} value={t.id}>
                                    {t.name} · {dutyCount[t.id] || 0} {(dutyCount[t.id] || 0) === 1 ? 'duty' : 'duties'}
                                  </option>
                                ))}
                              </select>
                              <span style={{
                                fontSize:10.5, fontWeight:700, padding:'2px 7px', borderRadius:20, whiteSpace:'nowrap',
                                background: short ? '#fffbeb' : '#f0fdf4', color: short ? '#92400e' : '#166534',
                                border:`1px solid ${short ? '#fde68a' : '#bbf7d0'}`,
                              }}>
                                {invigs.length}/{c.teachersPerExam}
                              </span>
                            </div>
                          </td>

                          <td style={{ ...TD, textAlign:'center' }}>
                            <button onClick={() => removeEditSlot(semId, idx)} title="Remove this exam"
                              style={{ padding:'3px 7px', borderRadius:6, border:'1px solid #fecaca', background:'#fef2f2', color:'#dc2626', fontSize:11, cursor:'pointer' }}>✕</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* ── Live duty distribution, so uneven loads are obvious ── */}
            {slots.length > 0 && Object.keys(dutyCount).length > 0 && (
              <div style={{ marginTop:16, background:'white', border:'1px solid #e5e7eb', borderRadius:10, padding:'12px 15px' }}>
                <div style={{ fontSize:11, fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:9 }}>
                  Invigilation duties in this batch
                </div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:7 }}>
                  {Object.entries(dutyCount)
                    .sort((a, b) => b[1] - a[1])
                    .map(([tid, n]) => {
                      const t = allTeachers.find(x => x.id === tid);
                      return (
                        <span key={tid} title={t?.designation || ''}
                          style={{ fontSize:11.5, padding:'3px 10px', borderRadius:20, background:'#f1f5f9', color:'#334155', border:'1px solid #e2e8f0' }}>
                          {t?.name || 'Unknown'} <strong>{n}</strong>
                        </span>
                      );
                    })}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Batch setup modal ── */}
      {setupOpen && (
        <Modal onClose={() => setSetupOpen(false)} title={`Setup — ${SEM_FULL[semId] || semId}`} width={520}>
          <div style={{ fontSize:12, color:'#6b7280', marginBottom:14 }}>
            These defaults apply to every exam of this batch. Shift {shiftOfBatch(semId)} ={' '}
            {shiftOfBatch(semId) === 1 ? '1st & 3rd year' : '2nd & 4th year'}.
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:12, marginBottom:16 }}>
            <Field label='Exam start time'>
              <input type='time' value={c.startTime} onChange={e => updCfg(semId,'startTime',e.target.value)} style={fieldStyle} />
            </Field>
            <Field label='Duration (min)'>
              <input type='number' min={15} max={360} value={c.durationMins}
                onChange={e => updCfg(semId,'durationMins',parseInt(e.target.value)||60)} style={fieldStyle} />
            </Field>
            <Field label='Invigilators / exam'>
              <input type='number' min={1} max={10} value={c.teachersPerExam}
                onChange={e => updCfg(semId,'teachersPerExam',parseInt(e.target.value)||3)} style={fieldStyle} />
            </Field>
            <Field label='Exam rooms'>
              <input type='text' placeholder='429 & 430' value={c.rooms}
                onChange={e => updCfg(semId,'rooms',e.target.value)} style={fieldStyle} />
            </Field>
          </div>
          <div style={{ display:'flex', justifyContent:'flex-end' }}>
            <button onClick={() => setSetupOpen(false)}
              style={{ ...BTN, padding:'8px 18px', border:'none', background:'#1a3a52', color:'white', fontWeight:700 }}>Done</button>
          </div>
        </Modal>
      )}

      {/* ── Invigilator rules modal (weights + leave) ── */}
      {rulesOpen && (
        <Modal onClose={() => setRulesOpen(false)} title='Invigilator rules' width={860}>
          <p style={{ fontSize:12.5, color:'#6b7280', margin:'0 0 14px' }}>
            Click a teacher to cycle their weight: <strong>2</strong> full duty · <strong>1</strong> own course only
            (Dean / Chairman) · <strong>0</strong> excluded. Teachers on approved leave are skipped automatically on
            those dates. Lecturers are assigned first, then Assistant → Associate → Professor.
          </p>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(270px,1fr))', gap:9, maxHeight:'55vh', overflowY:'auto' }}>
            {allTeachers.map(t => {
              const w = wm[t.id] ?? 2;
              const lDates = lm[t.id] || [];
              const onLeave = lDates.length > 0;
              return (
                <button key={t.id} onClick={() => cycleWeight(semId, t.id)}
                  style={{
                    display:'flex', alignItems:'center', gap:11, padding:'9px 13px', borderRadius:10,
                    border:`1.5px solid ${onLeave ? '#fca5a5' : WEIGHT_BORDER[w]}`,
                    background: onLeave ? '#fef2f2' : WEIGHT_BG[w], cursor:'pointer', textAlign:'left',
                  }}>
                  <span style={{
                    width:32, height:32, borderRadius:'50%', flexShrink:0,
                    background: onLeave ? '#dc2626' : '#1a3a52', color:'white',
                    display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700,
                  }}>{initials(t)}</span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:12.5, fontWeight:600, color:'#111827', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.name}</div>
                    <div style={{ fontSize:10, color:'#6b7280' }}>{t.special_post || t.designation || ''}</div>
                    {onLeave && <div style={{ fontSize:10, color:'#dc2626', fontWeight:600 }}>On leave · {lDates.length} exam date{lDates.length>1?'s':''}</div>}
                  </div>
                  <span style={{
                    fontSize:10.5, fontWeight:700, padding:'2px 8px', borderRadius:20, flexShrink:0,
                    background:'white', color:WEIGHT_TEXT[w], border:`1px solid ${WEIGHT_BORDER[w]}`,
                  }}>{w} — {WEIGHT_LABEL[w]}</span>
                </button>
              );
            })}
          </div>
          <div style={{ display:'flex', justifyContent:'flex-end', marginTop:14 }}>
            <button onClick={() => setRulesOpen(false)}
              style={{ ...BTN, padding:'8px 18px', border:'none', background:'#1a3a52', color:'white', fontWeight:700 }}>Done</button>
          </div>
        </Modal>
      )}

      {/* ── Single-batch generate modal ── */}
      {genOpen && (
        <Modal onClose={() => !generating && setGenOpen(false)} title={`Generate — ${SEM_FULL[semId] || semId}`} width={560}>
          <div style={{ fontSize:12, color:'#6b7280', marginBottom:14 }}>
            {theory.length} theory course{theory.length !== 1 ? 's' : ''} ·{' '}
            {theory.length < 5 ? 'Tuesday will be left as a gap day' : 'regular run on consecutive class days'}
            {' · '}shift {shiftOfBatch(semId)} ({shiftOfBatch(semId) === 1 ? '1st & 3rd year' : '2nd & 4th year'})
            {' · '}invigilators are assigned in the same pass.
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:12, marginBottom:16 }}>
            <Field label={`Start date${calendarDates[0] ? ' (from calendar)' : ''}`}>
              <input type='date' value={genForm.startDate}
                onChange={e => setGenForm(f => ({ ...f, startDate: e.target.value }))} style={fieldStyle} />
            </Field>
            <Field label={`Start time (shift ${shiftOfBatch(semId)})`}>
              <input type='time'
                value={shiftOfBatch(semId) === 2 ? genForm.shift2Time : genForm.shift1Time}
                onChange={e => setGenForm(f => shiftOfBatch(semId) === 2
                  ? { ...f, shift2Time: e.target.value }
                  : { ...f, shift1Time: e.target.value })} style={fieldStyle} />
            </Field>
            <Field label='Exam rooms'>
              <input type='text' value={genForm.rooms} placeholder='429 & 430'
                onChange={e => setGenForm(f => ({ ...f, rooms: e.target.value }))} style={fieldStyle} />
            </Field>
            <Field label='Invigilators / exam'>
              <input type='number' min='1' value={genForm.perExam}
                onChange={e => setGenForm(f => ({ ...f, perExam: e.target.value }))} style={fieldStyle} />
            </Field>
            <Field label='Duration (mins)'>
              <input type='number' min='15' step='15' value={genForm.durationMins}
                onChange={e => setGenForm(f => ({ ...f, durationMins: e.target.value }))} style={fieldStyle} />
            </Field>
          </div>
          <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
            <button onClick={() => setGenOpen(false)}
              style={{ ...BTN, padding:'8px 16px', border:'1.5px solid #d1d5db', background:'white', color:'#374151' }}>Cancel</button>
            <button onClick={() => runGenerate(semId)} disabled={generating}
              style={{ ...BTN, padding:'8px 18px', border:'none', background:'linear-gradient(135deg,#1a3a52,#2c5f8a)', color:'white', fontWeight:700, opacity: generating ? .6 : 1 }}>
              {generating ? 'Generating…' : 'Generate'}
            </button>
          </div>
        </Modal>
      )}

      {/* ── Generate-all modal ── */}
      {genAllOpen && (
        <Modal onClose={() => !genAllRunning && setGenAllOpen(false)}
          title={`Generate all ${sorted.length} batch${sorted.length !== 1 ? 'es' : ''}`} width={760}>
          <div style={{ fontSize:12, color:'#6b7280', marginBottom:14 }}>
            Theory courses only. Each batch keeps one fixed start time and room set for every exam;
            a batch with fewer than 5 exams leaves Tuesday as a gap day. Invigilators are assigned
            in the same pass and everything is saved automatically.
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:12, marginBottom:14 }}>
            <Field label={`Start date${calendarDates[0] ? ' (from calendar)' : ''}`}>
              <input type='date' value={genForm.startDate}
                onChange={e => setGenForm(f => ({ ...f, startDate: e.target.value }))} style={fieldStyle} />
            </Field>
            <Field label='Shift 1 start (1st & 3rd yr)'>
              <input type='time' value={genForm.shift1Time}
                onChange={e => setGenForm(f => ({ ...f, shift1Time: e.target.value }))} style={fieldStyle} />
            </Field>
            <Field label='Shift 2 start (2nd & 4th yr)'>
              <input type='time' value={genForm.shift2Time}
                onChange={e => setGenForm(f => ({ ...f, shift2Time: e.target.value }))} style={fieldStyle} />
            </Field>
            <Field label='Invigilators / exam'>
              <input type='number' min='1' value={genForm.perExam}
                onChange={e => setGenForm(f => ({ ...f, perExam: e.target.value }))} style={fieldStyle} />
            </Field>
            <Field label='Duration (mins)'>
              <input type='number' min='15' step='15' value={genForm.durationMins}
                onChange={e => setGenForm(f => ({ ...f, durationMins: e.target.value }))} style={fieldStyle} />
            </Field>
          </div>
          <div style={{ fontSize:12, fontWeight:600, color:'#374151', marginBottom:6 }}>Rooms per batch</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))', gap:10, marginBottom:16 }}>
            {sorted.map(sid => (
              <Field key={sid} label={`${SEM_LABEL[sid] || sid} · shift ${shiftOfBatch(sid)}`}>
                <input type='text' placeholder='429 & 430' value={batchRooms[sid] || ''}
                  onChange={e => setBatchRooms(r => ({ ...r, [sid]: e.target.value }))} style={fieldStyle} />
              </Field>
            ))}
          </div>
          <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
            <button onClick={() => setGenAllOpen(false)}
              style={{ ...BTN, padding:'8px 16px', border:'1.5px solid #d1d5db', background:'white', color:'#374151' }}>Cancel</button>
            <button onClick={generateAll} disabled={genAllRunning}
              style={{ ...BTN, padding:'8px 18px', border:'none', background:'linear-gradient(135deg,#1a3a52,#2c5f8a)', color:'white', fontWeight:700, opacity: genAllRunning ? .6 : 1 }}>
              {genAllRunning ? 'Generating…' : 'Generate & save all'}
            </button>
          </div>
        </Modal>
      )}

      {/* ── Official-format preview + download ── */}
      {previewSem && (() => {
        // Prefer the editable rows so the preview reflects unsaved edits.
        const rows = eSlots(previewSem);
        const docSlots = rows.length
          ? rows.map(s => ({
              id: s._id, course_id: s.course_id, exam_date: s.exam_date,
              start_time: s.start_time, end_time: s.end_time, rooms: s.rooms,
              invigilators: iMap(previewSem, s._id),
            }))
          : dbSlots(previewSem).map(s => ({ ...s, invigilators: iMap(previewSem, s.id) }));
        const tMap = {};
        for (const t of allTeachers) tMap[t.id] = t;

        return (
          <div
            onClick={e => e.target === e.currentTarget && setPreviewSem(null)}
            style={{ position:'fixed', inset:0, background:'rgba(15,23,42,.55)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:10000, padding:20 }}
          >
            <div style={{ background:'#f8fafc', borderRadius:12, width:'100%', maxWidth:900, height:'92vh', display:'flex', flexDirection:'column', overflow:'hidden', boxShadow:'0 20px 60px rgba(0,0,0,.3)' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, padding:'12px 18px', background:'white', borderBottom:'1px solid #e5e7eb' }}>
                <span style={{ fontWeight:700, fontSize:14, color:'#1a2a4a' }}>
                  Preview — {SEM_FULL[previewSem]} in-course notice
                </span>
                <div style={{ display:'flex', gap:8 }}>
                  <button
                    onClick={() => printRef.current && printCalendarNode(printRef.current, `Incourse Routine - ${SEM_FULL[previewSem]}`)}
                    style={{ ...BTN, padding:'7px 14px', border:'1.5px solid #cbd5e1', background:'white', fontSize:12.5, fontWeight:700, color:'#1e3a5f' }}>
                    ⬇ Download PDF
                  </button>
                  <button onClick={() => setPreviewSem(null)}
                    style={{ ...BTN, padding:'7px 14px', border:'1.5px solid #cbd5e1', background:'white', fontSize:12.5, fontWeight:700, color:'#1e3a5f' }}>
                    ✕ Close
                  </button>
                </div>
              </div>
              <div style={{ flex:1, overflow:'auto', padding:20 }}>
                <div ref={printRef}>
                  <IncourseDocument
                    batchLabel={SEM_FULL[previewSem]}
                    slots={docSlots}
                    courseMap={allCourses}
                    teacherMap={tMap}
                    noticeDate={new Date().toISOString().slice(0, 10)}
                  />
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ── Small presentational helpers ───────────────────────────────────────────────
const fieldStyle = {
  display:'block', width:'100%', marginTop:4, padding:'7px 9px',
  border:'1.5px solid #d1d5db', borderRadius:7, fontSize:13, boxSizing:'border-box',
};

function Field({ label, children }) {
  return (
    <label style={{ fontSize:12, fontWeight:600, color:'#374151' }}>
      {label}
      {children}
    </label>
  );
}

function Modal({ title, width = 560, onClose, children }) {
  return (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position:'fixed', inset:0, background:'rgba(15,23,42,.55)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:10000, padding:20 }}
    >
      <div style={{ background:'white', borderRadius:12, padding:'20px 24px', width:'100%', maxWidth:width, maxHeight:'90vh', overflowY:'auto', boxShadow:'0 20px 60px rgba(0,0,0,.3)' }}>
        <div style={{ fontWeight:700, fontSize:15, color:'#1a3a52', marginBottom:10 }}>{title}</div>
        {children}
      </div>
    </div>
  );
}
