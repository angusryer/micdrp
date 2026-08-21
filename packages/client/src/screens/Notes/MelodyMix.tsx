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
import { StyleSheet, Switch, Text, View } from 'react-native';

import { LevelSlider } from '../../components/LevelSlider';
import { useTheme } from '../../theme';

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
      {/* Heard apart, each is plausible; heard together, you find out whether
          they are the same thing (INV-NOTES-027). */}
      <View style={styles.togetherRow}>
        <Text style={[styles.together, { color: colors.typography }]}>
          Play over the recording
        </Text>
        <Switch
          testID="hear-over-take"
          accessibilityLabel="Play the melody over the recording"
          value={isOverTake}
          onValueChange={onOverTakeChange}
        />
      </View>

      {isOverTake && (
        <View>
          <View style={styles.togetherRow}>
            <Text style={[styles.together, { color: colors.gray500 }]}>
              Melody level
            </Text>
            <Text style={[styles.levelText, { color: colors.typography }]}>
              {Math.round(level * 100)}%
            </Text>
          </View>
          {/* Continuous, and reported while the finger is down: the balance
              is found by hearing it move, not by tapping and re-listening. */}
          <LevelSlider
            value={level}
            onChange={onLevelChange}
            accessibilityLabel="Melody level"
          />
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
  levelText: { fontSize: 14, minWidth: 44, textAlign: 'right' }
});

export default MelodyMix;
