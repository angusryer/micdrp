/**
 * profilesRepo against the in-memory backend fake.
 *
 * The profile is the auth record now, so these also cover the structural
 * guarantee that an account has exactly one profile, and that deleting an
 * account takes the singer's records with it.
 */
import {
  fakeBackend,
  resetFakeBackend,
  signInFake
} from '../../testing/fakeBackend';

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

import { profilesRepo } from '../profilesRepo';

beforeEach(() => {
  resetFakeBackend();
});

describe('profilesRepo.get', () => {
  it('maps the auth record to the camelCase DTO', async () => {
    const id = await signInFake('ada@micdrp.test');
    await fakeBackend.collection('users').update(id, { name: 'Ada' });

    const dto = await profilesRepo.get();

    expect(dto.id).toBe(id);
    expect(dto.displayName).toBe('Ada');
    expect(typeof dto.createdAtMs).toBe('number');
  });

  it('reads an unset name as null so the UI can fall back to the email', async () => {
    await signInFake();
    expect((await profilesRepo.get()).displayName).toBeNull();
  });

  it('throws when unauthenticated', async () => {
    await expect(profilesRepo.get()).rejects.toThrow();
  });
});

describe('profilesRepo.updateDisplayName', () => {
  it('persists a trimmed name and returns the updated DTO', async () => {
    await signInFake();
    const dto = await profilesRepo.updateDisplayName('  Grace  ');
    expect(dto.displayName).toBe('Grace');
    expect((await profilesRepo.get()).displayName).toBe('Grace');
  });

  it('clears the name when given only whitespace', async () => {
    await signInFake();
    await profilesRepo.updateDisplayName('Grace');
    await profilesRepo.updateDisplayName('   ');
    expect((await profilesRepo.get()).displayName).toBeNull();
  });
});

describe('profilesRepo.deleteAccount', () => {
  it('deletes the account, its records, and the local session', async () => {
    const id = await signInFake();
    await fakeBackend.collection('notes').create({ user: id, title: 'Mine' });
    expect(await fakeBackend.collection('notes').getFullList()).toHaveLength(1);

    await profilesRepo.deleteAccount();

    // Session cleared, and the cascade took the singer's notes with them.
    expect(fakeBackend.authStore.isValid).toBe(false);
    await signInFake('someone-else@micdrp.test');
    expect(await fakeBackend.collection('notes').getFullList()).toHaveLength(0);
  });

  it('throws when unauthenticated', async () => {
    await expect(profilesRepo.deleteAccount()).rejects.toThrow();
  });
});
