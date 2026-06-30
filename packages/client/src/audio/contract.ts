/**
 * The single integration surface between the native audio engine and the app.
 *
 * Every screen, hook, machine and native bridge codes against THESE types.
 * Do not redefine them elsewhere. `PitchSample` is structurally compatible with
 * `logic`'s `PitchFrame`, so the offline pipeline (smoothPitch → segmentNotes →
 * notesToMidi / scorePitch) consumes a `PitchSample[]` directly.
 *
 * See docs/NATIVE_BUILD_PLAN.md §0 (tier model) and §2 (contract).
 */

/**
 * One analysed frame emitted by the native engine (all tiers). This is the
 * native-boundary pitch frame: `frequencyHz` is 0 (never null) when unvoiced,
 * matching the C++/wire representation. It is structurally compatible with
 * `logic`'s `PitchFrame`, so the offline pipeline consumes a `PitchSample[]`
 * directly. (Distinct on purpose from the `models` domain types, which use
 * `null` for unvoiced and are not on the native boundary.)
 */
export interface PitchSample {
  /** Milliseconds from capture start. */
  timestampMs: number;
  /** Detected fundamental in Hz; 0 when unvoiced. */
  frequencyHz: number;
  /** NSDF clarity / confidence, 0..1. */
  clarity: number;
  /** Nearest MIDI note number; null when unvoiced. */
  midi: number | null;
  /** Deviation from the nearest note in cents (-50..50); null when unvoiced. */
  cents: number | null;
}

/** Tunable engine parameters. All optional on the wire; native fills defaults. */
export interface EngineConfig {
  sampleRateHz: number; // default 44100
  frameSize: number; // analysis window, default 2048
  hopSize: number; // default 1024
  minFrequencyHz: number; // default 70
  maxFrequencyHz: number; // default 1200
  clarityThreshold: number; // default 0.9
  emitRateHz: number; // throttle to JS, default 60
}

export const DEFAULT_ENGINE_CONFIG: EngineConfig = {
  sampleRateHz: 44100,
  frameSize: 2048,
  hopSize: 1024,
  minFrequencyHz: 70,
  maxFrequencyHz: 1200,
  clarityThreshold: 0.9,
  emitRateHz: 60
};

export type EngineState = 'idle' | 'recording' | 'analyzing' | 'error';

/** Reference to a finished capture: audio file on disk + the full analysis. */
export interface RecordingHandle {
  id: string;
  /** file:// path to the captured audio (wav/m4a). */
  uri: string;
  sampleRateHz: number;
  durationMs: number;
  /** Full-resolution analysis (NOT throttled), ready for the offline pipeline. */
  samples: PitchSample[];
}

/**
 * The TS surface of the native audio engine (TurboModule-shaped).
 *
 * Implemented by `src/audio/AudioEngine.ts`, which selects the fastest available
 * tier (native C++ → audio-api worklet) behind this interface. The app only ever
 * imports the wrapper, never the native module directly.
 */
export interface AudioEngine {
  /** Merge overrides into the engine config. Safe to call before start(). */
  configure(config: Partial<EngineConfig>): Promise<void>;
  /** Begin microphone capture + analysis. Rejects if permission is denied. */
  start(): Promise<void>;
  /** Stop capture and resolve with the captured session. */
  stop(): Promise<RecordingHandle>;
  /** Request the OS microphone permission. Resolves true if granted. */
  requestPermission(): Promise<boolean>;
  /** Subscribe to the throttled live PitchSample stream. Returns an unsubscribe fn. */
  onPitch(cb: (sample: PitchSample) => void): () => void;
  /** Subscribe to coarse engine-state transitions. Returns an unsubscribe fn. */
  onState(cb: (state: EngineState) => void): () => void;
}
