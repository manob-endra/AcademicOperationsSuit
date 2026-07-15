/**
 * Memetic GA engine: heuristic seeding → tournament selection → uniform
 * crossover → violation-biased mutation → greedy local-search repair →
 * elitism, with early stopping. Pure module — no framework imports.
 */
import { createRng } from './rng.js';
import { evaluate } from './fitness.js';
import { validStarts } from './events.js';

function randomGene(ev, ctx, rng) {
  return {
    day: rng.int(ctx.days.length),
    start: rng.pick(validStarts(ev, ctx)),
    roomIdx: ev.type === 'lab' ? rng.int(ctx.labRooms.length) : null,
  };
}

// All candidate placements for one event (used by seeding + local search)
function allPlacements(ev, ctx) {
  const out = [];
  const starts = validStarts(ev, ctx);
  const roomIdxs = ev.type === 'lab'
    ? ctx.labRooms.map((_, i) => i)
    : [null];
  for (let d = 0; d < ctx.days.length; d++) {
    for (const start of starts) {
      for (const roomIdx of roomIdxs) out.push({ day: d, start, roomIdx });
    }
  }
  return out;
}

// Count hard conflicts a placement would cause against a busy-map snapshot.
// Cheap approximation used by seeding and the memetic repair step.
function placementConflicts(ev, gene, busy, ctx) {
  const day = ctx.days[gene.day];
  let conflicts = 0;
  const groups = ev.type === 'theory' || ev.group === 'alt' ? ['A', 'B'] : [ev.group];
  const room = ev.type === 'lab' ? ctx.labRooms[gene.roomIdx] : ev.fixedRoom;

  for (let p = 0; p < ev.periods; p++) {
    const slot = gene.start + p;
    for (const tid of ev.teacherIds) {
      if (busy.teacher.has(`${tid}|${day}|${slot}`)) conflicts++;
      const t = ctx.teacherById[tid];
      if (ctx.isHardAvailTeacher(t) && !ctx.availMap[tid].has(`${day}-s${slot}`)) conflicts++;
    }
    for (const grp of groups) {
      if (busy.group.has(`${ev.semId}|${grp}|${day}|${slot}`)) conflicts++;
    }
    if (room && busy.room.has(`${room}|${day}|${slot}`)) conflicts++;
  }
  // H6: theory instance of the same course already on this day
  if (ev.type === 'theory' && busy.courseDay.has(`${ev.courseId}|${day}`)) conflicts++;
  return conflicts;
}

function commitToBusy(ev, gene, busy, ctx) {
  const day = ctx.days[gene.day];
  const groups = ev.type === 'theory' || ev.group === 'alt' ? ['A', 'B'] : [ev.group];
  const room = ev.type === 'lab' ? ctx.labRooms[gene.roomIdx] : ev.fixedRoom;
  for (let p = 0; p < ev.periods; p++) {
    const slot = gene.start + p;
    for (const tid of ev.teacherIds) busy.teacher.add(`${tid}|${day}|${slot}`);
    for (const grp of groups) busy.group.add(`${ev.semId}|${grp}|${day}|${slot}`);
    if (room) busy.room.add(`${room}|${day}|${slot}`);
  }
  if (ev.type === 'theory') busy.courseDay.add(`${ev.courseId}|${ctx.days[gene.day]}`);
}

function emptyBusy() {
  return { teacher: new Set(), group: new Set(), room: new Set(), courseDay: new Set() };
}

// Busy-map snapshot of a chromosome excluding one event
function busyExcluding(genes, ctx, excludeIdx) {
  const busy = emptyBusy();
  for (const ev of ctx.events) {
    if (ev.idx === excludeIdx) continue;
    commitToBusy(ev, genes[ev.idx], busy, ctx);
  }
  return busy;
}

/**
 * Heuristic seed: place hardest events first (labs, then most-constrained
 * teachers), each into a least-conflict placement (random among ties).
 */
function heuristicChromosome(ctx, rng) {
  const genes = new Array(ctx.events.length);
  const busy = emptyBusy();

  const order = [...ctx.events].sort((a, b) => {
    const labDiff = (b.type === 'lab') - (a.type === 'lab');
    if (labDiff !== 0) return labDiff;
    return b.teacherIds.length - a.teacherIds.length;
  });

  for (const ev of order) {
    const placements = rng.shuffle(allPlacements(ev, ctx));
    let best = null;
    let bestConf = Infinity;
    for (const gene of placements) {
      const c = placementConflicts(ev, gene, busy, ctx);
      if (c < bestConf) { bestConf = c; best = gene; }
      if (c === 0) break;
    }
    genes[ev.idx] = best || randomGene(ev, ctx, rng);
    commitToBusy(ev, genes[ev.idx], busy, ctx);
  }
  return genes;
}

function randomChromosome(ctx, rng) {
  return ctx.events.map(ev => randomGene(ev, ctx, rng));
}

