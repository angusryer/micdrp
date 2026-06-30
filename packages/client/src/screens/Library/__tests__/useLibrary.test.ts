/**
 * Unit tests for useLibrary (WP-LIBRARY-UI).
 *
 * The data layer (recordings) and share seam are mocked so the hook can run
 * completely off-device. The in-memory MMKV mock wired in jest.setup.js
 * backs the real `data/store` module, but we mock the higher-level
 * `data/recordings` layer here to stay isolated from MMKV initialization
 * order and to inject controlled fixtures.
 *
 * Tests exercise: initial load, pull-to-refresh, delete (which re-loads),
 * shareMidi success, and shareMidi when midiUri is absent.
 */
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

import type { RecordingMeta } from '../../../data/recordings';
import { useLibrary, type UseLibraryValue } from '../useLibrary';

// ---- mock the data seam ----
const mockListRecordings = jest.fn<RecordingMeta[], []>();
const mockDeleteRecording = jest.fn<Promise<void>, [string]>();

jest.mock('../../../data/recordings', () => ({
  listRecordings: (...args: []) => mockListRecordings(...args),
  deleteRecording: (...args: [string]) => mockDeleteRecording(...args)
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
    audioUri: 'file:///mock/rec-1.wav',
    midiUri: 'file:///mock/rec-1.mid',
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

function mount(): Mounted {
  let latest: UseLibraryValue | null = null;
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(
      React.createElement(Harness, {
        onReady: (v: UseLibraryValue) => {
          latest = v;
        }
      })
    );
  });
  return {
    api: () => latest as UseLibraryValue,
    unmount: () => tree.unmount()
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockListRecordings.mockReturnValue([]);
  mockDeleteRecording.mockResolvedValue(undefined);
  mockShareOpen.mockResolvedValue(undefined);
});

describe('useLibrary', () => {
  it('loads recordings on mount and exposes them', () => {
    const metas = [makeMeta(), makeMeta({ id: 'rec-2', title: 'Take 2' })];
    mockListRecordings.mockReturnValue(metas);

    const { api } = mount();

    expect(mockListRecordings).toHaveBeenCalledTimes(1);
    expect(api().recordings).toEqual(metas);
    expect(api().loading).toBe(false);
  });

  it('exposes an empty array when no recordings are persisted', () => {
    mockListRecordings.mockReturnValue([]);
    const { api } = mount();
    expect(api().recordings).toEqual([]);
    expect(api().loading).toBe(false);
  });

  it('refresh() reloads the list', () => {
    mockListRecordings.mockReturnValueOnce([]).mockReturnValueOnce([makeMeta()]);
    const { api } = mount();

    expect(api().recordings).toEqual([]);

    act(() => {
      api().refresh();
    });

    expect(mockListRecordings).toHaveBeenCalledTimes(2);
    expect(api().recordings).toHaveLength(1);
  });

  it('remove() calls deleteRecording and reloads', async () => {
    const metas = [makeMeta()];
    mockListRecordings
      .mockReturnValueOnce(metas)  // initial load
      .mockReturnValueOnce([]);    // after deletion

    const { api } = mount();
    expect(api().recordings).toHaveLength(1);

    await act(async () => {
      await api().remove('rec-1');
    });

    expect(mockDeleteRecording).toHaveBeenCalledWith('rec-1');
    expect(api().recordings).toHaveLength(0);
  });

  it('shareMidi() opens the share sheet with the midiUri', async () => {
    mockListRecordings.mockReturnValue([]);
    const { api } = mount();
    const meta = makeMeta();

    await act(async () => {
      await api().shareMidi(meta);
    });

    expect(mockShareOpen).toHaveBeenCalledTimes(1);
    expect(mockShareOpen).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'file:///mock/rec-1.mid',
        type: 'audio/midi',
        failOnCancel: false
      })
    );
  });

  it('shareMidi() is a no-op when midiUri is absent', async () => {
    mockListRecordings.mockReturnValue([]);
    const { api } = mount();
    const meta = makeMeta({ midiUri: undefined });

    await act(async () => {
      await api().shareMidi(meta);
    });

    expect(mockShareOpen).not.toHaveBeenCalled();
  });

  it('shareMidi() rejects when Share.open throws', async () => {
    mockListRecordings.mockReturnValue([]);
    mockShareOpen.mockRejectedValueOnce(new Error('share error'));

    const { api } = mount();
    const meta = makeMeta();

    await act(async () => {
      await expect(api().shareMidi(meta)).rejects.toThrow('Share failed');
    });
  });

  it('handles listRecordings() throwing without crashing', () => {
    mockListRecordings.mockImplementation(() => {
      throw new Error('storage error');
    });
    const { api } = mount();
    expect(api().recordings).toEqual([]);
    expect(api().loading).toBe(false);
  });
});
