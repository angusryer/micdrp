/**
 * Which resident audio each recording occupies (INV-NOTES-133/134).
 *
 * The engine holds a fixed number of decoded takes, and every one of them is
 * the whole recording in memory — so the slots are a real resource and who
 * gets which is decided in one place rather than at each call site.
 *
 * The take always has the first. Layers take the rest in the order they were
 * sung, which means a layer keeps its slot for as long as the note is open.
 */

/**
 * How many the engine holds. Mirrors `kMaxSamples` in cpp/dsp/synth.h — the
 * engine ignores a slot past its own range, so a mismatch here would be audio
 * that loads and never sounds.
 */
export const MAX_SLOTS = 8;

/** The take's, which is never anything else's. */
export const TAKE_SLOT = 0;

/** How many layers can sound at once, which is what is left. */
export const MAX_LAYER_VOICES = MAX_SLOTS - 1;

/** Which slot the nth layer sounds from, or null when there is none left. */
export function layerSlot(index: number): number | null {
  const slot = index + 1;
  return slot > 0 && slot < MAX_SLOTS ? slot : null;
}
