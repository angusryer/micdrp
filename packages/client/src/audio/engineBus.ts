/**
 * The mixer, as the engine understands it (INV-TPORT-024).
 *
 * A bus is a track: a level, a timbre, and a way to fall silent. These
 * four calls are the whole of it, and this is the only module that makes
 * them — screens ask for a track to be quieter, not for a TurboModule
 * method to be invoked.
 *
 * `NativeSynth` was reached directly from six modules, three of them UI
 * hooks in `screens/Notes/`. Every one read as reasonable on its own, and
 * together they meant "what silenced the take?" had six possible answers
 * and no single place to look (INV-TPORT-001).
 *
 * Levels are stepped, not ramped. A move while a bus is sounding is
 * therefore a discontinuity — audible on a large jump. Ramping belongs in
 * the engine, per block, and is noted here because this is where the call
 * that needs it lives.
 */
import NativeSynth from '../specs/NativeSynth';

/**
 * The most a bus may be turned up, as a multiple of the audio on it.
 *
 * Above one on purpose: a take is a recording, so at a level of one it is
 * already as loud as it was sung and a quiet one could never be brought up
 * to sit with the tracks read from it (INV-NOTES-141). Mirrors
 * `kMaxBusLevel` in cpp/dsp/synth.h, which holds anything past it anyway —
 * stated here so a caller is not silently clamped on the way down.
 */
export const MAX_BUS_LEVEL = 4;

/** Whether there is an engine to talk to at all. */
export const hasEngine = (): boolean => NativeSynth != null;

/**
 * How loud a bus sits, from silence up to `MAX_BUS_LEVEL`.
 *
 * Reaches voices already sounding, which is what makes a level a mix
 * decision rather than a property of the next note (INV-NOTES-027). Past
 * one is make-up gain on a recording, not a synthesized voice — see the
 * constant above.
 */
export function setBusLevel(bus: number, level: number): void {
  NativeSynth?.setBusLevel(bus, Math.max(0, Math.min(MAX_BUS_LEVEL, level)));
}

/**
 * What a bus sounds like (INV-NOTES-144).
 *
 * Applied to voices admitted after it. A voice already speaking keeps its
 * timbre — changing an instrument under a sounding note is a click, and
 * whoever changed it is listening for the next thing.
 */
export function setBusWave(bus: number, wave: number): void {
  NativeSynth?.setBusWave(bus, wave);
}

/** Silence one bus: pending notes dropped, sounding voices released. */
export function clearBus(bus: number): void {
  NativeSynth?.clearBus(bus);
}

/**
 * Silence everything.
 *
 * Not one bus. Silence must never be contingent on bookkeeping being
 * right about which bus a voice went to (INV-TPORT-005).
 */
export function clearAll(): void {
  NativeSynth?.clearAll();
}
