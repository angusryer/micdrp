/**
 * The clock above a card's play button — INV-NOTES-016 / ACC-NOTES-030 /
 * ACC-NOTES-031.
 *
 * One line, in the space the close control vacated: the take's length before
 * the press, the running position against that length while it plays, and the
 * length alone again once it stops.
 */
import { fireEvent, waitFor, within } from '@testing-library/react-native';

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

import { resetNoteCardMocks } from '../__fixtures__/noteCardMocks';
import { noteWith, renderNoteCard } from '../__fixtures__/renderNoteCard';

describe('NoteCard take clock', () => {
  beforeEach(resetNoteCardMocks);

  it('shows one clock, reading the take length, above the play button', async () => {
    const { getAllByText, getAllByTestId, getByTestId } = await renderNoteCard(
      noteWith('notes/n1/audio.caf')
    );

    // One "0:12" on the card — the fact line at the top no longer carries it.
    expect(getAllByText('0:12')).toHaveLength(1);
    expect(getAllByTestId('note-card-time')).toHaveLength(1);

    // And it sits in the block that holds Play, where Close used to be.
    const actions = within(getByTestId('note-card-actions'));
    expect(actions.getByTestId('note-card-time')).toHaveTextContent(/^0:12$/);
    expect(actions.getByLabelText('Play note')).toBeTruthy();
  });

  it('counts the position against the length while the take plays', async () => {
    const { getAllByTestId, getByTestId, getByLabelText } =
      await renderNoteCard(noteWith('notes/n1/audio.caf'));

    await fireEvent.press(getByLabelText('Play note'));
    await waitFor(() =>
      expect(getByTestId('note-card-time')).toHaveTextContent('0:00 / 0:12')
    );
    expect(getAllByTestId('note-card-time')).toHaveLength(1);

    // Stopping puts the length back, alone.
    await fireEvent.press(getByLabelText('Stop note'));
    await waitFor(() =>
      expect(getByTestId('note-card-time')).toHaveTextContent(/^0:12$/)
    );
  });

  it('is the length alone on a card with no stored audio', async () => {
    const { getByTestId } = await renderNoteCard(noteWith(null));

    // Nothing can play, so nothing ever counts against it.
    expect(getByTestId('note-card-time')).toHaveTextContent(/^0:12$/);
  });
});
