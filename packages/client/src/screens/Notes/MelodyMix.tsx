/**
 * How loudly the detected melody sits against the take.
 *
 * Heard apart, each is plausible; heard together, you find out whether they
 * are the same thing. A note read a semitone out, or a beat late, is obvious
 * against the voice and easy to miss beside it (INV-NOTES-027).
 *
 * Whether it sounds at all is the melody's track toggle at the top of these
 * options, with the take's and the chords' (INV-NOTES-019). A switch here as
 * well would have been a second control for one decision, and only one of the
 * two would have been beside the tracks it belongs with.
 *
 * Split from HearItAs, which is about which reading you hear rather than how
 * loudly you hear it.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { LevelSlider } from '../../components/LevelSlider';
import { useTheme } from '../../theme';

export interface MelodyMixProps {
  /** How loud the melody sits against the take, 0..1. */
  level: number;
  onLevelChange: (level: number) => void;
}

export function MelodyMix({
  level,
  onLevelChange
}: MelodyMixProps): React.JSX.Element {
  const { colors } = useTheme();
  return (
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
      <Text style={[styles.hint, { color: colors.gray300 }]}>
        How loudly the melody sits over the take, when its track is on.
      </Text>
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
  levelText: { fontSize: 14, minWidth: 44, textAlign: 'right' },
  hint: { fontSize: 12, lineHeight: 17, paddingTop: 6 }
});

export default MelodyMix;
