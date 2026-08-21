/**
 * The backdrop lands where the take is — INV-NOTES-020 / ACC-NOTES-035.
 *
 * The maintainer asked to hear the chords as the audio is playing. The chords
 * cannot be scheduled in the instant the take starts: a render commits and an
 * audio context is built first, and starting the progression from its top at
 * that later instant leaves every chord that gap behind the voice for the
 * whole take. So the backdrop is handed how far the take has already run and
 * placed against that. What these pin is the placing: a slot already passed is
 * not sounded, the slot underway starts where the take is and still ends where
 * it ends, and the ones ahead keep their own place.
 *
 * `renderHook` is async in this setup — await it.
 */
import { renderHook } from '@testing-library/react-native';

import type { ChordPlayback } from 'logic';

interface FakeOscillator {
  startedAt: number | null;
  stoppedAt: number | null;
}

const oscillators: FakeOscillator[] = [];

jest.mock('react-native-audio-api', () => ({
  AudioContext: jest.fn().mockImplementation(() => ({
    currentTime: 0,
    destination: {},
    createOscillator: () => {
      const osc: FakeOscillator = { startedAt: null, stoppedAt: null };
      oscillators.push(osc);
      return {
        type: 'sine',
        frequency: {
          value: 0,
          setValueAtTime: jest.fn(),
          linearRampToValueAtTime: jest.fn()
        },
        connect: jest.fn(),
        start: (t: number) => {
          osc.startedAt = t;
        },
        stop: (t: number) => {
          osc.stoppedAt = t;
        }
      };
    },
    createGain: () => ({
      gain: {
        value: 0,
        setValueAtTime: jest.fn(),
        linearRampToValueAtTime: jest.fn()
      },
      connect: jest.fn()
    }),
    close: jest.fn().mockResolvedValue(undefined)
  }))
}));

import { shiftTones, useChordBackdrop } from '../useChordBackdrop';

/** Two bars of C then G, on the take's clock. */
const PROGRESSION: ChordPlayback[] = [
  { midi: [48, 52, 55], startMs: 0, endMs: 2000 },
  { midi: [55, 59, 62], startMs: 2000, endMs: 4000 }
];

describe('shiftTones', () => {
  const TONES = [
    { midi: 48, startMs: 0, endMs: 2000 },
    { midi: 55, startMs: 2000, endMs: 4000 },
    { midi: 60, startMs: 4000, endMs: 6000 }
  ];

  it('leaves the progression alone when nothing has elapsed', () => {
    expect(shiftTones(TONES, 0)).toEqual(TONES);
  });

  it('drops what the take has passed and clips what it is inside of', () => {
    // 2500ms in: the first chord is over, the second is half gone, the third
    // is still ahead and keeps the 1500ms of silence before it.
    expect(shiftTones(TONES, 2500)).toEqual([
      { midi: 55, startMs: 0, endMs: 1500 },
      { midi: 60, startMs: 1500, endMs: 3500 }
    ]);
  });

  it('sounds nothing once the take is past the whole progression', () => {
    expect(shiftTones(TONES, 6000)).toEqual([]);
  });
});

describe('the backdrop against a take already running', () => {
  beforeEach(() => {
    oscillators.length = 0;
    jest.clearAllMocks();
  });

  it('starts from the top when the take has not moved yet', async () => {
    const { result } = await renderHook(() => useChordBackdrop(PROGRESSION));
    result.current.start();

    expect(oscillators).toHaveLength(6);
    expect(oscillators[0].startedAt).toBe(0);
    // The second chord still waits its two seconds.
    expect(oscillators[3].startedAt).toBe(2);
  });

  it('skips the chord the take has passed and shortens the one it is in', async () => {
    const { result } = await renderHook(() => useChordBackdrop(PROGRESSION));
    result.current.start(2500);

    // Only the second chord's three notes are left to sound.
    expect(oscillators).toHaveLength(3);
    for (const osc of oscillators) {
      // It starts now, where the take is — not 2.5s late, and not 2s from now.
      expect(osc.startedAt).toBe(0);
      // And still ends where the chord ends: 1.5s of its 2s remain.
      expect(osc.stoppedAt).toBe(1.5);
    }
  });

  it('sounds nothing when the take is already past the progression', async () => {
    const { result } = await renderHook(() => useChordBackdrop(PROGRESSION));
    result.current.start(4000);

    expect(oscillators).toHaveLength(0);
  });
});
