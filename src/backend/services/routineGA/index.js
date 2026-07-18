/**
 * Routine GA orchestrator: raw data in → routine entries + report out.
 * Pure module — callers (routineService) supply the data and persist results.
 */
import { GA_CONFIG } from './config.js';
import { buildContext } from './events.js';
import { runGA } from './engine.js';

/**
 * Generate a routine with the memetic GA.
 * `data` — routineService._loadData() output.
 * `options.seed` — optional integer for a reproducible run.
 * `options.config` — optional per-run overrides of GA_CONFIG.
 *
 * Returns { entries, report } where `entries` use the routine_storage shape
 * (one entry per occupied period; lab sessions emit 2 entries sharing a
 * session_id) so the existing views and publish flow work unchanged.
 */
export function generateWithGA(data, options = {}) {
  const cfg = { ...GA_CONFIG, ...(options.config || {}), soft: { ...GA_CONFIG.soft, ...(options.config?.soft || {}) } };
  const { ctx, problems } = buildContext(data, cfg);

  const { genes, best, stats } = runGA(ctx, cfg, options.seed);

  const entries = [];
  for (const ev of ctx.events) {
    const gene = genes[ev.idx];
    if (!gene) continue;
    const day = ctx.days[gene.day];
    const room = ev.type === 'lab' ? (ctx.labRooms[gene.roomIdx] ?? null) : ev.fixedRoom;
    const sessionId = ev.type === 'lab' ? `${ev.courseId}:${ev.group}` : null;

    for (let p = 0; p < ev.periods; p++) {
      entries.push({
        semester: ev.semId,
        day_of_week: day,
        slot_id: `s${gene.start + p}`,
        course_id: ev.courseId,
        teacher_id: ev.teacherIds[0] ?? null,   // legacy field (existing views/publish)
        teacher_ids: ev.teacherIds,             // full list — a course may have many
        room,
        group: ev.group,                        // null | 'A' | 'B' | 'alt'
        alternating: !!ev.alternating,          // theory class every other week
        session_id: sessionId,
      });
    }
  }

  const report = {
    feasible: best.hardCount === 0,
    // Time budget hit before a feasible routine was found: this result is the
    // best attempt, with the unmet hard constraints listed for the admin.
    timedOut: !!stats.timedOut,
    hardViolations: best.hard.map(h => ({ type: h.type, message: h.message })),
    hardCount: best.hardCount,
    softCost: Math.round(best.softCost * 100) / 100,
    inputProblems: problems,
    stats: {
      events: ctx.events.length,
      entries: entries.length,
      generations: stats.generations,
      elapsedMs: stats.elapsedMs,
      seed: stats.seed,
    },
  };

  return { entries, report };
}

export { GA_CONFIG } from './config.js';
export { buildContext, validStarts } from './events.js';
export { evaluate } from './fitness.js';
export { runGA } from './engine.js';
