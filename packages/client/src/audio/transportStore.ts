/**
 * The one thing that knows what is sounding (INV-TPORT-001).
 *
 * A store, not a hook. Commands go in, a subscription comes out, and no
 * React appears anywhere in it — which is what lets the whole model be
 * tested without a renderer, a device or a sound. The hooks above are a
 * binding, and a thin one.
 *
 * Two rules shape it, and both are days already spent.
 *
 * What changes every frame never crosses into React (INV-TPORT-002).
 * The moment lives on the head and is never published; subscribers hear
 * about state, which changes rarely. The position used to tick upward
 * as React state twice a second and re-render a canvas that cost more
 * than the interval, so the JS thread never went idle and a press had
 * nowhere to be handled.
 *
 * A refused command is an error, never silence (INV-TPORT-006). Every
 * fault in this history presented as nothing happening, and outside is
 * where the only person using this stands.
 */
import {
  accepts,
  nextState,
  type CommandKind,
  type TransportState
} from './transportState';

/** How often the engine is asked whether the run is over. */
const WATCH_MS = 100;

/** What a subscriber is told. Never the moment (INV-TPORT-002). */
export interface TransportSnapshot {
  state: TransportState;
  /** Why the last command failed, or null. */
  problem: string | null;
  /** Where a run would start from, in ms. Moves rarely; a seek is an act. */
  cueMs: number;
}

/** What the store needs of an engine. Kept small so a fake is honest. */
export interface TransportEngine {
  /** Resolve, decode and schedule from a moment. Resolves with the length. */
  start(fromMs: number): Promise<number>;
  /** Silence everything. Not one bus (INV-TPORT-005). */
  silence(): void;
  /** Where the engine says the run has reached, in ms. */
  reachedMs(): number;
  /**
   * Whether the engine says this run has finished, or undefined where it
   * cannot say (INV-TPORT-011, INV-TPORT-014).
   *
   * Asked rather than predicted. Where the answer is undefined — a
   * binary older than this bundle — the store falls back to the length
   * the decode reported, which is what it did before an engine could be
   * asked at all.
   */
  hasEnded?(): boolean | undefined;
}

export interface Transport {
  snapshot(): TransportSnapshot;
  subscribe(listener: () => void): () => void;
  play(atMs?: number): Promise<void>;
  pause(): Promise<void>;
  stop(): Promise<void>;
  seek(atMs: number): Promise<void>;
}

export function createTransport(engine: TransportEngine): Transport {
  let snapshot: TransportSnapshot = {
    state: 'idle',
    problem: null,
    cueMs: 0
  };
  const listeners = new Set<() => void>();

  /**
   * Which press is the current one (INV-TPORT-008).
   *
   * Anything resuming after an await checks this and stops if it is no
   * longer current. A play once waited out a count-in on a timer nothing
   * could cancel, so a stop silenced everything, set the state to
   * stopped, and then started the take anyway.
   */
  let run = 0;
  /** The fallback end, armed only where the engine cannot say. */
  let endsAt: ReturnType<typeof setTimeout> | null = null;
  /** Asking the engine whether the run is over, while one is. */
  let watching: ReturnType<typeof setInterval> | null = null;

  const stopWatching = (): void => {
    if (endsAt != null) {
      clearTimeout(endsAt);
      endsAt = null;
    }
    if (watching != null) {
      clearInterval(watching);
      watching = null;
    }
  };

  /**
   * Notice the run ending.
   *
   * The engine's word where it has one, and the decoded length where it
   * has not. A transport that only predicts is wrong whenever the
   * prediction is, and cannot be right about a run that failed early —
   * but a bundle newer than its binary has nothing else to go on
   * (INV-TPORT-011, INV-TPORT-014).
   */
  const watchForEnd = (mine: number, lengthMs: number, fromMs: number): void => {
    stopWatching();
    const ended = (): void => {
      if (mine !== run) {
        return;
      }
      stopWatching();
      publish({ state: 'stopped' });
    };
    if (typeof engine.hasEnded === 'function' && engine.hasEnded() !== undefined) {
      watching = setInterval(() => {
        if (engine.hasEnded?.() === true) {
          ended();
        }
      }, WATCH_MS);
      return;
    }
    endsAt = setTimeout(ended, Math.max(0, lengthMs - fromMs));
  };

  const publish = (next: Partial<TransportSnapshot>): void => {
    snapshot = { ...snapshot, ...next };
    for (const listener of listeners) {
      listener();
    }
  };

  const command = async (kind: CommandKind, atMs?: number): Promise<void> => {
    if (!accepts(snapshot.state, kind)) {
      return;
    }
    const mine = (run += 1);
    stopWatching();

    if (kind === 'play') {
      const from = atMs ?? snapshot.cueMs;
      publish({ state: 'loading', problem: null, cueMs: from });
      let length = 0;
      try {
        length = await engine.start(from);
      } catch (error) {
        // Said out loud. A command the engine would not take must never
        // read as a control that did nothing (INV-TPORT-006).
        if (mine === run) {
          publish({
            state: 'failed',
            problem: error instanceof Error ? error.message : String(error)
          });
        }
        return;
      }
      // Stopped, or pressed again, while the take was being decoded.
      if (mine !== run) {
        return;
      }
      publish({ state: 'playing' });
      watchForEnd(mine, length, from);
      return;
    }

    // Everything else silences first and asks questions after. Silence
    // must not be contingent on bookkeeping being right about which bus
    // a voice went to (INV-TPORT-005).
    const reached = snapshot.state === 'playing' ? engine.reachedMs() : snapshot.cueMs;
    engine.silence();

    if (kind === 'pause') {
      publish({ state: nextState(snapshot.state, 'pause'), cueMs: reached });
      return;
    }
    if (kind === 'stop') {
      publish({ state: 'stopped' });
      return;
    }
    // Seek. The head moves whether or not anything was sounding, and a
    // take that was running starts again from there — this engine begins
    // at a moment rather than jumping to one (INV-TPORT-007).
    const to = Math.max(0, atMs ?? 0);
    const wasPlaying = snapshot.state === 'playing';
    publish({ state: wasPlaying ? 'stopped' : snapshot.state, cueMs: to });
    if (wasPlaying) {
      await command('play', to);
    }
  };

  return {
    snapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    play: (atMs) => command('play', atMs),
    pause: () => command('pause'),
    stop: () => command('stop'),
    seek: (atMs) => command('seek', atMs)
  };
}
