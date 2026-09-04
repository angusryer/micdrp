/**
 * Handing a take over: what travels with it, and what it costs to change
 * your mind. INV-DOG-031 through INV-DOG-037.
 */
import { shareTake } from '../samples';
import { flushShares } from '../sampleUpload';
import { withdrawTake } from '../sampleRecord';
import {
  pendingShare,
  pendingShares,
  resetSharesForTests,
  sharedTake,
  subscribeToShares
} from '../shares';

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

  it('ACC-DOG-040: sharing an unchanged reading twice makes one sample', async () => {
    await shareTake(take);
    await flushShares();
    await shareTake(take);
    await flushShares();
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it('ACC-DOG-047: a reading that changed goes beside the one before it', async () => {
    // The corpus exists to compare readings of one recording as a detector
    // changes. Refusing the second reading, or replacing the first with it,
    // both destroy exactly the comparison it was built for.
    await shareTake(take);
    await flushShares();
    mockCreate.mockResolvedValue({ id: 'sample-2' });
    const reread = { melody: [...heard, ...corrected], noteCount: 2, analysisVersion: 3 };
    expect(await shareTake({ ...take, take: reread })).toBeNull();
    await flushShares();
    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(sharedTake('note-1')?.sampleIds).toEqual(['sample-1', 'sample-2']);
  });

  it('replaces a queued share when the take is read again before it goes', async () => {
    // Neither reading has left the device, so there is nothing to compare
    // the older one against — the newer one is simply the one worth sending.
    mockCreate.mockRejectedValue(new Error('offline'));
    await shareTake(take);
    const reread = { melody: [...heard, ...corrected], noteCount: 2, analysisVersion: 3 };
    await shareTake({ ...take, take: reread });
    expect(pendingShares()).toHaveLength(1);
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

describe('following the queue', () => {
  it('ACC-DOG-046: says the share landed without the sheet being reopened', async () => {
    // The upload finishes whenever the network lets it, and React is told
    // nothing by that on its own — which is how the control went on saying
    // "Sending…" after the take had arrived.
    const told: string[] = [];
    const stop = subscribeToShares(() => told.push(sharedTake('note-1') ? 'shared' : 'pending'));
    await shareTake(take);
    await flushShares();
    stop();
    expect(told).toContain('shared');
    expect(sharedTake('note-1')).not.toBeNull();
  });

  it('stops telling a listener that has gone away', async () => {
    let count = 0;
    subscribeToShares(() => (count += 1))();
    await shareTake(take);
    await flushShares();
    expect(count).toBe(0);
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

  it('ACC-DOG-048: takes every reading of that take with it', async () => {
    // One control says whether the take is shared, so it cannot leave an
    // earlier reading on the server after saying it is not.
    await shareTake(take);
    await flushShares();
    mockCreate.mockResolvedValue({ id: 'sample-2' });
    await shareTake({
      ...take,
      take: { melody: [...heard, ...corrected], noteCount: 2, analysisVersion: 3 }
    });
    await flushShares();
    expect(await withdrawTake('note-1')).toBeNull();
    expect(mockDelete.mock.calls.map((c) => c[0])).toEqual(['sample-1', 'sample-2']);
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
    expect(sharedTake('note-1')?.sampleIds).toEqual(['sample-1']);
  });

  it('treats a record already gone as withdrawn', async () => {
    await shareTake(take);
    await flushShares();
    mockDelete.mockRejectedValue({ status: 404 });
    expect(await withdrawTake('note-1')).toBeNull();
    expect(sharedTake('note-1')).toBeNull();
  });
});
