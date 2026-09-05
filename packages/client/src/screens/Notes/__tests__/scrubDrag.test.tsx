/**
 * ACC-TPORT-013 / INV-TPORT-018 — a drag is one transport command.
 *
 * The scrubber sent a seek on every pan update. Playing, each of those
 * was a full stop, a file token minted, a decode and a reschedule, sixty
 * times a second, each superseding the last — which is the storm the
 * stranded spinner (INV-TPORT-016) and the abandoned decode
 * (INV-TPORT-015) were found underneath.
 *
 * Driven through the real hooks rather than a sketch of them: both of
 * those faults had tests that passed while the app was broken, because
 * they asserted the shape of a hand-written object.
 */
import { act, waitFor } from '@testing-library/react-native';

jest.mock('../../../specs/NativeSynth', () => ({
  __esModule: true,
  default: (require('../__fixtures__/synthDouble') as typeof import('../__fixtures__/synthDouble'))
    .synthDouble
}));

import { resetSynthDouble, synthDouble as synth } from '../__fixtures__/synthDouble';
import { renderPlaybackBar } from '../__fixtures__/renderPlaybackBar';

/** A backend file token is good for about two minutes (INV-NOTES-014). */
const REMOTE = 'https://micdrp-backend.fly.dev/api/files/notes/abc/a.wav?token=t';

interface Reached {
  isPlaying: boolean;
  seek: (ms: number) => void;
  grabHead: () => void;
  dropHead: (ms: number) => void;
  play: () => void;
}

beforeEach(() => {
  resetSynthDouble();
});

it('ACC-TPORT-013: a drag mints one token and schedules once', async () => {
  const resolveAudioUri = jest.fn().mockResolvedValue(REMOTE);
  // The bar republishes this whenever the transport changes, so the last
  // one held is the one a finger would be reaching.
  const held: { current: Reached | null } = { current: null };
  await renderPlaybackBar(resolveAudioUri, undefined, undefined, undefined, {
    onTransport: (next) => {
      held.current = next;
    }
  });
  await waitFor(() => expect(held.current).not.toBeNull());
  const at = (): Reached => held.current as Reached;

  await act(async () => {
    at().play();
  });
  await waitFor(() => expect(at().isPlaying).toBe(true));

  resolveAudioUri.mockClear();
  synth.scheduleSamples.mockClear();

  // A pan: one grab, twenty updates, one release.
  await act(async () => {
    at().grabHead();
  });
  for (let i = 0; i < 20; i += 1) {
    const ms = 1000 + i * 100;
    await act(async () => {
      at().seek(ms);
    });
  }
  await act(async () => {
    at().dropHead(3000);
  });

  await waitFor(() => expect(at().isPlaying).toBe(true));
  // One press worth of work for the whole gesture. It was twenty-two.
  expect(resolveAudioUri).toHaveBeenCalledTimes(1);
  expect(synth.scheduleSamples).toHaveBeenCalledTimes(1);
  // And it carries on from where the finger let go, not from where the
  // take had reached when it was grabbed.
  expect(synth.scheduleSamples.mock.calls[0][0][0].fromMs).toBe(3000);
});
