/**
 * INV-NOTES-139 — a take is kept on the device before it is sent anywhere.
 *
 * A take used to exist only if the round trip succeeded: the audio was
 * written to disk, the create was posted, and a failure left the recording
 * somewhere the app would never show again. The network is the least reliable
 * part of the phone and it was load-bearing.
 */
const mockStore = new Map<string, unknown>();

// The whole of what the store offers, not the two calls this file happened
// to need first: a double that silently lacks a method turns a real call
// into a TypeError swallowed by whatever catch it lands in, which is how
// this one presented — a sync that reported nothing sent.
jest.mock('../store', () => ({
  setJSON: (key: string, value: unknown) => mockStore.set(key, value),
  getJSON: (key: string) => mockStore.get(key),
  getString: (key: string) => mockStore.get(key) as string | undefined,
  setString: (key: string, value: string) => mockStore.set(key, value),
  remove: (key: string) => void mockStore.delete(key),
  has: (key: string) => mockStore.has(key),
  getAllKeys: () => [...mockStore.keys()],
  clearAll: () => mockStore.clear()
}));

jest.mock('../notesCache', () => ({
  NOTES_INDEX_KEY: 'notes.index',
  listNotes: () =>
    Object.values(
      (mockStore.get('notes.index') ?? {}) as Record<string, { createdAtMs: number }>
    ).sort((a, b) => b.createdAtMs - a.createdAtMs)
}));

const mockCreate = jest.fn();
jest.mock('../notesRepo', () => ({
  notesRepo: { create: (...args: unknown[]) => mockCreate(...args) }
}));

jest.mock('../notesSync', () => ({
  dtoToMeta: (dto: { id: string }) => ({ ...dto, createdAtMs: 1 })
}));

import { keepLocally, pendingNotes } from '../notesLocal';
import { flushPending, pendingCount } from '../notesQueue';

const input = {
  title: 'A tune',
  durationMs: 1000,
  sampleRateHz: 48000,
  melody: [],
  noteCount: 0
};

beforeEach(() => {
  mockStore.clear();
  jest.clearAllMocks();
});

describe('keeping a take on the device', () => {
  it('is there to be listed the moment it is kept', () => {
    keepLocally(input, 'file:///take.wav', 'local-1');
    expect(pendingNotes()).toHaveLength(1);
    expect(pendingCount()).toBe(1);
  });

  it('records where the audio is, because that is the only copy', () => {
    const note = keepLocally(input, 'file:///take.wav', 'local-1');
    expect(note.localAudioUri).toBe('file:///take.wav');
    // Nothing on the server yet: claiming otherwise would have playback
    // asking for a file that does not exist.
    expect(note.audioPath).toBeNull();
  });
});

describe('sending what is waiting', () => {
  it('uploads it and leaves one note, not two', async () => {
    keepLocally(input, 'file:///take.wav', 'local-1');
    mockCreate.mockResolvedValue({ id: 'server-1' });

    expect(await flushPending()).toBe(1);
    expect(pendingCount()).toBe(0);
    const index = mockStore.get('notes.index') as Record<string, unknown>;
    expect(Object.keys(index)).toEqual(['server-1']);
  });

  it('moves the take\u2019s reading settings to the id the server gave it', async () => {
    // The settings are keyed by note id and the id changes on upload, so
    // without this a take loses what it was read with at exactly the moment
    // it becomes the copy everything else reads (INV-NOTES-216).
    keepLocally(input, 'file:///take.wav', 'local-1');
    mockStore.set('notes.local-1.readWith', { 'segment.pitchHoldMs': 123 });
    mockCreate.mockResolvedValue({ id: 'server-1' });

    await flushPending();
    expect(mockStore.get('notes.server-1.readWith')).toEqual({
      'segment.pitchHoldMs': 123
    });
    expect(mockStore.has('notes.local-1.readWith')).toBe(false);
  });

  it('keeps the local audio after the upload, as the faster thing to read', async () => {
    keepLocally(input, 'file:///take.wav', 'local-1');
    mockCreate.mockResolvedValue({ id: 'server-1' });
    await flushPending();

    const index = mockStore.get('notes.index') as Record<
      string,
      { localAudioUri?: string }
    >;
    expect(index['server-1'].localAudioUri).toBe('file:///take.wav');
  });

  it('leaves it waiting when it cannot be sent', async () => {
    // No attempt counter and nothing discarded: the note is on the device,
    // and that is where the singer will look for it.
    keepLocally(input, 'file:///take.wav', 'local-1');
    mockCreate.mockRejectedValue(new Error('offline'));

    expect(await flushPending()).toBe(0);
    expect(pendingCount()).toBe(1);
  });

  it('stops at the first failure rather than working through the rest', async () => {
    // The usual reason one upload fails is that the network or the session is
    // gone, and the next nine will fail the same way a little more slowly.
    keepLocally(input, 'file:///a.wav', 'local-1');
    keepLocally(input, 'file:///b.wav', 'local-2');
    mockCreate.mockRejectedValue(new Error('offline'));

    await flushPending();
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it('sends the oldest first', async () => {
    const older = { ...input, title: 'older' };
    keepLocally(older, 'file:///a.wav', 'local-1');
    keepLocally({ ...input, title: 'newer' }, 'file:///b.wav', 'local-2');
    mockCreate.mockImplementation((_i: unknown) =>
      Promise.resolve({ id: `server-${mockCreate.mock.calls.length}` })
    );

    await flushPending();
    const [first] = mockCreate.mock.calls[0] as [{ title: string }];
    expect(first.title).toBe('older');
  });

  it('does not run twice at once', async () => {
    keepLocally(input, 'file:///take.wav', 'local-1');
    mockCreate.mockResolvedValue({ id: 'server-1' });

    const [a, b] = await Promise.all([flushPending(), flushPending()]);
    expect(a + b).toBe(2);
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });
});
