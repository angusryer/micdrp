/**
 * INV-NOTES-261 — reading the same frames with the same thresholds gives
 * the same reading, bit for bit.
 *
 * The reader is a pure function, so this is trivially true of the function
 * — and exactly the kind of trivially-true thing that stops being true the
 * day somebody reads a clock, a random seed or a module-level cache inside
 * it. Pinned here so that day is a failing test rather than a take that
 * came back different for no reason anybody could name.
 */
import { readTake } from '../readTake';
import { recentreNotes } from '../tuning';
import type { PitchFrame } from '../pitch';

/** A sung phrase as frames: four notes, a breath, a fifth. */
function phrase(): PitchFrame[] {
  const out: PitchFrame[] = [];
  const hz = [261.63, 293.66, 329.63, 349.23, 0, 392.0];
  hz.forEach((f, note) => {
    for (let i = 0; i < 40; i += 1) {
      out.push({
        timeMs: (note * 40 + i) * 10,
        frequencyHz: f > 0 ? f * (1 + Math.sin(i / 3) * 0.004) : 0,
        clarity: f > 0 ? 0.92 : 0.1,
        loudnessDb: f > 0 ? -18 : -70
      } as PitchFrame);
    }
  });
  return out;
}

describe('the reader', () => {
  it('gives the same notes and hits for the same frames and thresholds', () => {
    const a = readTake(phrase(), 'mixed', { minArticulationMs: 50 });
    const b = readTake(phrase(), 'mixed', { minArticulationMs: 50 });
    expect(b).toEqual(a);
  });

  it('gives the same recentred notes too', () => {
    const a = recentreNotes(readTake(phrase(), 'mixed').notes);
    const b = recentreNotes(readTake(phrase(), 'mixed').notes);
    expect(b).toEqual(a);
  });

  it('does not mutate the frames it was given', () => {
    const frames = phrase();
    const snapshot = JSON.stringify(frames);
    readTake(frames, 'mixed');
    expect(JSON.stringify(frames)).toBe(snapshot);
  });
});
