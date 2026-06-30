/**
 * ErrorBoundary — last-resort recovery surface.
 *
 * Catches render-time crashes anywhere below it and shows a themed, localized
 * fallback with a "Try again" action that clears the error and re-mounts the
 * subtree (rather than stranding the user on a blank white screen). The visual
 * fallback is a function component so it can read theme + i18n via hooks; the
 * boundary itself must stay a class to use the error lifecycle.
 *
 * Mounted inside the app providers so the fallback has theme and translation
 * context available.
 */
import React, { PureComponent, useContext, type ReactElement } from 'react';
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import AppError from '../utilities/errors';
import { ThemeContext } from '../theme';
import { useTranslation } from '../i18n';

/**
 * Minimal colours used if the boundary renders without a ThemeProvider above it
 * (e.g. a provider itself threw). Keeps the recovery screen legible regardless.
 */
const FALLBACK_COLORS = {
  neutral300: '#13161C',
  typography: '#ECEEF2',
  gray300: '#9BA1AD',
  primary500: '#3D7BE0',
  white: '#FFFFFF'
};

interface ErrorBoundaryProps {
  children: ReactElement;
}

interface State {
  error: AppError | undefined;
}

/** Themed, localized fallback UI shown when the boundary has caught an error. */
function ErrorFallback({ onRetry }: { onRetry: () => void }): React.JSX.Element {
  const theme = useContext(ThemeContext);
  const colors = theme?.colors ?? FALLBACK_COLORS;
  const { t } = useTranslation();
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.neutral300 }]}>
      <View style={styles.center}>
        <Text style={[styles.title, { color: colors.typography }]}>
          {t('errorScreen.title')}
        </Text>
        <Text style={[styles.body, { color: colors.gray300 }]}>
          {t('errorScreen.body')}
        </Text>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.primary500 }]}
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel={t('common.retry')}
        >
          <Text style={[styles.buttonText, { color: colors.white }]}>
            {t('common.retry')}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

export default class ErrorBoundary extends PureComponent<
  ErrorBoundaryProps,
  State
> {
  state: State = {
    error: undefined
  };

  static getDerivedStateFromError(error: unknown): State {
    return {
      error: new AppError(error)
    };
  }

  async componentDidCatch() {
    // const appError = new AppError(error, { stack: componentStack });
    // Send to log endpoint
  }

  /** Clear the caught error so the children re-mount and the app recovers. */
  handleRetry = (): void => {
    this.setState({ error: undefined });
  };

  render() {
    if (this.state.error) {
      return <ErrorFallback onRetry={this.handleRetry} />;
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12
  },
  title: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  body: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  button: {
    height: 48,
    borderRadius: 12,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12
  },
  buttonText: { fontSize: 16, fontWeight: '700' }
});
