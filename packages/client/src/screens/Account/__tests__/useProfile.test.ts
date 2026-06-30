/**
 * Unit tests for useProfile.
 *
 * profilesRepo and the auth context are mocked; we drive the hook through a
 * react-test-renderer harness and assert the load -> edit -> save flow, the
 * dirty flag, sign-out, and delete-account delegation.
 */
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

const mockGet = jest.fn();
const mockUpdate = jest.fn();
const mockDelete = jest.fn();
jest.mock('../../../data/profilesRepo', () => ({
  profilesRepo: {
    get: (...a: unknown[]) => mockGet(...a),
    updateDisplayName: (...a: unknown[]) => mockUpdate(...a),
    deleteAccount: (...a: unknown[]) => mockDelete(...a)
  }
}));

const mockSignOut = jest.fn();
jest.mock('../../../auth', () => ({
  useAuth: () => ({
    user: { email: 'singer@example.com' },
    signOut: (...a: unknown[]) => mockSignOut(...a)
  })
}));

import { useProfile, type UseProfileValue } from '../useProfile';

const PROFILE = {
  id: 'user-1',
  displayName: 'Ada',
  createdAtMs: 1_719_744_000_000
};

function Harness({ onReady }: { onReady: (v: UseProfileValue) => void }): null {
  onReady(useProfile());
  return null;
}

interface Mounted {
  api: () => UseProfileValue;
  unmount: () => void;
}

async function mount(): Promise<Mounted> {
  let latest: UseProfileValue | null = null;
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = TestRenderer.create(
      React.createElement(Harness, {
        onReady: (v: UseProfileValue) => {
          latest = v;
        }
      })
    );
  });
  return {
    api: () => {
      if (latest === null) {
        throw new Error('Harness did not render');
      }
      return latest;
    },
    unmount: () => tree.unmount()
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGet.mockResolvedValue(PROFILE);
  mockUpdate.mockResolvedValue({ ...PROFILE, displayName: 'Grace' });
  mockDelete.mockResolvedValue(undefined);
  mockSignOut.mockResolvedValue(undefined);
});

describe('useProfile', () => {
  it('loads the profile and seeds the editable name + email', async () => {
    const { api } = await mount();
    expect(api().email).toBe('singer@example.com');
    expect(api().displayName).toBe('Ada');
    expect(api().loading).toBe(false);
    expect(api().dirty).toBe(false);
  });

  it('marks the field dirty when the name changes', async () => {
    const { api } = await mount();
    act(() => {
      api().setDisplayName('Grace');
    });
    expect(api().dirty).toBe(true);
  });

  it('saves the edited name through the repo', async () => {
    const { api } = await mount();
    act(() => {
      api().setDisplayName('Grace');
    });
    await act(async () => {
      await api().save();
    });
    expect(mockUpdate).toHaveBeenCalledWith('Grace');
    expect(api().displayName).toBe('Grace');
    expect(api().dirty).toBe(false);
  });

  it('delegates sign-out to the auth context', async () => {
    const { api } = await mount();
    await act(async () => {
      await api().signOut();
    });
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  it('delegates account deletion to the repo', async () => {
    const { api } = await mount();
    await act(async () => {
      await api().deleteAccount();
    });
    expect(mockDelete).toHaveBeenCalledTimes(1);
  });

  it('surfaces a load error message', async () => {
    mockGet.mockRejectedValue(new Error('offline'));
    const { api } = await mount();
    expect(api().error).toBe('offline');
    expect(api().loading).toBe(false);
  });
});
