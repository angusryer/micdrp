/**
 * Unit tests for profilesRepo with a mocked Supabase client.
 *
 * The client (`../../lib/supabase`) is mocked with a tiny chainable query
 * builder + storage/rpc/auth stubs. We assert the snake_case row -> camelCase
 * ProfileDto mapping, the empty-name -> null clearing, and the
 * delete-account order (blob cleanup -> rpc -> signOut).
 */
type Result = { data: unknown; error: unknown };

function makeBuilder(result: Result) {
  const builder: Record<string, jest.Mock> & { _result: Result } = {
    _result: result
  } as never;
  const chain = (): typeof builder => builder;
  builder.select = jest.fn(chain);
  builder.update = jest.fn(chain);
  builder.eq = jest.fn(chain);
  builder.single = jest.fn(() => Promise.resolve(builder._result));
  return builder;
}

const mockFrom = jest.fn();
const mockStorageList = jest.fn();
const mockStorageRemove = jest.fn();
const mockRpc = jest.fn();
const mockGetUser = jest.fn();
const mockSignOut = jest.fn();

jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: (...a: unknown[]) => mockGetUser(...a),
      signOut: (...a: unknown[]) => mockSignOut(...a)
    },
    from: (...a: unknown[]) => mockFrom(...a),
    rpc: (...a: unknown[]) => mockRpc(...a),
    storage: {
      from: () => ({
        list: (...a: unknown[]) => mockStorageList(...a),
        remove: (...a: unknown[]) => mockStorageRemove(...a)
      })
    }
  }
}));

import { profilesRepo } from '../profilesRepo';

const ROW = {
  id: 'user-1',
  display_name: 'Ada',
  created_at: '2026-06-30T12:00:00.000Z'
};

beforeEach(() => {
  jest.clearAllMocks();
  mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
});

describe('profilesRepo.get', () => {
  it('maps a profile row to the camelCase DTO', async () => {
    mockFrom.mockReturnValue(makeBuilder({ data: ROW, error: null }));

    const dto = await profilesRepo.get();

    expect(dto).toEqual({
      id: 'user-1',
      displayName: 'Ada',
      createdAtMs: Date.parse('2026-06-30T12:00:00.000Z')
    });
  });

  it('throws when unauthenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(profilesRepo.get()).rejects.toThrow();
  });
});

describe('profilesRepo.updateDisplayName', () => {
  it('persists a trimmed name and returns the updated DTO', async () => {
    const builder = makeBuilder({ data: { ...ROW, display_name: 'Grace' }, error: null });
    mockFrom.mockReturnValue(builder);

    const dto = await profilesRepo.updateDisplayName('  Grace  ');

    expect(builder.update).toHaveBeenCalledWith({ display_name: 'Grace' });
    expect(dto.displayName).toBe('Grace');
  });

  it('clears the name (null) when given only whitespace', async () => {
    const builder = makeBuilder({ data: { ...ROW, display_name: null }, error: null });
    mockFrom.mockReturnValue(builder);

    await profilesRepo.updateDisplayName('   ');

    expect(builder.update).toHaveBeenCalledWith({ display_name: null });
  });
});

describe('profilesRepo.deleteAccount', () => {
  it('removes blobs, calls the RPC, then signs out — in order', async () => {
    const calls: string[] = [];
    mockStorageList.mockImplementation(() => {
      calls.push('list');
      return Promise.resolve({ data: [{ name: 'rec-1.m4a' }, { name: 'rec-1.mid' }], error: null });
    });
    mockStorageRemove.mockImplementation(() => {
      calls.push('remove');
      return Promise.resolve({ data: null, error: null });
    });
    mockRpc.mockImplementation(() => {
      calls.push('rpc');
      return Promise.resolve({ data: null, error: null });
    });
    mockSignOut.mockImplementation(() => {
      calls.push('signOut');
      return Promise.resolve({ error: null });
    });

    await profilesRepo.deleteAccount();

    expect(mockStorageRemove).toHaveBeenCalledWith(['user-1/rec-1.m4a', 'user-1/rec-1.mid']);
    expect(mockRpc).toHaveBeenCalledWith('delete_account');
    expect(calls).toEqual(['list', 'remove', 'rpc', 'signOut']);
  });

  it('skips blob removal when the user has no files', async () => {
    mockStorageList.mockResolvedValue({ data: [], error: null });
    mockRpc.mockResolvedValue({ data: null, error: null });
    mockSignOut.mockResolvedValue({ error: null });

    await profilesRepo.deleteAccount();

    expect(mockStorageRemove).not.toHaveBeenCalled();
    expect(mockRpc).toHaveBeenCalledWith('delete_account');
  });

  it('throws and does not sign out when the RPC fails', async () => {
    mockStorageList.mockResolvedValue({ data: [], error: null });
    mockRpc.mockResolvedValue({ data: null, error: { message: 'boom' } });

    await expect(profilesRepo.deleteAccount()).rejects.toThrow();
    expect(mockSignOut).not.toHaveBeenCalled();
  });
});
