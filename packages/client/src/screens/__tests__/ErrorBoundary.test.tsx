import { render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { View } from 'react-native';
import ErrorBoundary from '../ErrorBoundary';

describe('ErrorBoundary component', () => {
  const originalConsoleDotError = console.error;

  beforeAll(() => {
    // Suppress console.error that occurs when the error below throws
    console.error = jest.fn();
  });

  afterAll(() => {
    console.error = originalConsoleDotError;
  });

  const TestComponent = ({ shouldThrow }: { shouldThrow?: boolean }) => {
    if (shouldThrow) {
      throw new Error('error');
    } else {
      return <View testID='child'></View>;
    }
  };
  it('renders children properly when no error is thrown', async () => {
    await waitFor(() =>
      render(
        <ErrorBoundary>
          <TestComponent />
        </ErrorBoundary>
      )
    );
    expect(screen.getByTestId('child')).toBeDefined();
    expect(screen).toMatchSnapshot();
  });

  it('renders when an uncaught error is thrown from within a child component', async () => {
    await waitFor(() =>
      render(
        <ErrorBoundary>
          <TestComponent shouldThrow />
        </ErrorBoundary>
      )
    );
    expect(screen.queryByTestId('child')).toBeNull();
    expect(screen).toMatchSnapshot();
  });
});
