/**
 * AuthContext tests — verify the provider drives off `supabase.auth` correctly:
 * restores the session via the onAuthStateChange listener, exposes the derived
 * user, delegates sign in/up/out, maps errors onto the shared AppError shape,
 * and unsubscribes on unmount.
 */
import { act, render, renderHook, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';
import { AppErrorCode } from 'shared';

import { AuthProvider, useAuth } from '../AuthContext';

// --- Mock the single Supabase client --------------------------------------
const onAuthStateChange = jest.fn();
const signInWithPassword = jest.fn();
const signUp = jest.fn();
const signOut = jest.fn();
const unsubscribe = jest.fn();

jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      onAuthStateChange: (...args: unknown[]) => onAuthStateChange(...args),
      signInWithPassword: (...args: unknown[]) => signInWithPassword(...args),
      signUp: (...args: unknown[]) => signUp(...args),
      signOut: (...args: unknown[]) => signOut(...args)
    }
  }
}));

type Listener = (event: string, session: unknown) => void;

/** Capture the listener so tests can drive auth state changes. */
function wireListener(): { emit: Listener } {
  let captured: Listener = () => undefined;
  onAuthStateChange.mockImplementation((cb: Listener) => {
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
    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.loading).toBe(true);
    expect(result.current.session).toBeNull();
    expect(result.current.user).toBeNull();

    void act(() => emit('INITIAL_SESSION', null));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.session).toBeNull();
    expect(result.current.user).toBeNull();
  });

  it('restores a session and derives the user from it', async () => {
    const { emit } = wireListener();
    const session = { access_token: 'tok', user: { id: 'u1', email: 'a@b.c' } };
    const { result } = renderHook(() => useAuth(), { wrapper });

    void act(() => emit('SIGNED_IN', session));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.session).toBe(session);
    expect(result.current.user).toEqual({ id: 'u1', email: 'a@b.c' });
  });

  it('signIn delegates to signInWithPassword', async () => {
    wireListener();
    signInWithPassword.mockResolvedValue({ error: null });
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.signIn('a@b.c', 'pw');
    });

    expect(signInWithPassword).toHaveBeenCalledWith({
      email: 'a@b.c',
      password: 'pw'
    });
  });

  it('signUp delegates to supabase.auth.signUp', async () => {
    wireListener();
    signUp.mockResolvedValue({ error: null });
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.signUp('a@b.c', 'pw');
    });

    expect(signUp).toHaveBeenCalledWith({ email: 'a@b.c', password: 'pw' });
  });

  it('signOut delegates to supabase.auth.signOut', async () => {
    wireListener();
    signOut.mockResolvedValue({ error: null });
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.signOut();
    });

    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it('maps a Supabase auth error onto the shared AppError shape', async () => {
    wireListener();
    signInWithPassword.mockResolvedValue({
      error: { message: 'Invalid login credentials' }
    });
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await expect(result.current.signIn('a@b.c', 'pw')).rejects.toMatchObject({
        code: AppErrorCode.Auth,
        message: 'Invalid login credentials'
      });
    });
  });

  it('unsubscribes the auth listener on unmount', () => {
    wireListener();
    const { unmount } = render(
      <AuthProvider>
        <Text>child</Text>
      </AuthProvider>
    );

    unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('throws when useAuth is used outside an AuthProvider', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => renderHook(() => useAuth())).toThrow(
      /must be used within an AuthProvider/
    );
    spy.mockRestore();
  });
});
