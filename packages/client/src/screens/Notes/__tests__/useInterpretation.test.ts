/**
 * Keeping what a person made of a take — INV-NOTES-021, INV-NOTES-023.
 *
 * Chord editing shipped without any of this and every change was lost the
 * moment the screen closed, which made the feature feel broken while being
 * exactly as built. These pin the two things that stop that recurring: an edit
 * is written, and a frozen reading is never touched while doing it.
 *
 * `renderHook` is async in this setup — await it, and drive the hook directly
 * rather than through `act`. `act` is async here too, so wrapping a timer
 * advance in it never runs the write. The sibling backdrop suite does the
 * same, for the same reason.
 */
import { act, renderHook } from '@testing-library/react-native';

import type { InterpretationDto } from 'shared';

const mockSave = jest.fn().mockResolvedValue(undefined);
jest.mock('../../../data/notesRepo', () => ({
  notesRepo: { saveInterpretations: (...args: unknown[]) => mockSave(...args) }
}));

import { useInterpretation } from '../useInterpretation';

const EDIT = { atMs: 0, rootPc: 9, quality: 'min' as const };

beforeEach(() => {
  jest.useFakeTimers();
  mockSave.mockClear();
});
afterEach(() => {
  jest.useRealTimers();
});

describe('useInterpretation', () => {
  it('starts from the decisions already kept with the note', async () => {
    const stored: InterpretationDto[] = [
      { id: 'active', name: 'Original', createdAtMs: 0, isFrozen: false, chords: [EDIT] }
    ];
    const { result } = await renderHook(() => useInterpretation('n1', stored));
    expect(result.current.savedEdits).toEqual([EDIT]);
  });

  it('a note with no readings starts empty rather than failing', async () => {
    const { result } = await renderHook(() => useInterpretation('n1', []));
    expect(result.current.savedEdits).toEqual([]);
  });

  it('INV-NOTES-021: an edit is written, so it outlives the screen', async () => {
    const { result } = await renderHook(() => useInterpretation('n1', []));
    result.current.update([EDIT]);
    jest.advanceTimersByTime(1000);
    expect(mockSave).toHaveBeenCalledWith(
      'n1',
      expect.arrayContaining([expect.objectContaining({ chords: [EDIT] })])
    );
  });

  it('spends one write on a gesture, not one per step', async () => {
    // A nudge through six degrees fires six times; six round trips to describe
    // one decision is the kind of thing that makes an app feel slow.
    const { result } = await renderHook(() => useInterpretation('n1', []));
    for (let i = 0; i < 6; i++) {
      result.current.update([{ ...EDIT, rootPc: i }]);
    }
    jest.advanceTimersByTime(1000);
    expect(mockSave).toHaveBeenCalledTimes(1);
  });

  it('INV-NOTES-023: a frozen reading is carried through untouched', async () => {
    const frozen: InterpretationDto = {
      id: 'f1', name: 'Take one', createdAtMs: 5, isFrozen: true, chords: [EDIT]
    };
    const { result } = await renderHook(() => useInterpretation('n1', [frozen]));
    result.current.update([]);
    jest.advanceTimersByTime(1000);
    const written = mockSave.mock.calls[0][1] as InterpretationDto[];
    expect(written).toContainEqual(frozen);
  });

  it('writes nothing for a note that has no id yet', async () => {
    const { result } = await renderHook(() => useInterpretation(null, []));
    result.current.update([EDIT]);
    jest.advanceTimersByTime(1000);
    expect(mockSave).not.toHaveBeenCalled();
  });

  it('reports a write that failed, so a screen can say so', async () => {
    mockSave.mockRejectedValueOnce(new Error('offline'));
    const { result } = await renderHook(() => useInterpretation('n1', []));
    result.current.update([EDIT]);
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(result.current.failed).toBe(true);
  });
});
