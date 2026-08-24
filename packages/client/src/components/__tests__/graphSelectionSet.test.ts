/**
 * INV-NOTES-093 — several things chosen, all of one kind.
 */
import { isChosen, toggleChosen } from '../graphSelection';
import type { Selection } from '../graphSelection';

const note = (index: number): Selection => ({ kind: 'melodyNote', index });
const bar = (lineIndex: number): Selection => ({ kind: 'barLine', lineIndex });

describe('choosing several things', () => {
  it('adds one that was not chosen', () => {
    expect(toggleChosen([], note(0))).toEqual([note(0)]);
    expect(toggleChosen([note(0)], note(1))).toEqual([note(0), note(1)]);
  });

  it('takes out one that was', () => {
    expect(toggleChosen([note(0), note(1)], note(0))).toEqual([note(1)]);
  });

  it('keeps the order things were chosen in, which the sheet lists', () => {
    const chosen = toggleChosen(toggleChosen([], note(2)), note(0));
    expect(chosen).toEqual([note(2), note(0)]);
  });

  it('replaces the set when the kind changes', () => {
    // A downbeat and a sung note take different verbs, so a set holding
    // both could offer neither.
    expect(toggleChosen([bar(0), bar(1)], note(3))).toEqual([note(3)]);
    expect(toggleChosen([note(3)], bar(0))).toEqual([bar(0)]);
  });

  it('says what is already chosen', () => {
    expect(isChosen([note(0)], note(0))).toBe(true);
    expect(isChosen([note(0)], note(1))).toBe(false);
    expect(isChosen([], note(0))).toBe(false);
  });
});
