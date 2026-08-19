/**
 * AuthContext — the app's single source of truth for the authenticated session.
 *
 * Thin, deep integration over `supabase.auth`:
 *   - On mount we subscribe to `onAuthStateChange`; that subscription fires
 *     immediately with the restored session (from the hardware-backed Keychain
 *     adapter configured in `lib/supabase`), which clears `loading`.
 *   - `signIn` / `signUp` / `signOut` delegate straight to the SDK. We do not
 *     hand-roll tokens, refresh, or persistence — the SDK + Keychain adapter own
 *     that. Errors surface as `AppError` (the shared contract) so screens render
 *     a stable shape.
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
import { AppErrorCode, appError } from 'shared';

import { backend, COLLECTIONS, type UserRecord } from '../lib/backend';

/** What the app needs from a session: who is signed in, and are they valid. */
export interface Session {
  token: string;
  user: UserRecord;
}

export interface AuthContextValue {
  /** The current Supabase session, or `null` when signed out. */
  session: Session | null;
  /** Convenience accessor for `session.user`, or `null` when signed out. */
  user: UserRecord | null;
  /** `true` until the first auth state event resolves the restored session. */
  loading: boolean;
  signIn(email: string, password: string): Promise<void>;
  signUp(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  /** Email the user a password-reset link. */
  resetPassword(email: string): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * Map a thrown backend error onto the shared `AppError` contract so callers
 * always catch the same shape. appError already returns a real Error.
 */
function toAppError(error: unknown, fallback: string): Error & {
  code: AppErrorCode;
} {
  const message =
    error instanceof Error && error.message ? error.message : fallback;
  return appError(AppErrorCode.Auth, message, error);
}

/** Read the current session off the auth store, or null when signed out. */
function currentSession(): Session | null {
  const { token, record } = backend.authStore;
  return token && record ? { token, user: record as unknown as UserRecord } : null;
}

export function AuthProvider({
  children
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // onChange fires immediately with the restored session (or nothing), which
    // is what flips `loading` off — no separate "read the session" race.
    const unsubscribe = backend.authStore.onChange(() => {
      setSession(currentSession());
      setLoading(false);
    }, true);

    return unsubscribe;
  }, []);

  const signIn = useCallback(
    async (email: string, password: string): Promise<void> => {
      try {
        await backend
          .collection(COLLECTIONS.users)
          .authWithPassword(email, password);
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
        await backend
          .collection(COLLECTIONS.users)
          .authWithPassword(email, password);
      } catch (error) {
        throw toAppError(error, 'Sign up failed.');
      }
    },
    []
  );

  const signOut = useCallback(async (): Promise<void> => {
    // Clearing the store is synchronous and cannot fail; it also wipes the
    // Keychain entry through the async store's clear hook.
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
      signOut,
      resetPassword
    }),
    [session, loading, signIn, signUp, signOut, resetPassword]
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
