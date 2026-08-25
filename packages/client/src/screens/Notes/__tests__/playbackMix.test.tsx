/**
 * Turning the tracks a press sounds — notes.set_playback_mix / INV-NOTES-019 /
 * INV-NOTES-027 / ACC-NOTES-033 / ACC-NOTES-034 / ACC-NOTES-040.
 *
 * The maintainer asked to be able to turn the various tracks on and off, and
 * to drop the separate "play over the recording" switch once the toggles cover
 * them. What these pin is that a press sounds exactly the tracks left on: no
 * backdrop with the chords off, no melody with the melody off, and — the part
 * that would otherwise leak — no URL minted and nothing decoded with the take
 * off, which plays no take at all. Turning a track mid-playback stops what is
 * running, so no mix is ever half-applied.
 *
 * Rendering goes through __fixtures__/renderPlaybackBar, shared with
 * PlaybackBar.test.tsx.
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

import { backdrop, renderPlaybackBar } from '../__fixtures__/renderPlaybackBar';

const REMOTE = 'https://micdrp-backend.fly.dev/api/files/notes/abc/a.wav?token=t';

const renderBar = (
  chords: ReturnType<typeof backdrop>,
  resolve: () => Promise<string | null>,
  voice?: ReturnType<typeof backdrop>
) => renderPlaybackBar(resolve, chords, voice);

/** What each track's card is called, which is what its controls are named. */
const CARD: Record<string, string> = {
  Take: 'Your take',
  Chords: 'Chords read from your take',
  Melody: 'Transcription of your take'
};

/**
 * The speaker on one track's card, whichever way round it is.
 *
 * The mute is a glyph now rather than a pill, so it is found by the name a
 * screen reader hears — which is the only place the word survives.
 */
const track = (name: string) =>
  screen.getByLabelText(
    new RegExp(`^(Mute|Unmute) ${CARD[name]}$`)
  );

/** Whether that track is currently audible, read off the same control. */
const isOn = (name: string) =>
  (track(name).props.accessibilityLabel as string).startsWith('Mute');

const isLocked = (name: string) =>
  track(name).props.accessibilityState?.disabled === true;

