/**
 * MelodyOctave — which register you are listening to the melody in.
 *
 * A phone speaker has almost nothing in the low register, so a line sung down
 * there cannot be judged on one at all. Moving it by whole octaves keeps every
 * interval intact: it is the same tune, somewhere audible.
 *
 * It says outright that this is playback only. The graph does not move when
 * this does (INV-NOTES-058), and a control that silently changed pitch while
 * the drawing stayed put would read as a bug rather than as a choice.
 *
 * A direction that would push a note out of MIDI range is disabled rather
 * than clamping the notes that would leave it (INV-NOTES-059).
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { octaveLabel } from 'logic';

import { useTheme } from '../../theme';
import { useTranslation } from '../../i18n';

export interface MelodyOctaveProps {
  octaves: number;
  /** How far it may still go each way, given where the melody already sits. */
  range: { down: number; up: number };
  onShift: (by: number) => void;
}

export function MelodyOctave({
  octaves,
  range,
  onShift
}: MelodyOctaveProps): React.JSX.Element {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const label = octaveLabel(octaves);

  return (
    <View style={styles.row}>
      <View style={styles.labels}>
        <Text style={[styles.title, { color: colors.typography }]}>
          {t('notes.octave')}
        </Text>
        <Text style={[styles.hint, { color: colors.gray300 }]}>
          {t('notes.octaveHint')}
        </Text>
      </View>
      <View style={styles.steppers}>
        <Step
          label="−"
          accessibilityLabel={t('notes.octaveDown')}
          isDisabled={octaves <= -range.down}
          onPress={() => onShift(-1)}
        />
        {/* Nothing at rest: an offset of zero is not information. */}
        <Text style={[styles.reading, { color: colors.typography }]}>
          {label ?? '·'}
        </Text>
        <Step
          label="+"
          accessibilityLabel={t('notes.octaveUp')}
          isDisabled={octaves >= range.up}
          onPress={() => onShift(1)}
        />
      </View>
    </View>
  );
}

function Step({
  label,
  accessibilityLabel,
  isDisabled,
  onPress
}: {
  label: string;
  accessibilityLabel: string;
  isDisabled: boolean;
  onPress: () => void;
}): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: isDisabled }}
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.step,
        {
          borderColor: colors.neutral500,
          backgroundColor: pressed ? colors.neutral300 : colors.neutral50,
          opacity: isDisabled ? 0.35 : 1
        }
      ]}
    >
      <Text style={[styles.stepText, { color: colors.primary500 }]}>
        {label}
      </Text>
    </Pressable>
  );
}

export default MelodyOctave;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    gap: 12
  },
  labels: { flexShrink: 1 },
  title: { fontSize: 14, fontWeight: '600' },
  hint: { fontSize: 11, marginTop: 1 },
  steppers: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  step: {
    borderWidth: 1,
    borderRadius: 999,
    width: 40,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center'
  },
  stepText: { fontSize: 18, fontWeight: '700', lineHeight: 22 },
  reading: {
    fontSize: 14,
    fontWeight: '700',
    minWidth: 28,
    textAlign: 'center'
  }
});
