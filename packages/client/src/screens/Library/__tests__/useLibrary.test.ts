/**
 * Unit tests for useLibrary (cloud repo + cache).
 *
 * The cloud sync seam (`data/sync`), the repo (`data/recordingsRepo`), and the
 * share seam are mocked so the hook runs completely off-device. Tests exercise:
 * cache-then-cloud load, pull-to-refresh, delete (cloud remove + re-sync),
 * shareMidi success, shareMidi when midiUri is absent, and offline fallback.
 */
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

import type { RecordingMeta } from '../../../data/recordings';
import { useLibrary, type UseLibraryValue } from '../useLibrary';

// ---- mock the cloud sync + cache seam ----
const mockSyncRecordings = jest.fn<Promise<RecordingMeta[]>, []>();
const mockCachedRecordings = jest.fn<RecordingMeta[], []>();

jest.mock('../../../data/sync', () => ({
  syncRecordings: (...args: []) => mockSyncRecordings(...args),
  cachedRecordings: (...args: []) => mockCachedRecordings(...args)
}));

// ---- mock the cloud repo (delete) ----
const mockRepoRemove = jest.fn<Promise<void>, [string]>();
jest.mock('../../../data/recordingsRepo', () => ({
  recordingsRepo: {
    remove: (...args: [string]) => mockRepoRemove(...args)
  }
}));

// ---- mock react-native-share (already mocked globally but explicit here) ----
const mockShareOpen = jest.fn<Promise<void>, [object]>();
jest.mock(
  'react-native-share',
  () => ({ default: { open: (...args: [object]) => mockShareOpen(...args) } }),
  { virtual: true }
);

// ---- fixture ----
function makeMeta(over: Partial<RecordingMeta> = {}): RecordingMeta {
  return {
    id: 'rec-1',
    title: 'Take 1',
    createdAtMs: 1_700_000_000_000,
    durationMs: 3000,
    sampleRateHz: 44100,
    audioUri: 'https://signed/rec-1.m4a',
    midiUri: 'https://signed/rec-1.mid',
    score: 88,
    noteCount: 5,
    ...over
  };
}

// ---- harness ----
function Harness({ onReady }: { onReady: (v: UseLibraryValue) => void }): null {
  onReady(useLibrary());
  return null;
}

interface Mounted {
  api: () => UseLibraryValue;
  unmount: () => void;
}

async function mount(): Promise<Mounted> {
  let latest: UseLibraryValue | null = null;
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = TestRenderer.create(
      React.createElement(Harness, {
        onReady: (v: UseLibraryValue) => {
          latest = v;
        }
      })
    );
  });
  // Let the mount sync effect settle.
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  return {
    api: () => latest as UseLibraryValue,
    unmount: () => tree.unmount()
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCachedRecordings.mockReturnValue([]);
  mockSyncRecordings.mockResolvedValue([]);
  mockRepoRemove.mockResolvedValue(undefined);
  mockShareOpen.mockResolvedValue(undefined);
});

describe('useLibrary', () => {
  it('paints the cache, then cloud-syncs on mount', async () => {
    const cached = [makeMeta({ id: 'cached' })];
    const cloud = [makeMeta(), makeMeta({ id: 'rec-2', title: 'Take 2' })];
    mockCachedRecordings.mockReturnValue(cached);
    mockSyncRecordings.mockResolvedValue(cloud);

    const { api } = await mount();

    expect(mockSyncRecordings).toHaveBeenCalledTimes(1);
    expect(api().recordings).toEqual(cloud);
    expect(api().loading).toBe(false);
  });

  it('exposes an empty array when nothing is stored', async () => {
    const { api } = await mount();
    expect(api().recordings).toEqual([]);
    expect(api().loading).toBe(false);
  });

  it('refresh() re-pulls from the cloud', async () => {
    mockSyncRecordings
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([makeMeta()]);
    const { api } = await mount();

    expect(api().recordings).toEqual([]);

    await act(async () => {
      await api().refresh();
    });

    expect(mockSyncRecordings).toHaveBeenCalledTimes(2);
    expect(api().recordings).toHaveLength(1);
  });

  it('remove() deletes in the cloud and re-syncs', async () => {
    mockSyncRecordings
      .mockResolvedValueOnce([makeMeta()]) // initial sync
      .mockResolvedValueOnce([]); // after deletion

    const { api } = await mount();
    expect(api().recordings).toHaveLength(1);

    await act(async () => {
      await api().remove('rec-1');
    });

    expect(mockRepoRemove).toHaveBeenCalledWith('rec-1');
    expect(api().recordings).toHaveLength(0);
  });

  it('shareMidi() opens the share sheet with the midiUri', async () => {
    const { api } = await mount();
    const meta = makeMeta();

    await act(async () => {
      await api().shareMidi(meta);
    });

    expect(mockShareOpen).toHaveBeenCalledTimes(1);
    expect(mockShareOpen).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://signed/rec-1.mid',
        type: 'audio/midi',
        failOnCancel: false
      })
    );
  });

  it('shareMidi() is a no-op when midiUri is absent', async () => {
    const { api } = await mount();
    const meta = makeMeta({ midiUri: undefined });

    await act(async () => {
      await api().shareMidi(meta);
    });

    expect(mockShareOpen).not.toHaveBeenCalled();
  });

  it('shareMidi() rejects when Share.open throws', async () => {
    mockShareOpen.mockRejectedValueOnce(new Error('share error'));
    const { api } = await mount();
    const meta = makeMeta();

    await act(async () => {
      await expect(api().shareMidi(meta)).rejects.toThrow('Share failed');
    });
  });

  it('falls back to the cache when the cloud sync fails', async () => {
    const cached = [makeMeta({ id: 'offline' })];
    mockCachedRecordings.mockReturnValue(cached);
    mockSyncRecordings.mockRejectedValueOnce(new Error('offline'));

    const { api } = await mount();

    expect(api().recordings).toEqual(cached);
    expect(api().loading).toBe(false);
  });
});
