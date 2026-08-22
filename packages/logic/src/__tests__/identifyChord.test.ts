/**
 * Reading a chord back from the notes it actually has (INV-NOTES-036).
 */
import { identifyChord } from '../identifyChord';

describe('what a set of notes spells', () => {
  it('names a plain triad', () => {
    // C E G
    expect(identifyChord([60, 64, 67])).toEqual({ rootPc: 0, quality: 'maj' });
    // C Eb G
    expect(identifyChord([60, 63, 67])).toEqual({ rootPc: 0, quality: 'min' });
  });

  it('names a seventh', () => {
    // C E G Bb
    expect(identifyChord([60, 64, 67, 70])).toEqual({ rootPc: 0, quality: 'dom7' });
  });

  it('does not care which octave a note sits in', () => {
    // The same chord voiced wide reads the same.
    expect(identifyChord([60, 76, 91])).toEqual({ rootPc: 0, quality: 'maj' });
  });

  it('does not care about order or repeats', () => {
    expect(identifyChord([67, 64, 60, 72])).toEqual({ rootPc: 0, quality: 'maj' });
  });

  it('renames a major to a minor when the third moves down', () => {
    const before = identifyChord([60, 64, 67]);
    const after = identifyChord([60, 63, 67]);
    expect(before?.quality).toBe('maj');
    expect(after?.quality).toBe('min');
    expect(after?.rootPc).toBe(before?.rootPc);
  });

  it('says nothing when the notes spell nothing', () => {
    // C, D flat, D — a cluster, not a chord anyone has a name for here.
    expect(identifyChord([60, 61, 62])).toBeNull();
  });

  it('refuses to name an interval', () => {
    // Two notes belong to several chords equally, so naming one is a guess.
    expect(identifyChord([60, 64])).toBeNull();
    expect(identifyChord([60])).toBeNull();
    expect(identifyChord([])).toBeNull();
  });

  it('lets the bass break a tie', () => {
    // A diminished seventh is the same four notes from any of its roots.
    const notes = [60, 63, 66, 69];
    expect(identifyChord(notes, 3)?.rootPc).toBe(3);
    expect(identifyChord(notes, 9)?.rootPc).toBe(9);
  });

  it('ignores a bass that is not one of the roots on offer', () => {
    const named = identifyChord([60, 64, 67], 5);
    expect(named).toEqual({ rootPc: 0, quality: 'maj' });
  });
});
