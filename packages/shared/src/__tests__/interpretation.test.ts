/**
 * Reading back what a person made of a take — INV-NOTES-022.
 *
 * Most of these are about bad data. A reading that cannot be parsed must not
 * take the screen down with it: someone's note opening at all matters more
 * than one malformed record.
 */
import {
  activeInterpretation,
  parseInterpretations,
  type InterpretationDto
} from '../dto/interpretation';

const reading = (over: Partial<InterpretationDto> = {}): InterpretationDto => ({
  id: 'i1',
  name: 'Original',
  createdAtMs: 1000,
  isFrozen: false,
  chords: [{ atMs: 0, rootPc: 9, quality: 'min' }],
  ...over
});

describe('parseInterpretations', () => {
  it('reads a well-formed reading', () => {
    expect(parseInterpretations([reading()])).toEqual([reading()]);
  });

  it('a note saved before readings existed has none, and is not an error', () => {
    expect(parseInterpretations(null)).toEqual([]);
    expect(parseInterpretations(undefined)).toEqual([]);
    expect(parseInterpretations('')).toEqual([]);
  });

  it('discards a reading with no identity rather than inventing one', () => {
    expect(parseInterpretations([{ name: 'x' }, reading()])).toHaveLength(1);
  });

  it('drops a chord edit with an impossible root', () => {
    const parsed = parseInterpretations([
      reading({ chords: [{ atMs: 0, rootPc: 99, quality: 'min' }] })
    ]);
    expect(parsed[0].chords).toEqual([]);
  });

  it('drops a chord edit with a quality that is not one of ours', () => {
    const parsed = parseInterpretations([
      reading({ chords: [{ atMs: 0, rootPc: 0, quality: 'sus4' }] })
    ]);
    expect(parsed[0].chords).toEqual([]);
  });

  it('keeps the good edits in a reading that also has a bad one', () => {
    const parsed = parseInterpretations([
      reading({
        chords: [
          { atMs: 0, rootPc: 0, quality: 'maj' },
          { atMs: 1, rootPc: 0, quality: 'nonsense' }
        ]
      })
    ]);
    expect(parsed[0].chords).toHaveLength(1);
  });

  it('drops a bar line that is not a whole step', () => {
    const parsed = parseInterpretations([reading({ barLines: [0, 4.5, -1, 8] })]);
    expect(parsed[0].barLines).toEqual([0, 8]);
  });

  it('treats a missing isFrozen as not frozen, never the reverse', () => {
    // Guessing wrong in this direction would make a working copy immutable.
    const parsed = parseInterpretations([{ id: 'i', name: 'n', chords: [] }]);
    expect(parsed[0].isFrozen).toBe(false);
  });
});

describe('activeInterpretation', () => {
  it('is the one that is not frozen', () => {
    const frozen = reading({ id: 'f', isFrozen: true });
    expect(activeInterpretation([frozen, reading()])?.id).toBe('i1');
  });

  it('is null when a note has none', () => {
    expect(activeInterpretation([])).toBeNull();
  });

  it('is null when every reading is frozen', () => {
    expect(activeInterpretation([reading({ isFrozen: true })])).toBeNull();
  });
});
