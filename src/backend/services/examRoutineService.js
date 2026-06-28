import { supabase } from '../config/supabaseClient.js';

// Chairman/Dean default to weight=1; everyone else weight=2
const SPECIAL_POSTS_WEIGHT1 = ['Chairman', 'Dean'];

export const examRoutineService = {

  // ── Session ──────────────────────────────────────────────────────────────────

  async getOrCreateSession(semesterId, sessionType) {
    try {
      const { data: existing } = await supabase
        .from('exam_sessions')
        .select('*')
        .eq('semester_id', semesterId)
        .eq('session_type', sessionType)
        .maybeSingle();

      if (existing) return { success: true, data: existing };

      const { data, error } = await supabase
        .from('exam_sessions')
        .insert([{ semester_id: semesterId, session_type: sessionType }])
        .select().single();

      if (error) throw error;
      return { success: true, data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  async updateSessionConfig(sessionId, fields) {
    try {
      const allowed = {};
      if (fields.teachers_per_exam !== undefined) allowed.teachers_per_exam = parseInt(fields.teachers_per_exam) || 2;
      if (fields.default_start_time !== undefined) allowed.default_start_time = fields.default_start_time;
      if (fields.default_duration_mins !== undefined) allowed.default_duration_mins = parseInt(fields.default_duration_mins) || 60;
      if (fields.title !== undefined) allowed.title = fields.title;
      allowed.updated_at = new Date().toISOString();

      const { data, error } = await supabase
        .from('exam_sessions').update(allowed).eq('id', sessionId).select().single();
      if (error) throw error;
      return { success: true, data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  async getSessionFull(sessionId) {
    try {
      const { data: session, error: se } = await supabase
        .from('exam_sessions').select('*').eq('id', sessionId).single();
      if (se) throw se;

      const { data: slots } = await supabase
        .from('exam_slots').select('*').eq('session_id', sessionId)
        .order('slot_order');

      const slotIds = (slots || []).map(s => s.id);
      let invigilators = [];
      if (slotIds.length) {
        const { data: inv } = await supabase
          .from('exam_invigilators').select('*').in('slot_id', slotIds);
        invigilators = inv || [];
      }

      const { data: weights } = await supabase
        .from('teacher_exam_weights').select('*').eq('session_id', sessionId);

      const slotsWithInv = (slots || []).map(slot => ({
        ...slot,
        invigilators: invigilators.filter(i => i.slot_id === slot.id),
      }));

      return { success: true, data: { ...session, slots: slotsWithInv, weights: weights || [] } };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  async publishSession(sessionId) {
    try {
      const { data, error } = await supabase
        .from('exam_sessions')
        .update({ published: true, published_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', sessionId).select().single();
      if (error) throw error;
      return { success: true, data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  async getPublishedSession(semesterId, sessionType) {
    try {
      const { data, error } = await supabase
        .from('exam_sessions').select('*')
        .eq('semester_id', semesterId).eq('session_type', sessionType).eq('published', true)
        .order('published_at', { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      if (!data) return { success: true, data: null };
      return this.getSessionFull(data.id);
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  async getAllPublished(sessionType) {
    try {
      const { data, error } = await supabase
        .from('exam_sessions')
        .select('id, semester_id, session_type, title, published_at, teachers_per_exam')
        .eq('published', true)
        .eq('session_type', sessionType)
        .order('published_at', { ascending: false });
      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  // ── Slots ─────────────────────────────────────────────────────────────────────

  async saveSlots(sessionId, slots) {
    try {
      // Replace all slots for session
      await supabase.from('exam_slots').delete().eq('session_id', sessionId);

      if (!slots.length) return { success: true, data: [] };

      const { data, error } = await supabase
        .from('exam_slots')
        .insert(slots.map((s, i) => ({
          session_id:  sessionId,
          course_id:   s.course_id,
          exam_date:   s.exam_date,
          start_time:  s.start_time,
          end_time:    s.end_time,
          rooms:       s.rooms || '',
          slot_order:  s.slot_order ?? i,
        })))
        .select();
      if (error) throw error;
      return { success: true, data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  // ── Invigilators ─────────────────────────────────────────────────────────────

  async saveAllInvigilators(sessionId, invigilatorMap) {
    // invigilatorMap: { [slotId]: [{ teacher_id, is_course_teacher, is_lead }] }
    try {
      const { data: slots } = await supabase
        .from('exam_slots').select('id').eq('session_id', sessionId);
      if (slots?.length)
        await supabase.from('exam_invigilators').delete().in('slot_id', slots.map(s => s.id));

      const rows = [];
      for (const [slotId, assignments] of Object.entries(invigilatorMap)) {
        for (const a of assignments) {
          rows.push({ slot_id: slotId, teacher_id: a.teacher_id,
            is_course_teacher: !!a.is_course_teacher, is_lead: !!a.is_lead });
        }
      }
      if (!rows.length) return { success: true };
      const { error } = await supabase.from('exam_invigilators').insert(rows);
      if (error) throw error;
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  // ── Weights ──────────────────────────────────────────────────────────────────

  async setWeight(sessionId, teacherId, weight) {
    try {
      const { data, error } = await supabase
        .from('teacher_exam_weights')
        .upsert([{ session_id: sessionId, teacher_id: teacherId, weight: parseInt(weight) }],
          { onConflict: 'session_id,teacher_id' })
        .select().single();
      if (error) throw error;
      return { success: true, data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  // ── Auto-assign algorithm ─────────────────────────────────────────────────────

  autoAssign({ slots, teachers, routineEntries, weightMap, teachersPerExam, leaveMap = {} }) {
    /*
     * weightMap : { [teacherId]: number }  0=excluded, 1=own course only, 2+=any
     * leaveMap  : { [teacherId]: Set<'YYYY-MM-DD'> }  dates teacher is on approved leave
     * routineEntries: routine_storage entries for this semester
     * Returns: { [slotId]: [{ teacher_id, is_course_teacher, is_lead }] }
     *
     * Skip rules:
     *   - weight === 0 → fully excluded
     *   - teacher is on leave on the slot's exam_date → skip
     *   - availability_status !== 'available' → already filtered out before call (teachers list)
     */
    const courseToTeachers = {};
    for (const e of routineEntries) {
      if (!e.course_id || !e.teacher_id) continue;
      if (!courseToTeachers[e.course_id]) courseToTeachers[e.course_id] = new Set();
      courseToTeachers[e.course_id].add(e.teacher_id);
    }

    const loads = {};
    for (const t of teachers) loads[t.id] = 0;

    const result = {}; // slotId → [assignment]

    // Helper: is teacher on leave on a given date?
    const isOnLeave = (teacherId, examDate) => {
      const leaveDates = leaveMap[teacherId];
      if (!leaveDates) return false;
      return leaveDates.has(examDate);
    };

    // Sort slots by date then time for consistent ordering
    const sorted = [...slots].sort((a, b) => {
      if (a.exam_date !== b.exam_date) return a.exam_date < b.exam_date ? -1 : 1;
      return a.start_time < b.start_time ? -1 : 1;
    });

    for (const slot of sorted) {
      result[slot.id] = [];
      const assigned = new Set();
      const examDate = slot.exam_date; // 'YYYY-MM-DD'

      // Step 1: mandatory course teachers (weight >= 1 AND not on leave on exam date)
      const courseTeacherIds = [...(courseToTeachers[slot.course_id] || new Set())]
        .filter(tid =>
          (weightMap[tid] ?? 2) >= 1 &&
          !isOnLeave(tid, examDate)
        );

      for (const tid of courseTeacherIds) {
        result[slot.id].push({ teacher_id: tid, is_course_teacher: true, is_lead: result[slot.id].length === 0 });
        assigned.add(tid);
        loads[tid] = (loads[tid] || 0) + 1;
      }

      // Step 2: fill remaining from weight-2 pool (not on leave, not in concurrent slot)
      const needed = Math.max(0, teachersPerExam - assigned.size);
      if (!needed) continue;

      // Build concurrency set (teachers already committed at the same date+time)
      const concurrentIds = new Set();
      for (const other of sorted) {
        if (other.id === slot.id) continue;
        if (other.exam_date === slot.exam_date && other.start_time === slot.start_time) {
          for (const a of (result[other.id] || [])) concurrentIds.add(a.teacher_id);
        }
      }

      const pool = teachers
        .filter(t =>
          !assigned.has(t.id) &&
          !concurrentIds.has(t.id) &&
          !isOnLeave(t.id, examDate) &&
          (weightMap[t.id] ?? 2) >= 2
        )
        .sort((a, b) => (loads[a.id] || 0) - (loads[b.id] || 0));

      for (let i = 0; i < Math.min(needed, pool.length); i++) {
        const t = pool[i];
        result[slot.id].push({ teacher_id: t.id, is_course_teacher: false, is_lead: false });
        assigned.add(t.id);
        loads[t.id] = (loads[t.id] || 0) + 1;
      }
    }

    return result;
  },

  // ── Build leave map for a set of exam dates ────────────────────────────────
  // Returns { [teacherId]: Set<'YYYY-MM-DD'> } for dates within the exam window
  async buildLeaveMap(examDates) {
    if (!examDates.length) return {};
    const minDate = examDates.reduce((a, b) => a < b ? a : b);
    const maxDate = examDates.reduce((a, b) => a > b ? a : b);

    // Load all approved leaves that overlap with the exam window
    const { data: leaves, error } = await supabase
      .from('teacher_leaves')
      .select('teacher_id, start_date, end_date')
      .eq('status', 'approved')
      .lte('start_date', maxDate)
      .gte('end_date', minDate);

    if (error || !leaves?.length) return {};

    const examDateSet = new Set(examDates);
    const map = {};

    for (const leave of leaves) {
      const tid   = leave.teacher_id;
      const start = leave.start_date; // 'YYYY-MM-DD'
      const end   = leave.end_date;

      if (!map[tid]) map[tid] = new Set();

      // Add each exam date that falls within this leave range
      for (const d of examDateSet) {
        if (d >= start && d <= end) map[tid].add(d);
      }
    }

    return map;
  },

  // Default weight for a teacher based on their special_post
  defaultWeightForTeacher(teacher) {
    if (SPECIAL_POSTS_WEIGHT1.includes(teacher.special_post)) return 1;
    return 2;
  },
};
