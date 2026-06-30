/**
 * AccountScreen — the consolidated Account & Settings surface.
 *
 * Merges the former Profile and Settings tabs into one screen reached from a
 * header button on every tab. Sections, top to bottom:
 *   • Account     — email, display name, sign out, delete account.
 *   • Analysis    — chord-inference tuning (window, vocabulary, key-relative,
 *                   confidence floor), since a melody only *implies* harmony.
 *   • Engine      — DSP tuning steppers.
 *   • Appearance  — live theme palette.
 *   • About       — version / platform.
 *
 * Presentational over three hooks (`useProfile`, `useSettings`,
 * `useAnalysisSettings`) + the ThemeProvider. No audio-path work.
 */
import React, { useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { DEFAULT_ENGINE_CONFIG, type EngineConfig } from '../../audio/contract';
import { ETheme } from '../../configs/theme';
import { useTheme } from '../../theme';
import { useTranslation } from '../../i18n';
import type { RootStackParamList } from '../../navigation/types';
import { version as PACKAGE_VERSION } from '../../../package.json';
import { useProfile } from './useProfile';
import { useSettings } from './useSettings';
import { useAnalysisSettings } from './useAnalysisSettings';

type Props = NativeStackScreenProps<RootStackParamList, 'Account'>;

// ---------------------------------------------------------------------------
// Reusable bits
// ---------------------------------------------------------------------------

function Section({
  title,
  children
}: {
  title: string;
  children: React.ReactNode;
}): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.gray500 }]}>
        {title}
      </Text>
      <View
        style={[
          styles.card,
          { backgroundColor: colors.neutral100, borderColor: colors.neutral500 }
        ]}
      >
        {children}
      </View>
    </View>
  );
}

