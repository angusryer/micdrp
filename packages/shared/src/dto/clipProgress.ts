/**
 * How far the loop has got with a clip.
 *
 * The phases and what each is worth live here rather than in the loop, so the
 * app reading a percentage and the loop writing one cannot disagree about what
 * it means (Axiom 2).
 *
 * The weights are guesses at wall-clock share, not equal steps: building is
 * most of the time a run spends, so it gets most of the bar. A progress bar
 * that races to 90% and then sits there is worse than no bar.
 */

export interface ClipProgressDto {
  percent: number;
  note: string;
  atMs: number;
}

/** Where a run is, in the order it passes through. */
export type ClipPhase =
  | 'claimed'
  | 'transcribing'
  | 'interpreting'
  | 'building'
  | 'verifying'
  | 'delivering'
  | 'done';

/** Percentage each phase has reached when it begins. */
const PHASE_START: Record<ClipPhase, number> = {
  claimed: 2,
  transcribing: 6,
  interpreting: 18,
  // Building spans 30..85 — it is where nearly all the time goes.
  building: 30,
  verifying: 85,
  delivering: 92,
  done: 100
};

const BUILDING_END = 85;

/**
 * The percentage for a phase, and for how far through building it is.
 *
 * Building reports which request it is on, so a clip carrying four of them
 * moves four times rather than sitting at 30 for twenty minutes.
 */
export function progressPercent(
  phase: ClipPhase,
  done = 0,
  total = 0
): number {
  if (phase !== 'building' || total <= 0) {
    return PHASE_START[phase];
  }
  const span = BUILDING_END - PHASE_START.building;
  const through = Math.min(Math.max(done, 0), total) / total;
  return Math.round(PHASE_START.building + span * through);
}

/**
 * The percentage the step after this one begins at.
 *
 * The ceiling an estimate may approach and must never reach: passing it would
 * claim work that has not happened, and reaching it would leave nowhere for
 * the real milestone to land.
 */
export function nextMilestone(
  phase: ClipPhase,
  done = 0,
  total = 0
): number {
  if (phase === 'done') {
    return PHASE_START.done;
  }
  if (phase === 'building' && total > 0 && done + 1 < total) {
    return progressPercent('building', done + 1, total);
  }
  if (phase === 'building') {
    return BUILDING_END;
  }
  const order: ClipPhase[] = [
    'claimed',
    'transcribing',
    'interpreting',
    'building',
    'verifying',
    'delivering',
    'done'
  ];
  const next = order[order.indexOf(phase) + 1];
  return PHASE_START[next ?? 'done'];
}

/**
 * How far along a step is believed to be, from how long it has been running.
 *
 * Asymptotic on purpose. A step whose length is unknown has no honest linear
 * estimate, and a bar that marches steadily to the next milestone and then
 * has to stop dead is making a promise it cannot keep. This slows as it goes
 * and never arrives: it says "still working, and longer than usual" without
 * ever claiming the step is finished (INV-DOG-029).
 *
 * `typicalMs` is the time this kind of step usually takes; at exactly that
 * long the bar sits around two thirds of the way to the next milestone.
 */
export function creptPercent(
  from: number,
  to: number,
  elapsedMs: number,
  typicalMs: number
): number {
  if (!(to > from) || !(typicalMs > 0) || !(elapsedMs > 0)) {
    return from;
  }
  const share = 1 - Math.exp(-elapsedMs / typicalMs);
  // Never the ceiling itself: that number belongs to the step after this one.
  return Math.min(to - 1, Math.max(from, Math.round(from + (to - from) * share)));
}

/**
 * The fields a progress write sets, and — the point of it — the one it does
 * not.
 *
 * `heardFrom` is what separates a fact from an estimate. A milestone was
 * actually reached, so it refreshes the time the clip was last heard from; an
 * interpolated bar has learnt nothing and must leave that alone
 * (INV-DOG-030). The stall warning reads that timestamp, and it is the only
 * signal that tells slow work from dead work — a guess that refreshed it
 * would keep a hung run looking healthy for exactly as long as it was hung.
 *
 * Defined here rather than at the write so nothing can quietly start
 * refreshing it.
 */
export function progressPatch(
  percent: number,
  note: string,
  heardFrom: boolean,
  nowMs: number
): Record<string, unknown> {
  return {
    progress_percent: percent,
    progress_note: note.slice(0, 120),
    ...(heardFrom ? { progress_at_ms: nowMs } : {})
  };
}

/** Whether a clip has been silent long enough to look stuck. */
export function looksStalled(
  progress: ClipProgressDto | null,
  nowMs: number,
  stallAfterMs = 15 * 60 * 1000
): boolean {
  if (progress == null || progress.percent >= 100) {
    return false;
  }
  return nowMs - progress.atMs > stallAfterMs;
}

/**
 * The state that says a remark was withdrawn while a run held it.
 *
 * Named here so the app writing it and the loop reading it cannot disagree.
 * It is an instruction rather than a description: a run that finds it stops
 * and clears up, and does not treat it as something having gone wrong.
 */
export const CANCELLED = 'cancelled';

/** Whether a clip is in the hands of a run, and so has someone to tell. */
export function isInFlight(state: string): boolean {
  return state === 'claimed' || state === 'interpreted';
}
