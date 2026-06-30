/**
 * referenceTone — play a target melody as reference tones to sing against.
 *
 * Schedules one short sine-wave note per {@link TargetNote} on a
 * `react-native-audio-api` AudioContext, each with a small attack/release
 * envelope so the run is smooth rather than clicky. Pitches come from the shared
 * `logic` `midiToFrequency`, so the reference a singer hears is exactly the
 * target the scorer grades against.
 *
 * The audio graph is typed loosely (the package's real types only exist on a
 * device install) and resolved lazily, mirroring the Tier-2 worklet engine.
 * When the package is unavailable the player is an inert no-op, so callers never
 * need to guard for it.
 */
import { midiToFrequency, type TargetNote } from 'logic';

// ---------------------------------------------------------------------------
// Minimal structural shapes of the react-native-audio-api graph we touch.
// ---------------------------------------------------------------------------
interface AudioParamLike {
  value: number;
  setValueAtTime(value: number, time: number): void;
  linearRampToValueAtTime(value: number, time: number): void;
}
interface OscillatorLike {
  type: string;
  frequency: AudioParamLike;
  connect(node: unknown): void;
  start(time: number): void;
  stop(time: number): void;
}
interface GainLike {
  gain: AudioParamLike;
  connect(node: unknown): void;
}
export interface AudioContextLike {
  currentTime: number;
  destination: unknown;
  createOscillator(): OscillatorLike;
  createGain(): GainLike;
  close(): Promise<void> | void;
}

export interface ReferenceToneOptions {
  /** Peak gain for each note, 0..1 (default 0.2 — comfortably below clipping). */
  peakGain?: number;
  /** Attack/release ramp in seconds (default 0.01). */
  rampSeconds?: number;
  /**
   * Inject an AudioContext factory (tests). When omitted the player lazily
   * resolves `react-native-audio-api`'s AudioContext.
   */
  createContext?: () => AudioContextLike | null;
}

export interface ReferenceTonePlayer {
  /** Schedule and start playing the melody from the beginning. */
  play(notes: readonly TargetNote[]): void;
  /** Stop playback and release the audio graph. Safe to call repeatedly. */
  stop(): void;
}

/**
 * Lazily resolve `react-native-audio-api`'s AudioContext constructor. Returns a
 * factory that yields a context, or null when the package is unavailable.
 */
function defaultCreateContext(): AudioContextLike | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires -- optional native dep, resolved at runtime
    const api = require('react-native-audio-api') as Record<string, unknown>;
    const Ctor = api.AudioContext as (new () => AudioContextLike) | undefined;
    if (typeof Ctor !== 'function') {
      return null;
    }
    return new Ctor();
  } catch {
    return null;
  }
}

export function createReferenceTonePlayer(
  options: ReferenceToneOptions = {}
): ReferenceTonePlayer {
  const peakGain = options.peakGain ?? 0.2;
  const ramp = options.rampSeconds ?? 0.01;
  const makeContext = options.createContext ?? defaultCreateContext;

  let ctx: AudioContextLike | null = null;
  let oscillators: OscillatorLike[] = [];

  function stop(): void {
    if (ctx) {
      const now = ctx.currentTime;
      for (const osc of oscillators) {
        try {
          osc.stop(now);
        } catch {
          // Oscillator may already have stopped; ignore.
        }
      }
      void ctx.close();
    }
    oscillators = [];
    ctx = null;
  }

  function play(notes: readonly TargetNote[]): void {
    stop();
    if (notes.length === 0) {
      return;
    }
    const context = makeContext();
    if (!context) {
      return; // package unavailable — inert no-op
    }
    ctx = context;

    const t0 = context.currentTime;
    for (const note of notes) {
      const startAt = t0 + note.startMs / 1000;
      const endAt = t0 + note.endMs / 1000;
      // Release a touch early so consecutive notes don't overlap/click.
      const releaseAt = Math.max(startAt + ramp, endAt - ramp);

      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(midiToFrequency(note.midi), startAt);

      // Attack to peak, hold, release to silence.
      gain.gain.setValueAtTime(0, startAt);
      gain.gain.linearRampToValueAtTime(peakGain, startAt + ramp);
      gain.gain.setValueAtTime(peakGain, releaseAt);
      gain.gain.linearRampToValueAtTime(0, endAt);

      osc.connect(gain);
      gain.connect(context.destination);
      osc.start(startAt);
      osc.stop(endAt);
      oscillators.push(osc);
    }
  }

  return { play, stop };
}

export default createReferenceTonePlayer;
