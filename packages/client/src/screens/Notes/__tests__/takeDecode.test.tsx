/**
 * ACC-TPORT-014 / ACC-TPORT-015 — what the engine hands back is checked,
 * and a take is decoded once per take.
 *
 * `loadSample` returns -1 when the decode fails, and that was used as
 * the take's length. Nothing errored: the offset clamped to zero, the
 * clip was scheduled with an end a millisecond before its start, and the
 * run's fallback end fired at once. The press gave a spinner, a flicker
 * of the graph as following turned on and off, the play glyph back, and
 * no sound and no reason anywhere (INV-TPORT-019).
 *
 * It had a chance to fail at all because the decode cache compared the
 * full signed address, which carries a token minted fresh on every
 * press — so it never matched and every resume re-fetched the whole
 * recording (INV-TPORT-020).
 *
 * The engine here reports no transport, which is every binary that
 * exists: the C++ run state has not been built yet (INV-TPORT-014).
 */
import { act, waitFor } from '@testing-library/react-native';

jest.mock('../../../specs/NativeSynth', () => ({
  __esModule: true,
  default: (require('../__fixtures__/synthDouble') as typeof import('../__fixtures__/synthDouble'))
    .synthDouble
}));

import { resetSynthDouble, synthDouble as synth } from '../__fixtures__/synthDouble';
import { renderPlaybackBar } from '../__fixtures__/renderPlaybackBar';

/** The same recording, and a credential that is new every press. */
const address = (token: string) =>
  `https://micdrp-backend.fly.dev/api/files/notes/abc/a.wav?token=${token}`;

interface Reached {
  isPlaying: boolean;
  play: () => void;
  seek: (ms: number) => void;
  grabHead: () => void;
  dropHead: (ms: number) => void;
}

let clock = 0;

beforeEach(() => {
  resetSynthDouble();
  clock = 0;
  synth.nowMs.mockImplementation(() => clock);
  synth.transportReport.mockReturnValue(undefined);
});

/** Renders the bar and hands back the transport the graph would reach. */
const bar = async (resolve: () => Promise<string | null>) => {
  const held: { current: Reached | null } = { current: null };
  await renderPlaybackBar(resolve, undefined, undefined, undefined, {
    onTransport: (next) => {
      held.current = next;
    }
  });
  await waitFor(() => expect(held.current).not.toBeNull());
  return () => held.current as Reached;
};

it('ACC-TPORT-014: a take that will not decode schedules nothing', async () => {
  synth.loadSample.mockResolvedValue(-1);
  const at = await bar(() => Promise.resolve(address('t1')));

  await act(async () => {
    at().play();
  });
  // Long enough for a fallback end timer to have fired, which is how
  // this used to present as a play that stopped on its own.
  await new Promise((resolve) => setTimeout(resolve, 250));

  expect(at().isPlaying).toBe(false);
  expect(synth.scheduleSamples).not.toHaveBeenCalled();
});

it('ACC-TPORT-015: a resume schedules and does not decode again', async () => {
  // A new token every press, as the backend mints them.
  let minted = 0;
  const at = await bar(() => Promise.resolve(address(`t${(minted += 1)}`)));

  await act(async () => {
    at().play();
  });
  await waitFor(() => expect(at().isPlaying).toBe(true));
  expect(synth.loadSample).toHaveBeenCalledTimes(1);

  // Five seconds in, the head is taken hold of and put down again — the
  // gesture that stops and restarts the take (INV-TPORT-018).
  clock = 5000;
  await act(async () => {
    at().grabHead();
  });
  await act(async () => {
    at().dropHead(4000);
  });
  await waitFor(() => expect(at().isPlaying).toBe(true));

  // The recording is the same one. Only the credential moved.
  expect(synth.loadSample).toHaveBeenCalledTimes(1);
  expect(minted).toBe(2);
});
