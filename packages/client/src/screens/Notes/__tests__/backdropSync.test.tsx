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

jest.mock('../../../specs/NativeSynth', () => ({
  __esModule: true,
  // Required in the factory, not closed over: a factory runs before this
  // module's own bindings exist.
  default: (require('../__fixtures__/synthDouble') as typeof import('../__fixtures__/synthDouble'))
    .synthDouble
}));

import { resetSynthDouble, synthDouble as synth } from '../__fixtures__/synthDouble';
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
  beforeEach(resetSynthDouble);

  /** Every note the engine was asked for, however many calls it took. */
  const scheduled = () =>
    synth.schedule.mock.calls.flatMap(
      ([notes]) => notes as { startMs: number; endMs: number }[]
    );

  /** Where the engine was told to begin, relative to its own now plus lead. */
  const LEAD = 50;

  it('starts from the top when the take has not moved yet', async () => {
    const { result } = await renderHook(() => useChordBackdrop(PROGRESSION));
    result.current.start();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const notes = scheduled();
    expect(notes).toHaveLength(6);
    expect(notes[0].startMs).toBe(LEAD);
    // The second chord still waits its two seconds.
    expect(notes[3].startMs).toBe(LEAD + 2000);
  });

  it('skips the chord the take has passed and shortens the one it is in', async () => {
    const { result } = await renderHook(() => useChordBackdrop(PROGRESSION));
    result.current.start(2500);
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Only the second chord's three notes are left to sound.
    const notes = scheduled();
    expect(notes).toHaveLength(3);
    for (const note of notes) {
      // It starts now, where the take is — not 2.5s late, and not 2s from now.
      expect(note.startMs).toBe(LEAD);
      // And still ends where the chord ends: 1.5s of its 2s remain.
      expect(note.endMs).toBe(LEAD + 1500);
    }
  });

  it('sounds nothing when the take is already past the progression', async () => {
    const { result } = await renderHook(() => useChordBackdrop(PROGRESSION));
    result.current.start(4000);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(scheduled()).toHaveLength(0);
  });
});
