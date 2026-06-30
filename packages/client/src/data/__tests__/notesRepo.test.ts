/**
 * Unit tests for notesRepo (cloud CRUD) with a mocked Supabase client.
 *
 * The supabase client is mocked per-test with a tiny chainable query builder +
 * storage stub. react-native-fs is the global virtual mock (jest.setup.js)
 * returning a base64 string for readFile. We assert the snake_case row ->
 * camelCase DTO mapping (including melody_json -> melody), and the
 * insert -> upload -> patch order.
 */

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

import { notesRepo } from '../notesRepo';

const MELODY = [
  { midi: 60, startMs: 0, endMs: 400, durationMs: 400, cents: 0, clarity: 0.95 },
  { midi: 62, startMs: 400, endMs: 800, durationMs: 400, cents: 1, clarity: 0.9 }
];

const ROW = {
  id: 'note-1',
  user_id: 'user-1',
  title: 'My Idea',
  created_at: '2026-06-30T12:00:00.000Z',
  duration_ms: 800,
  sample_rate_hz: 44100,
  audio_path: 'user-1/note-1.wav',
  melody_json: MELODY,
  key: 'C major',
  tempo_bpm: 120,
  in_tune_ratio: 0.8,
  mean_cents_error: 14,
  note_count: 2,
  range_low_midi: 60,
  range_high_midi: 62
};

beforeEach(() => {
  jest.clearAllMocks();
  mockGetUser.mockResolvedValue({
    data: { user: { id: 'user-1' } },
    error: null
  });
  mockStorageUpload.mockResolvedValue({ data: { path: 'x' }, error: null });
  mockStorageRemove.mockResolvedValue({ data: [], error: null });
  mockCreateSignedUrl.mockResolvedValue({
    data: { signedUrl: 'https://signed/x' },
    error: null
  });
});

describe('notesRepo.create', () => {
  it('inserts (with melody_json), uploads audio, patches the path, and maps the DTO', async () => {
    const insertBuilder = makeBuilder({
      data: { ...ROW, audio_path: null },
      error: null
    });
    const updateBuilder = makeBuilder({ data: ROW, error: null });
    mockFrom
      .mockReturnValueOnce(insertBuilder)
      .mockReturnValueOnce(updateBuilder);

    const dto = await notesRepo.create(
      {
        title: 'My Idea',
        durationMs: 800,
        sampleRateHz: 44100,
        melody: MELODY,
        key: 'C major',
        tempoBpm: 120,
        inTuneRatio: 0.8,
        meanCentsError: 14,
        noteCount: 2,
        rangeLowMidi: 60,
        rangeHighMidi: 62
      },
      { audioUri: 'file:///mock/note-1.wav' }
    );

    expect(insertBuilder.insert).toHaveBeenCalledTimes(1);
    // melody_json is persisted on insert.
    const insertArg = insertBuilder.insert.mock.calls[0][0] as {
      melody_json: unknown;
    };
    expect(insertArg.melody_json).toEqual(MELODY);

    expect(mockStorageUpload).toHaveBeenCalledTimes(1);
    expect(updateBuilder.update).toHaveBeenCalledWith({
      audio_path: 'user-1/note-1.wav'
    });

    expect(dto.id).toBe('note-1');
    expect(dto.userId).toBe('user-1');
    expect(dto.createdAtMs).toBe(Date.parse('2026-06-30T12:00:00.000Z'));
    expect(dto.melody).toEqual(MELODY);
    expect(dto.inTuneRatio).toBe(0.8);
    expect(dto.rangeHighMidi).toBe(62);
  });

  it('throws Unauthorized when there is no user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(
      notesRepo.create(
        {
          title: 't',
          durationMs: 1,
          sampleRateHz: 1,
          melody: [],
          noteCount: 0
        },
        { audioUri: 'file:///x.wav' }
      )
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });
});

describe('notesRepo.list', () => {
  it('returns mapped DTOs newest-first from the query', async () => {
    const builder = makeBuilder({ data: [ROW], error: null });
    mockFrom.mockReturnValue(builder);

    const list = await notesRepo.list();

    expect(builder.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(builder.order).toHaveBeenCalledWith('created_at', {
      ascending: false
    });
    expect(list).toHaveLength(1);
    expect(list[0].title).toBe('My Idea');
    expect(list[0].melody).toHaveLength(2);
  });

  it('coerces a non-array melody_json to an empty melody', async () => {
    const builder = makeBuilder({
      data: [{ ...ROW, melody_json: null }],
      error: null
    });
    mockFrom.mockReturnValue(builder);
    const list = await notesRepo.list();
    expect(list[0].melody).toEqual([]);
  });
});

describe('notesRepo.signedAudioUrl', () => {
  it('signs the audio path', async () => {
    const url = await notesRepo.signedAudioUrl({
      id: 'note-1',
      userId: 'user-1',
      title: 'My Idea',
      createdAtMs: 0,
      durationMs: 0,
      sampleRateHz: 0,
      audioPath: 'user-1/note-1.wav',
      melody: [],
      key: null,
      tempoBpm: null,
      inTuneRatio: null,
      meanCentsError: null,
      noteCount: 0,
      rangeLowMidi: null,
      rangeHighMidi: null
    });
    expect(mockCreateSignedUrl).toHaveBeenCalledTimes(1);
    expect(url).toBe('https://signed/x');
  });
});
