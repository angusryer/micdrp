import React from 'react';
import AppProviders from './src/app/providers';
import RootNavigator from './src/navigation/RootNavigator';
import ErrorBoundary from './src/screens/ErrorBoundary';
import { initUpdates, UpdateGate } from './src/updates';

// Start the updater before the tree mounts, so the native layer's launch
// report — which decides whether the bundle now running is one to keep — is
// handled on the first render rather than after a screen has already drawn.
// A build with no update server configured returns immediately.
initUpdates();

export default function App() {
  return (
    <AppProviders>
      <ErrorBoundary>
        <RootNavigator />
      </ErrorBoundary>
      {/* Outside the boundary, not inside it: the gate renders nothing until
          there is a verified bundle waiting, and an update must never be able
          to take the app down with it. */}
      <UpdateGate />
    </AppProviders>
  );
}
