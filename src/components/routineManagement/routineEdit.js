/**
 * Client-side routine editing helpers.
 *
 * The saved routine is a flat list of per-period entries. For editing we
 * group them into BLOCKS — one class session each (a lab session is one
 * block covering 2 consecutive periods; a theory session is usually one).
 * A block is what the admin drags/moves; its periods always move together.
 *
 * `checkMove` re-implements the generator's hard constraints so a manual
 * change can warn the admin exactly like the GA would:
 *   H1 teacher double-booked          H5 lab periods split by lunch
 *   H2/H3 batch/group double-booked   H6 same theory course twice a day
 *   H4 room double-booked             H7 outside configured week/periods
 *   H8 Professor/Assoc. Professor outside their availability
 *   H9 department-avoided period
 * The admin may confirm and override — these are warnings, not locks.
 */

const slotNum = (slotId) => parseInt(String(slotId).replace(/^s/, ''), 10);

// Group flat entries into blocks. Entries belong to the same block when they
// share course/semester/group/session and sit on consecutive periods of the
// same day. `blockId` = index into the returned array.
export function buildBlocks(entries) {
  const keyed = new Map(); // groupKey → entry[] (sorted later)
  entries.forEach((e, idx) => {
    const key = [
      e.semester, e.course_id, e.group ?? '', e.session_id ?? '', e.day_of_week,
    ].join('|');
    if (!keyed.has(key)) keyed.set(key, []);
    keyed.get(key).push({ ...e, _idx: idx });
  });

  const blocks = [];
  for (const list of keyed.values()) {
    list.sort((a, b) => slotNum(a.slot_id) - slotNum(b.slot_id));
    // split non-consecutive runs (two separate theory classes on one day is
    // invalid anyway, but stay safe)
    let run = [list[0]];
    for (let i = 1; i < list.length; i++) {
      const prev = slotNum(run[run.length - 1].slot_id);
      if (slotNum(list[i].slot_id) === prev + 1) run.push(list[i]);
      else { blocks.push(run); run = [list[i]]; }
    }
    blocks.push(run);
  }

  return blocks.map((run, i) => ({
    id: i,
    entries: run,
    semester: run[0].semester,
    courseId: run[0].course_id,
    teacherIds: run[0].teacher_ids?.length ? run[0].teacher_ids : (run[0].teacher_id ? [run[0].teacher_id] : []),
    room: run[0].room ?? null,
    group: run[0].group ?? null,
    alternating: !!run[0].alternating,
    sessionId: run[0].session_id ?? null,
    day: run[0].day_of_week,
    start: slotNum(run[0].slot_id),
    periods: run.length,
  }));
}

// Rebuild the flat entries list from blocks (after moves).
export function blocksToEntries(blocks) {
  const out = [];
  for (const b of blocks) {
    for (let p = 0; p < b.periods; p++) {
      const src = b.entries[Math.min(p, b.entries.length - 1)];
      out.push({
        ...src,
        day_of_week: b.day,
        slot_id: `s${b.start + p}`,
      });
    }
  }
  // strip helper field
  return out.map(({ _idx, ...rest }) => rest);
}

/**
 * Check the hard constraints for placing `block` at (day, start), against all
 * other blocks. Returns a list of violation strings (empty = clean).
 *
 * ctx: {
 *   slotCount, before,           — from class time settings
 *   days: [...],                 — working day names
 *   avoidedSet: Set('Day-sN'),
 *   courseMap: { id: course },   — for type/code lookups
 *   teacherMap: { id: teacher }, — designation/name
 *   hardAvailabilityRanks: [...],
 *   availMap: { teacherId: Set('Day-sN') },
 * }
 */
export function checkMove(block, day, start, blocks, ctx) {
  const violations = [];
  const course = ctx.courseMap[block.courseId];
  const code = course?.code || 'course';

  // H7 bounds
  if (!ctx.days.includes(day)) violations.push(`H7 — ${day} is outside the configured class days.`);
  if (start < 1 || start + block.periods - 1 > ctx.slotCount) {
    violations.push(`H7 — "${code}" would fall outside the configured periods.`);
  }

  // H5: multi-period sessions must stay on one side of lunch
  if (block.periods > 1) {
    const end = start + block.periods - 1;
    const sameSide = end <= ctx.before || start > ctx.before;
    if (!sameSide) violations.push(`H5 — "${code}" would span the lunch break.`);
  }

  // H9: avoided periods
  for (let p = 0; p < block.periods; p++) {
    if (ctx.avoidedSet?.has(`${day}-s${start + p}`)) {
      violations.push(`H9 — "${code}" would sit on an avoided period (${day}, period ${start + p}).`);
      break;
    }
  }

  // H8: Prof / Assoc Prof availability is hard
  for (const tid of block.teacherIds) {
    const t = ctx.teacherMap[tid];
    if (!t) continue;
    if (ctx.hardAvailabilityRanks?.includes(t.designation) && ctx.availMap?.[tid]?.size) {
      for (let p = 0; p < block.periods; p++) {
        if (!ctx.availMap[tid].has(`${day}-s${start + p}`)) {
          violations.push(`H8 — ${t.name} (${t.designation}) is not available ${day} period ${start + p}.`);
          break;
        }
      }
    }
  }

  // Occupancy scans against every other block
  const mySlots = new Set();
  for (let p = 0; p < block.periods; p++) mySlots.add(start + p);
  // groups this block occupies for its batch (theory + alt-labs block both groups)
  const myGroups = (!block.group || block.group === 'alt') ? ['A', 'B'] : [block.group];

  for (const other of blocks) {
    if (other.id === block.id) continue;
    const overlaps = other.day === day &&
      [...Array(other.periods)].some((_, p) => mySlots.has(other.start + p));

    if (overlaps) {
      // H1 teacher clash
      const sharedTeacher = other.teacherIds.find(tid => block.teacherIds.includes(tid));
      if (sharedTeacher) {
        const t = ctx.teacherMap[sharedTeacher];
        const oc = ctx.courseMap[other.courseId];
        violations.push(`H1 — ${t?.name || 'a teacher'} is already taking "${oc?.code || '?'}" at that time.`);
      }
      // H2/H3 batch group clash
      if (other.semester === block.semester) {
        const otherGroups = (!other.group || other.group === 'alt') ? ['A', 'B'] : [other.group];
        if (myGroups.some(g => otherGroups.includes(g))) {
          const oc = ctx.courseMap[other.courseId];
          violations.push(`H2 — ${block.semester} already has "${oc?.code || '?'}" at that time.`);
        }
      }
      // H4 room clash
      if (block.room && other.room && block.room === other.room) {
        const oc = ctx.courseMap[other.courseId];
        violations.push(`H4 — room ${block.room} is occupied by "${oc?.code || '?'}" at that time.`);
      }
    }

    // H6: same theory course twice on one day (any slots)
    if (
      other.day === day &&
      other.courseId === block.courseId &&
      course?.course_type !== 'lab' &&
      (ctx.courseMap[other.courseId]?.course_type !== 'lab')
    ) {
      violations.push(`H6 — "${code}" already has a class on ${day}.`);
    }
  }

  // de-dup
  return [...new Set(violations)];
}
