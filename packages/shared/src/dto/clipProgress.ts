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
