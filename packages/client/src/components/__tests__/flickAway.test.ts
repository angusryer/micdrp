/**
 * INV-NOTES-132 — a vertical line is thrown away by flicking across it.
 *
 * These lines already move horizontally, so the direction left free is across
 * them. Speed is what separates a decision from a wobble: a slow vertical drag
 * is somebody who has not decided, and losing a hand-placed bar line to a
 * stray finger is worse than having to flick twice.
 */
import { isFlickAway, throwAway } from '../flickAway';

const flick = (over: Partial<Parameters<typeof isFlickAway>[0]> = {}) => ({
  translationX: 0,
  translationY: 90,
  velocityY: 1400,
  ...over
});

describe('reading a flick across a line', () => {
  it('takes a fast, straight, far drag across it', () => {
    expect(isFlickAway(flick())).toBe(true);
  });

  it('takes one flicked upward as readily as downward', () => {
    expect(isFlickAway(flick({ translationY: -90, velocityY: -1400 }))).toBe(
      true
    );
  });

  it('refuses a slow one, however far it went', () => {
    // Somebody who has not decided yet.
    expect(isFlickAway(flick({ velocityY: 120 }))).toBe(false);
  });

  it('refuses a short one, however fast it was', () => {
    // A tap that slipped.
    expect(isFlickAway(flick({ translationY: 8 }))).toBe(false);
  });

  it('refuses one travelling sideways', () => {
    // That is a line being placed, which is what a sideways drag has always
    // meant.
    expect(isFlickAway(flick({ translationX: 200 }))).toBe(false);
  });
});

describe('throwing the chosen lines away', () => {
  it('removes bar lines and tapped beats alike', () => {
    const bars: number[] = [];
    const beats: number[] = [];
    const went = throwAway(
      [
        { kind: 'barLine', lineIndex: 2 },
        { kind: 'beat', index: 5 }
      ],
      (i) => bars.push(i),
      (i) => beats.push(i)
    );
    expect(went).toBe(2);
    expect(bars).toEqual([2]);
    expect(beats).toEqual([5]);
  });

  it('takes the highest index first', () => {
    // Removing one shifts every index after it, so in order would delete the
    // wrong neighbours.
    const gone: number[] = [];
    throwAway(
      [
        { kind: 'beat', index: 1 },
        { kind: 'beat', index: 4 },
        { kind: 'beat', index: 2 }
      ],
      undefined,
      (i) => gone.push(i)
    );
    expect(gone).toEqual([4, 2, 1]);
  });

  it('leaves everything that is not a vertical line alone', () => {
    const gone: number[] = [];
    expect(
      throwAway(
        [
          { kind: 'melodyNote', index: 3 },
          { kind: 'chordTone', slot: 0, tone: 1 }
        ],
        (i) => gone.push(i),
        (i) => gone.push(i)
      )
    ).toBe(0);
    expect(gone).toEqual([]);
  });
});
