/**
 * INV-NOTES-057 — what is chosen is lit from behind.
 *
 * The halo has to land on exactly the chosen object and nothing else, and a
 * chord note has to keep its role colour while it is chosen (INV-NOTES-052):
 * the colour there is not decoration, it says which part of the chord the
 * note is playing, and lighting it in a selection colour would erase that.
 */
import { litShape } from '../SelectionGlow';
import { chordRoleColour } from '../chordRoles';
import type { ChordToneRect } from '../chordLayout';
import type { NoteRect } from '../melodyLayout';
import type { BarHandlePoint } from '../graphSelection';

const ACCENT = '#00A3FF';

const TONES = [
  { slot: 0, tone: 0, x: 10, y: 80, width: 40, height: 4, midi: 60, muted: false },
  { slot: 0, tone: 1, x: 10, y: 60, width: 40, height: 4, midi: 64, muted: false }
] as ChordToneRect[];

const BARS: BarHandlePoint[] = [
  { lineIndex: 0, x: 0 },
  { lineIndex: 1, x: 120 }
];

const NOTES = [
  { x: 5, y: 20, width: 30, height: 6, cy: 23 },
  { x: 40, y: 10, width: 30, height: 6, cy: 13 }
] as NoteRect[];

const lit = (selection: Parameters<typeof litShape>[0]) =>
  litShape(selection, TONES, BARS, NOTES, ACCENT);

describe('lighting the chosen thing', () => {
  it('lights nothing when nothing is chosen', () => {
    expect(lit(null)).toBeNull();
  });

  it('lights the chosen bar line, and only where it is', () => {
    expect(lit({ kind: 'barLine', lineIndex: 1 })).toEqual({
      kind: 'line',
      x: 120,
      colour: ACCENT
    });
  });

  it('lights the chosen sung note, around it rather than over it', () => {
    const shape = lit({ kind: 'melodyNote', index: 1 });
    expect(shape).not.toBeNull();
    if (!shape || shape.kind !== 'rect') {
      throw new Error('expected a rect');
    }
    // Outside the note on every side, so the note itself stays untouched.
    expect(shape.x).toBeLessThan(NOTES[1].x);
    expect(shape.y).toBeLessThan(NOTES[1].y);
    expect(shape.width).toBeGreaterThan(NOTES[1].width);
    expect(shape.height).toBeGreaterThan(NOTES[1].height);
  });

  it('lights a chord note in the colour of the part it plays', () => {
    const shape = lit({ kind: 'chordTone', slot: 0, tone: 1 });
    expect(shape?.colour).toBe(chordRoleColour(1));
    expect(shape?.colour).not.toBe(ACCENT);
  });

  it('lights nothing when what was chosen has since gone', () => {
    expect(lit({ kind: 'melodyNote', index: 9 })).toBeNull();
    expect(lit({ kind: 'chordTone', slot: 3, tone: 0 })).toBeNull();
    expect(lit({ kind: 'barLine', lineIndex: 7 })).toBeNull();
  });
});
