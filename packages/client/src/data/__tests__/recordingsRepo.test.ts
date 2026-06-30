/**
 * Unit tests for recordingsRepo (cloud CRUD) with a mocked Supabase client.
 *
 * The supabase client (`../../lib/supabase`) is mocked per-test with a tiny
 * chainable query builder + storage stub. react-native-fs is the global virtual
 * mock (jest.setup.js) returning a base64 string for readFile. We assert the
 * snake_case row -> camelCase DTO mapping, the insert -> upload -> patch order,
 * and the pure base64 decoder.
 */

// ---- chainable query-builder stub ----
type Result = { data: unknown; error: unknown };

function makeBuilder(result: Result) {
  const builder: Record<string, jest.Mock> & { _result: Result } = {
    _result: result
  } as never;
  const chain = (): typeof builder => builder;
  builder.insert = jest.fn(chain);
  builder.update = jest.fn(chain);
  builder.delete = jest.fn(chain);
  builder.select = jest.fn(chain);
  builder.eq = jest.fn(chain);
  builder.order = jest.fn(() => Promise.resolve(builder._result));
  builder.single = jest.fn(() => Promise.resolve(builder._result));
  builder.maybeSingle = jest.fn(() => Promise.resolve(builder._result));
  return builder;
}

const mockFrom = jest.fn();
const mockStorageUpload = jest.fn();
const mockStorageRemove = jest.fn();
const mockCreateSignedUrl = jest.fn();
const mockGetUser = jest.fn();

jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: { getUser: (...a: unknown[]) => mockGetUser(...a) },
    from: (...a: unknown[]) => mockFrom(...a),
    storage: {
      from: () => ({
        upload: (...a: unknown[]) => mockStorageUpload(...a),
        remove: (...a: unknown[]) => mockStorageRemove(...a),
        createSignedUrl: (...a: unknown[]) => mockCreateSignedUrl(...a)
      })
    }
  }
}));

import { recordingsRepo, base64ToBytes } from '../recordingsRepo';

const ROW = {
  id: 'rec-1',
  user_id: 'user-1',
  title: 'My Take',
  created_at: '2026-06-30T12:00:00.000Z',
  duration_ms: 3600,
  sample_rate_hz: 44100,
  note_count: 3,
  score: 92.5,
  key: 'C major',
  tempo_bpm: 120,
  audio_path: 'user-1/rec-1.wav',
  midi_path: 'user-1/rec-1.mid'
};

beforeEach(() => {
  jest.clearAllMocks();
  mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
  mockStorageUpload.mockResolvedValue({ data: { path: 'x' }, error: null });
  mockStorageRemove.mockResolvedValue({ data: [], error: null });
  mockCreateSignedUrl.mockResolvedValue({
    data: { signedUrl: 'https://signed/x' },
    error: null
  });
});

describe('base64ToBytes', () => {
  it('decodes a known base64 string', () => {
    // 'Man' -> TWFu
    expect(Array.from(base64ToBytes('TWFu'))).toEqual([77, 97, 110]);
  });
  it('handles padding', () => {
    // 'M' -> TQ==
    expect(Array.from(base64ToBytes('TQ=='))).toEqual([77]);
  });
});

describe('recordingsRepo.create', () => {
  it('inserts, uploads both blobs, patches paths, and returns a mapped DTO', async () => {
    // First .from() call: insert (returns row without paths).
    const insertBuilder = makeBuilder({
      data: { ...ROW, audio_path: null, midi_path: null },
      error: null
    });
    // Second .from() call: update (returns row with paths).
    const updateBuilder = makeBuilder({ data: ROW, error: null });
    mockFrom
      .mockReturnValueOnce(insertBuilder)
      .mockReturnValueOnce(updateBuilder);

    const dto = await recordingsRepo.create(
      {
        title: 'My Take',
        durationMs: 3600,
        sampleRateHz: 44100,
        noteCount: 3,
        score: 92.5,
        key: 'C major',
        tempoBpm: 120
      },
      { audioUri: 'file:///mock/rec-1.wav', midiBytes: new Uint8Array([1, 2, 3]) }
    );

    expect(insertBuilder.insert).toHaveBeenCalledTimes(1);
    expect(mockStorageUpload).toHaveBeenCalledTimes(2);
    expect(updateBuilder.update).toHaveBeenCalledWith({
      audio_path: 'user-1/rec-1.wav',
      midi_path: 'user-1/rec-1.mid'
    });

    // Mapped to camelCase DTO.
    expect(dto.id).toBe('rec-1');
    expect(dto.userId).toBe('user-1');
    expect(dto.createdAtMs).toBe(Date.parse('2026-06-30T12:00:00.000Z'));
    expect(dto.score).toBe(92.5);
    expect(dto.audioPath).toBe('user-1/rec-1.wav');
  });

  it('throws Unauthorized when there is no user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(
      recordingsRepo.create(
        { title: 't', durationMs: 1, sampleRateHz: 1, noteCount: 0 },
        { audioUri: 'file:///x.wav', midiBytes: new Uint8Array() }
      )
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });
});

describe('recordingsRepo.list', () => {
  it('returns mapped DTOs newest-first from the query', async () => {
    const builder = makeBuilder({ data: [ROW], error: null });
    mockFrom.mockReturnValue(builder);

    const list = await recordingsRepo.list();

    expect(builder.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(builder.order).toHaveBeenCalledWith('created_at', {
      ascending: false
    });
    expect(list).toHaveLength(1);
    expect(list[0].title).toBe('My Take');
  });
});

describe('recordingsRepo.signedUrls', () => {
  it('signs both blob paths', async () => {
    const urls = await recordingsRepo.signedUrls({
      id: 'rec-1',
      userId: 'user-1',
      title: 'My Take',
      createdAtMs: 0,
      durationMs: 0,
      sampleRateHz: 0,
      noteCount: 0,
      score: null,
      key: null,
      tempoBpm: null,
      audioPath: 'user-1/rec-1.wav',
      midiPath: 'user-1/rec-1.mid'
    });
    expect(mockCreateSignedUrl).toHaveBeenCalledTimes(2);
    expect(urls.audioUrl).toBe('https://signed/x');
    expect(urls.midiUrl).toBe('https://signed/x');
  });
});
