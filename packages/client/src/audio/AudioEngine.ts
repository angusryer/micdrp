/**
 * AudioEngine — the one way into detection, and the only caller of the
 * native module that does it (INV-PITCH-029).
 *
 * The C++ core runs on the real-time audio thread and pushes throttled
 * `PitchSample` frames over the codegen event emitters. PCM never reaches
 * JS.
 *
 * There was a second tier: the same algorithm again as pure TypeScript in
 * an audio worklet, taken whenever the native module was absent. Two
 * implementations of the one thing this app is for meant no measurement
 * and no fix applied to the app as a whole — whichever tier the build
 * selected is what ran, and the fallback was the one nobody measured. It
 * is gone, and an absent engine is now said out loud (INV-PITCH-029).
 *
 * Screens import ONLY this wrapper (via the barrel), never the native
 * module. Exposes both a named singleton `audioEngine` and a default
 * export.
 */

import NativeAudioEngine from '../specs/NativeAudioEngine';
import type { Spec as NativeAudioEngineModule } from '../specs/NativeAudioEngine';

import {
  AudioEngine as AudioEngineContract,
  DEFAULT_ENGINE_CONFIG,
  EngineConfig,
  EngineState,
  PitchSample,
  RecordingHandle
} from './contract';
import { ensureDirs, recordingsDir } from '../data/files';
import {
  PLAYABLE_AUDIO_EXTENSIONS,
  audioExtensionOf,
  isPlayableAudioPath
} from 'shared';

type PitchListener = (sample: PitchSample) => void;
type StateListener = (state: EngineState) => void;

/**
 * Resolve the TurboModule, or null where there is none — a stripped build,
 * or Jest.
 *
 * Null at import rather than a throw: `getEnforcing` fails at module scope,
 * before any caller can catch it, which takes the app down instead of the
 * one feature. Absence is reported at the call instead, by `engine()`.
 */
function getNativeModule(): NativeAudioEngineModule | null {
  return NativeAudioEngine ?? null;
}

/** What a caller is told when there is no engine to do the work. */
const NO_ENGINE = 'the native audio engine is not in this build';

/**
 * A field the engine may or may not have sent.
 *
 * Absent and present-but-not-a-number are the same thing here: a binary
 * older than the bundle reading it did not measure this, and a frame with
 * no reading must never be taken for one that read zero (INV-PITCH-020).
 */
const optional = (value: unknown): number | undefined =>
  typeof value === 'number' ? value : undefined;

/**
 * Normalize an arbitrary native event payload into a strict `PitchSample`.
 * Native sends `midi`/`cents` as `null` when unvoiced.
 *
 * Every field the engine measures is carried, not the five this used to
 * list. The engine has been measuring a level for every frame and sending
 * it across; this dropped it on the way in, so every note was built with
 * no loudness, every take was measured as unmeasured, and the level match
 * that starts the tracks where the take sits correctly declined to move
 * anything (INV-NOTES-141). The spectral fields went the same way, which
 * is what percussion is read from (INV-PITCH-025).
 *
 * Nothing failed. The loss was invisible at the seam and showed up only as
 * two features that quietly never happened.
 */
export function toPitchSample(raw: unknown): PitchSample {
  const o = (raw ?? {}) as Record<string, unknown>;
  const midi = o.midi;
  const cents = o.cents;
  return {
    timestampMs: typeof o.timestampMs === 'number' ? o.timestampMs : 0,
    frequencyHz: typeof o.frequencyHz === 'number' ? o.frequencyHz : 0,
    clarity: typeof o.clarity === 'number' ? o.clarity : 0,
    levelDb: optional(o.levelDb),
    centroidHz: optional(o.centroidHz),
    flatness: optional(o.flatness),
    rolloffHz: optional(o.rolloffHz),
    fluxDb: optional(o.fluxDb),
    midi: typeof midi === 'number' ? midi : null,
    cents: typeof cents === 'number' ? cents : null
  };
}

class AudioEngineImpl implements AudioEngineContract {
  private readonly native: NativeAudioEngineModule | null;

  private config: EngineConfig = { ...DEFAULT_ENGINE_CONFIG };
  private state: EngineState = 'idle';

  private readonly pitchListeners = new Set<PitchListener>();
  private readonly stateListeners = new Set<StateListener>();

  // Native subscriptions, attached lazily while listeners exist. Codegen
  // event emitters hand back an EventSubscription.
  private nativePitchSub: { remove(): void } | null = null;
  private nativeStateSub: { remove(): void } | null = null;

  constructor() {
    this.native = getNativeModule();
  }

  /** True when the C++ engine is available. There is no other way to run. */
  get isNative(): boolean {
    return this.native != null;
  }

  /**
   * The engine, or a thrown reason. Every operation that needs it goes
   * through here, so "there is no engine" is said once and said loudly
   * (INV-PITCH-029, INV-TPORT-006).
   */
  private engine(): NativeAudioEngineModule {
    if (this.native == null) {
      throw new Error(NO_ENGINE);
    }
    return this.native;
  }

