/**
 * PracticeScreen — pick a target exercise to sing against (the Practice tab).
 *
 * Lists the built-in `logic` melody catalogue plus two global controls (key /
 * pace). Selecting a melody navigates to the PracticeSession route with the
 * chosen melody id + transposition, where the take is recorded against it.
 *
 * Presentational + light state only; the exercise data and timing live in
 * `logic`, the session orchestration in `usePracticeSession`.
 */
import React, { useCallback, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { PRACTICE_MELODIES } from 'logic';

import { useTheme } from '../../theme';
import { useTranslation } from '../../i18n';
import type {
  MainTabParamList,
  RootStackParamList
} from '../../navigation/types';
import { midiToLabel } from '../Results/NoteList';

export type PracticeScreenProps = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Practice'>,
  NativeStackScreenProps<RootStackParamList>
>;

type PracticeNavigation = PracticeScreenProps['navigation'];

/** Pace presets → ms per note. */
const PACES = [
  { key: 'slow', noteDurationMs: 700 },
  { key: 'medium', noteDurationMs: 500 },
  { key: 'fast', noteDurationMs: 350 }
] as const;

const MIN_ROOT_MIDI = 48; // C3
const MAX_ROOT_MIDI = 72; // C5
const DEFAULT_ROOT_MIDI = 60; // C4

export function PracticeScreen(): React.JSX.Element {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<PracticeNavigation>();

  const [rootMidi, setRootMidi] = useState(DEFAULT_ROOT_MIDI);
  const [paceIndex, setPaceIndex] = useState(1); // medium

  const noteDurationMs = PACES[paceIndex].noteDurationMs;

  const stepRoot = useCallback((delta: number) => {
    setRootMidi((m) => Math.min(MAX_ROOT_MIDI, Math.max(MIN_ROOT_MIDI, m + delta)));
  }, []);

  const start = useCallback(
    (melodyId: string) => {
      navigation.navigate('PracticeSession', {
        melodyId,
        rootMidi,
        noteDurationMs
      });
    },
    [navigation, rootMidi, noteDurationMs]
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.neutral300 }]}>
      <View style={styles.header}>
        <Text style={[styles.heading, { color: colors.typography }]}>
          {t('practice.title')}
        </Text>
        <Text style={[styles.subtitle, { color: colors.gray300 }]}>
          {t('practice.subtitle')}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ---- Global controls ---- */}
        <View
          style={[
            styles.controls,
            { backgroundColor: colors.neutral100, borderColor: colors.neutral500 }
          ]}
        >
          <View style={styles.controlRow}>
            <Text style={[styles.controlLabel, { color: colors.typography }]}>
              {t('practice.key')}
            </Text>
            <View style={styles.stepper}>
              <TouchableOpacity
                onPress={() => stepRoot(-1)}
                disabled={rootMidi <= MIN_ROOT_MIDI}
                style={[styles.stepBtn, { backgroundColor: colors.neutral300, opacity: rootMidi <= MIN_ROOT_MIDI ? 0.35 : 1 }]}
                accessibilityLabel={t('practice.keyDown')}
              >
                <Text style={[styles.stepBtnText, { color: colors.primary500 }]}>−</Text>
              </TouchableOpacity>
              <Text style={[styles.stepValue, { color: colors.typography }]}>
                {midiToLabel(rootMidi)}
              </Text>
              <TouchableOpacity
                onPress={() => stepRoot(1)}
                disabled={rootMidi >= MAX_ROOT_MIDI}
                style={[styles.stepBtn, { backgroundColor: colors.neutral300, opacity: rootMidi >= MAX_ROOT_MIDI ? 0.35 : 1 }]}
                accessibilityLabel={t('practice.keyUp')}
              >
                <Text style={[styles.stepBtnText, { color: colors.primary500 }]}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.controlRow}>
            <Text style={[styles.controlLabel, { color: colors.typography }]}>
              {t('practice.pace')}
            </Text>
            <View style={styles.paceRow}>
              {PACES.map((p, i) => (
                <TouchableOpacity
                  key={p.key}
                  onPress={() => setPaceIndex(i)}
                  style={[
                    styles.paceChip,
                    {
                      backgroundColor: i === paceIndex ? colors.primary500 : colors.neutral300
                    }
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: i === paceIndex }}
                >
                  <Text
                    style={[
                      styles.paceChipText,
                      { color: i === paceIndex ? colors.white : colors.typography }
                    ]}
                  >
                    {t(`practice.paces.${p.key}`)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* ---- Melody list ---- */}
        {PRACTICE_MELODIES.map((melody) => (
          <TouchableOpacity
            key={melody.id}
            onPress={() => start(melody.id)}
            style={[
              styles.card,
              { backgroundColor: colors.neutral100, borderColor: colors.neutral500 }
            ]}
            accessibilityRole="button"
            accessibilityLabel={t('practice.startLabel', { name: melody.name })}
          >
            <View style={styles.cardText}>
              <Text style={[styles.cardTitle, { color: colors.typography }]}>
                {melody.name}
              </Text>
              <Text style={[styles.cardDesc, { color: colors.gray300 }]}>
                {melody.description}
              </Text>
            </View>
            <Text style={[styles.cardStart, { color: colors.primary500 }]}>
              {t('practice.start')}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  heading: { fontSize: 28, fontWeight: '700' },
  subtitle: { fontSize: 14, marginTop: 2 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 40 },
  controls: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 20
  },
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10
  },
  controlLabel: { fontSize: 15, fontWeight: '500' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  stepBtnText: { fontSize: 20, fontWeight: '600' },
  stepValue: { fontSize: 16, fontWeight: '600', minWidth: 48, textAlign: 'center' },
  paceRow: { flexDirection: 'row', gap: 8 },
  paceChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16 },
  paceChipText: { fontSize: 13, fontWeight: '600' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 12
  },
  cardText: { flex: 1, paddingRight: 12 },
  cardTitle: { fontSize: 17, fontWeight: '600' },
  cardDesc: { fontSize: 13, marginTop: 4 },
  cardStart: { fontSize: 15, fontWeight: '700' }
});

export default PracticeScreen;
