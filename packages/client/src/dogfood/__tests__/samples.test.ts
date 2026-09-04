/**
 * Handing a take over: what travels with it, and what it costs to change
 * your mind. INV-DOG-031 through INV-DOG-037.
 */
import { shareTake } from '../samples';
import { flushShares } from '../sampleUpload';
import { withdrawTake } from '../sampleRecord';
import { pendingShare, resetSharesForTests, sharedTake } from '../shares';

const mockCreate = jest.fn();
const mockDelete = jest.fn();
const mockFirst = jest.fn();

jest.mock('../../lib/backend', () => ({
  backend: {
    collection: () => ({
      create: mockCreate,
      delete: mockDelete,
      getFirstListItem: mockFirst
    })
  },
  COLLECTIONS: {}
}));

jest.mock('../../data/currentUser', () => ({
  requireUserId: jest.fn(() => Promise.resolve('user-1'))
}));

// A capture holding the microphone is the one thing that stops the queue.
const mockBusy = jest.fn(() => false);
jest.mock('../../app/activity', () => ({
  isBusy: () => mockBusy(),
  subscribeToBusy: () => () => undefined
}));

jest.mock('../config', () => ({
  readClipOrigin: () => ({ appVersion: '1.0.0', buildNumber: 14 }),
  TICK_MS: 250
}));
jest.mock('../origin', () => ({ runningBundleId: () => null }));

const heard = [{ midi: 60, startMs: 0, endMs: 500, cents: 4 }];
const corrected = [{ midi: 62, startMs: 0, endMs: 500, cents: 4 }];

const take = {
  noteId: 'note-1',
  title: 'Chorus idea',
  durationMs: 8000,
  sampleRateHz: 44100,
  take: { melody: heard, noteCount: 1, analysisVersion: 3 },
  resolveAudio: () => Promise.resolve('file:///takes/note-1.wav')
};

/** What went into the multipart body, by field name. */
const sentField = (name: string): unknown => {
  const form = mockCreate.mock.calls[0][0] as { get(key: string): unknown };
  return form.get(name);
};

beforeEach(() => {
  resetSharesForTests();
  mockCreate.mockReset().mockResolvedValue({ id: 'sample-1' });
  mockDelete.mockReset().mockResolvedValue(undefined);
  mockFirst.mockReset();
  mockBusy.mockReturnValue(false);
});

describe('sharing a take', () => {
  it('ACC-DOG-036: sends the reading beside the audio', async () => {
    expect(await shareTake(take)).toBeNull();
    await flushShares();
    const reading = JSON.parse(String(sentField('reading')));
    expect(reading.melody).toEqual(heard);
    expect(reading.analysisVersion).toBe(3);
  });

  it('carries the corrections a person made, which say what it should be', async () => {
    await shareTake({ ...take, corrected });
    await flushShares();
    expect(JSON.parse(String(sentField('reading'))).corrected).toEqual(corrected);
  });

  it('does not call an uncorrected melody a correction', async () => {
    await shareTake({ ...take, corrected: heard });
    await flushShares();
    expect(JSON.parse(String(sentField('reading'))).corrected).toBeUndefined();
  });

  it('names the owner, without which the server refuses the record', async () => {
    await shareTake(take);
    await flushShares();
    expect(sentField('user')).toBe('user-1');
  });

  it('ACC-DOG-040: sharing twice makes one sample', async () => {
    await shareTake(take);
    await flushShares();
    await shareTake(take);
    await flushShares();
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it('refuses a take with no recording anywhere', async () => {
    const problem = await shareTake({
      ...take,
      resolveAudio: () => Promise.resolve(null)
    });
    expect(problem).toMatch(/no recording/);
    expect(pendingShare('note-1')).toBeNull();
  });

  it('ACC-DOG-039: a share the server refused stays queued', async () => {
    mockCreate.mockRejectedValue(new Error('offline'));
    await shareTake(take);
    expect(await flushShares()).toBe(0);
    expect(mockCreate).toHaveBeenCalled();
    // The queue is persisted, so a fresh read is what a relaunch sees.
    expect(pendingShare('note-1')?.noteId).toBe('note-1');
    expect(sharedTake('note-1')).toBeNull();
  });

  it('ACC-DOG-043: nothing goes up while the microphone is held', async () => {
    mockBusy.mockReturnValue(true);
    await shareTake(take);
    expect(await flushShares()).toBe(0);
    expect(mockCreate).not.toHaveBeenCalled();
    expect(pendingShare('note-1')).not.toBeNull();
  });
});

describe('taking it back', () => {
  it('ACC-DOG-041: deletes the record and forgets it', async () => {
    await shareTake(take);
    await flushShares();
    expect(await withdrawTake('note-1')).toBeNull();
    expect(mockDelete).toHaveBeenCalledWith('sample-1');
    expect(sharedTake('note-1')).toBeNull();
  });

  it('ACC-DOG-042: a share that never left is dropped before it can go', async () => {
    mockCreate.mockRejectedValue(new Error('offline'));
    await shareTake(take);
    await withdrawTake('note-1');
    // From here on the server would accept it. Nothing must be sent.
    mockCreate.mockClear().mockResolvedValue({ id: 'sample-1' });
    expect(await flushShares()).toBe(0);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('keeps claiming the take is shared when the delete fails', async () => {
    // Forgetting locally would leave a recording on the server that the
    // control no longer offers any way to remove.
    await shareTake(take);
    await flushShares();
    mockDelete.mockRejectedValue(new Error('offline'));
    expect(await withdrawTake('note-1')).toMatch(/offline/);
    expect(sharedTake('note-1')?.sampleId).toBe('sample-1');
  });

  it('treats a record already gone as withdrawn', async () => {
    await shareTake(take);
    await flushShares();
    mockDelete.mockRejectedValue({ status: 404 });
    expect(await withdrawTake('note-1')).toBeNull();
    expect(sharedTake('note-1')).toBeNull();
  });
});
