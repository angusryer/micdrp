/**
 * Codegen spec for the native audio engine.
 *
 * This file is the contract: codegen reads it and generates the C++/ObjC
 * protocol the native implementation must satisfy, so a mismatch between JS and
 * native becomes a compile error rather than a runtime `undefined`. It replaces
 * the legacy bridge module, which passed everything as untyped dictionaries
 * over the async bridge.
 *
 * Shapes mirror `src/audio/contract.ts`; that file stays the app-facing type
 * surface, and `AudioEngine.ts` adapts between the two.
 */
import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';
import type {
  Double,
  EventEmitter
} from 'react-native/Libraries/Types/CodegenTypes';

/** One analysed frame as it crosses the native boundary. */
export type PitchSampleEvent = {
  timestampMs: Double;
  /** Detected fundamental; 0 when unvoiced, never null. */
  frequencyHz: Double;
  clarity: Double;
  /** Nearest MIDI note, or null when unvoiced. */
  midi?: Double | null;
  cents?: Double | null;
};

/** Partial engine configuration; native fills any field left out. */
export type EngineConfigInput = {
  sampleRateHz?: Double;
  frameSize?: Double;
  hopSize?: Double;
  minFrequencyHz?: Double;
  maxFrequencyHz?: Double;
  clarityThreshold?: Double;
  emitRateHz?: Double;
};

/** What a finished capture resolves to. */
export type RecordingHandleResult = {
  id: string;
  uri: string;
  sampleRateHz: Double;
  durationMs: Double;
  /** Full-resolution analysis, not the throttled stream. */
  samples: PitchSampleEvent[];
};

export interface Spec extends TurboModule {
  configure(config: EngineConfigInput): Promise<void>;
  requestPermission(): Promise<boolean>;
  /**
   * Begin capturing into `captureDir`, an absolute directory path the caller
   * owns. Passing it keeps the location defined once, in files.ts, rather
   * than once here and again in native code (INV-PITCH-011).
   */
  /**
   * `overdub` true when something is playing that the singer must keep
   * hearing — a layer sung against the take. It changes the audio session:
   * measurement mode strips processing for the cleanest possible detection,
   * which is right for a first take and wrong here, because it takes the
   * session and silences the playback, and because without echo cancellation
   * the microphone hears the take through the speaker and the detector reads
   * that back as the thing being sung (INV-NOTES-087).
   */
  start(captureDir: string, overdub?: boolean): Promise<void>;
  stop(): Promise<RecordingHandleResult>;
  /**
   * The round trip from asking for a sound to hearing it back through the
   * microphone, in milliseconds, for the route in use right now.
   *
   * Read rather than assumed: it differs between the built-in speaker, wired
   * headphones and Bluetooth, and Bluetooth is far enough out that any
   * constant would be wrong on every route but the one it was measured on
   * (INV-NOTES-074). 0 when the session cannot say.
   */
  roundTripLatencyMs(): Promise<Double>;

  /** Throttled live frames for the duration of a capture. */
  readonly onPitch: EventEmitter<PitchSampleEvent>;
  /** Coarse lifecycle: idle | recording | analyzing | error. */
  readonly onState: EventEmitter<string>;
}

/**
 * `get` rather than `getEnforcing`: this module is optional by design. When the
 * native engine is absent — a stripped build, or Jest — AudioEngine.ts falls
 * back to the Tier 2 worklet. getEnforcing throws at module scope, before any
 * caller can catch it, which would take the whole app down instead.
 */
export default TurboModuleRegistry.get<Spec>('AudioEngineModule');
