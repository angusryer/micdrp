/**
 * LoginScreen tests — drive the real screen through the real AuthProvider (with
 * a mocked Supabase client) and the real ThemeProvider, so the wiring between
 * the form, the auth context, and the SDK is exercised end to end.
 */
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor
} from '@testing-library/react-native';
import React from 'react';

import { AuthProvider } from '../AuthContext';
import { ThemeProvider } from '../../theme';
import LoginScreen from '../../screens/Login/LoginScreen';

// --- Mock the single Supabase client --------------------------------------
const onAuthStateChange = jest.fn();
const signInWithPassword = jest.fn();
const signUp = jest.fn();
const signOut = jest.fn();

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

function renderScreen() {
  // The listener fires once with no session so AuthProvider leaves loading.
  onAuthStateChange.mockImplementation((cb: (e: string, s: unknown) => void) => {
    cb('INITIAL_SESSION', null);
    return { data: { subscription: { unsubscribe: jest.fn() } } };
  });
  return render(
    <ThemeProvider>
      <AuthProvider>
        <LoginScreen />
      </AuthProvider>
    </ThemeProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('LoginScreen', () => {
  it('renders the sign-in form by default', () => {
    renderScreen();
    expect(screen.getByLabelText('Email')).toBeTruthy();
    expect(screen.getByLabelText('Password')).toBeTruthy();
    expect(screen.getByLabelText('Sign in')).toBeTruthy();
  });

  it('signs in with the entered credentials', async () => {
    signInWithPassword.mockResolvedValue({ error: null });
    renderScreen();

    fireEvent.changeText(screen.getByLabelText('Email'), '  a@b.c ');
    fireEvent.changeText(screen.getByLabelText('Password'), 'secret');
    await act(async () => {
      fireEvent.press(screen.getByLabelText('Sign in'));
    });

    expect(signInWithPassword).toHaveBeenCalledWith({
      email: 'a@b.c',
      password: 'secret'
    });
    expect(signUp).not.toHaveBeenCalled();
  });

  it('toggles to sign-up mode and calls signUp', async () => {
    signUp.mockResolvedValue({ error: null });
    renderScreen();

    fireEvent.press(screen.getByLabelText('Switch to create an account'));
    expect(screen.getByLabelText('Sign up')).toBeTruthy();

    fireEvent.changeText(screen.getByLabelText('Email'), 'new@user.io');
    fireEvent.changeText(screen.getByLabelText('Password'), 'pw123456');
    await act(async () => {
      fireEvent.press(screen.getByLabelText('Sign up'));
    });

    expect(signUp).toHaveBeenCalledWith({
      email: 'new@user.io',
      password: 'pw123456'
    });
  });

  it('shows an error message when sign in fails', async () => {
    signInWithPassword.mockResolvedValue({
      error: { message: 'Invalid login credentials' }
    });
    renderScreen();

    fireEvent.changeText(screen.getByLabelText('Email'), 'a@b.c');
    fireEvent.changeText(screen.getByLabelText('Password'), 'wrong');
    await act(async () => {
      fireEvent.press(screen.getByLabelText('Sign in'));
    });

    await waitFor(() =>
      expect(screen.getByText('Invalid login credentials')).toBeTruthy()
    );
  });

  it('does not submit when fields are empty', () => {
    renderScreen();
    fireEvent.press(screen.getByLabelText('Sign in'));
    expect(signInWithPassword).not.toHaveBeenCalled();
  });
});
