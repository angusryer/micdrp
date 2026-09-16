/**
 * Sign in with Apple (INV-ACCOUNT-024..027).
 *
 * The native sheet produces an identity token; the backend decides whether to
 * believe it and answers with the same token pair a password sign-in returns.
 */
import { SESSION_ROUTES, type SessionMetaDto } from 'shared';

import { backend, type UserRecord } from '../lib/backend';
import NativeAppleSignIn from '../specs/NativeAppleSignIn';
import { storeRefreshToken } from './refreshToken';

export type AppleOutcome = 'signedIn' | 'cancelled';

/** Whether this binary and device can offer the Apple sheet (INV-ACCOUNT-027). */
export function appleSignInAvailable(): boolean {
  try {
    return NativeAppleSignIn?.isAvailable() ?? false;
  } catch {
    return false;
  }
}

const isCancel = (error: unknown): boolean =>
  (error as { code?: string } | null)?.code === 'cancelled';

/** Show the sheet and sign in with what it returns. */
export async function signInWithApple(): Promise<AppleOutcome> {
  if (!NativeAppleSignIn) {
    throw new Error('Sign in with Apple is not available on this build.');
  }
  let credential;
  try {
    credential = await NativeAppleSignIn.signIn();
  } catch (error) {
    if (isCancel(error)) {
      return 'cancelled';
    }
    throw error;
  }
  const name = [credential.givenName, credential.familyName]
    .filter(Boolean)
    .join(' ');
  const auth = await backend.send<{
    token: string;
    record: UserRecord;
    meta?: SessionMetaDto;
  }>(SESSION_ROUTES.apple, {
    method: 'POST',
    body: {
      identityToken: credential.identityToken,
      nonce: credential.nonce,
      name
    }
  });
  await storeRefreshToken(auth.meta?.refreshToken ?? null);
  backend.authStore.save(auth.token, auth.record as never);
  return 'signedIn';
}
