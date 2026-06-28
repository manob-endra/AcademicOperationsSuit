import { useState, useEffect, useCallback } from 'react';
import { examRoutineAPI } from '../../services/examRoutineAPI';

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

const TH = { padding:'9px 12px', textAlign:'left', fontSize:11, fontWeight:700, border:'1px solid #1e4a6e', whiteSpace:'nowrap' };
const TD = { padding:'8px 12px', border:'1px solid #e5e7eb', verticalAlign:'top' };

export default function IncourseExamRoutine({ selectedSemesters = [] }) {
  const sorted = [...selectedSemesters].sort((a,b) => SEM_ORDER.indexOf(a) - SEM_ORDER.indexOf(b));

  const [activeSem,   setActiveSem]   = useState(sorted[0] || '');
  const [allTeachers, setAllTeachers] = useState([]);
  const [allCourses,  setAllCourses]  = useState({});
  const [routineMap,  setRoutineMap]  = useState({});
  const [globalLoad,  setGlobalLoad]  = useState(true);

  const [semSessions, setSemSessions] = useState({}); // semId → { session, slots(DB), weightMap, leaveMap, loaded }
  const [editSlots,   setEditSlots]   = useState({}); // semId → [editable slot]
  const [invigState,  setInvigState]  = useState({}); // semId → { slotId: [invig] }
  const [configs,     setConfigs]     = useState({}); // semId → config

  const [activeTab,  setActiveTab]  = useState('slots');
  const [saving,     setSaving]     = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [msg,        setMsg]        = useState({ type:'', text:'' });

  // ── Global load ──────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      setGlobalLoad(true);
      const [cRes, tRes, rRes] = await Promise.all([
        fetch(`${API}/courses`).then(r => r.json()).catch(() => ({})),
        fetch(`${API}/teachers`).then(r => r.json()).catch(() => ({})),
        fetch(`${API}/routine`).then(r => r.json()).catch(() => ({})),
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
      setGlobalLoad(false);
    })();
  }, []);

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
        startTime:      session.default_start_time    || '11:30',
        durationMins:   session.default_duration_mins || 60,
        teachersPerExam: session.teachers_per_exam    || 3,
        rooms: '',
      },
    }));
  }, []);

  useEffect(() => {
    if (globalLoad || !activeSem) return;
    if (!semSessions[activeSem]?.loaded) loadSession(activeSem);
  }, [activeSem, globalLoad, loadSession, semSessions]);

  // ── Accessors ─────────────────────────────────────────────────────────────────
  const cfg     = s => configs[s] || { startTime:'11:30', durationMins:60, teachersPerExam:3, rooms:'' };
  const sess    = s => semSessions[s]?.session;
  const dbSlots = s => semSessions[s]?.slots || [];
  const wMap    = s => semSessions[s]?.weightMap || {};
  const lMap    = s => semSessions[s]?.leaveMap  || {};
  const eSlots  = s => editSlots[s] || [];
  const iMap    = (s, slotId) => invigState[s]?.[slotId] || [];

  const theoryCourses = semId => {
    const seen = new Set(), result = [];
    for (const e of (routineMap[semId] || [])) {
      if (!e.course_id || seen.has(e.course_id)) continue;
      seen.add(e.course_id);
      const c = allCourses[e.course_id];
      if (!c || c.course_type === 'lab') continue;
      result.push(c);
    }
    return result.sort((a, b) => (a.code || '').localeCompare(b.code || ''));
  };

  const updCfg = (semId, field, val) =>
    setConfigs(prev => ({ ...prev, [semId]: { ...cfg(semId), [field]: val } }));

  // ── Generate slots ────────────────────────────────────────────────────────────
  const generateSlots = semId => {
    const courses = theoryCourses(semId);
    if (!courses.length) { setMsg({ type:'error', text:'No theory courses found in the routine for this semester.' }); return; }
    const c = cfg(semId);
    setEditSlots(prev => ({
      ...prev, [semId]: courses.map(course => ({
        _id: `new-${course.id}`, course_id: course.id,
        exam_date: '', start_time: c.startTime, end_time: addMins(c.startTime, c.durationMins),
        rooms: c.rooms,
      })),
    }));
    setMsg({ type:'info', text:`Generated ${courses.length} theory course slots. Set the exam date for each, then save.` });
  };

  const updEditSlot = (semId, idx, field, val) => {
    setEditSlots(prev => {
      const next = [...(prev[semId] || [])];
      next[idx] = { ...next[idx], [field]: val };
      if (field === 'start_time') next[idx].end_time = addMins(val, cfg(semId).durationMins);
      return { ...prev, [semId]: next };
    });
  };

  const removeEditSlot = (semId, idx) =>
    setEditSlots(prev => ({ ...prev, [semId]: (prev[semId] || []).filter((_, i) => i !== idx) }));

  const addEditSlot = semId => {
    const c = cfg(semId), courses = theoryCourses(semId);
    setEditSlots(prev => ({
      ...prev, [semId]: [...(prev[semId] || []), {
        _id: `new-${Date.now()}`, course_id: courses[0]?.id || '',
        exam_date: '', start_time: c.startTime, end_time: addMins(c.startTime, c.durationMins), rooms: c.rooms,
      }],
    }));
  };

  // ── Save slots ────────────────────────────────────────────────────────────────
  const saveSlots = async semId => {
    const session = sess(semId);
    if (!session?.id) return;
    const slots = eSlots(semId);
    if (slots.filter(s => !s.exam_date).length) {
      setMsg({ type:'error', text:'Please fill exam dates for all slots before saving.' }); return;
    }
    if (slots.some(s => !s.course_id)) {
      setMsg({ type:'error', text:'Please select a course for every slot.' }); return;
    }
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
    if (res.success) {
      setMsg({ type:'success', text:'Slots saved.' });
      setSemSessions(prev => ({ ...prev, [semId]: { ...prev[semId], loaded: false } }));
      await loadSession(semId);
      setActiveTab('assign');
    } else {
      setMsg({ type:'error', text: res.error || 'Save failed.' });
    }
    setSaving(false);
  };

  // ── Weight ────────────────────────────────────────────────────────────────────
  const cycleWeight = async (semId, tid) => {
    const cur = wMap(semId)[tid] ?? 2;
    const next = cur >= 2 ? 0 : cur + 1;
    setSemSessions(prev => ({
      ...prev, [semId]: { ...prev[semId], weightMap: { ...prev[semId]?.weightMap, [tid]: next } },
    }));
    const session = sess(semId);
    if (session?.id) await examRoutineAPI.setWeight('incourse', session.id, tid, next);
  };

  // ── Auto-assign ───────────────────────────────────────────────────────────────
  const autoAssign = async semId => {
    const session = sess(semId);
    if (!session?.id || !dbSlots(semId).length) {
      setMsg({ type:'error', text:'Save slots first before auto-assigning.' }); return;
    }
    setSaving(true);
    const c = cfg(semId);
    const res = await examRoutineAPI.autoAssign('incourse', session.id, semId, wMap(semId), c.teachersPerExam);
    if (res.success) {
      setMsg({ type:'success', text:'Auto-assigned invigilators.' });
      setSemSessions(prev => ({ ...prev, [semId]: { ...prev[semId], loaded: false } }));
      await loadSession(semId);
    } else {
      setMsg({ type:'error', text: res.error || 'Auto-assign failed.' });
    }
    setSaving(false);
  };

  // ── Toggle invigilator ────────────────────────────────────────────────────────
  const toggleInvig = (semId, slotId, tid) => {
    setInvigState(prev => {
      const cur = prev[semId]?.[slotId] || [];
      const has = cur.some(i => i.teacher_id === tid);
      return {
        ...prev, [semId]: {
          ...prev[semId],
          [slotId]: has
            ? cur.filter(i => i.teacher_id !== tid)
            : [...cur, { teacher_id: tid, is_course_teacher: false, is_lead: false }],
        },
      };
    });
  };

  const saveInvigilators = async semId => {
    const session = sess(semId);
    if (!session?.id) return;
    setSaving(true);
    const res = await examRoutineAPI.saveInvigilators('incourse', session.id, invigState[semId] || {});
    if (res.success) setMsg({ type:'success', text:'Assignments saved.' });
    else setMsg({ type:'error', text: res.error || 'Save failed.' });
    setSaving(false);
  };

  // ── Publish ───────────────────────────────────────────────────────────────────
  const publish = async semId => {
    const session = sess(semId);
    if (!session?.id || !dbSlots(semId).length) { setMsg({ type:'error', text:'Save slots first.' }); return; }
    setPublishing(true);
    const res = await examRoutineAPI.publish('incourse', session.id);
    if (res.success) {
      setMsg({ type:'success', text:'Published! Email notifications will be sent.' });
      setSemSessions(prev => ({ ...prev, [semId]: { ...prev[semId], loaded: false } }));
      await loadSession(semId);
    } else {
      setMsg({ type:'error', text: res.error || 'Publish failed.' });
    }
    setPublishing(false);
  };

  // ── Render ────────────────────────────────────────────────────────────────────
  if (globalLoad) return <div style={{ padding:40, textAlign:'center', color:'#9ca3af' }}>Loading…</div>;
  if (!sorted.length) return (
    <div style={{ padding:'48px 24px', textAlign:'center', color:'#9ca3af' }}>
      No semesters selected. Go to <strong>Home</strong> and select semesters first.
    </div>
  );

  const semId     = activeSem;
  const c         = cfg(semId);
  const session   = sess(semId);
  const slots     = eSlots(semId);
  const saved     = dbSlots(semId);
  const wm        = wMap(semId);
  const lm        = lMap(semId);
  const theory    = theoryCourses(semId);
  const isLoading = !semSessions[semId]?.loaded;

  return (
    <div>
      {/* ── Semester tabs ── */}
      <div style={{ display:'flex', overflowX:'auto', borderBottom:'2px solid #e5e7eb', background:'#f8fafc', padding:'0 24px' }}>
        {sorted.map(sid => (
          <button key={sid} onClick={() => { setActiveSem(sid); setMsg({ type:'', text:'' }); setActiveTab('slots'); }}
            style={{
              padding:'10px 18px', fontSize:13, fontWeight:600, cursor:'pointer', background:'none', border:'none',
              borderBottom: sid === semId ? '2.5px solid #1a3a52' : '2.5px solid transparent',
              color: sid === semId ? '#1a3a52' : '#6b7280', marginBottom:-2, whiteSpace:'nowrap',
            }}>
            {SEM_LABEL[sid] || sid}
            {semSessions[sid]?.session?.published && <span style={{ marginLeft:5, color:'#16a34a', fontSize:10 }}>✓</span>}
          </button>
        ))}
      </div>

      <div style={{ padding:'20px 24px' }}>
        <div style={{ marginBottom:16 }}>
          <h3 style={{ fontSize:16, fontWeight:700, color:'#1a3a52', margin:'0 0 3px' }}>
            Incourse Exam Routine — {SEM_FULL[semId] || semId}
          </h3>
          <p style={{ margin:0, fontSize:13, color:'#6b7280' }}>
            Theory courses only · {theory.length} course{theory.length !== 1 ? 's' : ''} found in routine
          </p>
        </div>

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
            {/* ── Config row ── */}
            <div style={{
              background:'#f8fafc', border:'1px solid #e5e7eb', borderRadius:10,
              padding:'14px 16px', marginBottom:20, display:'flex', gap:16, flexWrap:'wrap', alignItems:'flex-end',
            }}>
              <label style={{ display:'flex', flexDirection:'column', gap:4 }}>
                <span style={{ fontWeight:600, color:'#6b7280', fontSize:11 }}>Exam Start Time</span>
                <input type='time' value={c.startTime} onChange={e => updCfg(semId,'startTime',e.target.value)}
                  style={{ padding:'6px 8px', borderRadius:6, border:'1.5px solid #d1d5db', fontSize:13 }}/>
              </label>
              <label style={{ display:'flex', flexDirection:'column', gap:4 }}>
                <span style={{ fontWeight:600, color:'#6b7280', fontSize:11 }}>Duration (min)</span>
                <input type='number' min={15} max={360} value={c.durationMins}
                  onChange={e => updCfg(semId,'durationMins',parseInt(e.target.value)||60)}
                  style={{ width:70, padding:'6px 8px', borderRadius:6, border:'1.5px solid #d1d5db', fontSize:13, textAlign:'center' }}/>
              </label>
              <label style={{ display:'flex', flexDirection:'column', gap:4 }}>
                <span style={{ fontWeight:600, color:'#6b7280', fontSize:11 }}>Invigilators per exam</span>
                <input type='number' min={1} max={10} value={c.teachersPerExam}
                  onChange={e => updCfg(semId,'teachersPerExam',parseInt(e.target.value)||3)}
                  style={{ width:60, padding:'6px 8px', borderRadius:6, border:'1.5px solid #d1d5db', fontSize:13, textAlign:'center' }}/>
              </label>
              <label style={{ display:'flex', flexDirection:'column', gap:4, flex:1, minWidth:220 }}>
                <span style={{ fontWeight:600, color:'#6b7280', fontSize:11 }}>
                  Default Exam Rooms (comma-separated, e.g. 429, 430)
                </span>
                <input type='text' placeholder='429, 430' value={c.rooms}
                  onChange={e => updCfg(semId,'rooms',e.target.value)}
                  style={{ padding:'6px 10px', borderRadius:6, border:'1.5px solid #d1d5db', fontSize:13, width:'100%', boxSizing:'border-box' }}/>
              </label>
            </div>

            {/* ── Sub-tabs ── */}
            <div style={{ display:'flex', borderBottom:'2px solid #e5e7eb', marginBottom:20 }}>
              {[['slots','Exam Slots'],['weights','Invigilator Weights'],['assign','Assign Invigilators']].map(([k,lbl]) => (
                <button key={k} onClick={() => setActiveTab(k)} style={{
                  padding:'9px 18px', fontSize:13, fontWeight:600, cursor:'pointer', background:'none', border:'none',
                  borderBottom: activeTab===k ? '2.5px solid #1a3a52' : '2.5px solid transparent',
                  color: activeTab===k ? '#1a3a52' : '#6b7280', marginBottom:-2,
                }}>{lbl}</button>
              ))}
            </div>

            {/* ─── SLOTS TAB ─── */}
            {activeTab === 'slots' && (
              <div>
                <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap', alignItems:'center' }}>
                  <button onClick={() => generateSlots(semId)}
                    style={{ padding:'8px 16px', borderRadius:8, border:'1.5px solid #d1d5db', fontSize:13, fontWeight:600, cursor:'pointer', background:'white', color:'#374151' }}>
                    Generate from theory courses ({theory.length})
                  </button>
                  <button onClick={() => addEditSlot(semId)}
                    style={{ padding:'8px 14px', borderRadius:8, border:'1.5px solid #d1d5db', fontSize:13, fontWeight:600, cursor:'pointer', background:'white', color:'#374151' }}>
                    + Add slot
                  </button>
                  <span style={{ fontSize:11, color:'#9ca3af' }}>Lab courses excluded automatically.</span>
                </div>

                {slots.length === 0 ? (
                  <div style={{ textAlign:'center', padding:'48px 20px', color:'#9ca3af', fontSize:13, border:'1.5px dashed #e5e7eb', borderRadius:12 }}>
                    No slots yet. Click <strong>Generate</strong> to auto-fill from theory courses, or add manually.
                  </div>
                ) : (
                  <div style={{ overflowX:'auto', marginBottom:16 }}>
                    <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13, minWidth:680 }}>
                      <thead>
                        <tr style={{ background:'#1a3a52', color:'white' }}>
                          <th style={TH}>#</th>
                          <th style={TH}>Date & Time</th>
                          <th style={TH}>Course (Theory Only)</th>
                          <th style={TH}>Room(s)</th>
                          <th style={{ ...TH, width:36 }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {slots.map((slot, idx) => {
                          const course = allCourses[slot.course_id];
                          const df = slot.exam_date ? fmtDate(slot.exam_date) : null;
                          return (
                            <tr key={idx} style={{ background: idx%2===0?'white':'#f8fafc' }}>
                              <td style={{ ...TD, textAlign:'center', fontWeight:700, width:36 }}>{idx+1}</td>
                              <td style={TD}>
                                <input type='date' value={slot.exam_date}
                                  onChange={e => updEditSlot(semId, idx, 'exam_date', e.target.value)}
                                  style={{ padding:'4px 8px', borderRadius:6, fontSize:12, display:'block', marginBottom:4, border:`1px solid ${slot.exam_date?'#d1d5db':'#f59e0b'}` }}/>
                                {df && <div style={{ fontSize:11, color:'#6b7280', marginBottom:4 }}>{df.day}</div>}
                                <div style={{ display:'flex', gap:4, alignItems:'center' }}>
                                  <input type='time' value={slot.start_time}
                                    onChange={e => updEditSlot(semId, idx, 'start_time', e.target.value)}
                                    style={{ padding:'3px 6px', borderRadius:6, border:'1px solid #d1d5db', fontSize:11, width:90 }}/>
                                  <span style={{ fontSize:11, color:'#9ca3af' }}>–</span>
                                  <input type='time' value={slot.end_time}
                                    onChange={e => updEditSlot(semId, idx, 'end_time', e.target.value)}
                                    style={{ padding:'3px 6px', borderRadius:6, border:'1px solid #d1d5db', fontSize:11, width:90 }}/>
                                </div>
                              </td>
                              <td style={TD}>
                                <select value={slot.course_id}
                                  onChange={e => updEditSlot(semId, idx, 'course_id', e.target.value)}
                                  style={{ padding:'4px 8px', borderRadius:6, border:'1px solid #d1d5db', fontSize:12, width:'100%', minWidth:220 }}>
                                  <option value=''>— select course —</option>
                                  {theory.map(co => (
                                    <option key={co.id} value={co.id}>{co.code} – {co.title}</option>
                                  ))}
                                </select>
                                {course && <div style={{ fontSize:10, color:'#6b7280', marginTop:2 }}>{course.code}</div>}
                              </td>
                              <td style={TD}>
                                <input type='text' placeholder={c.rooms || 'e.g. 429, 430'} value={slot.rooms}
                                  onChange={e => updEditSlot(semId, idx, 'rooms', e.target.value)}
                                  style={{ padding:'4px 8px', borderRadius:6, border:'1px solid #d1d5db', fontSize:12, width:130 }}/>
                                {!slot.rooms && c.rooms && (
                                  <button onClick={() => updEditSlot(semId, idx, 'rooms', c.rooms)}
                                    style={{ display:'block', marginTop:3, fontSize:10, cursor:'pointer', color:'#2563eb', background:'none', border:'none', padding:0, textDecoration:'underline' }}>
                                    Use default ({c.rooms})
                                  </button>
                                )}
                              </td>
                              <td style={{ ...TD, textAlign:'center' }}>
                                <button onClick={() => removeEditSlot(semId, idx)}
                                  style={{ padding:'3px 8px', borderRadius:6, border:'1px solid #fecaca', background:'#fef2f2', color:'#dc2626', fontSize:11, cursor:'pointer' }}>✕</button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {slots.length > 0 && (
                  <button onClick={() => saveSlots(semId)} disabled={saving}
                    style={{ padding:'9px 22px', borderRadius:8, border:'none', background:'#1a3a52', color:'white', fontSize:13, fontWeight:700, cursor:'pointer', opacity:saving?0.7:1 }}>
                    {saving ? 'Saving…' : 'Save slots →'}
                  </button>
                )}
              </div>
            )}

            {/* ─── WEIGHTS TAB ─── */}
            {activeTab === 'weights' && (
              <div>
                <p style={{ fontSize:13, color:'#6b7280', marginBottom:16 }}>
                  Click a teacher to cycle weight: 0 = Excluded, 1 = Own course only, 2 = Full duty.
                  Chairman / Dean default to 1. Teachers on leave are highlighted and auto-skipped.
                </p>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:10 }}>
                  {allTeachers.map(t => {
                    const w = wm[t.id] ?? 2;
                    const lDates = lm[t.id] || [];
                    const onLeave = lDates.length > 0;
                    return (
                      <button key={t.id} onClick={() => cycleWeight(semId, t.id)}
                        style={{
                          display:'flex', alignItems:'center', gap:12, padding:'10px 14px', borderRadius:10,
                          border:`1.5px solid ${onLeave ? '#fca5a5' : WEIGHT_BORDER[w]}`,
                          background: onLeave ? '#fef2f2' : WEIGHT_BG[w], cursor:'pointer', textAlign:'left',
                        }}>
                        <span style={{
                          width:34, height:34, borderRadius:'50%', flexShrink:0,
                          background: onLeave ? '#dc2626' : '#1a3a52', color:'white',
                          display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700,
                        }}>
                          {t.initials || t.name?.slice(0,2) || '?'}
                        </span>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:13, fontWeight:600, color:'#111827', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.name}</div>
                          {t.special_post && <div style={{ fontSize:10, color:'#6b7280' }}>{t.special_post}</div>}
                          {onLeave && <div style={{ fontSize:10, color:'#dc2626', fontWeight:600, marginTop:2 }}>
                            On leave · {lDates.length} exam date{lDates.length>1?'s':''}
                          </div>}
                        </div>
                        {onLeave ? (
                          <span style={{ fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:20, flexShrink:0, background:'#fee2e2', color:'#dc2626', border:'1px solid #fca5a5' }}>On Leave</span>
                        ) : (
                          <span style={{ fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:20, flexShrink:0, background:'white', color:WEIGHT_TEXT[w], border:`1px solid ${WEIGHT_BORDER[w]}` }}>
                            {w} — {WEIGHT_LABEL[w]}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ─── ASSIGN TAB ─── */}
            {activeTab === 'assign' && (
              <div>
                <div style={{ display:'flex', gap:10, marginBottom:16, alignItems:'center', flexWrap:'wrap' }}>
                  <button onClick={() => autoAssign(semId)} disabled={saving || !saved.length}
                    style={{ padding:'9px 20px', borderRadius:8, border:'none', background:'#0d9488', color:'white', fontSize:13, fontWeight:700, cursor:'pointer', opacity:saving?0.7:1 }}>
                    {saving ? 'Running…' : '⚡ Auto-assign'}
                  </button>
                  <button onClick={() => saveInvigilators(semId)} disabled={saving}
                    style={{ padding:'9px 18px', borderRadius:8, border:'1.5px solid #d1d5db', background:'white', color:'#374151', fontSize:13, fontWeight:600, cursor:'pointer' }}>
                    Save assignments
                  </button>
                </div>

                {(() => {
                  const conflicts = Object.entries(lm).filter(([, d]) => d.length > 0);
                  return conflicts.length > 0 && (
                    <div style={{ background:'#fffbeb', border:'1px solid #fde68a', borderRadius:8, padding:'10px 14px', marginBottom:16, fontSize:12, color:'#92400e' }}>
                      <strong>Leave conflicts:</strong>{' '}
                      {conflicts.map(([tid, dates]) => {
                        const t = allTeachers.find(x => x.id === tid);
                        return t ? `${t.name} (${dates.length} date${dates.length>1?'s':''})` : '';
                      }).filter(Boolean).join(', ')}.
                      Auto-assign skips them on their leave dates.
                    </div>
                  );
                })()}

                {!saved.length ? (
                  <div style={{ padding:40, textAlign:'center', color:'#9ca3af', fontSize:13, border:'1.5px dashed #e5e7eb', borderRadius:12 }}>
                    No saved slots. Go to <strong>Exam Slots</strong> tab, fill all dates, and save first.
                  </div>
                ) : (
                  <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                    {saved.map((slot, sIdx) => {
                      const course   = allCourses[slot.course_id];
                      const invigs   = iMap(semId, slot.id);
                      const assigned = new Set(invigs.map(i => i.teacher_id));
                      const df       = slot.exam_date ? fmtDate(slot.exam_date) : null;
                      return (
                        <div key={sIdx} style={{ border:'1.5px solid #e5e7eb', borderRadius:10, padding:'14px 16px', background:'white' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10, flexWrap:'wrap' }}>
                            <span style={{ fontWeight:700, color:'white', fontSize:12, background:'#1a3a52', borderRadius:4, padding:'2px 8px', flexShrink:0 }}>{sIdx+1}</span>
                            <span style={{ fontWeight:700, color:'#374151' }}>{course?.code || '?'}</span>
                            <span style={{ fontSize:12, color:'#6b7280' }}>{course?.title || ''}</span>
                            {df && <>
                              <span style={{ fontSize:11, background:'#f1f5f9', padding:'2px 7px', borderRadius:5, color:'#374151' }}>{df.date}</span>
                              <span style={{ fontSize:11, color:'#6b7280' }}>{df.day}</span>
                            </>}
                            {slot.start_time && <span style={{ fontSize:11, color:'#6b7280' }}>{fmtTime(slot.start_time)} – {fmtTime(slot.end_time)}</span>}
                            {slot.rooms && <span style={{ fontSize:11, background:'#fef9c3', padding:'2px 7px', borderRadius:5, color:'#713f12' }}>Room: {slot.rooms}</span>}
                            <span style={{
                              fontSize:11, padding:'2px 8px', borderRadius:6, marginLeft:'auto',
                              background: assigned.size >= c.teachersPerExam ? '#d1fae5' : '#fffbeb',
                              color:       assigned.size >= c.teachersPerExam ? '#166534' : '#92400e',
                            }}>
                              {assigned.size}/{c.teachersPerExam} assigned
                            </span>
                          </div>

                          <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom: invigs.length ? 8 : 0 }}>
                            {allTeachers.map(t => {
                              const w = wm[t.id] ?? 2;
                              if (w === 0) return null;
                              const isOn    = assigned.has(t.id);
                              const onLeave = (lm[t.id] || []).includes(slot.exam_date);
                              const isCT    = invigs.find(i => i.teacher_id === t.id)?.is_course_teacher;
                              return (
                                <button key={t.id}
                                  onClick={() => !onLeave && toggleInvig(semId, slot.id, t.id)}
                                  title={onLeave ? `${t.name} is on approved leave on ${slot.exam_date}` : t.name}
                                  style={{
                                    padding:'4px 10px', borderRadius:20, fontSize:11, fontWeight:600,
                                    cursor: onLeave ? 'not-allowed' : 'pointer', border:'1.5px solid',
                                    borderColor: onLeave ? '#fca5a5' : isOn ? '#1a3a52' : '#e5e7eb',
                                    background:  onLeave ? '#fef2f2' : isOn ? '#1a3a52' : 'white',
                                    color:        onLeave ? '#dc2626' : isOn ? 'white' : '#6b7280',
                                    textDecoration: onLeave ? 'line-through' : 'none',
                                    opacity: onLeave ? 0.65 : 1,
                                  }}>
                                  {t.initials || t.name?.split(' ').map(w => w[0]).join('') || '?'}
                                  {isCT && !onLeave ? ' ★' : ''}{onLeave ? ' ✗' : ''}
                                </button>
                              );
                            })}
                          </div>

                          {invigs.length > 0 && (
                            <div style={{ paddingTop:8, borderTop:'1px solid #f1f5f9' }}>
                              <div style={{ fontSize:10, fontWeight:600, color:'#9ca3af', textTransform:'uppercase', marginBottom:4, letterSpacing:'0.05em' }}>Assigned Invigilators</div>
                              {invigs.map((inv, i) => {
                                const t = allTeachers.find(x => x.id === inv.teacher_id);
                                return (
                                  <div key={i} style={{ fontSize:12, color:'#374151', lineHeight:'1.7' }}>
                                    {i+1}. {t?.name || 'Unknown'}
                                    {inv.is_course_teacher && <span style={{ fontSize:10, color:'#1e40af', marginLeft:4, fontWeight:600 }}>(Course Teacher)</span>}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── Publish bar ── */}
            <div style={{ marginTop:24, paddingTop:20, borderTop:'1.5px solid #e5e7eb', display:'flex', alignItems:'center', gap:14 }}>
              <button onClick={() => publish(semId)} disabled={publishing || !saved.length}
                style={{
                  padding:'10px 28px', borderRadius:8, border:'none',
                  background: session?.published ? '#374151' : '#0f5132',
                  color:'white', fontSize:14, fontWeight:700, cursor:'pointer', opacity:publishing?0.7:1,
                }}>
                {publishing ? 'Publishing…' : session?.published ? 'Re-publish' : 'Publish exam routine'}
              </button>
              {session?.published && (
                <span style={{ fontSize:12, color:'#6b7280' }}>
                  Last published {new Date(session.published_at).toLocaleString()}
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
