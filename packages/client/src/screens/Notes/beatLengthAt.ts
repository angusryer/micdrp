/**
 * How long the beat is at one moment of a take (INV-NOTES-245).
 *
 * Off the beat timeline where there is one, because a take that breathes
 * has no single beat length and a note written into a phrase that was
 * stretched should be a quarter of *that* beat, not a quarter of the
 * average. Off the tempo where there are no beats to read, and a plain
 * eighth of a second where there is not even that.
 */
import { msToBeat, beatToMs, type BeatTimeline } from 'logic';

/** With nothing to read a beat from, a length that is visible and short. */
const FALLBACK_MS = 500;

export function beatLengthAt(
  timeline: BeatTimeline | null,
  bpm: number,
  atMs: number
): number {
  if (timeline != null && timeline.beats.length > 1) {
    const beat = Math.floor(msToBeat(timeline, atMs));
    const length = beatToMs(timeline, beat + 1) - beatToMs(timeline, beat);
    if (length > 0) {
      return length;
    }
  }
  return bpm > 0 ? 60000 / bpm : FALLBACK_MS;
}
