/**
 * INV-NOTES-083 — the melody track sounds when its own control says so.
 *
 * This is the gap that let a real bug through. The transport's own suites
 * hand it fake voices, so they prove the transport calls what it is given —
 * never that the thing it is given in the app actually sounds. The melody was
 * gated behind a switch that had been removed, and every one of those tests
 * still passed.
 *
 * `renderHook` is async in this setup — await it.
 */
import { renderHook } from '@testing-library/react-native';

const mockStart = jest.fn();
const mockStop = jest.fn();
const mockSetLevel = jest.fn();

jest.mock('../useMelodyBackdrop', () => ({
  DEFAULT_MELODY_LEVEL: 0.5,
  useMelodyBackdrop: () => ({
    start: mockStart,
    stop: mockStop,
    setLevel: mockSetLevel
  })
}));
jest.mock('../useChordBackdrop', () => ({
  useChordBackdrop: () => ({
    start: jest.fn(),
    stop: jest.fn(),
    setLevel: jest.fn(),
    durationMs: 0
  })
}));
jest.mock('../../../audio/synthPlayer', () => ({
  SynthBus: { Take: 0, Melody: 1, Chords: 2, Audition: 3, Bass: 4 },
  createTonePlayer: () => ({
    play: jest.fn(),
    stop: jest.fn(),
    setLevel: jest.fn()
  })
}));

import { useNotePlayback } from '../useNotePlayback';

const MELODY = [
  { midi: 60, startMs: 0, endMs: 500, durationMs: 500, cents: 0, clarity: 1 }
] as never;

const QUANTIZED = { notes: [], grid: { bpm: 0 } } as never;
const CHORDS = {
  progression: [],
  bass: [],
  voicing: () => [],
  auditionMs: 400,
  slots: []
} as never;

describe('the melody track', () => {
  beforeEach(() => jest.clearAllMocks());

  it('sounds when the transport starts it, with nothing else gating it', async () => {
    const { result } = await renderHook(() =>
      useNotePlayback(MELODY, QUANTIZED, CHORDS)
    );

    result.current.melodyVoiceMix.start(0);
    expect(mockStart).toHaveBeenCalledWith(0);
  });

  it('starts where the transport says, so it lands with the take', async () => {
    const { result } = await renderHook(() =>
      useNotePlayback(MELODY, QUANTIZED, CHORDS)
    );

    result.current.melodyVoiceMix.start(1200);
    expect(mockStart).toHaveBeenCalledWith(1200);
  });

  it('takes its level from the one place that sets it', async () => {
    const { result } = await renderHook(() =>
      useNotePlayback(MELODY, QUANTIZED, CHORDS)
    );

    result.current.melodyVoiceMix.setLevel?.(0.3);
    expect(mockSetLevel).toHaveBeenCalledWith(0.3);
    // One writer: a second would fight it, and the loser is whichever effect
    // commits first.
    expect(mockSetLevel).toHaveBeenCalledTimes(1);
  });
});
