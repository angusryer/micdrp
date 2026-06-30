import React from 'react';
import AppProviders from './src/app/providers';
import RootNavigator from './src/navigation/RootNavigator';
import ErrorBoundary from './src/screens/ErrorBoundary';

export default function App() {
  return (
    <AppProviders>
      <ErrorBoundary>
        <RootNavigator />
      </ErrorBoundary>
    </AppProviders>
  );
}
