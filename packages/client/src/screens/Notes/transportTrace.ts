/**
 * What the transport actually did, as a fact rather than an inference.
 *
 * Four attempts at the same bug failed because nothing could answer "was
 * the command sent, and did the sound stop" from the outside. Every link
 * read as correct, the fault surfaced as an error nowhere, and each fix
 * was a guess dressed as a diagnosis.
 *
 * So the transport counts what it does. A press that never reached the
 * engine and a press that reached it and was ignored look identical from
 * a chair; they do not look identical here.
 *
 * Deliberately not React state: it is written from callbacks on every
 * press and read once a frame by a display that already redraws. Making
 * it state would re-render the graph on every count.
 */

export interface TransportTrace {
  /**
   * Presses of the pause control, counted in the control itself.
   *
   * Separate from `paused` on purpose. A press that never fired and a
   * press that fired and died on its way to the engine look identical
   * from a chair, and the gap between these two numbers is exactly which
   * of those happened.
   */
  pressedPause: number;
  /** Presses of play that got as far as calling the engine. */
  played: number;
  /** Presses of pause that got as far as calling the engine. */
  paused: number;
  /** Times the engine was asked to silence everything. */
  silenced: number;
  /** Times a schedule was posted for the take. */
  scheduled: number;
  /** False when there is no native engine to talk to at all. */
  hasEngine: boolean;
  /** Whatever last went wrong, or null. */
  problem: string | null;
}

const trace: TransportTrace = {
  pressedPause: 0,
  played: 0,
  paused: 0,
  silenced: 0,
  scheduled: 0,
  hasEngine: false,
  problem: null
};

export function noteTransport(
  what: 'pressedPause' | 'played' | 'paused' | 'silenced' | 'scheduled'
): void {
  trace[what] += 1;
}

export function noteEngine(present: boolean): void {
  trace.hasEngine = present;
}

export function noteTransportProblem(problem: string | null): void {
  trace.problem = problem;
}

/** What has happened so far. A copy, so a reader cannot alter the count. */
export function transportTrace(): TransportTrace {
  return { ...trace };
}

/** One line, short enough to sit under a transport and be read at a glance. */
export function traceLine(t: TransportTrace = transportTrace()): string {
  const engine = t.hasEngine ? 'engine' : 'NO ENGINE';
  const parts = [
    engine,
    `press ${t.pressedPause}`,
    `play ${t.played}`,
    `pause ${t.paused}`,
    `silence ${t.silenced}`,
    `sched ${t.scheduled}`
  ];
  return t.problem == null ? parts.join('  ') : `${parts.join('  ')}  — ${t.problem}`;
}

/** Test seam. Never called by app code. */
export function resetTransportTraceForTests(): void {
  trace.pressedPause = 0;
  trace.played = 0;
  trace.paused = 0;
  trace.silenced = 0;
  trace.scheduled = 0;
  trace.hasEngine = false;
  trace.problem = null;
}
