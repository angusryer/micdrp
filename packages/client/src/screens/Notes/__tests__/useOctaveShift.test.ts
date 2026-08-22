/**
 * INV-NOTES-059 — the control refuses what would push a note out of range.
 *
 * The pure arithmetic is pinned in logic; what this covers is the control
 * honouring it, since a stepper that happily counts past its own limit would
 * leave the refusal true only on paper.
 *
 * `renderHook` is async in this setup — await it and any act.
 */
import { act, renderHook } from '@testing-library/react-native';

import type { NoteEvent } from 'logic';

import { OCTAVE_LIMIT, useOctaveShift } from '../useOctaveShift';

const noteAt = (midi: number): NoteEvent =>
  ({ midi, cents: 0, startMs: 0, endMs: 400 }) as NoteEvent;

describe('choosing a register to listen in', () => {
  it('starts at the take, so nothing is claimed until it is asked for', async () => {
    const { result } = await renderHook(() => useOctaveShift([noteAt(60)]));
    expect(result.current.octaves).toBe(0);
  });

  it('moves a whole octave at a time', async () => {
    const { result } = await renderHook(() => useOctaveShift([noteAt(60)]));
    await act(() => result.current.shiftOctave(1));
    expect(result.current.octaves).toBe(1);
    await act(() => result.current.shiftOctave(-1));
    expect(result.current.octaves).toBe(0);
  });

  it('will not count past the limit it offers', async () => {
    const { result } = await renderHook(() => useOctaveShift([noteAt(60)]));
    for (let i = 0; i < OCTAVE_LIMIT + 2; i += 1) {
      await act(() => result.current.shiftOctave(1));
    }
    expect(result.current.octaves).toBe(OCTAVE_LIMIT);
  });

  it('will not lift a melody already near the ceiling', async () => {
    const { result } = await renderHook(() => useOctaveShift([noteAt(120)]));
    expect(result.current.octaveRange.up).toBe(0);
    await act(() => result.current.shiftOctave(1));
    expect(result.current.octaves).toBe(0);
    // Down is still open, which is the direction that helps a high melody.
    await act(() => result.current.shiftOctave(-1));
    expect(result.current.octaves).toBe(-1);
  });
});
