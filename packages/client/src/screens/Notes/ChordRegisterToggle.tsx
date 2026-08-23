/**
 * Where the chords sit, which is really a question about what you are
 * listening on.
 *
 * A built-in speaker has almost nothing an octave below middle C, so a
 * backdrop voiced where a piano would put it is felt as absence rather than
 * heard as harmony; lifted towards the melody it can be heard. On headphones
 * the low voicing is the better sound (INV-NOTES-039).
 *
 * It sits with the rest of what decides a listen rather than beside the chord
 * cards, because it is about the ear and not about the harmony — the same
 * chords either way, in a different octave (INT-NOTES-021).
 */
import React from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';

import { useTheme } from '../../theme';

export interface ChordRegisterToggleProps {
  isLifted: boolean;
  onToggle: () => void;
}

export function ChordRegisterToggle({
  isLifted,
  onToggle
}: ChordRegisterToggleProps): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <View style={styles.labels}>
        <Text style={[styles.label, { color: colors.typography }]}>
          Lift the chords for the speaker
        </Text>
        <Text style={[styles.hint, { color: colors.gray300 }]}>
          Listening on the phone itself, where the low notes do not carry
        </Text>
      </View>
      <Switch
        testID="lift-chords"
        accessibilityLabel="Lift the chords for the speaker"
        value={isLifted}
        onValueChange={onToggle}
      />
    </View>
  );
}

export default ChordRegisterToggle;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    gap: 12
  },
  labels: { flexShrink: 1 },
  label: { fontSize: 14, fontWeight: '600' },
  hint: { fontSize: 11, marginTop: 2, lineHeight: 15 }
});
