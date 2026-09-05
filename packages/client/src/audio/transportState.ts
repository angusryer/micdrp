/**
 * What a transport is doing, as one word (INV-TPORT-001).
 *
 * A state machine rather than three booleans in three hooks. It was
 * three: one knew the take was loading, one knew a count was running,
 * one knew whether the chords were sounding, and a control asked
 * whichever it happened to hold. Two answers to "what is sounding" is
 * how a button came to show a pause glyph over a take that had stopped.
 *
 * Pure and free of React so it can be reasoned about — and tested —
 * without a renderer, a device or a sound.
 */

export type TransportState =
  | 'idle'
  | 'loading'
  | 'playing'
  | 'paused'
  | 'stopped'
  | 'failed';

/** What a control sends. Never a state a control sets (INV-TPORT-003). */
export type CommandKind = 'play' | 'pause' | 'stop' | 'seek';

/** Whether a sound is running now, which is a different question from busy. */
export const isSounding = (state: TransportState): boolean => state === 'playing';

/**
 * Whether a press should be refused rather than queued.
 *
 * Only while loading. A second press during a decode is the slow path
 * run twice, and a decode is the one slow step there is.
 */
export const isBusy = (state: TransportState): boolean => state === 'loading';

/**
 * Where a press leaves the head.
 *
 * Pausing holds the moment reached so the next press carries on from
 * it; stopping gives it back to wherever it was put. The difference is
 * the whole reason both exist, and it used to live in a comment.
 */
export const keepsTheMoment = (kind: CommandKind): boolean => kind === 'pause';

/**
 * Whether this command may follow that state.
 *
 * Refusing is a real answer and is reported as one — a command silently
 * dropped is exactly the failure this whole domain was built after
 * (INV-TPORT-006).
 */
export function accepts(state: TransportState, kind: CommandKind): boolean {
  if (kind === 'play') {
    // Not while loading: the take is already on its way.
    return state !== 'loading' && state !== 'playing';
  }
  // Silencing what is already silent is not an error, it is a no-op, and
  // a transport that refused it would make every control ask first.
  return true;
}

/** Where a command leaves the state, given it was accepted. */
export function nextState(
  state: TransportState,
  kind: CommandKind
): TransportState {
  switch (kind) {
    case 'play':
      return 'loading';
    case 'pause':
      // Pausing something that never started is stopping it: there is no
      // moment to hold, and calling it paused would promise one.
      return state === 'playing' ? 'paused' : state;
    case 'stop':
      return 'stopped';
    case 'seek':
      // Moving the head decides nothing about sound (INV-TPORT-007).
      return state === 'playing' ? 'playing' : state;
  }
}
