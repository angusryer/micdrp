/**
 * ACC-NOTES-222 / INV-NOTES-209 — taps mean what the singer says they mean.
 *
 * Tapping every beat to establish a tempo is most of a performance spent on
 * bookkeeping — and mid-song you do not yet know whether you will tap every
 * beat or only the backbeat. So the tap means nothing and the meaning comes
 * afterwards. A take carries no pattern until somebody sets one, which is
 * what keeps INV-NOTES-161 true.
 *
 * The point these pin down is that the taps alone say nothing about rate:
 * the same four evenly spaced taps are 120 read as every beat and 240 read
 * as the backbeat, and only the singer knows which. Nothing here guesses.
 */
import {
  SUGGESTED_TAP_PATTERN,
  TAP_PATTERNS,
  beatPositions,
  isUsablePattern,
  samePattern,
  tempoFromPattern
} from '../tapPattern';
import type { TappedBeat } from '../tappedBeats';

/** Taps every `everyMs`, as a finger actually leaves them. */
const tapsEvery = (everyMs: number, count: number, fromMs = 1000): TappedBeat[] =>
  Array.from({ length: count }, (_, i) => ({
    atMs: fromMs + i * everyMs,
    tappedAtMs: fromMs + i * everyMs,
    isDownbeat: false
  }));

const EVERY = { beats: [1, 2, 3, 4], beatsPerBar: 4 };
const BACKBEAT = { beats: [2, 4], beatsPerBar: 4 };

describe('where the picker opens', () => {
  it('is the backbeat, which is what a hand does on its own', () => {
    // Where it opens, not what the take assumes: until somebody sets one,
    // a take carries no pattern at all (INV-NOTES-161).
    expect(samePattern(SUGGESTED_TAP_PATTERN, BACKBEAT)).toBe(true);
  });

  it('offers every pattern it offers as a usable one', () => {
    for (const pattern of TAP_PATTERNS) {
      expect(isUsablePattern(pattern)).toBe(true);
    }
  });
});

describe('which beat each tap was meant for', () => {
  it('cycles through the pattern, bar after bar', () => {
    expect(beatPositions(5, BACKBEAT)).toEqual([2, 4, 6, 8, 10]);
    expect(beatPositions(5, EVERY)).toEqual([1, 2, 3, 4, 5]);
  });

  it('counts an uneven pattern by where its beats fall', () => {
    // Two taps close together and then a wait, twice over.
    expect(beatPositions(4, { beats: [1, 2], beatsPerBar: 4 })).toEqual([
      1, 2, 5, 6
    ]);
  });
});

describe('ACC-NOTES-222: the same taps under different patterns', () => {
  const taps = tapsEvery(500, 8);

  it('reads the backbeat at twice the rate of every beat', () => {
    const back = tempoFromPattern(taps, BACKBEAT);
    const every = tempoFromPattern(taps, EVERY);
    expect(back?.bpm).toBeCloseTo(240, 6);
    expect(every?.bpm).toBeCloseTo(120, 6);
  });

  it('puts the downbeat where the pattern says, not on a tap', () => {
    const back = tempoFromPattern(taps, BACKBEAT);
    // Tapped on two, so beat one is one beat of 250 ms earlier than 1000.
    expect(back?.offsetMs).toBeCloseTo(750, 6);
    const every = tempoFromPattern(taps, EVERY);
    // Tapped on one, so the first tap is the downbeat.
    expect(every?.offsetMs).toBeCloseTo(1000, 6);
  });

  it('reads one tap a bar as a bar', () => {
    const once = tempoFromPattern(taps, { beats: [1], beatsPerBar: 4 });
    // Four beats between taps, so a beat is a quarter of 500 ms.
    expect(once?.bpm).toBeCloseTo(480, 6);
    expect(once?.beatsPerBar).toBe(4);
  });
});

describe('how well the taps sit on what was claimed', () => {
  it('is complete for taps laid exactly on the pattern', () => {
    expect(tempoFromPattern(tapsEvery(500, 8), BACKBEAT)?.confidence).toBeCloseTo(
      1,
      6
    );
  });

  it('falls when the taps do not agree with the pattern', () => {
    // Tapped unevenly: no single rate puts all of these on the backbeat.
    const ragged: TappedBeat[] = [0, 500, 1300, 1500, 2400].map((atMs) => ({
      atMs,
      tappedAtMs: atMs,
      isDownbeat: false
    }));
    const fit = tempoFromPattern(ragged, BACKBEAT);
    expect(fit).not.toBeNull();
    expect(fit?.confidence).toBeLessThan(0.5);
  });

  it('is not thrown by one late tap', () => {
    const taps = tapsEvery(500, 8);
    taps[3] = { ...taps[3], atMs: taps[3].atMs + 40 };
    const fit = tempoFromPattern(taps, BACKBEAT);
    // Least squares, so one finger arriving late moves the answer a little.
    expect(fit?.bpm).toBeGreaterThan(230);
    expect(fit?.bpm).toBeLessThan(250);
  });
});

describe('when there is nothing to say', () => {
  it('says nothing rather than guessing', () => {
    expect(tempoFromPattern([], BACKBEAT)).toBeNull();
    expect(tempoFromPattern(tapsEvery(500, 1), BACKBEAT)).toBeNull();
  });

  it('refuses a pattern a bar cannot hold', () => {
    const taps = tapsEvery(500, 8);
    expect(tempoFromPattern(taps, { beats: [5], beatsPerBar: 4 })).toBeNull();
    expect(tempoFromPattern(taps, { beats: [], beatsPerBar: 4 })).toBeNull();
    expect(tempoFromPattern(taps, { beats: [3, 1], beatsPerBar: 4 })).toBeNull();
  });

  it('says nothing for taps that never moved', () => {
    const stuck: TappedBeat[] = [1000, 1000, 1000].map((atMs) => ({
      atMs,
      tappedAtMs: atMs,
      isDownbeat: false
    }));
    // Positions differ but times do not: a rate of zero is not a tempo.
    expect(tempoFromPattern(stuck, BACKBEAT)).toBeNull();
  });
});