function StepperRow({
  label,
  value,
  display,
  atMin,
  atMax,
  onDecrease,
  onIncrease
}: {
  label: string;
  value: number;
  display: string;
  atMin: boolean;
  atMax: boolean;
  onDecrease(): void;
  onIncrease(): void;
}): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <View style={[styles.row, { borderBottomColor: colors.neutral500 }]}>
      <Text style={[styles.rowLabel, { color: colors.typography }]}>
        {label}
      </Text>
      <View style={styles.stepper}>
        <TouchableOpacity
          onPress={onDecrease}
          disabled={atMin}
          style={[
            styles.stepBtn,
            { backgroundColor: colors.neutral300, opacity: atMin ? 0.35 : 1 }
          ]}
          accessibilityLabel={`Decrease ${label}`}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={[styles.stepBtnText, { color: colors.primary500 }]}>
            {'−'}
          </Text>
        </TouchableOpacity>
        <Text style={[styles.stepValue, { color: colors.typography }]}>
          {display}
        </Text>
        <TouchableOpacity
          onPress={onIncrease}
          disabled={atMax}
          style={[
            styles.stepBtn,
            { backgroundColor: colors.neutral300, opacity: atMax ? 0.35 : 1 }
          ]}
          accessibilityLabel={`Increase ${label}`}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={[styles.stepBtnText, { color: colors.primary500 }]}>
            {'+'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

interface EngineFieldSpec {
  key: keyof EngineConfig;
  labelKey: string;
  step: number;
  min: number;
  max: number;
  decimals?: number;
  unit?: string;
}

const ENGINE_FIELDS: EngineFieldSpec[] = [
  { key: 'frameSize', labelKey: 'settings.engine.frameSize', step: 512, min: 512, max: 8192, unit: 'samples' },
  { key: 'hopSize', labelKey: 'settings.engine.hopSize', step: 256, min: 256, max: 4096, unit: 'samples' },
  { key: 'minFrequencyHz', labelKey: 'settings.engine.minFrequency', step: 10, min: 20, max: 500, unit: 'Hz' },
  { key: 'maxFrequencyHz', labelKey: 'settings.engine.maxFrequency', step: 50, min: 200, max: 4000, unit: 'Hz' },
  { key: 'clarityThreshold', labelKey: 'settings.engine.clarityThreshold', step: 0.05, min: 0, max: 1, decimals: 2 },
  { key: 'emitRateHz', labelKey: 'settings.engine.emitRate', step: 10, min: 10, max: 120, unit: 'Hz' }
];

const PALETTE_DISPLAY: { palette: ETheme; label: string; swatch: string }[] = [
  { palette: ETheme.Blue, label: 'blue', swatch: '#0F52BA' },
  { palette: ETheme.Red, label: 'red', swatch: '#E0115F' },
  { palette: ETheme.Green, label: 'green', swatch: '#008080' }
];

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, parseFloat(value.toFixed(10))));
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function AccountScreen(_props: Props): React.JSX.Element {
  const { colors, palette, setPalette } = useTheme();
  const { t } = useTranslation();

  const {
    email,
    loading,
    error,
    displayName,
    setDisplayName,
    dirty,
    saving,
    save,
    deleting,
    deleteAccount,
    signOut
  } = useProfile();
  const { engineConfig, setEngineConfig, resetEngineConfig } = useSettings();
  const { chordInference, setChordInference, resetChordInference } =
    useAnalysisSettings();

  const inputStyle = useMemo(
    () => [
      styles.input,
      {
        backgroundColor: colors.neutral100,
        borderColor: colors.neutral500,
        color: colors.typography
      }
    ],
    [colors]
  );

  const confirmDelete = useCallback((): void => {
    Alert.alert(
      t('profile.delete.confirmTitle'),
      t('profile.delete.confirmBody'),
      [
        { text: t('profile.delete.cancel'), style: 'cancel' },
        {
          text: t('profile.delete.confirm'),
          style: 'destructive',
          onPress: () => void deleteAccount()
        }
      ]
    );
  }, [t, deleteAccount]);

  const stepEngine = useCallback(
    (field: EngineFieldSpec, dir: 1 | -1) => (): void => {
      const current: number = engineConfig[field.key];
      const next = clamp(current + dir * field.step, field.min, field.max);
      const override: Partial<EngineConfig> = {};
      override[field.key] = next;
      setEngineConfig(override);
    },
    [engineConfig, setEngineConfig]
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.neutral300 }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ---- Account ---- */}
        <Section title={t('profile.sections.account').toUpperCase()}>
          <View style={[styles.row, { borderBottomColor: colors.neutral500 }]}>
            <Text style={[styles.rowLabel, { color: colors.typography }]}>
              {t('profile.email')}
            </Text>
            <Text style={[styles.rowValue, { color: colors.gray300 }]}>
              {email ?? '—'}
            </Text>
          </View>
          <View style={styles.fieldBlock}>
            <Text style={[styles.fieldLabel, { color: colors.gray500 }]}>
              {t('profile.displayName')}
            </Text>
            <TextInput
              style={inputStyle}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder={t('profile.displayNamePlaceholder')}
              placeholderTextColor={colors.gray300}
              autoCapitalize="words"
              autoCorrect={false}
              editable={!saving && !loading}
              accessibilityLabel={t('profile.displayName')}
            />
            <TouchableOpacity
              style={[
                styles.primaryButton,
                {
                  backgroundColor: colors.primary500,
                  opacity: dirty && !saving ? 1 : 0.5
                }
              ]}
              onPress={() => void save()}
              disabled={!dirty || saving}
              accessibilityRole="button"
              accessibilityLabel={t('profile.save')}
            >
              {saving ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={[styles.primaryButtonText, { color: colors.white }]}>
                  {t('profile.save')}
                </Text>
              )}
            </TouchableOpacity>
            {error ? (
              <Text style={[styles.error, { color: colors.error }]}>{error}</Text>
            ) : null}
          </View>
        </Section>

        <TouchableOpacity
          style={[
            styles.actionButton,
            { borderColor: colors.neutral500, backgroundColor: colors.neutral100 }
          ]}
          onPress={() => void signOut()}
          accessibilityRole="button"
          accessibilityLabel={t('profile.signOut')}
        >
          <Text style={[styles.actionText, { color: colors.typography }]}>
            {t('profile.signOut')}
          </Text>
        </TouchableOpacity>

        {/* ---- Analysis (chord inference) ---- */}
        <Section title={t('settings.sections.analysis').toUpperCase()}>
          <StepperRow
            label={t('settings.analysis.windowMs')}
            value={chordInference.windowMs}
            display={`${chordInference.windowMs} ms`}
            atMin={chordInference.windowMs <= 500}
            atMax={chordInference.windowMs >= 6000}
            onDecrease={() =>
              setChordInference({
                windowMs: clamp(chordInference.windowMs - 250, 500, 6000)
              })
            }
            onIncrease={() =>
              setChordInference({
                windowMs: clamp(chordInference.windowMs + 250, 500, 6000)
              })
            }
          />
          {/* Vocabulary segmented control */}
          <View style={[styles.row, { borderBottomColor: colors.neutral500 }]}>
            <Text style={[styles.rowLabel, { color: colors.typography }]}>
              {t('settings.analysis.vocabulary')}
            </Text>
            <View style={styles.segment}>
              {(['triads', 'sevenths'] as const).map((v) => {
                const selected = chordInference.vocabulary === v;
                return (
                  <TouchableOpacity
                    key={v}
                    onPress={() => setChordInference({ vocabulary: v })}
                    style={[
                      styles.segmentBtn,
                      {
                        backgroundColor: selected
                          ? colors.primary500
                          : colors.neutral300
                      }
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                  >
                    <Text
                      style={[
                        styles.segmentText,
                        { color: selected ? colors.white : colors.typography }
                      ]}
                    >
                      {t(`settings.analysis.${v}`)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
          {/* Key-relative toggle */}
          <TouchableOpacity
            style={[styles.row, { borderBottomColor: colors.neutral500 }]}
            onPress={() =>
              setChordInference({ keyRelative: !chordInference.keyRelative })
            }
            accessibilityRole="switch"
            accessibilityState={{ checked: chordInference.keyRelative }}
          >
            <Text style={[styles.rowLabel, { color: colors.typography }]}>
              {t('settings.analysis.keyRelative')}
            </Text>
            <View
              style={[
                styles.toggle,
                {
                  backgroundColor: chordInference.keyRelative
                    ? colors.primary500
                    : colors.neutral500
                }
              ]}
            >
              <View
                style={[
                  styles.toggleKnob,
                  {
                    backgroundColor: colors.white,
                    alignSelf: chordInference.keyRelative
                      ? 'flex-end'
                      : 'flex-start'
                  }
                ]}
              />
            </View>
          </TouchableOpacity>
          <StepperRow
            label={t('settings.analysis.minConfidence')}
            value={chordInference.minConfidence}
            display={chordInference.minConfidence.toFixed(2)}
            atMin={chordInference.minConfidence <= 0}
            atMax={chordInference.minConfidence >= 0.9}
            onDecrease={() =>
              setChordInference({
                minConfidence: clamp(chordInference.minConfidence - 0.05, 0, 0.9)
              })
            }
            onIncrease={() =>
              setChordInference({
                minConfidence: clamp(chordInference.minConfidence + 0.05, 0, 0.9)
              })
            }
          />
          <View style={styles.resetRow}>
            <TouchableOpacity onPress={resetChordInference}>
              <Text style={[styles.resetText, { color: colors.error }]}>
                {t('settings.engine.resetToDefaults')}
              </Text>
            </TouchableOpacity>
          </View>
        </Section>

        {/* ---- Engine ---- */}
        <Section title={t('settings.sections.engine').toUpperCase()}>
          {ENGINE_FIELDS.map((field) => {
            const value = engineConfig[field.key];
            return (
              <StepperRow
                key={field.key}
                label={t(field.labelKey)}
                value={value}
                display={`${value.toFixed(field.decimals ?? 0)}${
                  field.unit ? ` ${field.unit}` : ''
                }`}
                atMin={value <= field.min}
                atMax={value >= field.max}
                onDecrease={stepEngine(field, -1)}
                onIncrease={stepEngine(field, 1)}
              />
            );
          })}
          <View style={styles.resetRow}>
            <TouchableOpacity
              onPress={resetEngineConfig}
              accessibilityRole="button"
              accessibilityLabel={t('settings.engine.resetAccessibility')}
            >
              <Text style={[styles.resetText, { color: colors.error }]}>
                {t('settings.engine.resetToDefaults')}
              </Text>
            </TouchableOpacity>
          </View>
        </Section>

        {/* ---- Appearance ---- */}
        <Section title={t('settings.sections.appearance').toUpperCase()}>
          <View style={styles.paletteRow}>
            {PALETTE_DISPLAY.map(({ palette: p, label, swatch }) => (
              <TouchableOpacity
                key={p}
                onPress={() => setPalette(p)}
                style={styles.swatchWrap}
                accessibilityRole="button"
                accessibilityState={{ selected: palette === p }}
                accessibilityLabel={`${label} theme`}
              >
                <View
                  style={[
                    styles.swatchCircle,
                    { backgroundColor: swatch },
                    palette === p && {
                      borderWidth: 3,
                      borderColor: colors.typography
                    }
                  ]}
                />
                <Text style={[styles.swatchLabel, { color: colors.typography }]}>
                  {t(`settings.appearance.palettes.${label}`)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Section>

        {/* ---- About ---- */}
        <Section title={t('settings.sections.about').toUpperCase()}>
          <View style={[styles.row, { borderBottomColor: 'transparent' }]}>
            <Text style={[styles.rowLabel, { color: colors.typography }]}>
              {t('settings.about.appVersion')}
            </Text>
            <Text style={[styles.rowValue, { color: colors.gray300 }]}>
              {PACKAGE_VERSION}
            </Text>
          </View>
          <View style={[styles.row, { borderBottomColor: 'transparent' }]}>
            <Text style={[styles.rowLabel, { color: colors.typography }]}>
              {t('settings.about.platform')}
            </Text>
            <Text style={[styles.rowValue, { color: colors.gray300 }]}>
              {Platform.OS === 'ios' ? 'iOS' : 'Android'}{' '}
              {typeof Platform.Version === 'number'
                ? Platform.Version.toString()
                : Platform.Version}
            </Text>
          </View>
        </Section>

        {/* ---- Danger zone ---- */}
        <TouchableOpacity
          style={[styles.actionButton, { borderColor: colors.error }]}
          onPress={confirmDelete}
          disabled={deleting}
          accessibilityRole="button"
          accessibilityLabel={t('profile.delete.action')}
        >
          {deleting ? (
            <ActivityIndicator color={colors.error} />
          ) : (
            <Text style={[styles.actionText, { color: colors.error }]}>
              {t('profile.delete.action')}
            </Text>
          )}
        </TouchableOpacity>
        <Text style={[styles.dangerHint, { color: colors.gray300 }]}>
          {t('profile.delete.hint')}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 48 },
  section: { marginBottom: 24 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 6,
    marginLeft: 4
  },
  card: { borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth
  },
  rowLabel: { fontSize: 15, flex: 1 },
  rowValue: { fontSize: 15, marginLeft: 12, flexShrink: 1, textAlign: 'right' },
  fieldBlock: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16 },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 8
  },
  input: {
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 16,
    marginBottom: 12
  },
  primaryButton: {
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center'
  },
  primaryButtonText: { fontSize: 15, fontWeight: '700' },
  error: { fontSize: 14, marginTop: 10 },
  actionButton: {
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16
  },
  actionText: { fontSize: 16, fontWeight: '600' },
  dangerHint: { fontSize: 12, marginHorizontal: 4, marginBottom: 8 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  stepBtnText: { fontSize: 20, fontWeight: '600', lineHeight: 24 },
  stepValue: {
    fontSize: 14,
    fontWeight: '500',
    minWidth: 92,
    textAlign: 'center'
  },
  segment: { flexDirection: 'row', gap: 6 },
  segmentBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8
  },
  segmentText: { fontSize: 13, fontWeight: '600' },
  toggle: {
    width: 46,
    height: 28,
    borderRadius: 14,
    padding: 3,
    justifyContent: 'center'
  },
  toggleKnob: { width: 22, height: 22, borderRadius: 11 },
  resetRow: { paddingHorizontal: 16, paddingVertical: 12, alignItems: 'flex-start' },
  resetText: { fontSize: 14, fontWeight: '600' },
  paletteRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 24
  },
  swatchWrap: { alignItems: 'center', gap: 6 },
  swatchCircle: { width: 40, height: 40, borderRadius: 20 },
  swatchLabel: { fontSize: 12, fontWeight: '500' }
});
