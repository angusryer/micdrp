/**
 * Recorded audio, as the engine holds it (INV-TPORT-024).
 *
 * A take is decoded once into a numbered slot and then scheduled like any
 * other voice — same call, same clock, same bus levels — so a backdrop and
 * the take it was read from are in time by construction rather than by
 * correction (INV-NOTES-133).
 *
 * The only module that schedules recorded audio. It was three, two of them
 * UI hooks holding their own idea of what was loaded where.
 */
import NativeSynth from '../specs/NativeSynth';

/** A passage of a loaded take to sound, on a bus, between two moments. */
export interface SamplePlacement {
  bus: number;
  slot: number;
  /** How far into the take to begin. Where a scrubbed head resumes. */
  fromMs: number;
  /** Absolute on the engine clock, as `audioNowMs()` reads it. */
  startMs: number;
  endMs: number;
}

/** Bring the engine up. Idempotent while running. */
export async function startEngine(): Promise<void> {
  await NativeSynth?.start();
}

/**
 * Decode a take into a slot, resolving with its length in ms.
 *
 * Throws where the decode did not happen. The native store returns -1 on
 * failure, and consumed as a length that scheduled a clip ending before it
 * began and a run whose end had already passed — a press that spun, showed
 * the play glyph again, and made no sound (INV-TPORT-019).
 */
export async function loadSample(slot: number, path: string): Promise<number> {
  if (NativeSynth == null) {
    throw new Error('the native audio engine is not in this build');
  }
  const lengthMs = await NativeSynth.loadSample(slot, path);
  if (!(lengthMs > 0)) {
    throw new Error('this take could not be decoded');
  }
  return lengthMs;
}

/** Give a slot back. The audio is freed once nothing can still read it. */
export function unloadSample(slot: number): void {
  NativeSynth?.unloadSample(slot);
}

/** Sound loaded audio; same clock and same busses as a synthesized voice. */
export function scheduleSamples(placements: readonly SamplePlacement[]): void {
  if (placements.length === 0) {
    return;
  }
  NativeSynth?.scheduleSamples(placements as SamplePlacement[]);
}
