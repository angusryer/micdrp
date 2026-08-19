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
const mockOnAuthStateChange = jest.fn();
const mockSignInWithPassword = jest.fn();
const mockSignUp = jest.fn();
const mockSignOut = jest.fn();

jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      onAuthStateChange: (...args: unknown[]) => mockOnAuthStateChange(...args),
      signInWithPassword: (...args: unknown[]) => mockSignInWithPassword(...args),
      signUp: (...args: unknown[]) => mockSignUp(...args),
      signOut: (...args: unknown[]) => mockSignOut(...args)
    }
  }
}));

async function renderScreen() {
  // The listener fires once with no session so AuthProvider leaves loading.
  mockOnAuthStateChange.mockImplementation((cb: (e: string, s: unknown) => void) => {
    cb('INITIAL_SESSION', null);
    return { data: { subscription: { unsubscribe: jest.fn() } } };
  });
  return await render(
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
  it('renders the sign-in form by default', async () => {
    await renderScreen();
    expect(screen.getByLabelText('Email')).toBeTruthy();
    expect(screen.getByLabelText('Password')).toBeTruthy();
    expect(screen.getByLabelText('Sign in')).toBeTruthy();
  });

  it('signs in with the entered credentials', async () => {
    mockSignInWithPassword.mockResolvedValue({ error: null });
    await renderScreen();

    await fireEvent.changeText(screen.getByLabelText('Email'), '  a@b.c ');
    await fireEvent.changeText(screen.getByLabelText('Password'), 'secret');
    await act(async () => {
      await fireEvent.press(screen.getByLabelText('Sign in'));
    });

    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: 'a@b.c',
      password: 'secret'
    });
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it('toggles to sign-up mode and calls signUp', async () => {
    mockSignUp.mockResolvedValue({ error: null });
    await renderScreen();

    await fireEvent.press(screen.getByLabelText('Switch to create an account'));
    expect(screen.getByLabelText('Sign up')).toBeTruthy();

    await fireEvent.changeText(screen.getByLabelText('Email'), 'new@user.io');
    await fireEvent.changeText(screen.getByLabelText('Password'), 'pw123456');
    await act(async () => {
      await fireEvent.press(screen.getByLabelText('Sign up'));
    });

    expect(mockSignUp).toHaveBeenCalledWith({
      email: 'new@user.io',
      password: 'pw123456'
    });
  });

  it('shows an error message when sign in fails', async () => {
    mockSignInWithPassword.mockResolvedValue({
      error: { message: 'Invalid login credentials' }
    });
    await renderScreen();

    await fireEvent.changeText(screen.getByLabelText('Email'), 'a@b.c');
    await fireEvent.changeText(screen.getByLabelText('Password'), 'wrong');
    await act(async () => {
      await fireEvent.press(screen.getByLabelText('Sign in'));
    });

    await waitFor(() =>
      expect(screen.getByText('Invalid login credentials')).toBeTruthy()
    );
  });

  it('does not submit when fields are empty', async () => {
    await renderScreen();
    await fireEvent.press(screen.getByLabelText('Sign in'));
    expect(mockSignInWithPassword).not.toHaveBeenCalled();
  });
});
