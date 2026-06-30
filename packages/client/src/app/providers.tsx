import React from 'react';
import { StatusBar, useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '../auth';
import { I18nProvider } from '../i18n';
import { ThemeProvider } from '../theme';

/**
 * App-wide providers. Order: gesture-handler root wraps everything, then
 * safe-area, i18n, theme, and finally the Supabase auth session (innermost so
 * screens and the navigator can read it). The audio engine and persistence
 * layers are singletons/hooks, so they are not mounted here.
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
        <I18nProvider>
          <ThemeProvider>
            <AuthProvider>
              <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
              {children}
            </AuthProvider>
          </ThemeProvider>
        </I18nProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
