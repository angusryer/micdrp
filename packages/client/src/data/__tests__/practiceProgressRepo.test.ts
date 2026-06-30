/**
 * Unit tests for practiceProgressRepo (cloud CRUD) with a mocked Supabase
 * client. Asserts the snake_case row -> camelCase DTO mapping and that list
 * orders oldest-first (trend order).
 */

type Result = { data: unknown; error: unknown };

function makeBuilder(result: Result) {
  const builder: Record<string, jest.Mock> & { _result: Result } = {
    _result: result
  } as never;
  const chain = (): typeof builder => builder;
  builder.insert = jest.fn(chain);
  builder.select = jest.fn(chain);
  builder.eq = jest.fn(chain);
  builder.order = jest.fn(() => Promise.resolve(builder._result));
  builder.single = jest.fn(() => Promise.resolve(builder._result));
  return builder;
}

const mockFrom = jest.fn();
const mockGetUser = jest.fn();

jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: { getUser: (...a: unknown[]) => mockGetUser(...a) },
    from: (...a: unknown[]) => mockFrom(...a)
  }
}));

import { practiceProgressRepo } from '../practiceProgressRepo';

const ROW = {
  id: 'prog-1',
  user_id: 'user-1',
  created_at: '2026-06-30T12:00:00.000Z',
  melody_id: 'major-scale',
  root_midi: 60,
  note_duration_ms: 400,
  score: 88,
  in_tune_ratio: 0.9,
  mean_cents_error: 11,
  evaluated_frames: 42
};

beforeEach(() => {
  jest.clearAllMocks();
  mockGetUser.mockResolvedValue({
    data: { user: { id: 'user-1' } },
    error: null
  });
});

describe('practiceProgressRepo.create', () => {
  it('inserts the metrics and maps the returned row to a DTO', async () => {
    const builder = makeBuilder({ data: ROW, error: null });
    mockFrom.mockReturnValue(builder);

    const dto = await practiceProgressRepo.create({
      melodyId: 'major-scale',
      rootMidi: 60,
      noteDurationMs: 400,
      score: 88,
      inTuneRatio: 0.9,
      meanCentsError: 11,
      evaluatedFrames: 42
    });

    expect(builder.insert).toHaveBeenCalledTimes(1);
    const arg = builder.insert.mock.calls[0][0] as { melody_id: string };
    expect(arg.melody_id).toBe('major-scale');

    expect(dto.id).toBe('prog-1');
    expect(dto.melodyId).toBe('major-scale');
    expect(dto.score).toBe(88);
    expect(dto.evaluatedFrames).toBe(42);
    expect(dto.createdAtMs).toBe(Date.parse('2026-06-30T12:00:00.000Z'));
  });

  it('throws Unauthorized when there is no user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(
      practiceProgressRepo.create({
        melodyId: 'm',
        rootMidi: 60,
        noteDurationMs: 400,
        evaluatedFrames: 0
      })
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });
});

describe('practiceProgressRepo.list', () => {
  it('returns mapped DTOs oldest-first (trend order)', async () => {
    const builder = makeBuilder({ data: [ROW], error: null });
    mockFrom.mockReturnValue(builder);

    const list = await practiceProgressRepo.list();

    expect(builder.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(builder.order).toHaveBeenCalledWith('created_at', {
      ascending: true
    });
    expect(list).toHaveLength(1);
    expect(list[0].melodyId).toBe('major-scale');
  });
});
