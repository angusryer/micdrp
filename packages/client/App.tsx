import React from 'react';
import AppProviders from './src/app/providers';
import RootNavigator from './src/navigation/RootNavigator';
import ErrorBoundary from './src/screens/ErrorBoundary';
import { initUpdates, UpdateGate } from './src/updates';
import { DogfoodControl } from './src/dogfood';

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
      {/* Outside the boundary, not inside it: neither an update nor a
          feedback recording may take the app down with it. The control sits
          above the navigator so a recording survives navigating (INV-DOG-002)
          — a header button would unmount and take the clip with it. */}
      <DogfoodControl />
      <UpdateGate />
    </AppProviders>
  );
}
