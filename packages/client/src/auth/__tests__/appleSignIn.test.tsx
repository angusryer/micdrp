/**
 * Sign in with Apple on the client (INV-ACCOUNT-026, 027). Whether a token is
 * believed is the backend's to decide, proven by backend/verify-apple.mjs.
 */
import {
  fireEvent,
  render,
  screen,
  waitFor
} from '@testing-library/react-native';
import React from 'react';
import { SESSION_ROUTES } from 'shared';

const mockNative = { isAvailable: jest.fn(() => true), signIn: jest.fn() };
let mockPresent = true;

jest.mock('../../specs/NativeAppleSignIn', () => ({
  __esModule: true,
  get default() {
    return mockPresent ? mockNative : null;
  }
}));
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

import AppleSignInButton from '../../screens/Login/AppleSignInButton';
import {
  fakeBackend,
  fakeSent,
  onFakeSend,
  resetFakeBackend
} from '../../testing/fakeBackend';
import { fakeJwt, resetFakeSession } from '../../testing/fakeSession';
import { AuthProvider } from '../AuthContext';
import { currentRefreshToken } from '../refreshToken';

const credential = {
  identityToken: 'apple.jwt',
  nonce: 'n1',
  givenName: 'Ada',
  familyName: 'Lovelace'
};
const cancelled = () =>
  Object.assign(new Error('The user canceled.'), { code: 'cancelled' });

async function renderButton(onError = jest.fn()) {
  await render(
    <AuthProvider>
      <AppleSignInButton isDisabled={false} onError={onError} />
    </AuthProvider>
  );
  return onError;
}

beforeEach(async () => {
  resetFakeBackend();
  await resetFakeSession();
  mockPresent = true;
  mockNative.signIn.mockReset();
});

it('offers no button on a binary without the module', async () => {
  mockPresent = false;
  await renderButton();
  await waitFor(() =>
    expect(screen.queryByLabelText('Sign in with Apple')).toBeNull()
  );
});

it('signs in with the token and keeps the refresh token', async () => {
  mockNative.signIn.mockResolvedValue(credential);
  onFakeSend(() =>
    Promise.resolve({
      token: fakeJwt(3600, 'a1'),
      record: { id: 'a1', email: 'ada@micdrp.test', created: '', updated: '' },
      meta: { refreshToken: 'apple-refresh' }
    })
  );
  await renderButton();
  await fireEvent.press(await screen.findByLabelText('Sign in with Apple'));
  await waitFor(() => expect(currentRefreshToken()).toBe('apple-refresh'));
  expect(fakeBackend.authStore.record?.id).toBe('a1');
  expect(
    fakeSent.find((r) => r.url === SESSION_ROUTES.apple)?.options.body
  ).toEqual({
    identityToken: 'apple.jwt',
    nonce: 'n1',
    name: 'Ada Lovelace'
  });
});

it('reports nothing when the sheet is cancelled', async () => {
  mockNative.signIn.mockRejectedValue(cancelled());
  const onError = await renderButton();
  await fireEvent.press(await screen.findByLabelText('Sign in with Apple'));
  await waitFor(() => expect(mockNative.signIn).toHaveBeenCalled());
  await waitFor(() => expect(onError).toHaveBeenLastCalledWith(null));
  expect(onError).not.toHaveBeenCalledWith(expect.any(String));
  expect(fakeSent).toHaveLength(0);
});

it('reports a refusal from the backend', async () => {
  mockNative.signIn.mockResolvedValue(credential);
  onFakeSend(() =>
    Promise.reject(
      Object.assign(new Error('Apple did not vouch for this sign-in.'), {
        status: 401
      })
    )
  );
  const onError = await renderButton();
  await fireEvent.press(await screen.findByLabelText('Sign in with Apple'));
  await waitFor(() =>
    expect(onError).toHaveBeenCalledWith(
      expect.stringMatching(/Apple did not vouch/)
    )
  );
  expect(currentRefreshToken()).toBeNull();
});
