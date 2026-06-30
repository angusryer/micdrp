/**
 * SettingsScreen — engine tuning + appearance (WP-SETTINGS-UI).
 *
 * Three collapsible sections:
 *   - Engine: sliders/steppers for EngineConfig fields persisted via useSettings.
 *   - Appearance: theme palette swatch picker (Blue / Red / Green).
 *   - About: app version.
 *
 * All controls are built from RN primitives (no extra slider library).  Each
 * numeric EngineConfig field is rendered as a row stepper: the current value is
 * shown between a "−" and "+" button, both constrained within the field's min/max.
 * The clarityThreshold (0..1, step 0.01) uses a finer step.
 *
 * Theme palette changes go straight to the ThemeProvider (the single owner of
 * the active palette via `useTheme().setPalette`), which recolors the whole app
 * live and persists the choice for the next launch.
 *
 * Typed as `BottomTabScreenProps<MainTabParamList, 'Settings'>`.
 * See docs/NATIVE_BUILD_PLAN.md §3 (WP-SETTINGS-UI).
 */
import React, { useCallback } from 'react';
import {
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';

import { DEFAULT_ENGINE_CONFIG, type EngineConfig } from '../../audio/contract';
import { ETheme } from '../../configs/theme';
import { useTheme } from '../../theme';
import { useTranslation } from '../../i18n';
import type { MainTabParamList } from '../../navigation/types';
import { useSettings } from './useSettings';
import { version as PACKAGE_VERSION } from '../../../package.json';

export type SettingsScreenProps = BottomTabScreenProps<MainTabParamList, 'Settings'>;

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface SectionProps {
  /** Already-translated section title string. */
  title: string;
  children: React.ReactNode;
}

function Section({ title, children }: SectionProps): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.gray500 }]}>{title}</Text>
      <View style={[styles.sectionCard, { backgroundColor: colors.neutral100, borderColor: colors.neutral500 }]}>
        {children}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Stepper control
// ---------------------------------------------------------------------------

interface StepperRowProps {
  label: string;
  value: number;
  step: number;
  min: number;
  max: number;
  decimals?: number;
  unit?: string;
  onDecrease(): void;
  onIncrease(): void;
}

