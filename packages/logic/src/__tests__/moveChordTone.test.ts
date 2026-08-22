/**
 * Moving a chord's note renames the slot to what it now spells
 * (INV-NOTES-036).
 */
import { moveChordTone, voiceChord, type ChordSlot } from '../harmony';

const KEY = { tonic: 0, tonicName: 'C', mode: 'major' as const, confidence: 1 };
const FLOOR = 48;

function slot(over: Partial<ChordSlot> = {}): ChordSlot {
  return {
    bar: 1,
    startMs: 0,
    endMs: 2000,
    rootPc: 0,
    quality: 'maj',
    label: 'C',
    roman: 'I',
    confidence: 0.8,
    isEdited: false,
    ...over
  };
}

describe('moving a note renames the chord', () => {
  it('turns a major into a minor when the third comes down', () => {
    // C major's tones are [root, third, fifth]; index 1 is the third.
    const moved = moveChordTone(slot(), KEY, 1, -1, FLOOR);
    expect(moved.quality).toBe('min');
    expect(moved.rootPc).toBe(0);
    expect(moved.label).toBe('Cm');
    // The name came from the notes, so no alteration is left over.
    expect(moved.voicing).toBeUndefined();
  });

  it('gives the new chord a roman numeral in the key', () => {
    const moved = moveChordTone(slot(), KEY, 1, -1, FLOOR);
    expect(moved.roman.length).toBeGreaterThan(0);
    expect(moved.roman).not.toBe(slot().roman);
  });

  it('sounds what it says it is', () => {
    const moved = moveChordTone(slot(), KEY, 1, -1, FLOOR);
    const asNamed = voiceChord(moved.rootPc, moved.quality, { bottomMidi: FLOOR });
    const asVoiced = voiceChord(moved.rootPc, moved.quality, {
      bottomMidi: FLOOR,
      voicing: moved.voicing
    });
    expect(asVoiced).toEqual(asNamed);
  });

  it('keeps the old name and marks it altered when the notes spell nothing', () => {
    // Move the fifth down a semitone: C, E, F# is no chord with a name here.
    const moved = moveChordTone(slot(), KEY, 2, -1, FLOOR);
    expect(moved.quality).toBe('maj');
    expect(moved.label).toBe('C');
    expect(moved.voicing?.offsets?.[2]).toBe(-1);
    expect(moved.isEdited).toBe(true);
  });

  it('is reversible through the names it passes', () => {
    const minor = moveChordTone(slot(), KEY, 1, -1, FLOOR);
    const backToMajor = moveChordTone(minor, KEY, 1, 1, FLOOR);
    expect(backToMajor.quality).toBe('maj');
    expect(backToMajor.rootPc).toBe(0);
  });

  it('marks the slot edited either way', () => {
    expect(moveChordTone(slot(), KEY, 1, -1, FLOOR).isEdited).toBe(true);
    expect(moveChordTone(slot(), KEY, 2, -1, FLOOR).isEdited).toBe(true);
  });
});
