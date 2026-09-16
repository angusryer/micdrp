/**
 * AuthContext — the app's single source of truth for the authenticated session.
 *
 * Thin integration over the backend client's auth store:
 *   - On mount we subscribe to the store's changes; the first one carries the
 *     restored session (from the Keychain-backed store in `lib/backend`), and
 *     once the refresh token has been read too, `loading` clears.
 *   - `signIn` / `signUp` delegate to the SDK and keep the refresh token the
 *     backend returns. Renewal lives in `renewSession` and runs from
 *     `useSessionRenewal` (INV-ACCOUNT-016..023). Errors surface as `AppError`
 *     (the shared contract) so screens render a stable shape.
 *
 * There is no mock user and no local auth store; this is the only auth context
 * in the app.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from 'react';
import { AppErrorCode, appError, type SessionMetaDto } from 'shared';

import { backend, COLLECTIONS, type UserRecord } from '../lib/backend';
import {
  type AppleOutcome,
  signInWithApple as appleSignIn
} from './appleSignIn';
import { loadRefreshToken, storeRefreshToken } from './refreshToken';
import { endLine } from './renewSession';
import { hasSession } from './sessionState';
import { useSessionRenewal } from './useSessionRenewal';

/** What the app needs from a session: who is signed in, and are they valid. */
export interface Session {
  token: string;
  user: UserRecord;
}

export interface AuthContextValue {
  /** The current session, or `null` when signed out. */
  session: Session | null;
  /** Convenience accessor for `session.user`, or `null` when signed out. */
  user: UserRecord | null;
  /** `true` until the first auth state event resolves the restored session. */
  loading: boolean;
  signIn(email: string, password: string): Promise<void>;
  signUp(email: string, password: string): Promise<void>;
  /** Show the Apple sheet and sign in; resolves `cancelled` when dismissed. */
  signInWithApple(): Promise<AppleOutcome>;
  signOut(): Promise<void>;
  /** Email the user a password-reset link. */
  resetPassword(email: string): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * Map a thrown backend error onto the shared `AppError` contract so callers
 * always catch the same shape. appError already returns a real Error.
 */
function toAppError(
  error: unknown,
  fallback: string
): Error & {
  code: AppErrorCode;
} {
  const message =
    error instanceof Error && error.message ? error.message : fallback;
  return appError(AppErrorCode.Auth, message, error);
}

/** Read the current session off the auth store, or null when signed out. */
function currentSession(): Session | null {
  const { token, record } = backend.authStore;
  return hasSession() && record
    ? { token, user: record as unknown as UserRecord }
    : null;
}

/** Sign in with a password and keep the refresh token that comes back. */
async function passwordSignIn(email: string, password: string): Promise<void> {
  const auth = await backend
    .collection(COLLECTIONS.users)
    .authWithPassword(email, password);
  const meta = (auth as { meta?: SessionMetaDto }).meta;
  await storeRefreshToken(meta?.refreshToken ?? null);
}

export function AuthProvider({
  children
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // onChange fires immediately with the restored session (or nothing). The
    // refresh token is read before deciding, because an expired access token
    // with one is still a session (INV-ACCOUNT-020).
    let live = true;
    const unsubscribe = backend.authStore.onChange(() => {
      void loadRefreshToken().then(() => {
        if (live) {
          setSession(currentSession());
          setLoading(false);
        }
      });
    }, true);

    return () => {
      live = false;
      unsubscribe();
    };
  }, []);

  useSessionRenewal(!loading);

  const signIn = useCallback(
    async (email: string, password: string): Promise<void> => {
      try {
        await passwordSignIn(email, password);
      } catch (error) {
        throw toAppError(error, 'Sign in failed.');
      }
    },
    []
  );

  const signUp = useCallback(
    async (email: string, password: string): Promise<void> => {
      try {
        await backend.collection(COLLECTIONS.users).create({
          email,
          password,
          passwordConfirm: password
        });
        // Creating an account does not sign it in; the app expects to land
        // signed in, as it did before.
        await passwordSignIn(email, password);
      } catch (error) {
        throw toAppError(error, 'Sign up failed.');
      }
    },
    []
  );

  const signInWithApple = useCallback(async (): Promise<AppleOutcome> => {
    try {
      return await appleSignIn();
    } catch (error) {
      throw toAppError(error, 'Sign in with Apple failed.');
    }
  }, []);

  const signOut = useCallback(async (): Promise<void> => {
    // The line ends on the backend best effort (INV-ACCOUNT-022). Clearing the
    // store is synchronous and cannot fail; it also wipes the Keychain entry
    // through the async store's clear hook.
    endLine();
    backend.authStore.clear();
    return Promise.resolve();
  }, []);

  const resetPassword = useCallback(async (email: string): Promise<void> => {
    try {
      await backend.collection(COLLECTIONS.users).requestPasswordReset(email);
    } catch (error) {
      throw toAppError(error, 'Could not send a reset email.');
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      signIn,
      signUp,
      signInWithApple,
      signOut,
      resetPassword
    }),
    [session, loading, signIn, signUp, signInWithApple, signOut, resetPassword]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
