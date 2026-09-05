/**
 * Codegen spec for the native synth — one voice pool, one clock, for
 * everything the app sounds (INV-NOTES-028/029).
 *
 * The C++ core lives in cpp/dsp/synth.h; the iOS module (SynthModule.mm)
 * feeds it to an AVAudioSourceNode and posts these calls to the audio thread
 * through cpp/dsp/synth_mailbox.h. This file is the contract: codegen derives
 * the ObjC protocol from it, so drift is a compile error.
 *
 * It sounds recorded audio too. A take is decoded once into a slot and then
 * scheduled like anything else — same call, same clock, same bus levels — so
 * a backdrop and the voice it was read from are in time by construction
 * rather than by correction (INV-NOTES-133).
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

/** A passage of loaded audio to sound, on a bus, at a moment. */
export type SynthSampleInput = {
  bus: Double;
  /** Which loaded take, as returned by the load that put it there. */
  slot: Double;
  /** How far into that take to begin. Where a scrubbed playhead resumes. */
  fromMs: Double;
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
  /**
   * What a bus sounds like: 0 sine, 1 triangle, 2 square, 3 saw, 4 noise
   * (INV-NOTES-144).
   *
   * Applied to voices admitted after it. A voice already sounding keeps its
   * timbre — changing an instrument under a note that is already speaking is
   * a click, and the person changing it is listening to the next thing.
   */
  setBusWave(bus: Double, wave: Double): void;
  /** Schedule notes; any order, any mix of busses, one clock. */
  schedule(notes: SynthNoteInput[]): void;
  /**
   * Decode a recorded take into a slot, ready to be scheduled. Resolves with
   * its length in ms. Slots are 0..7; loading over one in use is allowed and
   * leaves anything currently sounding alone.
   *
   * Once per take, not once per press: this reads and converts the whole
   * file, which is the cost that used to be paid on every play.
   */
  loadSample(slot: Double, path: string): Promise<Double>;
  /** Give a slot back. The audio is freed once nothing can still read it. */
  unloadSample(slot: Double): void;
  /** Sound loaded audio; same clock and same busses as `schedule`. */
  scheduleSamples(notes: SynthSampleInput[]): void;

  /** Silence one bus: pending notes dropped, sounding voices released. */
  clearBus(bus: Double): void;
  clearAll(): void;
  /**
   * Begin a run: time passing from `fromMs` of the material, at
   * `startMs` on the engine clock, until `endMs` (INV-TPORT-013).
   *
   * Separate from scheduling the audio, because a run is time passing
   * and a voice is a sound. Muting a track must not stop the clock.
   */
  startTransport(fromMs: Double, startMs: Double, endMs: Double): void;
  stopTransport(): void;
  /**
   * What the engine is doing, read as one consistent snapshot
   * (INV-TPORT-012).
   *
   * Absent on a binary older than this bundle, which is why everything
   * reading it asks first (INV-TPORT-014).
   */
  transportReport(): { positionMs: Double; running: boolean; generation: Double; ended: Double };
}

/**
 * `get`, never `getEnforcing`: bundles ship over the air to binaries built
 * before this module existed, and playback there must fall back rather than
 * throw at import time (INV-NOTES-030). `NativeAudioEngine` in this
 * directory says the same thing.
 */
export default TurboModuleRegistry.get<Spec>('NativeSynth');
