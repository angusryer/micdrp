/**
 * Unit tests for sync (server-authoritative cache reconcile).
 *
 * recordingsRepo is mocked; the MMKV cache is the in-memory jest.setup mock via
 * the real `store`/`recordings` modules. We assert dto -> meta mapping and that
 * syncRecordings overwrites the cache to mirror the cloud exactly.
 */
import type { RecordingDto } from 'shared';

const mockList = jest.fn<Promise<RecordingDto[]>, []>();
const mockSignedUrls = jest.fn<
  Promise<{ audioUrl: string | null; midiUrl: string | null }>,
  [RecordingDto]
>();

jest.mock('../recordingsRepo', () => ({
  recordingsRepo: {
    list: (...a: []) => mockList(...a),
    signedUrls: (...a: [RecordingDto]) => mockSignedUrls(...a)
  }
}));

import { dtoToMeta, syncRecordings, cachedRecordings } from '../sync';
import { listRecordings } from '../recordings';
import { store } from '../store';

function dto(over: Partial<RecordingDto> = {}): RecordingDto {
  return {
    id: 'rec-1',
    userId: 'user-1',
    title: 'Take 1',
    createdAtMs: 1_000,
    durationMs: 3000,
    sampleRateHz: 44100,
    noteCount: 5,
    score: 88,
    key: 'C major',
    tempoBpm: 120,
    audioPath: 'user-1/rec-1.wav',
    midiPath: 'user-1/rec-1.mid',
    ...over
  };
}

beforeEach(() => {
  store.clearAll();
  jest.clearAllMocks();
  mockSignedUrls.mockResolvedValue({
    audioUrl: 'https://signed/audio',
    midiUrl: 'https://signed/midi'
  });
});

describe('dtoToMeta', () => {
  it('projects a DTO + signed URLs onto the cache shape', () => {
    const meta = dtoToMeta(dto(), {
      audioUrl: 'https://a',
      midiUrl: 'https://m'
    });
    expect(meta).toEqual({
      id: 'rec-1',
      title: 'Take 1',
      createdAtMs: 1_000,
      durationMs: 3000,
      sampleRateHz: 44100,
      audioUri: 'https://a',
      midiUri: 'https://m',
      score: 88,
      noteCount: 5
    });
  });

  it('maps null score/midi to undefined and null audio to empty string', () => {
    const meta = dtoToMeta(dto({ score: null }), {
      audioUrl: null,
      midiUrl: null
    });
    expect(meta.score).toBeUndefined();
    expect(meta.midiUri).toBeUndefined();
    expect(meta.audioUri).toBe('');
  });
});

describe('syncRecordings', () => {
  it('overwrites the cache to mirror the cloud, newest first', async () => {
    mockList.mockResolvedValue([
      dto({ id: 'a', createdAtMs: 100 }),
      dto({ id: 'b', createdAtMs: 300 })
    ]);

    const result = await syncRecordings();

    expect(result.map((r) => r.id)).toEqual(['b', 'a']);
    // Cache now mirrors the cloud.
    expect(listRecordings().map((r) => r.id)).toEqual(['b', 'a']);
    expect(cachedRecordings().map((r) => r.id)).toEqual(['b', 'a']);
  });

  it('drops cache entries no longer in the cloud (server wins)', async () => {
    // Seed a stale cache entry.
    mockList.mockResolvedValueOnce([dto({ id: 'stale' })]);
    await syncRecordings();
    expect(cachedRecordings().map((r) => r.id)).toEqual(['stale']);

    // Cloud no longer has it.
    mockList.mockResolvedValueOnce([dto({ id: 'fresh' })]);
    await syncRecordings();
    expect(cachedRecordings().map((r) => r.id)).toEqual(['fresh']);
  });
});