  async configure(config: Partial<EngineConfig>): Promise<void> {
    this.config = { ...this.config, ...config };
    await this.native?.configure(config);
  }

  async requestPermission(): Promise<boolean> {
    return this.engine().requestPermission();
  }

  /**
   * `overdub` when something is playing that must keep being heard — a layer
   * sung against the take (INV-NOTES-087).
   */
  async start(overdub = false): Promise<void> {
    const native = this.engine();
    this.attachNative();
    // The capture directory is owned by files.ts and handed to native, so a
    // capture lands somewhere durable rather than in a temporary directory
    // the system may reclaim while the note still points at it.
    await ensureDirs();
    await native.start(recordingsDir(), overdub);
  }

  /**
   * The round trip from asking for a sound to hearing it back, for the route
   * in use right now, or 0 when nothing can say.
   *
   * Callers must read 0 as "do not correct" rather than "no latency": a wrong
   * correction to an overdub is worse than an uncorrected one, which is at
   * least visibly late (INV-NOTES-074).
   */
  async roundTripLatencyMs(): Promise<number> {
    try {
      return (await this.native?.roundTripLatencyMs()) ?? 0;
    } catch {
      // A session that refuses to say is the same answer as not having one,
      // and 0 already means "do not correct".
      return 0;
    }
  }

  /**
   * Read a recording back through the engine.
   *
   * The audio is the only part of a take that cannot be recomputed; the
   * melody, the hits, the chords and the grid are all readings of it. This is
   * what carries an improved engine back to takes recorded before it existed
   * (INV-NOTES-116).
   *
   * Empty rather than throwing, so a caller can offer the re-read and
   * simply find there is nothing new to say. This one is a re-reading of
   * something already captured, not a capture — nothing is lost by it
   * declining, which is why it is the one operation that stays quiet.
   */
  async analyzeFile(uri: string): Promise<PitchSample[]> {
    if (!this.native) {
      return [];
    }
    try {
      return (await this.native.analyzeFile(uri)) as PitchSample[];
    } catch {
      return [];
    }
  }

  async stop(): Promise<RecordingHandle> {
    const handle = await this.engine().stop();
    // Native already emits 'idle' via the state channel; mirror locally so a
    // caller without a state listener still sees a consistent value.
    this.state = 'idle';
    return this.normalizeHandle(handle);
  }

  onPitch(cb: PitchListener): () => void {
    this.pitchListeners.add(cb);
    this.attachNative();
    return () => {
      this.pitchListeners.delete(cb);
      this.maybeDetach();
    };
  }

  onState(cb: StateListener): () => void {
    this.stateListeners.add(cb);
    this.attachNative();
    // Replay current coarse state so late subscribers are in sync.
    cb(this.state);
    return () => {
      this.stateListeners.delete(cb);
      this.maybeDetach();
    };
  }

  // ---- internals ----

  private setState(next: EngineState): void {
    this.state = next;
    this.stateListeners.forEach((l) => l(next));
  }

  private emitPitch(sample: PitchSample): void {
    this.pitchListeners.forEach((l) => l(sample));
  }

  /**
   * Adapt the engine's handle into the strict contract shape. The codegen
   * type marks midi/cents optional; the contract requires them present and
   * nullable, and toPitchSample is what reconciles the two.
   */
  private normalizeHandle(handle: {
    id: string;
    uri: string;
    sampleRateHz: number;
    durationMs: number;
    samples: readonly unknown[];
  }): RecordingHandle {
    // The seam where the recorder's file meets the code that has to play it.
    // Nothing checked it before, so a capture written in a format the decoder
    // cannot open shipped and stayed shipped — every note silently unplayable
    // until someone pressed play (INV-PITCH-012). Complaining here names the
    // format, at the moment it is produced, rather than long afterwards.
    if (!isPlayableAudioPath(handle.uri)) {
      console.error(
        `[AudioEngine] captured ${audioExtensionOf(handle.uri) || 'an unnamed format'}, ` +
          `which playback cannot open. Expected one of ${PLAYABLE_AUDIO_EXTENSIONS.join(', ')}.`
      );
    }
    return {
      ...handle,
      samples: Array.isArray(handle.samples) ? handle.samples.map(toPitchSample) : []
    };
  }

  private attachNative(): void {
    const native = this.native;
    if (!native) {
      return;
    }
    if (this.nativePitchSub == null) {
      this.nativePitchSub = native.onPitch((raw) => {
        this.emitPitch(toPitchSample(raw));
      });
    }
    if (this.nativeStateSub == null) {
      this.nativeStateSub = native.onState((raw) => {
        this.setState(raw as EngineState);
      });
    }
  }

  private maybeDetach(): void {
    if (this.pitchListeners.size > 0 || this.stateListeners.size > 0) {
      return;
    }
    this.nativePitchSub?.remove();
    this.nativePitchSub = null;
    this.nativeStateSub?.remove();
    this.nativeStateSub = null;
  }
}

/** Process-wide singleton implementing the AudioEngine contract. */
export const audioEngine: AudioEngineImpl = new AudioEngineImpl();

export default audioEngine;
