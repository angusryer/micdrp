/**
 * Hearing the detected melody over the take, and mixing the two.
 *
 * Heard apart, each is plausible; heard together, you find out whether they
 * are the same thing. A note read a semitone out, or a beat late, is obvious
 * against the voice and easy to miss beside it (INV-NOTES-027).
 *
 * Split from HearItAs, which is about which reading you hear rather than how
 * loudly you hear it.
 */
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useTheme } from '../../theme';

/** Coarse enough to reach either end quickly, fine enough to sit it right. */
const LEVEL_STEP = 0.1;

export interface MelodyMixProps {
  /** Whether the melody sounds over the take when the take is played. */
  isOverTake: boolean;
  onOverTakeChange: (isOverTake: boolean) => void;
  /** How loud the melody sits against the take, 0..1. */
  level: number;
  onLevelChange: (level: number) => void;
}

export function MelodyMix({
  isOverTake,
  onOverTakeChange,
  level,
  onLevelChange
}: MelodyMixProps): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <View>
      {/* Heard apart, each is plausible; heard together, you find out whether
          they are the same thing (INV-NOTES-027). */}
      <TouchableOpacity
        testID="hear-over-take"
        accessibilityRole="switch"
        accessibilityState={{ checked: isOverTake }}
        onPress={() => onOverTakeChange(!isOverTake)}
        style={styles.togetherRow}
      >
        <Text style={[styles.together, { color: colors.typography }]}>
          Play over the recording
        </Text>
        <Text style={[styles.together, { color: colors.primary500 }]}>
          {isOverTake ? 'on' : 'off'}
        </Text>
      </TouchableOpacity>

      {isOverTake && (
        <View style={styles.togetherRow}>
          <Text style={[styles.together, { color: colors.gray500 }]}>
            Melody level
          </Text>
          <View style={styles.levelRow}>
            <TouchableOpacity
              testID="hear-level-down"
              accessibilityRole="button"
              accessibilityLabel="Quieter"
              disabled={level <= 0}
              onPress={() => onLevelChange(Math.max(0, level - LEVEL_STEP))}
            >
              <Text style={[styles.step, { color: level <= 0 ? colors.gray300 : colors.primary500 }]}>
                −
              </Text>
            </TouchableOpacity>
            <Text style={[styles.levelText, { color: colors.typography }]}>
              {Math.round(level * 100)}%
            </Text>
            <TouchableOpacity
              testID="hear-level-up"
              accessibilityRole="button"
              accessibilityLabel="Louder"
              disabled={level >= 1}
              onPress={() => onLevelChange(Math.min(1, level + LEVEL_STEP))}
            >
              <Text style={[styles.step, { color: level >= 1 ? colors.gray300 : colors.primary500 }]}>
                +
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  togetherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6
  },
  together: { fontSize: 14, fontWeight: '600' },
  levelRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  levelText: { fontSize: 14, minWidth: 44, textAlign: 'center' },
  step: { fontSize: 22, fontWeight: '700', paddingHorizontal: 6 }
});

export default MelodyMix;
