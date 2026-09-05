/**
 * Every field the engine measures survives the bridge (INV-NOTES-141,
 * INV-PITCH-020, INV-PITCH-025).
 *
 * The normaliser listed the five fields it wanted. The engine has been
 * sending eight — a level for every frame, and the four spectral readings
 * percussion is found from — and the other three were dropped on the way
 * in. Nothing failed: notes were simply built with no loudness, so the
 * match that starts the tracks where the take sits declined to move
 * anything, and mouth drums were looked for in readings that were not
 * there.
 */
import { toPitchSample } from '../AudioEngine';

const frame = {
  timestampMs: 120,
  frequencyHz: 440,
  clarity: 0.93,
  levelDb: -22,
  centroidHz: 1800,
  flatness: 0.12,
  rolloffHz: 3400,
  fluxDb: 4.5,
  midi: 69,
  cents: 3
};

describe('a frame crossing the bridge', () => {
  it('keeps the level the engine measured', () => {
    expect(toPitchSample(frame).levelDb).toBe(-22);
  });

  it('keeps what the spectrum said, which is what drums are read from', () => {
    const s = toPitchSample(frame);
    expect(s.centroidHz).toBe(1800);
    expect(s.flatness).toBe(0.12);
    expect(s.rolloffHz).toBe(3400);
    expect(s.fluxDb).toBe(4.5);
  });

  it('keeps the pitch it always kept', () => {
    const s = toPitchSample(frame);
    expect(s).toMatchObject({ timestampMs: 120, frequencyHz: 440, midi: 69, cents: 3 });
  });

  it('says nothing measured it rather than saying it read zero', () => {
    // A binary older than the bundle reading it did not measure these, and
    // a frame with no reading must never be taken for one that read zero.
    const older = toPitchSample({ timestampMs: 0, frequencyHz: 0, clarity: 0, midi: null, cents: null });
    expect(older.levelDb).toBeUndefined();
    expect(older.flatness).toBeUndefined();
  });

  it('treats an unvoiced frame as unvoiced', () => {
    const s = toPitchSample({ ...frame, midi: null, cents: null });
    expect(s.midi).toBeNull();
    expect(s.cents).toBeNull();
    // Still measured, though: a frame with no pitch still had a level.
    expect(s.levelDb).toBe(-22);
  });
});
