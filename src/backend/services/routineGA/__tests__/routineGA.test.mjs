/**
 * Unit tests for the routine GA engine (pure module).
 * Run: npm run test:ga   (node --test)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { GA_CONFIG } from '../config.js';
import { buildContext, validStarts } from '../events.js';
import { evaluate } from '../fitness.js';
import { runGA } from '../engine.js';

// ── Fixture helpers ──────────────────────────────────────────────────────────

function makeData(overrides = {}) {
  // 5-day week, 3 periods before lunch + 2 after (s1..s5)
  return {
    settings: {
      classes_before_lunch: 3,
      classes_after_lunch: 2,
      class_day: 'Sunday-Thursday',
    },
    selectedSemesters: ['Y2-S1'],
    courses: [],
    durations: [],
    rooms: {
      theory_rooms: ['R-301'],
      lab_rooms: ['Lab-1', 'Lab-2'],
      semester_theory_rooms: { 'Y2-S1': 'R-301' },
    },
    teachers: [],
    availability: [],
    courseTeacherChoices: [],
    ...overrides,
  };
}

function theoryCourse(id, code, teacherIds) {
  return {
    course: { id, code, title: code, course_type: 'theory', credit_hours: 3, year: '2nd Year', semester: '1st Semester', in_routine: true },
    choice: { course_id: id, teacher_assignments: teacherIds },
  };
}

function labCourse(id, code, teacherIds, credit = 1) {
  return {
    course: { id, code, title: code, course_type: 'lab', credit_hours: credit, year: '2nd Year', semester: '1st Semester', in_routine: true },
    choice: { course_id: id, teacher_assignments: teacherIds },
  };
}

function teacher(id, name, designation = 'Lecturer') {
  return { id, name, initials: name.slice(0, 2).toUpperCase(), designation };
}

function buildCtx(defs, dataOverrides = {}) {
  const data = makeData({
    courses: defs.map(d => d.course),
    courseTeacherChoices: defs.map(d => d.choice),
    ...dataOverrides,
  });
  const { ctx, problems } = buildContext(data, GA_CONFIG);
  return { ctx, problems };
}

const gene = (day, start, roomIdx = null) => ({ day, start, roomIdx });

// ── Event extraction ─────────────────────────────────────────────────────────

test('theory course expands to 2 weekly single-period events by default', () => {
  const { ctx } = buildCtx([theoryCourse('c1', 'CSE-101', ['t1'])], {
    teachers: [teacher('t1', 'Alice')],
  });
  assert.equal(ctx.events.length, 2);
  assert.ok(ctx.events.every(e => e.type === 'theory' && e.periods === 1 && e.fixedRoom === 'R-301'));
});

test('1-credit lab becomes dual-group (A + B) events; 0.75 lab becomes one alternating event', () => {
  const { ctx } = buildCtx(
    [labCourse('l1', 'LAB-1', ['t1'], 1), labCourse('l2', 'LAB-2', ['t1'], 0.75)],
    { teachers: [teacher('t1', 'Alice')] },
  );
  const l1 = ctx.events.filter(e => e.courseId === 'l1');
  const l2 = ctx.events.filter(e => e.courseId === 'l2');
  assert.deepEqual(l1.map(e => e.group).sort(), ['A', 'B']);
  assert.deepEqual(l2.map(e => e.group), ['alt']);
  assert.ok(ctx.events.every(e => e.periods === 2));
});

test('lab valid starts never span the lunch break (H5 by construction)', () => {
  const { ctx } = buildCtx([labCourse('l1', 'LAB-1', ['t1'])], {
    teachers: [teacher('t1', 'Alice')],
  });
  // before=3, after=2, slots s1..s5 → lab may start at 1,2 (morning) or 4 (afternoon); never 3
  assert.deepEqual(validStarts(ctx.events[0], ctx), [1, 2, 4]);
});

// ── Hard constraints ─────────────────────────────────────────────────────────

test('H1: teacher double-booked across semesters is detected', () => {
  const t = [teacher('t1', 'Alice')];
  const defs = [theoryCourse('c1', 'CSE-101', ['t1']), theoryCourse('c2', 'CSE-201', ['t1'])];
  defs[1].course.year = '3rd Year'; // second course in another semester, same teacher
  const { ctx } = buildCtx(defs, {
    teachers: t,
    selectedSemesters: ['Y2-S1', 'Y3-S1'],
    rooms: {
      theory_rooms: ['R-301', 'R-302'],
      lab_rooms: ['Lab-1'],
      semester_theory_rooms: { 'Y2-S1': 'R-301', 'Y3-S1': 'R-302' },
    },
  });
  // c1 events idx 0,1; c2 events idx 2,3 — put one of each at the same day/slot
  const genes = [gene(0, 1), gene(1, 1), gene(0, 1), gene(2, 1)];
  const res = evaluate(genes, ctx, GA_CONFIG);
  assert.ok(res.hard.some(h => h.type === 'H1'), 'expected an H1 teacher clash');
});

test('H2/H3: semester theory overlapping a group lab is detected', () => {
  const { ctx } = buildCtx(
    [theoryCourse('c1', 'CSE-101', ['t1']), labCourse('l1', 'LAB-1', ['t2'])],
    { teachers: [teacher('t1', 'Alice'), teacher('t2', 'Bob')] },
  );
  // theory idx 0,1 · lab A idx 2 · lab B idx 3
  // theory#0 on day0 s1 overlaps lab A (s1-s2, day0); lab B safely elsewhere
  const genes = [gene(0, 1), gene(1, 1), gene(0, 1, 0), gene(2, 1, 0)];
  const res = evaluate(genes, ctx, GA_CONFIG);
  assert.ok(res.hard.some(h => h.type === 'H2/H3'), 'expected a group overlap violation');
});

test('H1 catches Group A and Group B of one lab overlapping (shared teachers)', () => {
  const { ctx } = buildCtx([labCourse('l1', 'LAB-1', ['t1'])], {
    teachers: [teacher('t1', 'Alice')],
  });
  const genes = [gene(0, 1, 0), gene(0, 1, 1)]; // same day+start, different rooms
  const res = evaluate(genes, ctx, GA_CONFIG);
  assert.ok(res.hardCount > 0, 'A/B overlap with common teacher must be a hard violation');
});

test('alternate-week lab blocks BOTH groups (conflicts with a dual-group lab)', () => {
  const { ctx } = buildCtx(
    [labCourse('l1', 'ALT-LAB', ['t1'], 0.75), labCourse('l2', 'LAB-2', ['t2'], 1)],
    { teachers: [teacher('t1', 'Alice'), teacher('t2', 'Bob')] },
  );
  // alt idx 0 · l2-A idx 1 · l2-B idx 2. Overlap alt with l2 group B: different
  // teachers, different rooms — only the student-group track can catch it.
  const genes = [gene(0, 1, 0), gene(1, 1, 0), gene(0, 1, 1)];
  const res = evaluate(genes, ctx, GA_CONFIG);
  assert.ok(
    res.hard.some(h => h.type === 'H2/H3' && h.message.includes('Group B')),
    'alt-week lab must occupy both group tracks',
  );
});

test('H4: two labs in the same room at the same time is detected', () => {
  const { ctx } = buildCtx(
    [labCourse('l1', 'LAB-1', ['t1'], 0.75), labCourse('l2', 'LAB-2', ['t2'], 0.75)],
    {
      teachers: [teacher('t1', 'Alice'), teacher('t2', 'Bob')],
      selectedSemesters: ['Y2-S1', 'Y3-S1'],
    },
  );
  // put l2 into another semester so only the room clashes
  ctx.events[1].semId = 'Y3-S1';
  const genes = [gene(0, 1, 0), gene(0, 1, 0)];
  const res = evaluate(genes, ctx, GA_CONFIG);
  assert.ok(res.hard.some(h => h.type === 'H4'), 'expected a room double-booking');
});

test('H5: a lab spanning the lunch break is a hard violation', () => {
  const { ctx } = buildCtx([labCourse('l1', 'LAB-1', ['t1'])], {
    teachers: [teacher('t1', 'Alice')],
  });
  const genes = [gene(0, 3, 0), gene(1, 1, 0)]; // start s3 spans s3–s4 = across lunch
  const res = evaluate(genes, ctx, GA_CONFIG);
  assert.ok(res.hard.some(h => h.type === 'H5'), 'expected a lunch-span violation');
});

test('H6: two classes of one theory course on the same day is a violation', () => {
  const { ctx } = buildCtx([theoryCourse('c1', 'CSE-101', ['t1'])], {
    teachers: [teacher('t1', 'Alice')],
  });
  const genes = [gene(0, 1), gene(0, 3)]; // same day, different periods
  const res = evaluate(genes, ctx, GA_CONFIG);
  assert.ok(res.hard.some(h => h.type === 'H6'), 'expected a same-day violation');
});

test('H8: Professor outside marked availability is HARD; Lecturer is soft', () => {
  const mkDefs = () => [theoryCourse('c1', 'CSE-101', ['t1'])];
  const availability = [{ teacher_id: 't1', day_of_week: 'Sunday', slot_id: 's1' }];
  const genes = [gene(1, 2), gene(2, 2)]; // both outside Sunday-s1

  const prof = buildCtx(mkDefs(), { teachers: [teacher('t1', 'Alice', 'Professor')], availability });
  const profRes = evaluate(genes, prof.ctx, GA_CONFIG);
  assert.ok(profRes.hard.some(h => h.type === 'H8'), 'Professor availability must be hard');

  const lect = buildCtx(mkDefs(), { teachers: [teacher('t1', 'Alice', 'Lecturer')], availability });
  const lectRes = evaluate(genes, lect.ctx, GA_CONFIG);
  assert.equal(lectRes.hard.filter(h => h.type === 'H8').length, 0, 'Lecturer availability must be soft');
  assert.ok(lectRes.softCost > 0, 'Lecturer misses must cost soft penalty');
});

// ── Soft constraints ─────────────────────────────────────────────────────────

test('S1: a senior (Assistant Professor) unmet preference costs more than a Lecturer one', () => {
  const availability = [{ teacher_id: 't1', day_of_week: 'Sunday', slot_id: 's1' }];
  const genes = [gene(1, 2), gene(2, 2)];
  const run = (designation) => {
    const { ctx } = buildCtx([theoryCourse('c1', 'CSE-101', ['t1'])], {
      teachers: [teacher('t1', 'Alice', designation)],
      availability,
    });
    return evaluate(genes, ctx, GA_CONFIG).softCost;
  };
  assert.ok(run('Assistant Professor') > run('Lecturer'), 'seniority weight ordering violated');
});

test('S2: an isolated single-class day costs more than two adjacent classes', () => {
  const { ctx } = buildCtx([theoryCourse('c1', 'CSE-101', ['t1']), theoryCourse('c2', 'CSE-102', ['t2'])], {
    teachers: [teacher('t1', 'Alice'), teacher('t2', 'Bob')],
  });
  // compact: both classes adjacent on the same day (c1#0 s1, c2#0 s2), others adjacent on day1
  const compact = [gene(0, 1), gene(1, 1), gene(0, 2), gene(1, 2)];
  // scattered: same courses but each class alone on its own day
  const scattered = [gene(0, 1), gene(1, 1), gene(2, 1), gene(3, 1)];
  const cCompact = evaluate(compact, ctx, GA_CONFIG);
  const cScattered = evaluate(scattered, ctx, GA_CONFIG);
  assert.equal(cCompact.hardCount, 0);
  assert.equal(cScattered.hardCount, 0);
  assert.ok(cCompact.softCost < cScattered.softCost, 'compact layout must be cheaper');
});

// ── End-to-end GA ────────────────────────────────────────────────────────────

test('GA finds a conflict-free routine for a small feasible instance', () => {
  const defs = [
    theoryCourse('c1', 'CSE-101', ['t1']),
    theoryCourse('c2', 'CSE-102', ['t2']),
    labCourse('l1', 'LAB-1', ['t1', 't2'], 1),
    labCourse('l2', 'LAB-2', ['t3'], 0.75),
  ];
  const { ctx } = buildCtx(defs, {
    teachers: [teacher('t1', 'Alice'), teacher('t2', 'Bob'), teacher('t3', 'Cara')],
  });
  const cfg = { ...GA_CONFIG, populationSize: 30, generations: 120 };
  const { best } = runGA(ctx, cfg, 42);
  assert.equal(best.hardCount, 0, `expected feasible, got: ${best.hard.map(h => h.message).join(' | ')}`);
});

test('avoided periods are never scheduled and raise no hard violation', () => {
  const defs = [
    theoryCourse('c1', 'CSE-101', ['t1']),
    theoryCourse('c2', 'CSE-102', ['t2']),
  ];
  // Block every Monday period and Sunday period 1.
  const avoid = ['Monday-s1', 'Monday-s2', 'Monday-s3', 'Monday-s4', 'Monday-s5', 'Sunday-s1'];
  const { ctx } = buildCtx(defs, {
    teachers: [teacher('t1', 'Alice'), teacher('t2', 'Bob')],
    settings: {
      classes_before_lunch: 3,
      classes_after_lunch: 2,
      class_day: 'Sunday-Thursday',
      avoid_periods: avoid,
    },
  });
  const cfg = { ...GA_CONFIG, populationSize: 30, generations: 120 };
  const { best, genes } = runGA(ctx, cfg, 7);

  assert.equal(best.hardCount, 0, `expected feasible, got: ${best.hard.map(h => h.message).join(' | ')}`);
  const avoidedSet = new Set(avoid);
  ctx.events.forEach(ev => {
    const g = genes[ev.idx];
    const day = ctx.days[g.day];
    for (let p = 0; p < ev.periods; p++) {
      assert.ok(!avoidedSet.has(`${day}-s${g.start + p}`),
        `event ${ev.code} landed on avoided ${day}-s${g.start + p}`);
    }
  });
});

test('GA is deterministic for a fixed seed', () => {
  const defs = [
    theoryCourse('c1', 'CSE-101', ['t1']),
    labCourse('l1', 'LAB-1', ['t2'], 1),
  ];
  const mk = () => buildCtx(defs, {
    teachers: [teacher('t1', 'Alice'), teacher('t2', 'Bob')],
  }).ctx;
  const cfg = { ...GA_CONFIG, populationSize: 20, generations: 40 };
  const r1 = runGA(mk(), cfg, 1234);
  const r2 = runGA(mk(), cfg, 1234);
  assert.deepEqual(r1.genes, r2.genes, 'same seed must reproduce the same routine');
  assert.equal(r1.best.cost, r2.best.cost);
});
