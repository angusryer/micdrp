/**
 * Session helpers for tests: tokens that expire when a test says, and a way to
 * relaunch the session modules between tests.
 */
import {
  relaunchRefreshTokenForTests,
  storeRefreshToken
} from '../auth/refreshToken';
import { relaunchRenewalForTests } from '../auth/renewSession';

const base64url = (value: string): string =>
  btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** An access token that expires `seconds` from now (negative: already has). */
export function fakeJwt(seconds: number, id = 'rec'): string {
  const payload = { id, exp: Math.floor(Date.now() / 1000) + seconds };
  return `${base64url('{"alg":"HS256"}')}.${base64url(JSON.stringify(payload))}.sig`;
}

/** Forget every stored and in-memory refresh token. Call from beforeEach. */
export async function resetFakeSession(): Promise<void> {
  await storeRefreshToken(null);
  relaunchRefreshTokenForTests();
  relaunchRenewalForTests();
}

/** Put a refresh token in the Keychain as a previous launch would have. */
export async function storedRefreshToken(token: string): Promise<void> {
  await storeRefreshToken(token);
  relaunchRefreshTokenForTests();
}

/** A backend refusal, as the SDK reports one. */
export const refusal = (): Error =>
  Object.assign(new Error('The refresh token was refused.'), { status: 401 });

/** No network, as the SDK reports it. */
export const offline = (): Error =>
  Object.assign(new Error('Something went wrong.'), { status: 0 });
