/**
 * Fitness evaluation for the routine GA.
 *
 * Hard constraints (each occurrence = 1 violation, weighted by cfg.hardWeight):
 *   H1  teacher double-booked (covers Group A/B of one lab sharing teachers)
 *   H2  two whole-class (theory) events of a semester overlap anything
 *   H3  a group's lab overlapping its semester's theory / the other group of
 *       the same course (modelled with per-group occupancy tracks; an
 *       alternate-week lab blocks both groups)
 *   H4  room double-booked
 *   H5  lab must sit on 2 consecutive periods on one side of lunch
 *   H6  two classes of the same theory course on the same day
 *   H7  placement outside the configured week/periods
 *   H8  Professor / Associate Professor placed outside their available slots
 *
 * Soft costs (weights in cfg.soft):
 *   S1  other teachers outside available slots, × seniority weight
 *   S2  compactness: single-class days and idle gaps for both batches and teachers
 *   S3  even spread of a semester's load across the week
 *   S4  labs before lunch / theory after lunch (mild)
 *
 * Pure module — no framework imports.
 */

function occupiedSlots(ev, gene) {
  const out = [];
  for (let p = 0; p < ev.periods; p++) out.push(gene.start + p);
  return out;
}

// Groups whose students are busy during this event
function occupiedGroups(ev) {
  if (ev.type === 'theory') return ['A', 'B'];       // whole class
  if (ev.group === 'alt')   return ['A', 'B'];       // both groups on alternate weeks
  return [ev.group];                                  // single lab group
}

