/**
 * Where a sung line lands under a hand — INV-NOTES-146 and INV-NOTES-147.
 */
import {
  fingerMelody,
  neckOctaveShift,
  placesFor,
  STANDARD_NECK,
  STANDARD_TUNING
} from '../fretboard';

/** Middle C. On a standard neck: 5th string 3rd fret, or 6th string 8th. */
const C4 = 60;

describe('placesFor', () => {
  it('offers every string that can take the pitch, lowest first', () => {
    const places = placesFor(C4, STANDARD_NECK);
    expect(places).toEqual([
      { string: 0, fret: 20 },
      { string: 1, fret: 15 },
      { string: 2, fret: 10 },
      { string: 3, fret: 5 },
      { string: 4, fret: 1 }
    ].filter((p) => p.fret <= STANDARD_NECK.frets));
  });

  it('offers the open string as fret 0', () => {
    expect(placesFor(STANDARD_TUNING[0], STANDARD_NECK)).toContainEqual({
      string: 0,
      fret: 0
    });
  });

  it('offers nothing for a pitch off the neck', () => {
    expect(placesFor(STANDARD_TUNING[0] - 1, STANDARD_NECK)).toEqual([]);
    expect(placesFor(100, STANDARD_NECK)).toEqual([]);
  });
});

describe('neckOctaveShift — the melody moves as a whole (INV-NOTES-146)', () => {
  it('leaves a melody that already fits alone', () => {
    expect(neckOctaveShift([55, 57, 59, 60])).toBe(0);
  });

  it('brings a melody sung above the neck down by whole octaves', () => {
    // A line around C6, above the twelfth fret of the top string; one octave
    // down is enough, and the smaller move is the one taken.
    expect(neckOctaveShift([84, 86, 88])).toBe(-1);
  });

  it('lifts a melody sung below the neck', () => {
    expect(neckOctaveShift([28, 30, 32])).toBe(1);
  });

  it('takes the shift that reaches the most notes, not all or nothing', () => {
    // Nine notes on the neck an octave down, one stray very low note that no
    // shift can rescue without losing the other nine.
    const melody = [84, 85, 86, 87, 88, 89, 90, 91, 92, 20];
    expect(neckOctaveShift(melody)).toBe(-2);
  });

  it('has nothing to move for an empty melody', () => {
    expect(neckOctaveShift([])).toBe(0);
  });
});

describe('fingerMelody — nearest place wins (INV-NOTES-147)', () => {
  it('opens the hand at the lowest fret that can take the first note', () => {
    // C4 is fret 1 of the B string and fret 5 of the G string.
    expect(fingerMelody([C4])[0]).toEqual({ string: 4, fret: 1 });
  });

  it('keeps a phrase in one position rather than at the lowest fret', () => {
    // G4 A4 B4 C5 sits under one hand around the 5th fret of the top string;
    // taking each note's lowest fret alone would scatter it across strings.
    const placed = fingerMelody([67, 69, 71, 72]);
    const frets = placed.map((place) => place?.fret);
    expect(Math.max(...(frets as number[])) - Math.min(...(frets as number[])))
      .toBeLessThanOrEqual(5);
  });

  it('prefers a string of travel to a fret of travel', () => {
    // From the open low E, B3 (59) is fret 19 on that string — off the neck —
    // and open on the B string. The cheap move is across, not along.
    const placed = fingerMelody([40, 59]);
    expect(placed[1]).toEqual({ string: 4, fret: 0 });
  });

  it('leaves a note with no place unplaced', () => {
    const placed = fingerMelody([C4, 20, C4 + 2]);
    expect(placed[1]).toBeNull();
    expect(placed[0]).not.toBeNull();
    expect(placed[2]).not.toBeNull();
  });

  it('does not let an unplaced note move the hand', () => {
    // The stray note between them must not reset the position: the third
    // note is measured from the first.
    const withStray = fingerMelody([67, 20, 69]);
    const without = fingerMelody([67, 69]);
    expect(withStray[2]).toEqual(without[1]);
  });
});
