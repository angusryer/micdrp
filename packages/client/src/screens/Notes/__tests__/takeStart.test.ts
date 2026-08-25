/**
 * INV-NOTES-127 — a take is never booked against a clock that is not moving.
 *
 * The take is started at a moment chosen in advance so everything lined up
 * against it can be exact rather than estimated (INV-NOTES-126). That only
 * holds for a clock that advances. A context made while a recording session is
 * live can arrive suspended, and a booking against a stopped clock is a
 * booking for a time that never comes — the sound simply never arrives, which
 * is what silenced the whole backing while recording a bass line.
 *
 * It went unseen because the context double had no clock at all, so every test
 * took the "start now" path while the device took the other one.
 */
import { act, renderHook, waitFor } from '@testing-library/react-native';

// Required lazily inside the factory: a jest.mock factory is hoisted above
// every import and may not close over one.
jest.mock('../audioApi', () =>
  jest
    .requireActual<typeof import('../__fixtures__/noteCardMocks')>(
      '../__fixtures__/noteCardMocks'
    )
    .audioApiMock()
);

import {
  audioContext,
  mockResume,
  mockStart,
  resetNoteCardMocks
} from '../__fixtures__/noteCardMocks';
import { usePlayback } from '../usePlayback';

const RESOLVED = 'https://example.test/take.wav';

const start = async () => {
  const { result } = await renderHook(() =>
    usePlayback({ resolveAudioUri: () => Promise.resolve(RESOLVED) })
  );
  await act(async () => {
    await result.current.play();
  });
  return result;
};

beforeEach(() => resetNoteCardMocks());

describe('starting the take', () => {
  it('books ahead of a clock that is running', async () => {
    audioContext.state = 'running';
    audioContext.currentTime = 12.5;

    await start();

    await waitFor(() => expect(mockStart).toHaveBeenCalled());
    // Ahead of the clock, not at it: booking for now is booking for a moment
    // already passing.
    expect(mockStart.mock.calls[0][0]).toBeGreaterThan(12.5);
  });

  it('starts a suspended context before deciding anything', async () => {
    audioContext.state = 'suspended';
    audioContext.currentTime = 0;

    await start();

    expect(mockResume).toHaveBeenCalled();
  });

  it('books ahead once a suspended context has started', async () => {
    // Resumed, the clock runs, and booking ahead is right again.
    audioContext.state = 'suspended';
    audioContext.currentTime = 0;

    await start();

    await waitFor(() => expect(mockStart).toHaveBeenCalled());
    expect(mockStart.mock.calls[0][0]).toBeGreaterThan(0);
  });

  it('plays at once where the context will not start at all', async () => {
    // A live capture holds the session, the context stays suspended, and a
    // booking against its stopped clock is a booking for a time that never
    // comes. It starts at once instead.
    audioContext.state = 'suspended';
    audioContext.currentTime = 0;
    audioContext.willNotResume = true;

    await start();

    await waitFor(() => expect(mockStart).toHaveBeenCalled());
    expect(mockStart.mock.calls[0][0]).toBe(0);
  });

  it('does not call a refused start a failure', async () => {
    // The regression this replaced: a session held by a capture refuses to
    // hand the context a clock, and letting that refusal escape turned
    // silence into "Playback failed" — a worse answer to the same situation
    // (INV-NOTES-128).
    audioContext.state = 'suspended';
    audioContext.currentTime = 0;
    audioContext.willNotResume = true;

    const result = await start();

    expect(result.current.state).not.toBe('error');
    await waitFor(() => expect(mockStart).toHaveBeenCalled());
  });

  it('plays at once where there is no clock to book against', async () => {
    audioContext.currentTime = Number.NaN;

    await start();

    await waitFor(() => expect(mockStart).toHaveBeenCalled());
    expect(mockStart.mock.calls[0][0]).toBe(0);
  });

  it('always starts the take somewhere, whatever the clock says', async () => {
    // The property that matters more than which path was taken: pressing play
    // makes a sound.
    for (const state of ['running', 'suspended', 'interrupted']) {
      resetNoteCardMocks();
      audioContext.state = state;
      await start();
      await waitFor(() => expect(mockStart).toHaveBeenCalled());
    }
  });
});
