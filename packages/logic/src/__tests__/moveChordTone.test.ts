/**
 * The notes are stable things you push around; the name follows them
 * (INV-NOTES-036, INV-NOTES-052).
 */
import {
  collectEdits,
  moveChordTone,
  relabelFromNotes,
  replayEdits,
  resetChordTone,
  toggleMute,
  voiceChord,
  type ChordSlot
} from '../index';
import { identifyChord } from '../identifyChord';

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

/** What a slot is actually sounding. */
function sounding(s: ChordSlot): number[] {
  return voiceChord(s.rootPc, s.quality, { bottomMidi: FLOOR, voicing: s.voicing });
}

describe('the name follows the notes', () => {
  it('reads C major with a flattened third as C minor', () => {
    const moved = moveChordTone(slot(), KEY, 1, -1, FLOOR);
    expect(moved.label).toBe('Cm');
    expect(identifyChord(sounding(moved))?.quality).toBe('min');
  });

  it('gives it a roman numeral to match', () => {
    const moved = moveChordTone(slot(), KEY, 1, -1, FLOOR);
    expect(moved.roman).not.toBe(slot().roman);
    expect(moved.roman.length).toBeGreaterThan(0);
  });

  it('keeps the last name when the notes spell nothing known', () => {
    // C, E, F# is no chord this codebase names.
    const moved = moveChordTone(slot(), KEY, 2, -1, FLOOR);
    expect(moved.label).toBe('C');
    expect(moved.isEdited).toBe(true);
  });
});

describe('the notes stay where they were put', () => {
  it('leaves root and quality alone, so the notes are not renumbered', () => {
    // Renumbering mid-drag would move a colour from one note to another.
    const moved = moveChordTone(slot(), KEY, 1, -1, FLOOR);
    expect(moved.rootPc).toBe(0);
    expect(moved.quality).toBe('maj');
    expect(moved.voicing?.offsets?.[1]).toBe(-1);
  });

  it('does not shift the chord by an octave when the name changes', () => {
    const before = sounding(slot());
    const after = sounding(moveChordTone(slot(), KEY, 1, -1, FLOOR));
    // Only the note that was dragged moved, and only by what was asked.
    expect(after).toHaveLength(before.length);
    expect(Math.min(...after)).toBe(Math.min(...before));
  });

  it('lets a note be carried past its neighbours into an inversion', () => {
    // Take the root up a seventh: it clears the third and the fifth, and the
    // chord is the same chord with something else at the bottom.
    const inverted = moveChordTone(slot(), KEY, 0, 11, FLOOR);
    const notes = sounding(inverted);
    expect(identifyChord(notes)).not.toBeNull();
    // The lowest note is no longer the one that started lowest.
    expect(Math.min(...notes)).toBeGreaterThan(Math.min(...sounding(slot())));
  });

  it('is reversible: back the way it came is where it started', () => {
    const there = moveChordTone(slot(), KEY, 1, -1, FLOOR);
    const back = moveChordTone(there, KEY, 1, 1, FLOOR);
    expect(sounding(back)).toEqual(sounding(slot()));
    expect(back.label).toBe('C');
  });
});

describe('the name survives being stored and replayed', () => {
  it('does not revert to the spine when an edit round-trips', () => {
    // The bug this pins: replayEdits names a slot from its root and quality,
    // so a moved note kept sounding while the name snapped back to C.
    const moved = moveChordTone(slot(), KEY, 1, -1, FLOOR);
    expect(moved.label).toBe('Cm');

    const edits = collectEdits([moved]);
    const replayed = replayEdits([slot()], edits, KEY).map((s) =>
      relabelFromNotes(s, KEY, FLOOR)
    );
    expect(replayed[0].label).toBe('Cm');
    expect(sounding(replayed[0])).toEqual(sounding(moved));
  });
});

describe('putting one note back', () => {
  it('restores the chord it came from', () => {
    const moved = moveChordTone(slot(), KEY, 1, -1, FLOOR);
    const back = resetChordTone(moved, KEY, 1, FLOOR);
    expect(back.label).toBe('C');
    expect(sounding(back)).toEqual(sounding(slot()));
  });

  it('leaves the other notes where they were put', () => {
    // Move two, reset one.
    const one = moveChordTone(slot(), KEY, 1, -1, FLOOR);
    const two = moveChordTone(one, KEY, 2, -1, FLOOR);
    const back = resetChordTone(two, KEY, 1, FLOOR);
    expect(back.voicing?.offsets?.[1]).toBe(0);
    expect(back.voicing?.offsets?.[2]).toBe(-1);
  });

  it('brings back a silenced note too', () => {
    const silenced = {
      ...slot(),
      voicing: toggleMute(undefined, 'maj', 2)
    };
    const back = resetChordTone(silenced, KEY, 2, FLOOR);
    expect(sounding(back)).toEqual(sounding(slot()));
  });
});
