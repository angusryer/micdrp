/**
 * PracticeSessionScreen — run one practice take against the chosen melody.
 *
 * Drives {@link usePracticeSession}: tap Start → (count-in or play-along) →
 * record while the target + live pitch scroll in sync on {@link PracticePitchView}
 * → auto-stop after the melody's length → navigate to Results with the practice
 * params so scoring targets the same melody.
 *
 * The screen owns only the transport timer (auto-stop) and coarse phase UI; the
 * per-frame pitch never touches React state.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { findMelody } from 'logic';

import { useTheme } from '../../theme';
import { useTranslation } from '../../i18n';
import type { RootStackParamList } from '../../navigation/types';
import { usePracticeSession } from './usePracticeSession';
import { PracticePitchView } from './PracticePitchView';

type Props = NativeStackScreenProps<RootStackParamList, 'PracticeSession'>;

const CANVAS_MARGIN = 16;
const CANVAS_HEIGHT = 260;

export default function PracticeSessionScreen({
  route,
  navigation
}: Props): React.JSX.Element {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const params = route.params;

  const {
    phase,
    targets,
    durationMs,
    sharedMidi,
    sharedFrame,
    fps,
    begin,
    finish,
    cancel
  } = usePracticeSession(params);

  const [error, setError] = useState<string | null>(null);

  const melodyName = findMelody(params.melodyId)?.name ?? '';

  const handleStart = useCallback((): void => {
    setError(null);
    begin().catch(() => {
      setError(t('practice.session.micDenied'));
    });
  }, [begin, t]);

  const handleCancel = useCallback((): void => {
    cancel()
      .catch(() => undefined)
      .finally(() => navigation.goBack());
  }, [cancel, navigation]);

  const finishAndGo = useCallback((): void => {
    finish()
      .then((handle) => {
        navigation.replace('Results', { handle, practice: params });
      })
      .catch(() => {
        setError(t('practice.session.failed'));
      });
  }, [finish, navigation, params, t]);

  // Stop button: while recording, finish early and score the partial take;
  // during the count-in, abort back to the picker.
  const handleStopPress = useCallback((): void => {
    if (phase === 'recording') {
      finishAndGo();
    } else {
      handleCancel();
    }
  }, [phase, finishAndGo, handleCancel]);

  // Auto-stop once the melody's length has elapsed, then go to Results. Stopping
  // early (manual) flips the phase, which clears this timer via the cleanup.
  useEffect(() => {
    if (phase !== 'recording') {
      return;
    }
    const timer = setTimeout(finishAndGo, durationMs);
    return () => clearTimeout(timer);
  }, [phase, durationMs, finishAndGo]);

  const isPreparing = phase === 'preparing' || phase === 'countIn';

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.neutral300 }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.typography }]}>{melodyName}</Text>
        <Text style={[styles.status, { color: colors.gray300 }]}>
          {phase === 'recording'
            ? t('practice.session.sing')
            : isPreparing
              ? t('practice.session.listen')
              : phase === 'analyzing'
                ? t('practice.session.analyzing')
                : t('practice.session.getReady')}
        </Text>
      </View>

      <View
        style={[
          styles.canvasWrap,
          { backgroundColor: colors.neutral50, borderColor: colors.neutral500 }
        ]}
      >
        <PracticePitchView
          sharedMidi={sharedMidi}
          sharedFrame={sharedFrame}
          targets={targets}
          width={width - 2 * CANVAS_MARGIN}
          height={CANVAS_HEIGHT}
          fps={fps}
        />
      </View>

      {error ? (
        <Text style={[styles.error, { color: colors.error }]}>{error}</Text>
      ) : null}

      <View style={styles.controls}>
        {phase === 'idle' ? (
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: colors.primary500 }]}
            onPress={handleStart}
            accessibilityRole="button"
            accessibilityLabel={t('practice.session.start')}
          >
            <Text style={[styles.primaryBtnText, { color: colors.white }]}>
              {t('practice.session.start')}
            </Text>
          </TouchableOpacity>
        ) : phase === 'analyzing' ? (
          <ActivityIndicator color={colors.primary500} />
        ) : (
          <TouchableOpacity
            style={[styles.stopBtn, { borderColor: colors.error }]}
            onPress={handleStopPress}
            accessibilityRole="button"
            accessibilityLabel={t('practice.session.stop')}
          >
            <Text style={[styles.stopBtnText, { color: colors.error }]}>
              {t('practice.session.stop')}
            </Text>
          </TouchableOpacity>
        )}

        {phase === 'idle' ? (
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={handleCancel}
            accessibilityRole="button"
            accessibilityLabel={t('practice.session.back')}
          >
            <Text style={[styles.cancelText, { color: colors.gray500 }]}>
              {t('practice.session.back')}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { alignItems: 'center', paddingTop: 16, paddingBottom: 12 },
  title: { fontSize: 22, fontWeight: '700' },
  status: { fontSize: 15, marginTop: 4 },
  canvasWrap: {
    marginHorizontal: CANVAS_MARGIN,
    height: CANVAS_HEIGHT,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden'
  },
  error: { fontSize: 14, textAlign: 'center', marginTop: 12, marginHorizontal: 16 },
  controls: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  primaryBtn: {
    height: 56,
    paddingHorizontal: 48,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center'
  },
  primaryBtnText: { fontSize: 18, fontWeight: '700' },
  stopBtn: {
    height: 56,
    paddingHorizontal: 40,
    borderRadius: 28,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center'
  },
  stopBtnText: { fontSize: 16, fontWeight: '700' },
  cancelBtn: { paddingVertical: 8 },
  cancelText: { fontSize: 14, fontWeight: '600' }
});
