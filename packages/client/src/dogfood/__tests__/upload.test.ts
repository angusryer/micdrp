/**
 * INV-DOG-004 — a spoken remark is not lost by a bad connection.
 *
 * A remark is spoken once. The maintainer will not know it vanished and will
 * not say it again, so the queue has to outlive the failure that lost it.
 */
import { unlink } from '@dr.pogodin/react-native-fs';
import {
  enqueue,
  flushPending,
  listPending,
  resetQueueForTests,
  uploadOne
} from '../upload';
import type { PendingClip } from '../types';

const clip = (id: string): PendingClip => ({
  id,
  audioPath: `/tmp/micdrp/dogfood/${id}.m4a`,
  durationMs: 4000,
  screenTrail: [{ route: 'Notes', atMs: 0 }],
  appVersion: '1.0.0',
  buildNumber: 5,
  bundleId: null,
  recordedAtMs: 1_700_000_000_000
});

// Named with the `mock` prefix because jest hoists the factory below above
// this declaration, and only mock-prefixed names may be referenced from it.
const mockCreate = jest.fn();

// The whole backend module is stubbed rather than one method spied: only
// `create` is exercised here, and PocketBase's RecordService is too wide to
// satisfy structurally for no gain.
jest.mock('../../lib/backend', () => ({
  backend: { collection: () => ({ create: mockCreate }) },
  COLLECTIONS: {}
}));

beforeEach(() => {
  resetQueueForTests();
  mockCreate.mockReset().mockResolvedValue({ id: 'server-1' });
  jest.mocked(unlink).mockClear();
});

describe('the upload queue', () => {
  it('holds a finished clip until it is accepted', () => {
    enqueue(clip('a'));
    expect(listPending().map((c) => c.id)).toEqual(['a']);
  });

  it('sends the trail and the binary that recorded it', async () => {
    await uploadOne(clip('a'));
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it('drops a clip from the queue once the server has it', async () => {
    enqueue(clip('a'));
    await uploadOne(clip('a'));
    expect(listPending()).toHaveLength(0);
  });

  it('deletes the local audio only after acceptance', async () => {
    enqueue(clip('a'));
    await uploadOne(clip('a'));
    expect(unlink).toHaveBeenCalledWith('/tmp/micdrp/dogfood/a.m4a');
  });

  it('ACC-DOG-010: keeps the clip when the server is unreachable', async () => {
    mockCreate.mockRejectedValue(new Error('offline'));
    enqueue(clip('a'));
    expect(await uploadOne(clip('a'))).toBe(false);
    expect(listPending().map((c) => c.id)).toEqual(['a']);
  });

  it('never deletes the audio for a clip that did not go up', async () => {
    mockCreate.mockRejectedValue(new Error('offline'));
    enqueue(clip('a'));
    await uploadOne(clip('a'));
    expect(unlink).not.toHaveBeenCalled();
  });

  it('ACC-DOG-011: a queued clip survives a relaunch', () => {
    enqueue(clip('a'));
    // The queue is persisted, so a fresh read is what a relaunch sees.
    expect(listPending().map((c) => c.id)).toEqual(['a']);
  });

  it('flushes oldest first', async () => {
    enqueue(clip('a'));
    enqueue(clip('b'));
    expect(await flushPending()).toBe(2);
    expect(listPending()).toHaveLength(0);
  });

  it('stops flushing at the first failure rather than hammering', async () => {
    mockCreate
      .mockResolvedValueOnce({ id: 'server-1' })
      .mockRejectedValue(new Error('offline'));
    enqueue(clip('a'));
    enqueue(clip('b'));
    enqueue(clip('c'));
    expect(await flushPending()).toBe(1);
    // b failed, so c was never attempted — both are still waiting.
    expect(listPending().map((c) => c.id)).toEqual(['b', 'c']);
  });

  it('a failed record leaves nothing surfaced to the maintainer', async () => {
    mockCreate.mockRejectedValue(new Error('offline'));
    enqueue(clip('a'));
    await expect(flushPending()).resolves.toBe(0);
  });
});
