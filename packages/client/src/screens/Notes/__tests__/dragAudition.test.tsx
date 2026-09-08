/**
 * ACC-NOTES-237 / INV-NOTES-223 — the pitch a drag reaches is still sounding
 * after the drag has moved the note.
 *
 * Every wire from the gesture to the engine was already in place and a drag
 * was still silent on the device, because both ends of the same frame took
 * the sound away: claiming the voice let go of the engine's last hold, and
 * the effect watching the reading fired on the very edit the drag had just
 * made. So this drives the voice the way a drag does — sound the pitch, then
 * re-render with the melody it changed — rather than asserting the call.
 */
import { act } from '@testing-library/react-native';
import TestRenderer from 'react-test-renderer';
import React from 'react';

jest.mock('../../../specs/NativeSynth', () => ({
  __esModule: true,
  default: require('../__fixtures__/synthDouble').synthDouble
}));

import {
  resetSynthDouble,
  synthDouble as synth
} from '../__fixtures__/synthDouble';
import { usePreviewVoice } from '../usePreviewVoice';
import { AUDITION_BUS } from '../../../audio/synthPlayer';
import type { useChordTrack } from '../useChordTrack';

/** As much of a chord track as the voice reads. */
const chords = {
  voicing: () => [],
  auditionMs: 700
} as unknown as ReturnType<typeof useChordTrack>;

let voice: ReturnType<typeof usePreviewVoice>;

function Probe({ midi }: { midi: number }): null {
  voice = usePreviewVoice([{ midi, startMs: 0, endMs: 500 }], chords, 0);
  return null;
}

/** Middle C sharp — what a semitone up from middle C sounds at. */
const CS4_HZ = 277.1826;

beforeEach(() => resetSynthDouble());

it('ACC-NOTES-237: keeps sounding the pitch the drag moved the note to', async () => {
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = TestRenderer.create(<Probe midi={60} />);
  });

  await act(async () => {
    // What a drag does within one frame: the edit lands, the pitch reached is
    // sounded, and the re-render carrying the edit follows.
    voice.hearDragged(61);
    tree.update(<Probe midi={61} />);
  });

  const scheduled = synth.schedule.mock.calls.flatMap(([notes]) => notes);
  expect(scheduled).toHaveLength(1);
  expect(scheduled[0].frequencyHz).toBeCloseTo(CS4_HZ, 3);
  // Still sounding: nothing cleared the bus behind it, and the engine that
  // would play it is still running.
  expect(synth.clearBus).not.toHaveBeenCalledWith(AUDITION_BUS);
  expect(synth.stop).not.toHaveBeenCalled();
});

it('still stops a playing melody when the reading changes under it', async () => {
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = TestRenderer.create(<Probe midi={60} />);
  });
  await act(async () => {
    voice.playMelody();
  });
  await act(async () => {
    tree.update(<Probe midi={62} />);
  });
  expect(synth.clearBus).toHaveBeenCalledWith(AUDITION_BUS);
  expect(voice.isMelodyPlaying).toBe(false);
});
