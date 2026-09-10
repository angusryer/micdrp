/**
 * The way back from throwing a note away (INV-NOTES-249).
 *
 * Nothing else in this app is a one-way door: a correction can be undone, a
 * re-read can be undone, a tapped beat can be put back where the finger
 * landed. A deleted note has no handle left on the graph to offer it from,
 * which is exactly why the offer has to live somewhere else rather than not
 * exist at all.
 *
 * Shown only while there is something to put back (INV-NOTES-044). A row
 * that is always there saying "0 notes thrown away" is a permanent reminder
 * of a thing that has not happened.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../../theme';

export interface DeletedNotesRowProps {
  /** How many sung notes have been thrown away. */
  count: number;
  onRestore: () => void;
}

export function DeletedNotesRow({
  count,
  onRestore
}: DeletedNotesRowProps): React.JSX.Element | null {
  const { colors } = useTheme();
  if (count <= 0) {
    return null;
  }

  return (
    <View style={styles.row} testID="deleted-notes-row">
      <Text style={[styles.title, { color: colors.typography }]}>
        {count === 1 ? '1 note thrown away' : `${count} notes thrown away`}
      </Text>
      <Text
        accessibilityRole="button"
        accessibilityLabel="Put the thrown-away notes back"
        testID="restore-deleted-notes"
        onPress={onRestore}
        style={[styles.action, { color: colors.primary500 }]}
      >
        Put them back
      </Text>
    </View>
  );
}

export default DeletedNotesRow;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12
  },
  title: { fontSize: 14 },
  action: { fontSize: 13, fontWeight: '600' }
});
