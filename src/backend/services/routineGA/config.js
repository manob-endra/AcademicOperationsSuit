/**
 * All tunables for the memetic routine GA live here.
 * Pure data — no imports.
 */
export const GA_CONFIG = {
  // ── Genetic algorithm parameters ──
  populationSize: 70,
  generations: 350,
  // Wall-clock threshold. If no feasible routine is found inside this budget
  // the GA stops and returns the BEST FOUND SO FAR, with the remaining hard
  // violations listed in the report so the admin knows what couldn't be met.
  timeBudgetMs: 60000,
  tournamentK: 3,
  crossoverRate: 0.9,
  mutationRate: 0.12,            // per-gene base probability
  violationMutationBoost: 3,     // multiplier for genes currently in a hard violation
  elitism: 2,
  earlyStopPlateau: 50,          // stop when hard = 0 and best cost unchanged this many generations

  // Memetic local-search step (per offspring)
  localSearchMaxEvents: 4,       // repair at most this many violating events
  localSearchMaxCandidates: 40,  // sampled placements tried per event

  // ── Fitness weights ──
  hardWeight: 10000,             // ≫ any achievable soft total

  // Seniority weights for soft availability penalties (S1).
  // Professor / Associate Professor availability is enforced as HARD instead
  // (see hardAvailabilityRanks) — weights kept here for completeness.
  seniorityWeights: {
    'Professor': 10,
    'Associate Professor': 8,
    'Assistant Professor': 5,
    'Senior Lecturer': 3,
    'Lecturer': 2,
    'Adjunct Professor': 2,
  },
  defaultSeniorityWeight: 2,     // teachers with no designation → Lecturer level

  // Designations whose availability slots are a hard constraint
  hardAvailabilityRanks: ['Professor', 'Associate Professor'],

  soft: {
    availability: 6,             // S1 base (× seniority weight) per missed slot
    semSingleClassDay: 30,       // S2/S3: a batch day with exactly one class
    semGapPerPeriod: 14,         // S2: each idle period between a batch's classes in a day
    teacherSingleClassDay: 10,   // S2: a teacher coming in for a single class
    teacherGapPerPeriod: 8,      // S2: idle periods inside a teacher's day
    spreadPerDeviation: 3,       // S3: |day load − mean| per unit, per semester
    labBeforeLunch: 1.5,         // S4: lab period sitting before lunch
    theoryAfterLunch: 1.5,       // S4: theory period sitting after lunch
  },

  // Labs with credit_hours ≥ this run as dual-group (A + B weekly sessions);
  // below it (e.g. 0.75) they run as one session with groups alternating weekly.
  labDualGroupMinCredit: 1,

  labPeriods: 2,                 // consecutive periods per lab session
  defaultTheoryWeekly: 2,        // theory classes/week when course_durations has none
};
