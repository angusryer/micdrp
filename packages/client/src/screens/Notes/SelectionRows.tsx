/**
 * The several things chosen, one to a row.
 *
 * A count alone ("3 chosen") is not enough to work from — which three is the
 * question, and the answer is on the graph rather than in the sheet. Pressing
 * a row lights that one where it sits, so the list and the picture stay one
 * thing (INV-NOTES-094).
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Chosen } from '../../components/graphSelection';
import { useTheme } from '../../theme';
import { describeSelection } from './selectionFacts';
import type { useNoteDetail } from './useNoteDetail';

export interface SelectionRowsProps {
  detail: ReturnType<typeof useNoteDetail>;
  selection: Chosen;
  onSelect: (selection: Chosen) => void;
}

export function SelectionRows({
  detail,
  selection,
  onSelect
}: SelectionRowsProps): React.JSX.Element {
  const { colors } = useTheme();
  const listed = selection.map((one) => ({
    one,
    shown: describeSelection(one, detail, colors.primary500, () => onSelect([]))
  }));

  return (
    <>
      <Text style={[styles.title, { color: colors.typography }]}>
        {`${selection.length} chosen`}
      </Text>
      {listed.map(({ one, shown }, i) => (
        <Pressable
          key={`${one.kind}-${i}`}
          accessibilityRole="button"
          accessibilityLabel={`Find ${shown.title} on the graph`}
          onPress={() => detail.flash(one)}
          style={({ pressed }) => [
            styles.row,
            {
              borderColor: colors.neutral500,
              backgroundColor: pressed ? colors.neutral300 : 'transparent'
            }
          ]}
        >
          <View style={[styles.swatch, { backgroundColor: shown.accent }]} />
          <Text style={[styles.rowTitle, { color: colors.typography }]}>
            {shown.title}
          </Text>
          <Text style={[styles.rowFact, { color: colors.gray300 }]}>
            {shown.facts[0]?.value ?? ''}
          </Text>
        </Pressable>
      ))}
    </>
  );
}

export default SelectionRows;

const styles = StyleSheet.create({
  title: { fontSize: 20, fontWeight: '700' },
  swatch: { width: 12, height: 12, borderRadius: 6 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
    paddingHorizontal: 4
  },
  rowTitle: { fontSize: 14, fontWeight: '600', flex: 1 },
  rowFact: { fontSize: 12 }
});
