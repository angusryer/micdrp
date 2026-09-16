/**
 * Renewal against the fake backend (INV-ACCOUNT-017..023, INV-NOTES-140).
 * The backend's own half — rotation, reuse, expiry — is proven against a
 * running instance by backend/verify-session.mjs.
 */
import { act, renderHook, waitFor } from '@testing-library/react-native';
import React from 'react';
import { SESSION_ROUTES } from 'shared';

jest.mock('../../lib/backend', () => {
  const fake = jest.requireActual('../../testing/fakeBackend') as {
    fakeBackend: unknown;
  };
  return {
    __esModule: true,
    backend: fake.fakeBackend,
    default: fake.fakeBackend,
    COLLECTIONS: { users: 'users' }
  };
});

import {
  fakeBackend,
  fakeSent,
  onFakeSend,
  resetFakeBackend,
  signInFake
} from '../../testing/fakeBackend';
import {
  fakeJwt,
  offline,
  refusal,
  resetFakeSession,
  storedRefreshToken
} from '../../testing/fakeSession';
import { AuthProvider, useAuth } from '../AuthContext';
import { currentRefreshToken } from '../refreshToken';
import { renewSession } from '../renewSession';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);
const sentTo = (route: string) => fakeSent.filter((r) => r.url === route);

/** A singer from a previous launch whose access token expires in `seconds`. */
async function restored(
  seconds: number,
  refreshToken: string | null
): Promise<string> {
  const id = await signInFake('ada@micdrp.test');
  fakeBackend.authStore.save(
    fakeJwt(seconds, id),
    fakeBackend.authStore.record!
  );
  if (refreshToken) {
    await storedRefreshToken(refreshToken);
  }
  return id;
}

/** Answer a refresh with a new pair and count nothing else. */
function renewing(): void {
  onFakeSend((url) =>
    url === SESSION_ROUTES.refresh
      ? Promise.resolve({
          token: fakeJwt(3600),
          record: fakeBackend.authStore.record,
          meta: { refreshToken: 'r2' }
        })
      : Promise.resolve({})
  );
}

beforeEach(async () => {
  resetFakeBackend();
  await resetFakeSession();
});

describe('restoring a session', () => {
  it('signs out an expired token with nothing to renew it', async () => {
    await restored(-10, null);
    const { result } = await renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.session).toBeNull();
  });

  it('renews an expired token on launch', async () => {
    await restored(-10, 'r1');
    renewing();
    const { result } = await renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(currentRefreshToken()).toBe('r2'));
    expect(result.current.session).not.toBeNull();
    expect(sentTo(SESSION_ROUTES.refresh)[0].options.body).toEqual({
      refreshToken: 'r1'
    });
  });

  it('signs out when the backend refuses the renewal', async () => {
    await restored(-10, 'r1');
    onFakeSend(() => Promise.reject(refusal()));
    const { result } = await renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(sentTo(SESSION_ROUTES.refresh)).toHaveLength(1));
    await waitFor(() => expect(result.current.session).toBeNull());
    expect(currentRefreshToken()).toBeNull();
  });

  it.each([
    ['offline', offline],
    ['an older backend', () => Object.assign(new Error('x'), { status: 404 })]
  ])('stays signed in when %s', async (_label, failure) => {
    await restored(-10, 'r1');
    onFakeSend(() => Promise.reject(failure()));
    const { result } = await renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(sentTo(SESSION_ROUTES.refresh)).toHaveLength(1));
    expect(result.current.session).not.toBeNull();
    expect(currentRefreshToken()).toBe('r1');
  });

  it('adopts a session from before rotation once', async () => {
    await restored(3600, null);
    onFakeSend(() => Promise.resolve({ refreshToken: 'adopted' }));
    await renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(currentRefreshToken()).toBe('adopted'));
    expect(sentTo(SESSION_ROUTES.adopt)).toHaveLength(1);
  });
});

describe('renewing', () => {
  it('shares one renewal between concurrent callers', async () => {
    await restored(-10, 'r1');
    renewing();
    const outcomes = await Promise.all([
      renewSession(),
      renewSession(),
      renewSession()
    ]);
    expect(outcomes).toEqual(['renewed', 'renewed', 'renewed']);
    expect(sentTo(SESSION_ROUTES.refresh)).toHaveLength(1);
  });

  it('does not bring back a session signed out while renewing', async () => {
    await restored(-10, 'r1');
    let answer: (value: unknown) => void = () => undefined;
    onFakeSend((url) =>
      url === SESSION_ROUTES.refresh
        ? new Promise((resolve) => {
            answer = resolve;
          })
        : Promise.resolve({})
    );
    const pending = renewSession();
    await waitFor(() => expect(sentTo(SESSION_ROUTES.refresh)).toHaveLength(1));
    const { result } = await renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.signOut();
    });
    answer({
      token: fakeJwt(3600),
      record: { id: 'x' },
      meta: { refreshToken: 'r2' }
    });
    expect(await pending).toBe('none');
    expect(fakeBackend.authStore.token).toBe('');
    expect(currentRefreshToken()).toBeNull();
  });

  it('sends a request with the renewed token, not the expiring one', async () => {
    await restored(30, 'r1');
    renewing();
    const { result } = await renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await fakeBackend.send('/api/elsewhere');
    const request = fakeSent.find((r) => r.url === '/api/elsewhere')!;
    expect(request.options.headers?.Authorization).toBe(
      fakeBackend.authStore.token
    );
    expect(sentTo(SESSION_ROUTES.refresh)).toHaveLength(1);
  });
});

describe('signing in and out', () => {
  it('keeps the refresh token a sign-in returns', async () => {
    const { result } = await renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.signIn('ada@micdrp.test', 'pw');
    });
    expect(currentRefreshToken()).toMatch(/^refresh-/);
  });

  it('ends the line on the backend when signing out', async () => {
    await restored(3600, 'r1');
    onFakeSend(() => Promise.resolve({}));
    const { result } = await renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.signOut();
    });
    expect(sentTo(SESSION_ROUTES.signOut)[0].options.body).toEqual({
      refreshToken: 'r1'
    });
    expect(result.current.session).toBeNull();
  });
});