export function evaluate(genes, ctx, cfg) {
  const hard = [];
  const violating = new Set();
  const addHard = (type, msg, evIdxs) => {
    hard.push({ type, message: msg, events: evIdxs });
    evIdxs.forEach(i => violating.add(i));
  };

  const teacherOcc = new Map();  // "tid|day|slot" → [evIdx]
  const groupOcc = new Map();    // "sem|grp|day|slot" → [evIdx]
  const roomOcc = new Map();     // "room|day|slot" → [evIdx]
  const theoryCourseDay = new Map(); // "courseId|day" → [evIdx]
  const semDaySlots = new Map(); // "sem|day" → Set(slot)
  const teacherDaySlots = new Map(); // "tid|day" → Set(slot)

  const push = (map, key, val) => {
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(val);
  };
  const pushSet = (map, key, val) => {
    if (!map.has(key)) map.set(key, new Set());
    map.get(key).add(val);
  };

  let softCost = 0;

  // ── Pass 1: occupancy + per-event checks ──
  for (const ev of ctx.events) {
    const gene = genes[ev.idx];
    const day = ctx.days[gene.day];

    // H7: inside configured week/periods
    if (day === undefined || gene.start < 1 || gene.start + ev.periods - 1 > ctx.slotCount) {
      addHard('H7', `"${ev.code}" placed outside the configured week/periods.`, [ev.idx]);
      continue;
    }

    // H5: labs on one side of lunch, consecutive by construction
    if (ev.type === 'lab') {
      const end = gene.start + ev.periods - 1;
      const sameSide = end <= ctx.before || gene.start > ctx.before;
      if (!sameSide) {
        addHard('H5', `Lab "${ev.code}" (${ev.group}) spans the lunch break.`, [ev.idx]);
      }
    }

    const slots = occupiedSlots(ev, gene);
    const room = ev.type === 'lab' ? ctx.labRooms[gene.roomIdx] : ev.fixedRoom;

    for (const slot of slots) {
      for (const tid of ev.teacherIds) {
        push(teacherOcc, `${tid}|${day}|${slot}`, ev.idx);
        pushSet(teacherDaySlots, `${tid}|${day}`, slot);
      }
      for (const grp of occupiedGroups(ev)) {
        push(groupOcc, `${ev.semId}|${grp}|${day}|${slot}`, ev.idx);
      }
      if (room) push(roomOcc, `${room}|${day}|${slot}`, ev.idx);
      pushSet(semDaySlots, `${ev.semId}|${day}`, slot);

      // S4: side-of-lunch preference
      if (ev.type === 'lab' && slot <= ctx.before) softCost += cfg.soft.labBeforeLunch;
      if (ev.type === 'theory' && slot > ctx.before) softCost += cfg.soft.theoryAfterLunch;
    }

    // H6 bookkeeping (theory instances of the same course)
    if (ev.type === 'theory') push(theoryCourseDay, `${ev.courseId}|${day}`, ev.idx);

    // H8 / S1: availability
    for (const tid of ev.teacherIds) {
      const t = ctx.teacherById[tid];
      const avail = ctx.availMap[tid];
      if (!avail || avail.size === 0) continue; // nothing marked → fully available
      const missed = slots.filter(sl => !avail.has(`${day}-s${sl}`));
      if (missed.length === 0) continue;
      if (ctx.isHardAvailTeacher(t)) {
        addHard('H8',
          `${t.name || 'Teacher'} (${t.designation}) has "${ev.code}" outside their available slots (${day} P${missed.join(',P')}).`,
          [ev.idx]);
      } else {
        softCost += missed.length * ctx.rankWeight(t) * cfg.soft.availability;
      }
    }
  }

  // ── Pass 2: overlap conflicts from occupancy maps ──
  const overlapScan = (map, type, describe) => {
    for (const [key, list] of map) {
      if (list.length > 1) {
        const uniq = [...new Set(list)];
        if (uniq.length > 1 || list.length > uniq.length) {
          addHard(type, describe(key, uniq), uniq);
        }
      }
    }
  };

  overlapScan(teacherOcc, 'H1', (key, idxs) => {
    const [tid, day, slot] = key.split('|');
    const t = ctx.teacherById[tid];
    const codes = idxs.map(i => ctx.events[i].code).join(', ');
    return `${t?.name || 'Teacher'} is double-booked on ${day} P${slot} (${codes}).`;
  });

  overlapScan(groupOcc, 'H2/H3', (key, idxs) => {
    const [sem, grp, day, slot] = key.split('|');
    const codes = idxs.map(i => {
      const e = ctx.events[i];
      return e.group ? `${e.code}(${e.group})` : e.code;
    }).join(', ');
    return `${sem} Group ${grp} has overlapping classes on ${day} P${slot} (${codes}).`;
  });

  overlapScan(roomOcc, 'H4', (key, idxs) => {
    const [room, day, slot] = key.split('|');
    const codes = idxs.map(i => ctx.events[i].code).join(', ');
    return `Room "${room}" double-booked on ${day} P${slot} (${codes}).`;
  });

  // H6: same theory course twice in one day
  for (const [key, list] of theoryCourseDay) {
    if (list.length > 1) {
      const day = key.split('|')[1];
      addHard('H6', `"${ctx.events[list[0]].code}" has ${list.length} theory classes on ${day} — must be on different days.`, list);
    }
  }

  // ── Soft: compactness + spread ──
  const gapStats = (slotSet) => {
    let min = Infinity, max = -Infinity;
    for (const sl of slotSet) { if (sl < min) min = sl; if (sl > max) max = sl; }
    return { count: slotSet.size, gaps: max - min + 1 - slotSet.size };
  };

  // S2 per semester-day
  const semTotals = new Map(); // sem → { perDay: Map(day → busySlots) }
  for (const [key, slotSet] of semDaySlots) {
    const [sem, day] = key.split('|');
    const { count, gaps } = gapStats(slotSet);
    if (count === 1) softCost += cfg.soft.semSingleClassDay;
    softCost += gaps * cfg.soft.semGapPerPeriod;
    if (!semTotals.has(sem)) semTotals.set(sem, new Map());
    semTotals.get(sem).set(day, count);
  }

  // S2 per teacher-day
  for (const [, slotSet] of teacherDaySlots) {
    const { count, gaps } = gapStats(slotSet);
    if (count === 1) softCost += cfg.soft.teacherSingleClassDay;
    softCost += gaps * cfg.soft.teacherGapPerPeriod;
  }

  // S3: spread each semester's load across the week (mean absolute deviation
  // over days that have classes; single-day pile-ups already cost via gaps)
  for (const [, perDay] of semTotals) {
    const counts = ctx.days.map(d => perDay.get(d) || 0);
    const busy = counts.filter(c => c > 0);
    if (busy.length <= 1) continue;
    const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
    const mad = counts.reduce((a, c) => a + Math.abs(c - mean), 0) / counts.length;
    softCost += mad * cfg.soft.spreadPerDeviation;
  }

  const hardCount = hard.length;
  return {
    cost: hardCount * cfg.hardWeight + softCost,
    hardCount,
    hard,
    softCost,
    violating,
  };
}
