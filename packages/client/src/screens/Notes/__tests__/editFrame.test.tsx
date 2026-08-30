/**
 * INV-NOTES-174 — a note edit moves the note, not the picture.
 *
 * The metrical grid was fitted to the melody with corrections already applied,
 * so every edit re-read the tempo. A new bpm is a new pixels-per-millisecond
 * and a new offset is a new zero, so the whole drawing rescaled and shifted
 * under a change to one note: tapped beats slid, and bar lines — held as step
 * indices — landed at different moments than the beats they were arranged
 * against.
 */
import { act, renderHook } from '@testing-library/react-native';

/** A take whose onsets are uneven enough that re-fitting them moves the grid. */
const NOTE = {
  id: 'n1',
  durationMs: 8000,
  melody: [
    { midi: 60, startMs: 500, endMs: 880, cents: 0, clarity: 1 },
    { midi: 62, startMs: 1010, endMs: 1390, cents: 0, clarity: 1 },
    { midi: 64, startMs: 1490, endMs: 1900, cents: 0, clarity: 1 },
    { midi: 65, startMs: 2020, endMs: 2400, cents: 0, clarity: 1 },
    { midi: 67, startMs: 2500, endMs: 2900, cents: 0, clarity: 1 },
    { midi: 65, startMs: 3010, endMs: 3400, cents: 0, clarity: 1 }
  ],
  interpretations: [],
  hits: [],
  layers: []
};

jest.mock('../../../data/notesSync', () => ({
  cachedNotes: () => [NOTE],
  cacheReading: jest.fn()
}));

import { useNoteDetail } from '../useNoteDetail';

const open = () => renderHook(() => useNoteDetail('n1'));

describe('the picture under a note edit', () => {
  it('keeps the grid it read from the take', async () => {
    const { result } = await open();
    const before = { ...result.current.grid };
    await act(async () => {
      result.current.correctNote(0, 5);
    });
    // The edit landed — otherwise this asserts nothing.
    expect(result.current.melody[0]?.midi).toBe(65);
    expect(result.current.grid).toEqual(before);
  });

  it('keeps the grid when a note is made longer', async () => {
    const { result } = await open();
    const before = { ...result.current.grid };
    await act(async () => {
      result.current.setSelection([{ kind: 'melodyNote', index: 2 }]);
    });
    await act(async () => {
      result.current.resizeChosen(1, 'end');
    });
    expect(result.current.melody[2]?.endMs).not.toBe(1900);
    expect(result.current.grid).toEqual(before);
  });

  it('keeps the grid when a note is moved in time', async () => {
    const { result } = await open();
    const before = { ...result.current.grid };
    await act(async () => {
      result.current.setSelection([{ kind: 'melodyNote', index: 3 }]);
    });
    await act(async () => {
      result.current.shiftChosen(1);
    });
    expect(result.current.melody[3]?.startMs).not.toBe(2020);
    expect(result.current.grid).toEqual(before);
  });

  it('keeps the downbeats it proposed from the take', async () => {
    const { result } = await open();
    const before = [...result.current.bars.layout.lines];
    await act(async () => {
      result.current.setSelection([{ kind: 'melodyNote', index: 4 }]);
    });
    await act(async () => {
      result.current.shiftChosen(3);
    });
    expect(result.current.melody[4]?.startMs).not.toBe(2500);
    expect(result.current.bars.layout.lines).toEqual(before);
  });

  it('still holds the take as heard in the pitch window', async () => {
    const { result } = await open();
    // Corrected down out of the top of the take. The window is fitted to what
    // is drawn, so without declaring what was heard it would close in and move
    // every other note.
    await act(async () => {
      result.current.correctNote(4, -12);
    });
    expect(result.current.heardPitches).toEqual([60, 67]);
  });
});
