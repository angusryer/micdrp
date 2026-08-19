/**
 * practiceProgressRepo against the in-memory backend fake.
 */
import { resetFakeBackend, signInFake } from '../../testing/fakeBackend';

jest.mock('../../lib/backend', () => {
  const fake = jest.requireActual('../../testing/fakeBackend') as {
    fakeBackend: unknown;
  };
  return {
    __esModule: true,
    backend: fake.fakeBackend,
    default: fake.fakeBackend,
    COLLECTIONS: {
      users: 'users',
      notes: 'notes',
      practiceProgress: 'practice_progress'
    }
  };
});

import { practiceProgressRepo } from '../practiceProgressRepo';

const INPUT = {
  melodyId: 'major-scale',
  rootMidi: 60,
  noteDurationMs: 500,
  score: 88,
  inTuneRatio: 0.91,
  meanCentsError: 14.2,
  evaluatedFrames: 220
};

beforeEach(() => {
  resetFakeBackend();
});

describe('practiceProgressRepo.create', () => {
  it('stores the metrics and maps the record back to a DTO', async () => {
    const userId = await signInFake();

    const dto = await practiceProgressRepo.create(INPUT);

    expect(dto.userId).toBe(userId);
    expect(dto.melodyId).toBe('major-scale');
    expect(dto.rootMidi).toBe(60);
    expect(dto.evaluatedFrames).toBe(220);
    expect(typeof dto.createdAtMs).toBe('number');
  });

  it('records an unscorable take with a null score', async () => {
    await signInFake();
    const dto = await practiceProgressRepo.create({
      ...INPUT,
      score: null,
      inTuneRatio: null,
      meanCentsError: null,
      evaluatedFrames: 0
    });
    expect(dto.score).toBeNull();
    expect(dto.evaluatedFrames).toBe(0);
  });

  it('throws Unauthorized when there is no user', async () => {
    await expect(practiceProgressRepo.create(INPUT)).rejects.toThrow();
  });
});

describe('practiceProgressRepo.list', () => {
  it('returns DTOs oldest-first, which is trend order', async () => {
    await signInFake();
    await practiceProgressRepo.create({ ...INPUT, melodyId: 'first' });
    await practiceProgressRepo.create({ ...INPUT, melodyId: 'second' });

    const rows = await practiceProgressRepo.list();

    expect(rows.map((r) => r.melodyId)).toEqual(['first', 'second']);
  });

  it('returns only the signed-in singer rows', async () => {
    await signInFake('alice@micdrp.test');
    await practiceProgressRepo.create(INPUT);

    await signInFake('bob@micdrp.test');

    expect(await practiceProgressRepo.list()).toEqual([]);
  });
});
