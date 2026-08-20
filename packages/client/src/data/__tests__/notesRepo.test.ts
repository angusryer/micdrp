/**
 * notesRepo against the in-memory backend fake.
 *
 * The fake enforces the same ownership rule the real backend does, so the
 * "only your own notes" assertions here are testing the repo's behaviour
 * rather than a permissive mock.
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

import { notesRepo } from '../notesRepo';
import { backend } from '../../lib/backend';

const MELODY = [
  { midi: 60, startMs: 0, endMs: 400, durationMs: 400, cents: 0, clarity: 0.9 }
];

const INPUT = {
  title: 'Bridge idea',
  durationMs: 1200,
  sampleRateHz: 44100,
  melody: MELODY,
  key: 'C major',
  tempoBpm: 96,
  inTuneRatio: 0.8,
  meanCentsError: 12,
  noteCount: 1,
  rangeLowMidi: 60,
  rangeHighMidi: 60
};

const BLOBS = { audioUri: 'file:///tmp/rec-1.m4a' };

beforeEach(() => {
  resetFakeBackend();
});

describe('notesRepo.create', () => {
  it('persists the melody and the audio in one request', async () => {
    const userId = await signInFake();

    const dto = await notesRepo.create(INPUT, BLOBS);

    expect(dto.userId).toBe(userId);
    expect(dto.title).toBe('Bridge idea');
    expect(dto.noteCount).toBe(1);
    // The audio is attached to the same record rather than patched in after.
    expect(dto.audioPath).not.toBeNull();
  });

  it('throws Unauthorized when there is no user', async () => {
    await expect(notesRepo.create(INPUT, BLOBS)).rejects.toThrow();
  });
});

describe('notesRepo.list', () => {
  it('returns DTOs newest-first', async () => {
    await signInFake();
    await notesRepo.create({ ...INPUT, title: 'older' }, BLOBS);
    await notesRepo.create({ ...INPUT, title: 'newer' }, BLOBS);

    const rows = await notesRepo.list();

    expect(rows.map((r) => r.title)).toEqual(['newer', 'older']);
  });

  it('coerces a non-array melody to an empty melody', async () => {
    await signInFake();
    await notesRepo.create({ ...INPUT, melody: undefined as never }, BLOBS);
    expect((await notesRepo.list())[0].melody).toEqual([]);
  });

  it('returns nothing that belongs to another singer', async () => {
    await signInFake('alice@micdrp.test');
    await notesRepo.create(INPUT, BLOBS);

    await signInFake('bob@micdrp.test');

    expect(await notesRepo.list()).toEqual([]);
  });
});

describe('notesRepo.get', () => {
  it('returns null for a note owned by someone else', async () => {
    await signInFake('alice@micdrp.test');
    const mine = await notesRepo.create(INPUT, BLOBS);

    await signInFake('bob@micdrp.test');

    expect(await notesRepo.get(mine.id)).toBeNull();
  });
});

describe('notesRepo.signedAudioUrl', () => {
  it('builds a token-carrying URL for an attached file', async () => {
    await signInFake();
    const dto = await notesRepo.create(INPUT, BLOBS);

    const url = await notesRepo.signedAudioUrl(dto);

    expect(url).toContain(dto.id);
    expect(url).toContain('token=');
  });

  it('returns null when the note has no audio', async () => {
    await signInFake();
    const dto = await notesRepo.create(INPUT, BLOBS);
    expect(await notesRepo.signedAudioUrl({ ...dto, audioPath: null })).toBeNull();
  });
});

describe('notesRepo.remove', () => {
  it('deletes the note and its attached audio together', async () => {
    await signInFake();
    const dto = await notesRepo.create(INPUT, BLOBS);

    await notesRepo.remove(dto.id);

    expect(await notesRepo.list()).toEqual([]);
  });

  it('cannot delete another singer note', async () => {
    await signInFake('alice@micdrp.test');
    const mine = await notesRepo.create(INPUT, BLOBS);

    await signInFake('bob@micdrp.test');
    await expect(notesRepo.remove(mine.id)).rejects.toThrow();

    await signInFake('alice@micdrp.test');
    expect(await notesRepo.list()).toHaveLength(1);
  });
});

describe('notesRepo.audioUrlFor — INV-NOTES-014', () => {
  it('mints a token-carrying URL from a cached path', async () => {
    await signInFake();
    const dto = await notesRepo.create(INPUT, BLOBS);

    const url = await notesRepo.audioUrlFor(dto.id, dto.audioPath);

    expect(url).toContain(dto.id);
    expect(url).toContain('token=');
  });

  it('mints a fresh token on every call rather than reusing one', async () => {
    // The bug this pins: a token lives about two minutes, so a URL obtained
    // once and kept is dead by the time the singer taps Play. Every call must
    // ask again.
    await signInFake();
    const dto = await notesRepo.create(INPUT, BLOBS);
    const tokenSpy = jest.spyOn(backend.files, 'getToken');

    await notesRepo.audioUrlFor(dto.id, dto.audioPath);
    await notesRepo.audioUrlFor(dto.id, dto.audioPath);

    expect(tokenSpy).toHaveBeenCalledTimes(2);
    tokenSpy.mockRestore();
  });

  it('returns null when the note has no audio', async () => {
    await signInFake();
    expect(await notesRepo.audioUrlFor('note-1', null)).toBeNull();
  });
});
