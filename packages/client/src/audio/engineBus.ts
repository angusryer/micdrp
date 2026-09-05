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

/** Whether there is an engine to talk to at all. */
export const hasEngine = (): boolean => NativeSynth != null;

/**
 * How loud a bus sits, 0..1.
 *
 * Reaches voices already sounding, which is what makes a level a mix
 * decision rather than a property of the next note (INV-NOTES-027).
 */
export function setBusLevel(bus: number, level: number): void {
  NativeSynth?.setBusLevel(bus, Math.max(0, Math.min(1, level)));
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
