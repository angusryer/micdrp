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
import type { AuthError, Session, User } from '@supabase/supabase-js';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from 'react';
import { AppErrorCode, appError } from 'shared';

import { supabase } from '../lib/supabase';

export interface AuthContextValue {
  /** The current Supabase session, or `null` when signed out. */
  session: Session | null;
  /** Convenience accessor for `session.user`, or `null` when signed out. */
  user: User | null;
  /** `true` until the first auth state event resolves the restored session. */
  loading: boolean;
  signIn(email: string, password: string): Promise<void>;
  signUp(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * Map a Supabase `AuthError` (or any thrown value) onto the shared `AppError`
 * contract so callers always catch the same shape.
 */
function toAppError(error: AuthError | null, fallback: string): Error & {
  code: AppErrorCode;
} {
  const app = appError(AppErrorCode.Auth, error?.message ?? fallback, error);
  // Throw a real Error so React Native's red-box / try-catch ergonomics hold,
  // while carrying the shared AppError fields for typed handling upstream.
  return Object.assign(new Error(app.message), app);
}

export function AuthProvider({
  children
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // The listener fires once on subscribe with the restored session (or null),
    // which is what flips `loading` off — no separate getSession() race.
    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(
    async (email: string, password: string): Promise<void> => {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      if (error) {
        throw toAppError(error, 'Sign in failed.');
      }
    },
    []
  );

  const signUp = useCallback(
    async (email: string, password: string): Promise<void> => {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        throw toAppError(error, 'Sign up failed.');
      }
    },
    []
  );

  const signOut = useCallback(async (): Promise<void> => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw toAppError(error, 'Sign out failed.');
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      signIn,
      signUp,
      signOut
    }),
    [session, loading, signIn, signUp, signOut]
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
