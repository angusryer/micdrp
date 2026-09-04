import React from 'react';
import AppProviders from './src/app/providers';
import RootNavigator from './src/navigation/RootNavigator';
import ErrorBoundary from './src/screens/ErrorBoundary';
import { initUpdates, UpdateGate } from './src/updates';
import { registerNativeProbe } from './src/audio/outputRoute';
import { applyEngineConfig } from './src/audio/engineSettings';

// Start the updater before the tree mounts, so the native layer's launch
// report — which decides whether the bundle now running is one to keep — is
// handled on the first render rather than after a screen has already drawn.
// A build with no update server configured returns immediately.
initUpdates();

// Fill the audio-route probe from the native side. Done here rather than
// lazily so the first thing to ask — Practice deciding whether it may play the
// reference while recording — already has a real answer.
registerNativeProbe();

// Hand the singer's engine settings to the engine before anything can ask it
// for a reading. Stored settings used to be read back only by the screen that
// wrote them, so the detector ran on its compiled-in defaults for ever and
// every control on that screen was inert (INV-ACCOUNT-015).
void applyEngineConfig();

export default function App() {
  return (
    <AppProviders>
      <ErrorBoundary>
        <RootNavigator />
      </ErrorBoundary>
      {/* Outside the boundary, not inside it: a failed update must never be
          able to take the app down with it. The feedback control is not here
          — it lives in the navigator's header, where the safe area is already
          accounted for (INV-DOG-014). */}
      <UpdateGate />
    </AppProviders>
  );
}
