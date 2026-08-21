/**
 * NoteCard play control — INT-NOTES-010 / INV-NOTES-015 / ACC-NOTES-027 /
 * ACC-NOTES-028 / ACC-NOTES-029.
 *
 * One press has to reach the decoder, and the button pressed has to become the
 * running take's Stop — not a Close for a player nobody opened. The clock above
 * that button is NoteCardTime.test.tsx.
 */
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

// Required from inside the factory, not imported above it: jest.mock is
// hoisted, so anything it names has to be resolved at call time.
jest.mock('react-native-audio-api', () =>
  jest
    .requireActual<typeof import('../__fixtures__/noteCardMocks')>(
      '../__fixtures__/noteCardMocks'
    )
    .audioApiMock()
);
jest.mock('../../../data/notesRepo', () =>
  jest
    .requireActual<typeof import('../__fixtures__/noteCardMocks')>(
      '../__fixtures__/noteCardMocks'
    )
    .notesRepoMock()
);

import {
  REMOTE,
  mockAudioUrlFor,
  mockDecode,
  mockStart,
  resetNoteCardMocks
} from '../__fixtures__/noteCardMocks';
import { noteWith, renderNoteCard } from '../__fixtures__/renderNoteCard';

describe('NoteCard play control', () => {
  beforeEach(resetNoteCardMocks);

  it('starts playback on the first press, with no second press', async () => {
    await renderNoteCard(noteWith('notes/n1/audio.wav'));

    await fireEvent.press(screen.getByLabelText('Play note'));

    // One press: the URL is minted and the decoded buffer is started.
    await waitFor(() => expect(mockStart).toHaveBeenCalled());
    expect(mockAudioUrlFor).toHaveBeenCalledWith('n1', 'notes/n1/audio.wav');
    expect(mockDecode).toHaveBeenCalledWith(REMOTE);
  });

  it('does not resolve or decode anything before the press', async () => {
    await renderNoteCard(noteWith('notes/n1/audio.wav'));

    expect(screen.getByLabelText('Play note')).toBeTruthy();
    // INV-NOTES-014: a token minted at render is dead by the time it is used.
    expect(mockAudioUrlFor).not.toHaveBeenCalled();
    expect(mockDecode).not.toHaveBeenCalled();
  });

  it('becomes the take’s stop control, never a close control', async () => {
    const { getByLabelText, queryByLabelText, queryByText } =
      await renderNoteCard(noteWith('notes/n1/audio.wav'));

    await fireEvent.press(getByLabelText('Play note'));

    // The pressed control transitions in place: Play → Stop, one control.
    await waitFor(() => expect(getByLabelText('Stop note')).toBeTruthy());
    expect(queryByLabelText('Play note')).toBeNull();
    expect(queryByLabelText('Close player')).toBeNull();
    expect(queryByText('Close')).toBeNull();

    // And back, so stopping is what the second press means.
    await fireEvent.press(getByLabelText('Stop note'));
    await waitFor(() => expect(getByLabelText('Play note')).toBeTruthy());
  });

  it('offers no play control when the note has no stored audio', async () => {
    await renderNoteCard(noteWith(null));

    expect(screen.getByLabelText('Delete note')).toBeTruthy();
    expect(screen.queryByLabelText('Play note')).toBeNull();
  });
});
