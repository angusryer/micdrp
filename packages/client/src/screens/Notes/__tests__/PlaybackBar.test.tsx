/**
 * PlaybackBar — INV-NOTES-012 / ACC-NOTES-024.
 *
 * A note served from the backend carries an https URL with a session token;
 * only a capture that has not synced carries file://. The component used to
 * strip a file:// prefix and read the result with RNFS as a local path, so
 * every backend-served note — which is every note after a sync — failed to
 * play. These tests pin the URL reaching the decoder untouched.
 *
 * INV-NOTES-014 sits on top of that: the URL is now produced by a resolver
 * called when Play is pressed, because a PocketBase file token lives about two
 * minutes. Signing at sync time and caching the result — what the code did
 * before — meant every note played more than two minutes later fetched with a
 * dead token, which is why playback still failed after the first fix.
 *
 * The decoder is now the native engine, which reads the URL itself and holds
 * the take in a slot (INV-NOTES-133) — so what these pin is the URL reaching
 * `loadSample` untouched.
 *
 * Rendering goes through __fixtures__/renderPlaybackBar, which holds the
 * providers and the `await waitFor(() => render(...))` this setup needs before
 * any query is touched. What a press sounds is playbackMix.test.tsx.
 */
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

jest.mock('../../../specs/NativeSynth', () => ({
  __esModule: true,
  // Required in the factory, not closed over: a factory runs before this
  // module's own bindings exist.
  default: (require('../__fixtures__/synthDouble') as typeof import('../__fixtures__/synthDouble'))
    .synthDouble
}));

import { resetSynthDouble, synthDouble as synth } from '../__fixtures__/synthDouble';

import { TAKE_SLOT } from '../sampleSlots';

import { backdrop, renderPlaybackBar } from '../__fixtures__/renderPlaybackBar';

const REMOTE =
  'https://micdrp-backend.fly.dev/api/files/notes/abc123/audio.wav?token=t0ken';
const LOCAL = 'file:///var/mobile/tmp/micdrp-abc.wav';

const renderBar = (audioUri: string | null, chords?: ReturnType<typeof backdrop>) =>
  renderPlaybackBar(() => Promise.resolve(audioUri), chords);

describe('PlaybackBar', () => {
  beforeEach(resetSynthDouble);

  it('passes a backend https URL to the decoder unchanged', async () => {
    await renderBar(REMOTE);
    await fireEvent.press(screen.getByLabelText('Play'));

    await waitFor(() => expect(synth.loadSample).toHaveBeenCalled());
    expect(synth.loadSample).toHaveBeenCalledWith(TAKE_SLOT, REMOTE);
    await waitFor(() => expect(synth.scheduleSamples).toHaveBeenCalled());
  });

  it('passes a local file:// URI to the decoder unchanged', async () => {
    await renderBar(LOCAL);
    await fireEvent.press(screen.getByLabelText('Play'));

    // Still prefixed: stripping file:// is what broke the remote case, and the
    // decoder wants the scheme for the local case too.
    await waitFor(() =>
      expect(synth.loadSample).toHaveBeenCalledWith(TAKE_SLOT, LOCAL)
    );
  });

  it('surfaces an error state and logs the cause when decoding fails', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    synth.loadSample.mockRejectedValue(new Error('unsupported format'));

    await renderBar(REMOTE);
    await fireEvent.press(screen.getByLabelText('Play'));

    await waitFor(() => expect(screen.getByText('Playback failed')).toBeTruthy());
    // The cause must reach the log; swallowing it is why this was opaque.
    expect(warn).toHaveBeenCalledWith(
      '[useTakeVoice] playback failed for',
      REMOTE,
      expect.any(Error)
    );
    warn.mockRestore();
  });
});

describe('PlaybackBar accompaniment', () => {
  beforeEach(resetSynthDouble);

  it('sounds the backdrop with the take, not before it', async () => {
    const chords = backdrop();
    await renderBar(REMOTE, chords);
    expect(chords.start).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByLabelText('Play'));

    await waitFor(() => expect(chords.start).toHaveBeenCalledTimes(1));
  });

  it('silences the backdrop when the take is stopped', async () => {
    const chords = backdrop();
    await renderBar(REMOTE, chords);
    await fireEvent.press(screen.getByLabelText('Play'));
    await waitFor(() => expect(chords.start).toHaveBeenCalled());
    chords.stop.mockClear();

    await fireEvent.press(screen.getByLabelText('Pause'));

    await waitFor(() => expect(chords.stop).toHaveBeenCalled());
  });

  it('leaves no backdrop sounding when the take cannot be decoded', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    synth.loadSample.mockRejectedValue(new Error('unsupported format'));
    const chords = backdrop();
    await renderBar(REMOTE, chords);
    chords.stop.mockClear();

    await fireEvent.press(screen.getByLabelText('Play'));

    await waitFor(() => expect(chords.stop).toHaveBeenCalled());
    expect(chords.start).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
