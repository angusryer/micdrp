/**
 * ACC-NOTES-220 / INV-NOTES-175 — a tapped note sounds at the level the
 * sheet says the transcription sits at.
 *
 * The audition bus already borrows the melody track's timbre, for the
 * reason that checking a note in one sound and hearing it play in another
 * compares two different things (INV-NOTES-144). Its loudness is the same
 * argument: it sat at full while the track it stands for was balanced
 * against the take, so a tapped note arrived at a different loudness from
 * the same note in playback — and once the take's level was matched, loud
 * enough to startle.
 */
import { act } from '@testing-library/react-native';
import TestRenderer from 'react-test-renderer';
import React from 'react';

jest.mock('../../../specs/NativeSynth', () => ({
  __esModule: true,
  default: (require('../__fixtures__/synthDouble') as typeof import('../__fixtures__/synthDouble'))
    .synthDouble
}));

import { resetSynthDouble, synthDouble as synth } from '../__fixtures__/synthDouble';
import { usePlaybackMix } from '../usePlaybackMix';
import { DEFAULT_LEVELS, DEFAULT_MIX, DEFAULT_VOICES } from '../playbackTracks';
import { AUDITION_BUS } from '../../../audio/synthPlayer';

function Probe({ melody }: { melody: number }): null {
  usePlaybackMix({
    resolveAudioUri: () => Promise.resolve(null),
    mix: DEFAULT_MIX,
    levels: { ...DEFAULT_LEVELS, melody },
    voices: DEFAULT_VOICES
  });
  return null;
}

/** What the audition bus was last set to, or null if it never was. */
const auditionLevel = (): number | null => {
  const calls = synth.setBusLevel.mock.calls.filter(
    ([bus]) => bus === AUDITION_BUS
  );
  return calls.length === 0 ? null : (calls[calls.length - 1][1] as number);
};

beforeEach(() => resetSynthDouble());

it('ACC-NOTES-220: sounds a tapped note at the transcription level', async () => {
  await act(async () => {
    TestRenderer.create(<Probe melody={0.25} />);
  });
  expect(auditionLevel()).toBeCloseTo(0.25, 6);
});

it('follows the slider as it moves', async () => {
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = TestRenderer.create(<Probe melody={0.25} />);
  });
  await act(async () => {
    tree.update(<Probe melody={0.8} />);
  });
  expect(auditionLevel()).toBeCloseTo(0.8, 6);
});
