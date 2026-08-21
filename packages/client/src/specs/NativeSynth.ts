/**
 * Codegen spec for the native synth — one voice pool, one clock, for
 * everything the app sounds (INV-NOTES-028/029).
 *
 * The C++ core lives in cpp/dsp/synth.h; the iOS module (SynthModule.mm)
 * feeds it to an AVAudioSourceNode and posts these calls to the audio thread
 * through cpp/dsp/synth_mailbox.h. This file is the contract: codegen derives
 * the ObjC protocol from it, so drift is a compile error.
 *
 * Times are absolute milliseconds on the engine's own clock — the one
 * `nowMs()` reads. Callers wanting two schedules aligned anchor both to the
 * same reading; there is no "relative to now" here because "now" at two call
 * sites is two different moments, which is the bug this module removes.
 */
import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';
import type { Double } from 'react-native/Libraries/Types/CodegenTypes';

/** One note to sound. `bus`: 0 Take, 1 Melody, 2 Chords, 3 Audition. */
export type SynthNoteInput = {
  bus: Double;
  frequencyHz: Double;
  /** Absolute on the engine clock, as read by nowMs(). */
  startMs: Double;
  endMs: Double;
};

export interface Spec extends TurboModule {
  /**
   * Bring the engine up: audio session, output node, clock at zero.
   * Idempotent while running. Scheduling before start() sounds nothing.
   */
  start(): Promise<void>;
  /** Tear the engine down and release the audio session's claim on output. */
  stop(): Promise<void>;

  /**
   * Where the engine's clock has reached, in ms since start(). Synchronous:
   * a clock read that resolved a tick later would be a reading of some other
   * moment. Returns 0 when the engine is not running.
   */
  nowMs(): Double;

  /** Level for one bus, 0..1, reaching already-sounding voices (INV-NOTES-027). */
  setBusLevel(bus: Double, level: Double): void;
  /** Schedule notes; any order, any mix of busses, one clock. */
  schedule(notes: SynthNoteInput[]): void;
  /** Silence one bus: pending notes dropped, sounding voices released. */
  clearBus(bus: Double): void;
  clearAll(): void;
}

/**
 * `get`, never `getEnforcing`: bundles ship over the air to binaries built
 * before this module existed, and playback there must fall back rather than
 * throw at import time (INV-NOTES-030). `NativeAudioEngine` in this
 * directory says the same thing.
 */
export default TurboModuleRegistry.get<Spec>('NativeSynth');
