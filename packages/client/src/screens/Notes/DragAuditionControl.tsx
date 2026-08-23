/**
 * Whether moving a note sounds it, and how loudly.
 *
 * Dragging a note is a question about pitch, and the drag is the moment to
 * answer it (INT-NOTES-024). Both halves are here because they are one
 * decision: turning it on immediately raises how loud, and a level with
 * nothing sounding is a control for nothing.
 *
 * The level is separate from the melody's own because this fires far more
 * often — a drag across an octave is twelve notes — and wants to sit under it.
 */
import React from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';

import { LevelSlider } from '../../components/LevelSlider';
import { useTheme } from '../../theme';

export interface DragAuditionControlProps {
  isAudible: boolean;
  onAudibleChange: (isAudible: boolean) => void;
  level: number;
  onLevelChange: (level: number) => void;
}

export function DragAuditionControl({
  isAudible,
  onAudibleChange,
  level,
  onLevelChange
}: DragAuditionControlProps): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <View>
      <View style={styles.row}>
        <Text style={[styles.label, { color: colors.typography }]}>
          Hear notes while dragging
        </Text>
        <Switch
          testID="hear-while-dragging"
          accessibilityLabel="Hear notes while dragging them"
          value={isAudible}
          onValueChange={onAudibleChange}
        />
      </View>

      {/* Only once there is something to set the loudness of. */}
      {isAudible ? (
        <View>
          <View style={styles.row}>
            <Text style={[styles.label, { color: colors.gray500 }]}>
              Dragging level
            </Text>
            <Text style={[styles.reading, { color: colors.typography }]}>
              {Math.round(level * 100)}%
            </Text>
          </View>
          <LevelSlider
            value={level}
            onChange={onLevelChange}
            accessibilityLabel="Level of notes heard while dragging"
          />
        </View>
      ) : null}
    </View>
  );
}

export default DragAuditionControl;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6
  },
  label: { fontSize: 14, fontWeight: '600' },
  reading: { fontSize: 14, minWidth: 44, textAlign: 'right' }
});
