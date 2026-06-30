/**
 * Read-path tests for the recordings index (the offline cache) against the
 * in-memory MMKV mock (jest.setup.js). The cache is written only by `sync.ts`;
 * here we seed the MMKV index record directly and assert `listRecordings`
 * read/sort/corruption behaviour.
 */
import { RECORDINGS_INDEX_KEY, listRecordings, type RecordingMeta } from '../recordings';
import { store } from '../store';

function meta(over: Partial<RecordingMeta> = {}): RecordingMeta {
  return {
    id: 'rec-1',
    title: 'Take 1',
    createdAtMs: 1_000,
    durationMs: 5_000,
    sampleRateHz: 44100,
    audioUri: 'file:///tmp/micdrp/recordings/rec-1.wav',
    ...over
  };
}

/** Seed the MMKV cache the way `sync.ts` does: one whole-index write. */
function seed(...metas: RecordingMeta[]): void {
  const index: Record<string, RecordingMeta> = {};
  for (const m of metas) {
    index[m.id] = m;
  }
  store.setString(RECORDINGS_INDEX_KEY, JSON.stringify(index));
}

beforeEach(() => {
  store.clearAll();
  jest.clearAllMocks();
});

describe('recordings cache read path', () => {
  it('returns an empty list when nothing is cached', () => {
    expect(listRecordings()).toEqual([]);
  });

  it('reads back the cached recordings', () => {
    const m = meta();
    seed(m);
    expect(listRecordings()).toEqual([m]);
  });

  it('lists recordings newest first by createdAtMs', () => {
    seed(
      meta({ id: 'a', createdAtMs: 100 }),
      meta({ id: 'b', createdAtMs: 300 }),
      meta({ id: 'c', createdAtMs: 200 })
    );
    expect(listRecordings().map((r) => r.id)).toEqual(['b', 'c', 'a']);
  });

  it('preserves optional fields (midiUri/score/noteCount)', () => {
    seed(meta({ midiUri: 'file:///tmp/micdrp/recordings/rec-1.mid', score: 73, noteCount: 9 }));
    const got = listRecordings()[0];
    expect(got?.midiUri).toBe('file:///tmp/micdrp/recordings/rec-1.mid');
    expect(got?.score).toBe(73);
    expect(got?.noteCount).toBe(9);
  });

  it('survives a corrupt index payload by treating it as empty', () => {
    store.setString(RECORDINGS_INDEX_KEY, '{not json');
    expect(listRecordings()).toEqual([]);
  });
});
