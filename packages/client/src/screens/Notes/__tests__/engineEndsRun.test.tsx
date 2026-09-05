/**
 * ACC-TPORT-012 / INV-TPORT-017 — the engine's word reaches the app.
 *
 * `useTakeVoice` handed the store an adapter listing `start`, `silence`
 * and `reachedMs` by hand. `hasEnded` arrived on the engine one commit
 * later and never reached the store, so the engine-owned end detection
 * of INV-TPORT-011 was dead in the app and only the fallback timer ever
 * ran. Nothing failed: the subset type-checks, because that method is
 * optional by design (INV-TPORT-014).
 *
 * So this asks the question from outside — play a take, have the engine
 * say the run is over, and see whether the transport hears it — which
 * no test of the adapter's shape could have asked.
 */
import { act, waitFor } from '@testing-library/react-native';

jest.mock('../../../specs/NativeSynth', () => ({
  __esModule: true,
  default: (require('../__fixtures__/synthDouble') as typeof import('../__fixtures__/synthDouble'))
    .synthDouble
}));

import { resetSynthDouble, synthDouble as synth } from '../__fixtures__/synthDouble';
import { renderPlaybackBar } from '../__fixtures__/renderPlaybackBar';

const REMOTE = 'https://micdrp-backend.fly.dev/api/files/notes/abc/a.wav?token=t';

/** What the engine publishes as it renders (INV-TPORT-010). */
const report = (running: boolean, positionMs = 0) => ({
  positionMs,
  running,
  generation: 1,
  ended: running ? 0 : 1
});

beforeEach(() => {
  resetSynthDouble();
});

it('ACC-TPORT-012: stops when the engine says the run ended', async () => {
  synth.transportReport.mockReturnValue(report(true));
  const held: { current: { isPlaying: boolean; play: () => void } | null } = {
    current: null
  };
  await renderPlaybackBar(
    () => Promise.resolve(REMOTE),
    undefined,
    undefined,
    undefined,
    {
      onTransport: (next) => {
        held.current = next;
      }
    }
  );
  await waitFor(() => expect(held.current).not.toBeNull());

  await act(async () => {
    held.current?.play();
  });
  await waitFor(() => expect(held.current?.isPlaying).toBe(true));

  // The take is a minute long, so no fallback timer is anywhere near
  // firing. The only thing that can stop this within a second is the
  // engine's word, asked for every hundred milliseconds while a run is on.
  synth.transportReport.mockReturnValue(report(false, 60_000));
  await waitFor(() => expect(held.current?.isPlaying).toBe(false));
});
