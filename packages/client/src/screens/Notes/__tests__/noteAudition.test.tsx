/**
 * INV-NOTES-175, INV-NOTES-176 — choosing a note sounds it, and changing its
 * pitch sounds what it becomes.
 */
import { act, renderHook } from '@testing-library/react-native';

const NOTE = {
  id: 'n1',
  durationMs: 8000,
  melody: [
    { midi: 60, startMs: 500, endMs: 880, cents: 0, clarity: 1 },
    { midi: 64, startMs: 1010, endMs: 1390, cents: 0, clarity: 1 }
  ],
  interpretations: [],
  hits: [],
  layers: []
};

jest.mock('../../../data/notesSync', () => ({
  cachedNotes: () => [NOTE],
  cacheReading: jest.fn()
}));

const played: number[] = [];
const dragged: number[] = [];
jest.mock('../../../audio/synthPlayer', () => {
  const actual = jest.requireActual('../../../audio/synthPlayer');
  return {
    ...actual,
    createTonePlayer: () => ({
      play: (targets: { midi: number }[]) => {
        played.push(targets[0]?.midi ?? -1);
      },
      setLevel: () => undefined,
      stop: () => undefined
    })
  };
});

import { useNoteDetail } from '../useNoteDetail';

const open = () => renderHook(() => useNoteDetail('n1'));

beforeEach(() => {
  played.length = 0;
  dragged.length = 0;
});

describe('choosing a note', () => {
  it('sounds its pitch, with no further press', async () => {
    const { result } = await open();
    await act(async () => {
      result.current.setSelection([{ kind: 'melodyNote', index: 1 }]);
    });
    expect(played).toContain(64);
  });

  it('sounds nothing for a set, which has no one pitch', async () => {
    const { result } = await open();
    await act(async () => {
      result.current.setSelection([
        { kind: 'melodyNote', index: 0 },
        { kind: 'melodyNote', index: 1 }
      ]);
    });
    expect(played).toHaveLength(0);
  });

  it('sounds nothing for a thing with no pitch', async () => {
    const { result } = await open();
    await act(async () => {
      result.current.setSelection([{ kind: 'beat', index: 0 }]);
    });
    expect(played).toHaveLength(0);
  });
});

describe('nudging a pitch', () => {
  it('sounds the pitch it becomes, not the one it was', async () => {
    const { result } = await open();
    await act(async () => {
      result.current.setSelection([{ kind: 'melodyNote', index: 0 }]);
    });
    played.length = 0;
    await act(async () => {
      result.current.nudgeChosen(2);
    });
    expect(played).toContain(62);
  });
});