function StepperRow({
  label,
  value,
  step,
  min,
  max,
  decimals = 0,
  unit,
  onDecrease,
  onIncrease
}: StepperRowProps): React.JSX.Element {
  const { colors } = useTheme();
  const atMin = value <= min;
  const atMax = value >= max;

  return (
    <View style={[styles.row, { borderBottomColor: colors.neutral500 }]}>
      <Text style={[styles.rowLabel, { color: colors.typography }]}>{label}</Text>
      <View style={styles.stepper}>
        <TouchableOpacity
          onPress={onDecrease}
          disabled={atMin}
          style={[styles.stepBtn, { backgroundColor: colors.neutral300, opacity: atMin ? 0.35 : 1 }]}
          accessibilityLabel={`Decrease ${label}`}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={[styles.stepBtnText, { color: colors.primary500 }]}>{'−'}</Text>
        </TouchableOpacity>

        <Text style={[styles.stepValue, { color: colors.typography }]}>
          {value.toFixed(decimals)}
          {unit ? ` ${unit}` : ''}
        </Text>

        <TouchableOpacity
          onPress={onIncrease}
          disabled={atMax}
          style={[styles.stepBtn, { backgroundColor: colors.neutral300, opacity: atMax ? 0.35 : 1 }]}
          accessibilityLabel={`Increase ${label}`}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={[styles.stepBtnText, { color: colors.primary500 }]}>{'+'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Helpers to step a single EngineConfig field
// ---------------------------------------------------------------------------

type StepDirection = 'increase' | 'decrease';

interface FieldSpec {
  key: keyof EngineConfig;
  label: string;
  step: number;
  min: number;
  max: number;
  decimals?: number;
  unit?: string;
}

/** Translation keys for each engine field label, in ENGINE_FIELDS order. */
const ENGINE_FIELD_LABEL_KEYS: Record<keyof EngineConfig, string> = {
  sampleRateHz: 'settings.engine.frameSize', // not editable but mapped for completeness
  frameSize: 'settings.engine.frameSize',
  hopSize: 'settings.engine.hopSize',
  minFrequencyHz: 'settings.engine.minFrequency',
  maxFrequencyHz: 'settings.engine.maxFrequency',
  clarityThreshold: 'settings.engine.clarityThreshold',
  emitRateHz: 'settings.engine.emitRate'
};

const ENGINE_FIELDS: FieldSpec[] = [
  { key: 'frameSize',        label: ENGINE_FIELD_LABEL_KEYS.frameSize,        step: 512,  min: 512,  max: 8192, unit: 'samples' },
  { key: 'hopSize',          label: ENGINE_FIELD_LABEL_KEYS.hopSize,          step: 256,  min: 256,  max: 4096, unit: 'samples' },
  { key: 'minFrequencyHz',   label: ENGINE_FIELD_LABEL_KEYS.minFrequencyHz,   step: 10,   min: 20,   max: 500,  unit: 'Hz' },
  { key: 'maxFrequencyHz',   label: ENGINE_FIELD_LABEL_KEYS.maxFrequencyHz,   step: 50,   min: 200,  max: 4000, unit: 'Hz' },
  { key: 'clarityThreshold', label: ENGINE_FIELD_LABEL_KEYS.clarityThreshold, step: 0.05, min: 0,    max: 1,    decimals: 2 },
  { key: 'emitRateHz',       label: ENGINE_FIELD_LABEL_KEYS.emitRateHz,       step: 10,   min: 10,   max: 120,  unit: 'Hz' }
];

function clampedStep(
  value: number,
  direction: StepDirection,
  step: number,
  min: number,
  max: number
): number {
  const next = direction === 'increase' ? value + step : value - step;
  return Math.min(max, Math.max(min, parseFloat(next.toFixed(10))));
}

// ---------------------------------------------------------------------------
// Palette swatch
// ---------------------------------------------------------------------------

const PALETTE_DISPLAY: { palette: ETheme; label: string; swatch: string }[] = [
  { palette: ETheme.Blue,  label: 'Blue',  swatch: '#0F52BA' },
  { palette: ETheme.Red,   label: 'Red',   swatch: '#E0115F' },
  { palette: ETheme.Green, label: 'Green', swatch: '#008080' }
];

interface PaletteSwatchProps {
  palette: ETheme;
  label: string;
  swatch: string;
  selected: boolean;
  onPress(): void;
}

function PaletteSwatch({
  label,
  swatch,
  selected,
  onPress
}: PaletteSwatchProps): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      style={styles.swatchWrap}
      accessibilityRole="button"
      accessibilityLabel={`${label} theme`}
      accessibilityState={{ selected }}
    >
      <View
        style={[
          styles.swatchCircle,
          { backgroundColor: swatch },
          selected && { borderWidth: 3, borderColor: colors.typography }
        ]}
      />
      <Text style={[styles.swatchLabel, { color: colors.typography }]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export function SettingsScreen(_props: SettingsScreenProps): React.JSX.Element {
  // The active palette is owned by the ThemeProvider so changing it recolors the
  // whole app live; engine tuning stays in useSettings.
  const { colors, palette: themePalette, setPalette } = useTheme();
  const { t } = useTranslation();
  const { engineConfig, setEngineConfig, resetEngineConfig } = useSettings();

  const makeStepHandler = useCallback(
    (field: FieldSpec, direction: StepDirection) => (): void => {
      const current: number = engineConfig[field.key];
      const next = clampedStep(current, direction, field.step, field.min, field.max);
      // Every EngineConfig field is a number, so writing a single key into a
      // typed partial is fully type-safe (no `any`, no assertion).
      const override: Partial<EngineConfig> = {};
      override[field.key] = next;
      setEngineConfig(override);
    },
    [engineConfig, setEngineConfig]
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.neutral300 }]}>
      <View style={styles.header}>
        <Text style={[styles.heading, { color: colors.typography }]}>
          {t('settings.title')}
        </Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ---- Engine section ---- */}
        <Section title={t('settings.sections.engine').toUpperCase()}>
          {ENGINE_FIELDS.map((field, idx) => {
            const value = engineConfig[field.key];
            const isLast = idx === ENGINE_FIELDS.length - 1;
            const translatedLabel = t(field.label);
            return (
              <View key={field.key} style={isLast && styles.lastRow}>
                <StepperRow
                  label={translatedLabel}
                  value={value}
                  step={field.step}
                  min={field.min}
                  max={field.max}
                  decimals={field.decimals}
                  unit={field.unit}
                  onDecrease={makeStepHandler(field, 'decrease')}
                  onIncrease={makeStepHandler(field, 'increase')}
                />
              </View>
            );
          })}

          {/* Reset row */}
          <View style={styles.resetRow}>
            <TouchableOpacity
              onPress={resetEngineConfig}
              accessibilityLabel={t('settings.engine.resetAccessibility')}
              accessibilityRole="button"
            >
              <Text style={[styles.resetText, { color: colors.error }]}>
                {t('settings.engine.resetToDefaults')}
              </Text>
            </TouchableOpacity>
          </View>
        </Section>

        {/* ---- Appearance section ---- */}
        <Section title={t('settings.sections.appearance').toUpperCase()}>
          <View style={styles.paletteRow}>
            {PALETTE_DISPLAY.map(({ palette, label, swatch }) => {
              const translatedLabel = t(`settings.appearance.palettes.${label.toLowerCase()}`);
              return (
                <PaletteSwatch
                  key={palette}
                  palette={palette}
                  label={translatedLabel}
                  swatch={swatch}
                  selected={themePalette === palette}
                  onPress={() => setPalette(palette)}
                />
              );
            })}
          </View>
          <Text style={[styles.paletteHint, { color: colors.gray300 }]}>
            {t('settings.appearance.themeHint')}
          </Text>
        </Section>

        {/* ---- About section ---- */}
        <Section title={t('settings.sections.about').toUpperCase()}>
          <View style={[styles.row, styles.lastRow, { borderBottomColor: 'transparent' }]}>
            <Text style={[styles.rowLabel, { color: colors.typography }]}>
              {t('settings.about.appVersion')}
            </Text>
            <Text style={[styles.rowValue, { color: colors.gray300 }]}>
              {APP_VERSION}
            </Text>
          </View>
          <View style={[styles.row, styles.lastRow, { borderBottomColor: 'transparent' }]}>
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
          <View style={[styles.row, styles.lastRow, { borderBottomColor: 'transparent' }]}>
            <Text style={[styles.rowLabel, { color: colors.typography }]}>
              {t('settings.about.defaultSampleRate')}
            </Text>
            <Text style={[styles.rowValue, { color: colors.gray300 }]}>
              {DEFAULT_ENGINE_CONFIG.sampleRateHz.toLocaleString()} Hz
            </Text>
          </View>
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// App version — statically imported from package metadata (no `require`, no
// network calls, no secrets). `resolveJsonModule` types the import.
// ---------------------------------------------------------------------------

const APP_VERSION: string = PACKAGE_VERSION;

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  safe: {
    flex: 1
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12
  },
  heading: {
    fontSize: 28,
    fontWeight: '700'
  },
  scroll: {
    flex: 1
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40
  },

  // Section
  section: {
    marginBottom: 28
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 6,
    marginLeft: 4
  },
  sectionCard: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden'
  },

  // Row (stepper + about rows)
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth
  },
  lastRow: {
    borderBottomWidth: 0
  },
  rowLabel: {
    fontSize: 15,
    flex: 1
  },
  rowValue: {
    fontSize: 15
  },

  // Stepper
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  stepBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  stepBtnText: {
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 24
  },
  stepValue: {
    fontSize: 14,
    fontWeight: '500',
    minWidth: 80,
    textAlign: 'center'
  },

  // Reset
  resetRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'flex-start'
  },
  resetText: {
    fontSize: 14,
    fontWeight: '600'
  },

  // Palette
  paletteRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 4,
    gap: 24
  },
  paletteHint: {
    fontSize: 12,
    paddingHorizontal: 16,
    paddingBottom: 14
  },
  swatchWrap: {
    alignItems: 'center',
    gap: 6
  },
  swatchCircle: {
    width: 40,
    height: 40,
    borderRadius: 20
  },
  swatchLabel: {
    fontSize: 12,
    fontWeight: '500'
  }
});

export default SettingsScreen;
