/**
 * AuthContext tests — verify the provider drives off `supabase.auth` correctly:
 * restores the session via the mockOnAuthStateChange listener, exposes the derived
 * user, delegates sign in/up/out, maps errors onto the shared AppError shape,
 * and unsubscribes on unmount.
 */
import { act, render, renderHook, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';
import { AppErrorCode } from 'shared';

import { AuthProvider, useAuth } from '../AuthContext';

// --- Mock the single Supabase client --------------------------------------
const mockOnAuthStateChange = jest.fn();
const mockSignInWithPassword = jest.fn();
const mockSignUp = jest.fn();
const mockSignOut = jest.fn();
const mockResetPasswordForEmail = jest.fn();
const unsubscribe = jest.fn();

jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      onAuthStateChange: (...args: unknown[]) => mockOnAuthStateChange(...args),
      signInWithPassword: (...args: unknown[]) => mockSignInWithPassword(...args),
      signUp: (...args: unknown[]) => mockSignUp(...args),
      signOut: (...args: unknown[]) => mockSignOut(...args),
      resetPasswordForEmail: (...args: unknown[]) => mockResetPasswordForEmail(...args)
    }
  }
}));

type Listener = (event: string, session: unknown) => void;

/** Capture the listener so tests can drive auth state changes. */
function wireListener(): { emit: Listener } {
  let captured: Listener = () => undefined;
  mockOnAuthStateChange.mockImplementation((cb: Listener) => {
    captured = cb;
    return { data: { subscription: { unsubscribe } } };
  });
  return {
    emit: (event, session) => captured(event, session)
  };
}

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

beforeEach(() => {
  jest.clearAllMocks();
});

describe('AuthProvider / useAuth', () => {
  it('starts loading and resolves to a null session when restore yields nothing', async () => {
    const { emit } = wireListener();
    const { result } = await renderHook(() => useAuth(), { wrapper });

    expect(result.current.loading).toBe(true);
    expect(result.current.session).toBeNull();
    expect(result.current.user).toBeNull();

    await act(async () => {
      emit('INITIAL_SESSION', null);
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.session).toBeNull();
    expect(result.current.user).toBeNull();
  });

  it('restores a session and derives the user from it', async () => {
    const { emit } = wireListener();
    const session = { access_token: 'tok', user: { id: 'u1', email: 'a@b.c' } };
    const { result } = await renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      emit('SIGNED_IN', session);
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.session).toBe(session);
    expect(result.current.user).toEqual({ id: 'u1', email: 'a@b.c' });
  });

  it('signIn delegates to signInWithPassword', async () => {
    wireListener();
    mockSignInWithPassword.mockResolvedValue({ error: null });
    const { result } = await renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.signIn('a@b.c', 'pw');
    });

    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: 'a@b.c',
      password: 'pw'
    });
  });

  it('signUp delegates to supabase.auth.signUp', async () => {
    wireListener();
    mockSignUp.mockResolvedValue({ error: null });
    const { result } = await renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.signUp('a@b.c', 'pw');
    });

    expect(mockSignUp).toHaveBeenCalledWith({ email: 'a@b.c', password: 'pw' });
  });

  it('signOut delegates to supabase.auth.signOut', async () => {
    wireListener();
    mockSignOut.mockResolvedValue({ error: null });
    const { result } = await renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.signOut();
    });

    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  it('resetPassword delegates to supabase.auth.resetPasswordForEmail', async () => {
    wireListener();
    mockResetPasswordForEmail.mockResolvedValue({ error: null });
    const { result } = await renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.resetPassword('a@b.c');
    });

    expect(mockResetPasswordForEmail).toHaveBeenCalledWith('a@b.c');
  });

  it('maps a Supabase auth error onto the shared AppError shape', async () => {
    wireListener();
    mockSignInWithPassword.mockResolvedValue({
      error: { message: 'Invalid login credentials' }
    });
    const { result } = await renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await expect(result.current.signIn('a@b.c', 'pw')).rejects.toMatchObject({
        code: AppErrorCode.Auth,
        message: 'Invalid login credentials'
      });
    });
  });

  it('unsubscribes the auth listener on unmount', async () => {
    wireListener();
    const { unmount } = await render(
      <AuthProvider>
        <Text>child</Text>
      </AuthProvider>
    );

    await act(async () => {
      await unmount();
    });
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('throws when useAuth is used outside an AuthProvider', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    // renderHook is async in RNTL 14, so the guard surfaces as a rejection
    // rather than a synchronous throw.
    await expect(renderHook(() => useAuth())).rejects.toThrow(
      /must be used within an AuthProvider/
    );
    spy.mockRestore();
  });
});
