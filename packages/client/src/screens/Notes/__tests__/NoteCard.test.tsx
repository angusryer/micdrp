/**
 * NoteCard play control — INT-NOTES-010 / ACC-NOTES-027 / ACC-NOTES-028.
 *
 * The card's Play button used to only toggle the playback bar into view; the
 * singer then had to press the bar's own Play to hear anything. One press now
 * has to reach the decoder.
 *
 * Render pattern: `await waitFor(() => render(...))` before touching `screen`,
 * matching CaptureSection.test.tsx — a bare render leaves `screen` unbound here.
 */
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within
} from '@testing-library/react-native';
import React from 'react';

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

// Called through an arrow, not passed directly: the factory is hoisted above
// this const, so a direct reference captures undefined.
const mockAudioUrlFor = jest.fn();
jest.mock('../../../data/notesRepo', () => ({
  notesRepo: {
    audioUrlFor: (id: string, path: string | null): Promise<string | null> =>
      mockAudioUrlFor(id, path) as Promise<string | null>
  }
}));

import { I18nProvider } from '../../../i18n';
import { ThemeProvider } from '../../../theme';
import type { NoteMeta } from '../../../data/notesCache';
import { NoteCard } from '../NoteCard';

const REMOTE =
  'https://micdrp-backend.fly.dev/api/files/notes/abc123/audio.caf?token=t0ken';

const noteWith = (audioPath: string | null): NoteMeta =>
  ({
    id: 'n1',
    title: 'Hook idea',
    createdAtMs: 1_700_000_000_000,
    durationMs: 12_000,
    melody: [],
    audioPath
  }) as unknown as NoteMeta;

const renderCard = (note: NoteMeta) =>
  waitFor(() =>
    render(
      <I18nProvider>
        <ThemeProvider>
          <NoteCard note={note} onOpen={jest.fn()} onDelete={jest.fn()} />
        </ThemeProvider>
      </I18nProvider>
    )
  );

describe('NoteCard play control', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDecode.mockResolvedValue({ duration: 12 });
    mockAudioUrlFor.mockResolvedValue(REMOTE);
  });

  it('starts playback on the first press, with no second press', async () => {
    await renderCard(noteWith('notes/n1/audio.caf'));

    await fireEvent.press(screen.getByLabelText('Play note'));

    // One press: the URL is minted and the decoded buffer is started.
    await waitFor(() => expect(mockStart).toHaveBeenCalled());
    expect(mockAudioUrlFor).toHaveBeenCalledWith('n1', 'notes/n1/audio.caf');
    expect(mockDecode).toHaveBeenCalledWith(REMOTE);
  });

  it('does not resolve or decode anything before the press', async () => {
    await renderCard(noteWith('notes/n1/audio.caf'));

    expect(screen.getByLabelText('Play note')).toBeTruthy();
    // INV-NOTES-014: a token minted at render is dead by the time it is used.
    expect(mockAudioUrlFor).not.toHaveBeenCalled();
    expect(mockDecode).not.toHaveBeenCalled();
  });

  it('shows the take length once, in the block that holds the play button', async () => {
    const { getAllByText, getByTestId } = await renderCard(
      noteWith('notes/n1/audio.caf')
    );

    // One "0:12" on the card — the fact line at the top no longer carries it.
    expect(getAllByText('0:12')).toHaveLength(1);

    const actions = within(getByTestId('note-card-actions'));
    expect(actions.getByText('0:12')).toBeTruthy();
    expect(actions.getByLabelText('Play note')).toBeTruthy();
  });

  it('does not repeat the length once the playback bar is open', async () => {
    const { getAllByText, getByLabelText } = await renderCard(
      noteWith('notes/n1/audio.caf')
    );

    await fireEvent.press(getByLabelText('Play note'));

    await waitFor(() => expect(mockStart).toHaveBeenCalled());
    expect(getAllByText('0:12')).toHaveLength(1);
  });

  it('offers no play control when the note has no stored audio', async () => {
    await renderCard(noteWith(null));

    expect(screen.getByLabelText('Delete note')).toBeTruthy();
    expect(screen.queryByLabelText('Play note')).toBeNull();
  });
});
