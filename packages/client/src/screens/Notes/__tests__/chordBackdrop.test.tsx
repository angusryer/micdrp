/**
 * The chord backdrop under a take — notes.play_backdrop / INV-NOTES-018.
 *
 * The maintainer asked for the chords to sound as well as the line that was
 * detected, so pressing play now schedules the whole voiced progression beside
 * the audio. What these pin is the scheduling: one tone per chord note across
 * that chord's own slot, on the take's clock, its length for when the chords
 * are sounded alone, and nothing left over once the screen goes away.
 *
 * `renderHook` is async in this setup — await it and any rerender.
 */
import { renderHook } from '@testing-library/react-native';

import type { ChordPlayback } from 'logic';

interface FakeOscillator {
  freq: number;
  start: jest.Mock;
  stop: jest.Mock;
}

const oscillators: FakeOscillator[] = [];
const gains: number[] = [];
const mockClose = jest.fn().mockResolvedValue(undefined);

jest.mock('react-native-audio-api', () => ({
  AudioContext: jest.fn().mockImplementation(() => ({
    currentTime: 0,
    destination: {},
    createOscillator: () => {
      const osc: FakeOscillator = { freq: 0, start: jest.fn(), stop: jest.fn() };
      oscillators.push(osc);
      return {
        ...osc,
        type: 'sine',
        frequency: {
          value: 0,
          setValueAtTime: (v: number) => {
            osc.freq = v;
          },
          linearRampToValueAtTime: jest.fn()
        },
        connect: jest.fn()
      };
    },
    createGain: () => ({
      gain: {
        value: 0,
        setValueAtTime: jest.fn(),
        linearRampToValueAtTime: (v: number) => {
          if (v > 0) {
            gains.push(v);
          }
        }
      },
      connect: jest.fn()
    }),
    close: mockClose
  }))
}));

import { backdropTones, useChordBackdrop } from '../useChordBackdrop';

/** Two bars of C then G, voiced from the backdrop floor. */
const PROGRESSION: ChordPlayback[] = [
  { midi: [48, 52, 55], startMs: 0, endMs: 2000 },
  { midi: [55, 59, 62], startMs: 2000, endMs: 4000 }
];

describe('backdropTones', () => {
  it('sounds every chord note across its own slot', () => {
    expect(backdropTones(PROGRESSION)).toEqual([
      { midi: 48, startMs: 0, endMs: 2000 },
      { midi: 52, startMs: 0, endMs: 2000 },
      { midi: 55, startMs: 0, endMs: 2000 },
      { midi: 55, startMs: 2000, endMs: 4000 },
      { midi: 59, startMs: 2000, endMs: 4000 },
      { midi: 62, startMs: 2000, endMs: 4000 }
    ]);
  });

  it('clamps a slot the grid placed before the take began', () => {
    // The fitted grid's first bar line can precede the first sung note, which
    // would otherwise schedule a chord at a negative offset from "now".
    const tones = backdropTones([
      { midi: [48], startMs: -500, endMs: 500 },
      { midi: [50], startMs: -900, endMs: -400 }
    ]);
    expect(tones).toEqual([{ midi: 48, startMs: 0, endMs: 500 }]);
  });

  it('gives an empty backdrop for a melody that implied no chords', () => {
    expect(backdropTones([])).toEqual([]);
  });
});

describe('useChordBackdrop', () => {
  beforeEach(() => {
    oscillators.length = 0;
    gains.length = 0;
    jest.clearAllMocks();
  });

  it('schedules nothing until the take starts', async () => {
    await renderHook(() => useChordBackdrop(PROGRESSION));
    expect(oscillators).toHaveLength(0);
  });

  it('sounds one tone per chord note when the take starts', async () => {
    const { result } = await renderHook(() => useChordBackdrop(PROGRESSION));
    result.current.start();

    expect(oscillators).toHaveLength(6);
    // Voiced from the backdrop floor: 48 is C3 at 130.81 Hz (INV-NOTES-009).
    expect(oscillators[0].freq).toBeCloseTo(130.81, 1);
    // Quieter per tone than a tapped chord's 0.2, since several sound at once
    // underneath a sung take.
    expect(Math.max(...gains)).toBeLessThan(0.2);
  });

  it('reports how long the whole progression runs', async () => {
    const { result } = await renderHook(() => useChordBackdrop(PROGRESSION));
    expect(result.current.durationMs).toBe(4000);
    const none = await renderHook(() => useChordBackdrop([]));
    expect(none.result.current.durationMs).toBe(0);
  });

  it('silences the backdrop when the take stops', async () => {
    const { result } = await renderHook(() => useChordBackdrop(PROGRESSION));
    result.current.start();
    result.current.stop();

    for (const osc of oscillators) {
      expect(osc.stop).toHaveBeenCalled();
    }
    expect(mockClose).toHaveBeenCalled();
  });

  it('leaves nothing sounding when the screen goes away', async () => {
    const { result, unmount } = await renderHook(() =>
      useChordBackdrop(PROGRESSION)
    );
    result.current.start();
    await unmount();

    for (const osc of oscillators) {
      expect(osc.stop).toHaveBeenCalled();
    }
  });
});
