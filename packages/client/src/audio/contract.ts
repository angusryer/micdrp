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
 * directly. (`frequencyHz` uses 0 — not null — for unvoiced because this type
 * sits on the native boundary; `logic` operates on `midi`/`cents`, which stay
 * null when unvoiced.)
 */
export interface PitchSample {
  /** Milliseconds from capture start. */
  timestampMs: number;
  /** Detected fundamental in Hz; 0 when unvoiced. */
  frequencyHz: number;
  /** NSDF clarity / confidence, 0..1. */
  clarity: number;
  /**
   * How loud the analysed window was, in dBFS, floored at -80.
   *
   * Absent when the binary predates it: a bundle can be newer than the app it
   * is running inside, and a frame with no reading must not be taken for a
   * silent one (INV-PITCH-020).
   */
  levelDb?: number;
  /**
   * What the spectrum said. All four come free of the transform the pitch
   * detector runs to get its autocorrelation (INV-PITCH-026).
   */
  /** Energy-weighted mean frequency: where the sound sits. */
  centroidHz?: number;
  /** 0..1. Near 1 is noise, near 0 is a tone. Whether it is pitched at all. */
  flatness?: number;
  /** The frequency below which 85% of the energy lies. */
  rolloffHz?: number;
  /** How far the spectrum moved since the last frame, in dB. An attack. */
  fluxDb?: number;
  /** Nearest MIDI note number; null when unvoiced. */
  midi: number | null;
  /** Deviation from the nearest note in cents (-50..50); null when unvoiced. */
  cents: number | null;
}

/** Tunable engine parameters. All optional on the wire; native fills defaults. */
export interface EngineConfig {
  sampleRateHz: number; // default 44100
  frameSize: number; // analysis window, default 2048
  hopSize: number; // default 512
  minFrequencyHz: number; // default 70
  maxFrequencyHz: number; // default 2500
  /**
   * MPM's peak-picking parameter: which NSDF peak counts as the fundamental,
   * as a fraction of the tallest one. It decides WHICH pitch was sung, never
   * whether anything was — lowering it invites octave errors rather than
   * finding quiet notes (INV-PITCH-021).
   */
  clarityThreshold: number; // default 0.9
  /**
   * How tall the chosen peak must be in absolute terms to count as a pitch
   * rather than noise shaped like one. This is the one to lower when quiet
   * singing or whistling goes undetected.
   */
  voicedClarityMin: number; // default 0.5
  /** How loud the window must be, in dBFS, to be worth calling anything. */
  voicedLevelDb: number; // default -55
  emitRateHz: number; // throttle to JS, default 60
}

export const DEFAULT_ENGINE_CONFIG: EngineConfig = {
  sampleRateHz: 44100,
  frameSize: 2048,
  // Half a frame used to be the hop. Halving it again doubles the time
  // resolution of every onset — 23ms of uncertainty becomes 12ms, which is
  // the difference between placing a fast attack and rounding it to the
  // nearest other one. Affordable only because the detector became fifteen
  // times cheaper (INV-PITCH-026).
  hopSize: 512,
  minFrequencyHz: 70,
  /**
   * The ceiling on what counts as a pitch.
   *
   * 2500 Hz, not 1200. Whistling is a primary way melodies get sketched
   * here, and it sits far above singing: a measured whistled take ran to a
   * median of 1238 Hz and a peak of 2309, so at 1200 more than half of it
   * was above the ceiling and was thrown away — which read back as a
   * singer who drifted and left gaps rather than as a detector that had
   * stopped listening.
   *
   * Raising it costs little. The bound only sets the shortest lag the
   * detector will consider; which peak counts as the fundamental is
   * clarityThreshold's decision, and that is what octave errors turn on.
   */
  maxFrequencyHz: 2500,
  clarityThreshold: 0.9,
  voicedClarityMin: 0.5,
  voicedLevelDb: -55,
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
  /**
   * Read a recording back through the engine and return every frame.
   *
   * The audio is the only part of a take that cannot be recomputed; the
   * melody, the hits, the chords and the grid are all readings of it. This is
   * what lets an improved engine reach a take recorded before it existed
   * (INV-NOTES-116). Returns an empty array where the file cannot be read.
   */
  analyzeFile(uri: string): Promise<PitchSample[]>;
  /** Subscribe to the throttled live PitchSample stream. Returns an unsubscribe fn. */
  onPitch(cb: (sample: PitchSample) => void): () => void;
  /** Subscribe to coarse engine-state transitions. Returns an unsubscribe fn. */
  onState(cb: (state: EngineState) => void): () => void;
}
