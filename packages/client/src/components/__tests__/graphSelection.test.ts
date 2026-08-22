/**
 * What a touch on the graph is pointing at (INT-NOTES-015).
 */
import {
  isSame,
  selectionAt,
  touchesSelection,
  type BarHandlePoint
} from '../graphSelection';
import type { ChordToneRect } from '../chordLayout';

function tone(slot: number, index: number, x: number, y: number): ChordToneRect {
  return {
    slot,
    tone: index,
    x,
    y,
    width: 80,
    height: 8,
    midi: 60,
    muted: false,
    moved: false
  };
}

const TONES = [tone(0, 0, 0, 100), tone(0, 1, 0, 80), tone(1, 0, 100, 100)];
const BARS: BarHandlePoint[] = [
  { lineIndex: 0, x: 10 },
  { lineIndex: 1, x: 200 }
];

describe('what a touch points at', () => {
  it('finds a chord note under the finger', () => {
    expect(selectionAt(40, 104, TONES, BARS)).toEqual({
      kind: 'chordTone',
      slot: 0,
      tone: 0
    });
  });

  it('finds a bar line when nothing else is near', () => {
    expect(selectionAt(205, 20, TONES, BARS)).toEqual({
      kind: 'barLine',
      lineIndex: 1
    });
  });

  it('gives a chord note the tie, being the smaller target', () => {
    // x=10 is on bar line 0 and inside slot 0's notes.
    expect(selectionAt(10, 104, TONES, BARS)?.kind).toBe('chordTone');
  });

  it('takes the nearer of two notes', () => {
    // Between the two notes of slot 0, closer to the upper one.
    expect(selectionAt(40, 86, TONES, BARS)).toEqual({
      kind: 'chordTone',
      slot: 0,
      tone: 1
    });
  });

  it('finds nothing in empty space', () => {
    expect(selectionAt(400, 400, TONES, BARS)).toBeNull();
    // Beyond a note's own slot, even at its height.
    expect(selectionAt(300, 104, TONES, [])).toBeNull();
  });
});

describe('comparing what is chosen', () => {
  it('knows the same thing from a different one', () => {
    expect(isSame({ kind: 'barLine', lineIndex: 2 }, { kind: 'barLine', lineIndex: 2 })).toBe(true);
    expect(isSame({ kind: 'barLine', lineIndex: 2 }, { kind: 'barLine', lineIndex: 3 })).toBe(false);
    expect(
      isSame({ kind: 'chordTone', slot: 1, tone: 0 }, { kind: 'chordTone', slot: 1, tone: 0 })
    ).toBe(true);
    expect(
      isSame({ kind: 'chordTone', slot: 1, tone: 0 }, { kind: 'chordTone', slot: 1, tone: 2 })
    ).toBe(false);
  });

  it('never confuses a bar line with a chord note', () => {
    expect(isSame({ kind: 'barLine', lineIndex: 0 }, { kind: 'chordTone', slot: 0, tone: 0 })).toBe(false);
  });

  it('treats nothing as nothing', () => {
    expect(isSame(null, null)).toBe(true);
    expect(isSame(null, { kind: 'barLine', lineIndex: 0 })).toBe(false);
  });
});

describe('whether a drag may take hold', () => {
  it('is true only on the thing already chosen', () => {
    const chosen = { kind: 'chordTone', slot: 0, tone: 0 } as const;
    expect(touchesSelection(chosen, 40, 104, TONES, BARS)).toBe(true);
    // Same graph, different object.
    expect(touchesSelection(chosen, 205, 20, TONES, BARS)).toBe(false);
    // Empty space.
    expect(touchesSelection(chosen, 400, 400, TONES, BARS)).toBe(false);
  });

  it('is false when nothing is chosen, so the take scrolls', () => {
    expect(touchesSelection(null, 40, 104, TONES, BARS)).toBe(false);
  });
});
