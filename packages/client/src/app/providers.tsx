import React from 'react';
import { StatusBar, useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../theme';

/**
 * App-wide providers. Order matters: gesture-handler root must wrap everything,
 * then safe-area, then theme. The audio engine and persistence layers are
 * accessed via hooks/singletons (no provider needed), so they are not mounted
 * here.
 */
export default function AppProviders({
  children
}: {
  children: React.ReactNode;
}) {
  const isDark = useColorScheme() === 'dark';
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
          {children}
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
