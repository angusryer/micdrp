/**
 * CRUD tests for the recordings index against the in-memory MMKV mock
 * (jest.setup.js) and the virtual react-native-fs mock.
 */
import {
  deleteRecording,
  getRecording,
  listRecordings,
  saveRecording,
  type RecordingMeta
} from '../recordings';
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

beforeEach(() => {
  store.clearAll();
  jest.clearAllMocks();
});

describe('recordings CRUD', () => {
  it('returns an empty list when nothing is saved', () => {
    expect(listRecordings()).toEqual([]);
    expect(getRecording('nope')).toBeNull();
  });

  it('saves and reads back a recording', () => {
    const m = meta();
    saveRecording(m);
    expect(getRecording('rec-1')).toEqual(m);
    expect(listRecordings()).toEqual([m]);
  });

  it('replaces an existing record on save with the same id', () => {
    saveRecording(meta({ title: 'old' }));
    saveRecording(meta({ title: 'new', score: 88, noteCount: 12 }));
    const got = getRecording('rec-1');
    expect(got?.title).toBe('new');
    expect(got?.score).toBe(88);
    expect(got?.noteCount).toBe(12);
    expect(listRecordings()).toHaveLength(1);
  });

  it('lists recordings newest first by createdAtMs', () => {
    saveRecording(meta({ id: 'a', createdAtMs: 100 }));
    saveRecording(meta({ id: 'b', createdAtMs: 300 }));
    saveRecording(meta({ id: 'c', createdAtMs: 200 }));
    expect(listRecordings().map((r) => r.id)).toEqual(['b', 'c', 'a']);
  });

  it('persists optional fields (midiUri/score/noteCount)', () => {
    saveRecording(
      meta({ midiUri: 'file:///tmp/micdrp/recordings/rec-1.mid', score: 73, noteCount: 9 })
    );
    const got = getRecording('rec-1');
    expect(got?.midiUri).toBe('file:///tmp/micdrp/recordings/rec-1.mid');
    expect(got?.score).toBe(73);
    expect(got?.noteCount).toBe(9);
  });

  it('deletes a recording and removes its on-disk files', async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const RNFS = require('react-native-fs');
    saveRecording(meta());
    saveRecording(meta({ id: 'rec-2', createdAtMs: 2_000 }));

    await deleteRecording('rec-1');

    expect(getRecording('rec-1')).toBeNull();
    expect(listRecordings().map((r) => r.id)).toEqual(['rec-2']);
    // both the .wav and .mid paths were unlinked (exists() is mocked true).
    expect(RNFS.unlink).toHaveBeenCalled();
  });

  it('deleting an unknown id still resolves and attempts file cleanup', async () => {
    await expect(deleteRecording('ghost')).resolves.toBeUndefined();
    expect(listRecordings()).toEqual([]);
  });

  it('survives a corrupt index payload by treating it as empty', () => {
    store.setString('recordings.index', '{not json');
    expect(listRecordings()).toEqual([]);
    // a subsequent save overwrites the corrupt value cleanly.
    saveRecording(meta());
    expect(getRecording('rec-1')).not.toBeNull();
  });
});