describe('turning the tracks a press sounds', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetSynthDouble();
  });

  it('starts with the take and the chords on and the melody off', async () => {
    const chords = backdrop();
    const melody = backdrop(3000);
    await renderBar(chords, jest.fn().mockResolvedValue(REMOTE), melody);

    expect(
      isOn('Take')
    ).toBe(true);
    expect(
      isOn('Chords')
    ).toBe(true);
    expect(
      isOn('Melody')
    ).toBe(false);

    await fireEvent.press(screen.getByLabelText('Play'));

    await waitFor(() => expect(synth.scheduleSamples).toHaveBeenCalled());
    expect(chords.start).toHaveBeenCalledTimes(1);
    // The take is already running when the chords are handed over, so what the
    // backdrop is given is the take's position, not its top (INV-NOTES-020).
    expect(chords.start).toHaveBeenCalledWith(expect.any(Number));
    // And the melody is off until it is turned on, so nothing was read back.
    expect(melody.start).not.toHaveBeenCalled();
  });

  it('sounds the take alone with no backdrop under it', async () => {
    const chords = backdrop();
    const resolve = jest.fn().mockResolvedValue(REMOTE);
    await renderBar(chords, resolve);

    await fireEvent.press(track('Chords'));
    await fireEvent.press(screen.getByLabelText('Play'));

    await waitFor(() =>
      expect(synth.loadSample).toHaveBeenCalledWith(0, REMOTE)
    );
    expect(chords.start).not.toHaveBeenCalled();
  });

  it('sounds the chords alone without minting or decoding a take', async () => {
    const chords = backdrop();
    const resolve = jest.fn().mockResolvedValue(REMOTE);
    await renderBar(chords, resolve);

    await fireEvent.press(track('Take'));
    await fireEvent.press(screen.getByLabelText('Play'));

    await waitFor(() => expect(chords.start).toHaveBeenCalledTimes(1));
    // Nothing to catch up to without a take, so they start from the top.
    expect(chords.start).toHaveBeenCalledWith(0);
    // A press that plays no take asks the backend for nothing.
    expect(resolve).not.toHaveBeenCalled();
    expect(synth.loadSample).not.toHaveBeenCalled();
    // The chords are the transport now, so the control is the one that stops
    // them.
    expect(screen.getByLabelText('Pause')).toBeTruthy();
  });

  it('sounds the melody over the take once its track is on', async () => {
    const melody = backdrop(3000);
    await renderBar(backdrop(), jest.fn().mockResolvedValue(REMOTE), melody);

    await fireEvent.press(track('Melody'));
    await fireEvent.press(screen.getByLabelText('Play'));

    // On the take's own clock, so it is handed how far the take has run
    // (INV-NOTES-027).
    await waitFor(() => expect(melody.start).toHaveBeenCalledTimes(1));
    expect(melody.start).toHaveBeenCalledWith(expect.any(Number));
  });

  it('sounds the melody alone with the take off under it', async () => {
    const melody = backdrop(3000);
    await renderBar(backdrop(), jest.fn().mockResolvedValue(REMOTE), melody);

    await fireEvent.press(track('Melody'));
    await fireEvent.press(track('Take'));
    await fireEvent.press(track('Chords'));

    // Its own transport now: the melody read from a take is worth hearing by
    // itself, and the control that used to do that is this toggle
    // (INT-NOTES-026).
    await fireEvent.press(screen.getByLabelText('Play'));

    await waitFor(() => expect(melody.start).toHaveBeenCalledTimes(1));
    // From its own top, with no take to catch up to.
    expect(melody.start).toHaveBeenCalledWith(0);
  });

  it('will not turn off the last track that can sound', async () => {
    await renderBar(backdrop(), jest.fn().mockResolvedValue(REMOTE));

    await fireEvent.press(track('Chords'));

    // The take is all that is left, so its toggle stops taking a press rather
    // than leaving a play control with nothing behind it.
    expect(
      isLocked('Take')
    ).toBe(true);
  });

  it('hands the control back to play when the progression runs out', async () => {
    const chords = backdrop(40);
    await renderBar(chords, jest.fn().mockResolvedValue(REMOTE));

    await fireEvent.press(track('Take'));
    await fireEvent.press(screen.getByLabelText('Play'));
    await waitFor(() => expect(chords.start).toHaveBeenCalled());

    await waitFor(() => expect(screen.getByLabelText('Play')).toBeTruthy());
    expect(chords.stop).toHaveBeenCalled();
  });

  it('stops what is sounding when a track is turned mid-playback', async () => {
    const chords = backdrop();
    await renderBar(chords, jest.fn().mockResolvedValue(REMOTE));
    await fireEvent.press(screen.getByLabelText('Play'));
    await waitFor(() => expect(chords.start).toHaveBeenCalled());
    chords.stop.mockClear();

    await fireEvent.press(track('Chords'));

    await waitFor(() => expect(chords.stop).toHaveBeenCalled());
    expect(screen.getByLabelText('Play')).toBeTruthy();
  });

  it('offers nothing to turn for a take with no chords and no melody', async () => {
    await renderBar(backdrop(0), jest.fn().mockResolvedValue(REMOTE));

    expect(screen.queryByText('Chords')).toBeNull();
    expect(screen.queryByText('Melody')).toBeNull();
    expect(screen.queryByText('Take')).toBeNull();
    expect(screen.getByLabelText('Play')).toBeTruthy();
  });

  it('offers the melody alone when the take implied no chords', async () => {
    await renderBar(
      backdrop(0),
      jest.fn().mockResolvedValue(REMOTE),
      backdrop(3000)
    );

    // No card for a track the note does not have.
    expect(screen.queryByText(CARD.Chords)).toBeNull();
    expect(screen.getByText(CARD.Melody)).toBeTruthy();
    // The take is the only thing that can sound, so it cannot be turned off.
    expect(isLocked('Take')).toBe(true);
  });
});