function tournament(pop, evals, rng, k) {
  let best = rng.int(pop.length);
  for (let i = 1; i < k; i++) {
    const c = rng.int(pop.length);
    if (evals[c].cost < evals[best].cost) best = c;
  }
  return pop[best];
}

function crossover(a, b, rng) {
  return a.map((g, i) => (rng.chance(0.5) ? { ...g } : { ...b[i] }));
}

function mutate(genes, evalRes, ctx, cfg, rng) {
  for (const ev of ctx.events) {
    const inViolation = evalRes?.violating.has(ev.idx);
    const rate = cfg.mutationRate * (inViolation ? cfg.violationMutationBoost : 1);
    if (rng.chance(rate)) genes[ev.idx] = randomGene(ev, ctx, rng);
  }
  return genes;
}

/**
 * Memetic repair: for a few violating events, greedily move them to the
 * least-conflict placement (sampled candidates).
 */
function localSearch(genes, ctx, cfg, rng) {
  const res = evaluate(genes, ctx, cfg);
  if (res.hardCount === 0) return { genes, res };

  const targets = rng.shuffle([...res.violating]).slice(0, cfg.localSearchMaxEvents);
  for (const idx of targets) {
    const ev = ctx.events[idx];
    const busy = busyExcluding(genes, ctx, idx);
    let candidates = allPlacements(ev, ctx);
    if (candidates.length > cfg.localSearchMaxCandidates) {
      candidates = rng.shuffle(candidates).slice(0, cfg.localSearchMaxCandidates);
    }
    let bestGene = genes[idx];
    let bestConf = placementConflicts(ev, bestGene, busy, ctx);
    for (const gene of candidates) {
      const c = placementConflicts(ev, gene, busy, ctx);
      if (c < bestConf) { bestConf = c; bestGene = gene; }
      if (c === 0) break;
    }
    genes[idx] = bestGene;
  }
  return { genes, res: evaluate(genes, ctx, cfg) };
}

/**
 * Run the memetic GA. Returns the best chromosome + its evaluation + stats.
 * `seed` (optional) makes the run reproducible.
 */
export function runGA(ctx, cfg, seed) {
  const usedSeed = Number.isFinite(seed) ? seed : (Date.now() % 2147483647);
  const rng = createRng(usedSeed);
  const t0 = Date.now();

  if (ctx.events.length === 0) {
    return {
      genes: [],
      best: { cost: 0, hardCount: 0, hard: [], softCost: 0, violating: new Set() },
      stats: { generations: 0, elapsedMs: 0, seed: usedSeed },
    };
  }

  // ── Seed population: half heuristic, half random ──
  let pop = [];
  for (let i = 0; i < cfg.populationSize; i++) {
    pop.push(i < cfg.populationSize / 2
      ? heuristicChromosome(ctx, rng)
      : randomChromosome(ctx, rng));
  }
  let evals = pop.map(g => evaluate(g, ctx, cfg));

  let bestIdx = 0;
  for (let i = 1; i < pop.length; i++) if (evals[i].cost < evals[bestIdx].cost) bestIdx = i;
  let bestGenes = pop[bestIdx].map(g => ({ ...g }));
  let bestEval = evals[bestIdx];

  let plateau = 0;
  let gen = 0;

  for (gen = 0; gen < cfg.generations; gen++) {
    // Early stop: feasible and no improvement for a while
    if (bestEval.hardCount === 0 && plateau >= cfg.earlyStopPlateau) break;

    // Elitism: carry the best chromosomes over unchanged
    const ranked = pop
      .map((g, i) => ({ g, e: evals[i] }))
      .sort((a, b) => a.e.cost - b.e.cost);

    const nextPop = ranked.slice(0, cfg.elitism).map(x => x.g.map(g => ({ ...g })));
    const nextEvals = ranked.slice(0, cfg.elitism).map(x => x.e);

    while (nextPop.length < cfg.populationSize) {
      const p1 = tournament(pop, evals, rng, cfg.tournamentK);
      const p2 = tournament(pop, evals, rng, cfg.tournamentK);
      let child = rng.chance(cfg.crossoverRate)
        ? crossover(p1, p2, rng)
        : p1.map(g => ({ ...g }));

      child = mutate(child, evaluate(child, ctx, cfg), ctx, cfg, rng);

      // Memetic step: greedy repair of violating events
      const { genes: repaired, res } = localSearch(child, ctx, cfg, rng);
      nextPop.push(repaired);
      nextEvals.push(res);
    }

    pop = nextPop;
    evals = nextEvals;

    let genBest = 0;
    for (let i = 1; i < pop.length; i++) if (evals[i].cost < evals[genBest].cost) genBest = i;

    if (evals[genBest].cost < bestEval.cost - 1e-9) {
      bestEval = evals[genBest];
      bestGenes = pop[genBest].map(g => ({ ...g }));
      plateau = 0;
    } else {
      plateau++;
    }
  }

  return {
    genes: bestGenes,
    best: bestEval,
    stats: { generations: gen, elapsedMs: Date.now() - t0, seed: usedSeed },
  };
}
