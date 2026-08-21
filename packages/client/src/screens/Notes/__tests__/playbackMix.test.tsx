/**
 * Choosing what play sounds — notes.set_playback_mix / INV-NOTES-019 /
 * ACC-NOTES-033 / ACC-NOTES-034.
 *
 * The maintainer asked to be able to hear the take alone, the chords alone, or
 * both. What these pin is that a press sounds exactly what was chosen: no
 * backdrop under a take-alone press, and — the part that would otherwise leak —
 * no URL minted and nothing decoded for a chords-alone press, which plays no
 * take at all. Changing the choice mid-playback stops what is running, so no
 * mix is ever half-applied.
 *
 * Rendering goes through __fixtures__/renderPlaybackBar, shared with
 * PlaybackBar.test.tsx.
 */
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

const mockDecode = jest.fn();
const mockStart = jest.fn();

jest.mock('react-native-audio-api', () => ({
  AudioContext: jest.fn().mockImplementation(() => ({
    destination: {},
    decodeAudioData: mockDecode,
    createBufferSource: () => ({
      buffer: null,
      connect: jest.fn(),
      start: mockStart,
      stop: jest.fn(),
      onended: null
    }),
    close: jest.fn().mockResolvedValue(undefined)
  }))
}));

import { backdrop, renderPlaybackBar } from '../__fixtures__/renderPlaybackBar';

const REMOTE = 'https://micdrp-backend.fly.dev/api/files/notes/abc/a.wav?token=t';

const renderBar = (
  chords: ReturnType<typeof backdrop>,
  resolve: () => Promise<string | null>
) => renderPlaybackBar(resolve, chords);

describe('choosing what play sounds', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDecode.mockResolvedValue({ duration: 3 });
  });

  it('offers both by default, and both is what sounds', async () => {
    const chords = backdrop();
    const resolve = jest.fn().mockResolvedValue(REMOTE);
    await renderBar(chords, resolve);

    expect(
      screen.getByRole('radio', { name: 'Both', selected: true })
    ).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Play'));

    await waitFor(() => expect(mockStart).toHaveBeenCalled());
    expect(chords.start).toHaveBeenCalledTimes(1);
    // The take is already running when the chords are handed over, so what the
    // backdrop is given is the take's position, not its top (INV-NOTES-020).
    expect(chords.start).toHaveBeenCalledWith(expect.any(Number));
  });

  it('sounds the take alone with no backdrop under it', async () => {
    const chords = backdrop();
    const resolve = jest.fn().mockResolvedValue(REMOTE);
    await renderBar(chords, resolve);

    await fireEvent.press(screen.getByText('Take'));
    await fireEvent.press(screen.getByLabelText('Play'));

    await waitFor(() => expect(mockDecode).toHaveBeenCalledWith(REMOTE));
    expect(chords.start).not.toHaveBeenCalled();
  });

  it('sounds the chords alone without minting or decoding a take', async () => {
    const chords = backdrop();
    const resolve = jest.fn().mockResolvedValue(REMOTE);
    await renderBar(chords, resolve);

    await fireEvent.press(screen.getByText('Chords'));
    await fireEvent.press(screen.getByLabelText('Play'));

    await waitFor(() => expect(chords.start).toHaveBeenCalledTimes(1));
    // Nothing to catch up to without a take, so they start from the top.
    expect(chords.start).toHaveBeenCalledWith(0);
    // A press that plays no take asks the backend for nothing.
    expect(resolve).not.toHaveBeenCalled();
    expect(mockDecode).not.toHaveBeenCalled();
    // The chords are the transport now, so the control is the one that stops
    // them.
    expect(screen.getByLabelText('Pause')).toBeTruthy();
  });

  it('hands the control back to play when the progression runs out', async () => {
    const chords = backdrop(40);
    await renderBar(chords, jest.fn().mockResolvedValue(REMOTE));

    await fireEvent.press(screen.getByText('Chords'));
    await fireEvent.press(screen.getByLabelText('Play'));
    await waitFor(() => expect(chords.start).toHaveBeenCalled());

    await waitFor(() => expect(screen.getByLabelText('Play')).toBeTruthy());
    expect(chords.stop).toHaveBeenCalled();
  });

  it('stops what is sounding when the choice changes mid-playback', async () => {
    const chords = backdrop();
    await renderBar(chords, jest.fn().mockResolvedValue(REMOTE));
    await fireEvent.press(screen.getByLabelText('Play'));
    await waitFor(() => expect(chords.start).toHaveBeenCalled());
    chords.stop.mockClear();

    await fireEvent.press(screen.getByText('Chords'));

    await waitFor(() => expect(chords.stop).toHaveBeenCalled());
    expect(screen.getByLabelText('Play')).toBeTruthy();
  });

  it('offers no choice for a melody that implied no chords', async () => {
    await renderBar(backdrop(0), jest.fn().mockResolvedValue(REMOTE));

    expect(screen.queryByText('Chords')).toBeNull();
    expect(screen.getByLabelText('Play')).toBeTruthy();
  });
});
