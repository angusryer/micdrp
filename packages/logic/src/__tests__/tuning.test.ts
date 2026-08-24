/**
 * Judging a take against its own centre — INV-PITCH-013, INV-PITCH-014.
 *
 * The property that matters: shifting a whole take must not change how in
 * tune it is with itself. Someone humming an idea has nothing to tune to.
 */
import {
  recentreNotes,
  relativeCents,
  tuningCentre,
  type NoteEvent
} from '../index';

/** Notes at a given set of deviations, all the same length. */
function take(cents: number[], durationMs = 500): NoteEvent[] {
  return cents.map((c, i) => ({
    midi: 60 + i,
    startMs: i * durationMs,
    endMs: (i + 1) * durationMs,
    durationMs,
    cents: c,
    clarity: 0.95, loudnessDb: null
  }));
}

describe('tuningCentre', () => {
  it('finds concert pitch when that is where the take sits', () => {
    const { offsetCents } = tuningCentre(take([0, 1, -1, 2, -2]));
    expect(Math.abs(offsetCents)).toBeLessThan(1);
  });

  it('finds a take centred sharp', () => {
    const { offsetCents, confidence } = tuningCentre(take([28, 32, 30, 29, 31]));
    expect(offsetCents).toBeCloseTo(30, 0);
    expect(confidence).toBeGreaterThan(0.9);
  });

  it('finds a take centred flat', () => {
    expect(tuningCentre(take([-20, -22, -18])).offsetCents).toBeCloseTo(-20, 0);
  });

  it('does not average a wrap-around to the middle', () => {
    // +48 and -48 are four cents apart, not ninety-six. An ordinary mean
    // lands at zero, which is the one answer that is certainly wrong.
    const { offsetCents } = tuningCentre(take([48, -48, 49, -49]));
    expect(Math.abs(offsetCents)).toBeGreaterThan(45);
  });

  it('weights a held note above a passing one', () => {
    // A note someone sat on says more about where they are centred.
    const held: NoteEvent[] = [
      ...take([40], 4000),
      ...take([0, 0], 60)
    ];
    expect(tuningCentre(held).offsetCents).toBeGreaterThan(30);
  });

  it('has no confidence when the notes agree on nothing', () => {
    // Evenly spread around the circle: there is no centre to find, and
    // saying so is better than picking one.
    const spread = take([-40, -20, 0, 20, 40, -50]);
    expect(tuningCentre(spread).confidence).toBeLessThan(0.5);
  });

  it('says nothing about an empty take rather than guessing', () => {
    expect(tuningCentre([])).toEqual({ offsetCents: 0, confidence: 0 });
  });
});

describe('relativeCents', () => {
  /** Every note restated against the centre the take was actually sung at. */
  function asSung(cents: number[]): number[] {
    const centre = tuningCentre(take(cents));
    return cents.map((c) => relativeCents(c, centre.offsetCents));
  }

  it.each([30, -25, 45, -48, 7])(
    'INV-PITCH-013: a take shifted bodily by %s cents is as in tune as it was',
    (shift) => {
      // The whole point. Sing the same phrase sharp and it is the same
      // phrase — each note sits where it sat relative to the others.
      //
      // Not that the offset comes back as the shift: the phrase has a centre
      // of its own, and the take's centre is that plus the shift. What must
      // not move is how far each note sits from it.
      const phrase = [0, 5, -5, 10];
      const before = asSung(phrase);
      const after = asSung(phrase.map((c) => c + shift));
      after.forEach((a, i) => expect(a).toBeCloseTo(before[i], 4));
    }
  );

  it('reports a take that really is centred sharp', () => {
    // The singer should still be able to find out, which is what
    // INV-PITCH-014 is for — they are just not told the phrase is wrong.
    expect(tuningCentre(take([30, 30, 30])).offsetCents).toBeCloseTo(30, 0);
  });

  it('never reports more than half a semitone', () => {
    // A note is always nearer some semitone than half of one.
    for (let cents = -50; cents <= 50; cents += 5) {
      for (let offset = -50; offset <= 50; offset += 5) {
        const r = relativeCents(cents, offset);
        expect(r).toBeGreaterThanOrEqual(-50);
        expect(r).toBeLessThanOrEqual(50);
      }
    }
  });

  it('changes nothing when the take is already at concert pitch', () => {
    expect(relativeCents(12, 0)).toBe(12);
  });
});

describe('recentreNotes', () => {
  /** A note at a given fractional pitch. */
  function at(pitch: number, i = 0): NoteEvent {
    const midi = Math.round(pitch);
    return {
      midi,
      startMs: i * 500,
      endMs: (i + 1) * 500,
      durationMs: 500,
      cents: Math.round((pitch - midi) * 100),
      clarity: 0.95, loudnessDb: null
    };
  }

  it('keeps the intervals a person actually sang', () => {
    // The whole point. A rising major third is a major third wherever the
    // singer happened to be centred.
    const sung = [60.45, 64.45, 67.45].map((p, i) => at(p, i));
    const { notes } = recentreNotes(sung);
    const intervals = notes.slice(1).map((n, i) => n.midi - notes[i].midi);
    expect(intervals).toEqual([4, 3]);
  });

  it('stops the same scale degree landing on different semitones', () => {
    // A take sitting either side of a rounding boundary used to split one
    // degree across two semitones, which is what corrupts the key estimate.
    const sung = [60.48, 60.52, 60.49, 60.51].map((p, i) => at(p, i));
    const before = new Set(sung.map((n) => n.midi));
    const after = new Set(recentreNotes(sung).notes.map((n) => n.midi));
    expect(before.size).toBe(2);
    expect(after.size).toBe(1);
  });

  it('reports where the take sat, so playback can put it back', () => {
    const { centre } = recentreNotes([60.4, 64.4, 67.4].map((p, i) => at(p, i)));
    expect(centre.offsetCents).toBeCloseTo(40, 0);
  });

  it('leaves a take already at concert pitch alone', () => {
    const sung = [60, 64, 67].map((p, i) => at(p, i));
    expect(recentreNotes(sung).notes.map((n) => n.midi)).toEqual([60, 64, 67]);
  });

  it('changes nothing when there is no centre to be found', () => {
    expect(recentreNotes([]).notes).toEqual([]);
  });

  it('never moves a note by more than a semitone', () => {
    for (const p of [60.1, 60.3, 60.49, 59.6, 59.9]) {
      const { notes } = recentreNotes([at(p), at(p + 4, 1), at(p + 7, 2)]);
      expect(Math.abs(notes[0].midi - Math.round(p))).toBeLessThanOrEqual(1);
    }
  });
});
