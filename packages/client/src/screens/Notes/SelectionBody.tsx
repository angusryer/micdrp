/**
 * What you chose, and what can be done to it — the content itself.
 *
 * Separate from where it is presented because that differs with which way the
 * phone is held: upright it rises from the bottom, sideways it comes in from
 * the right so the graph keeps its height (INV-NOTES-099). Both show exactly
 * this, so neither can drift into offering something the other does not.
 */
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { Chosen } from '../../components/graphSelection';
import { useTheme } from '../../theme';
import { LengthBar } from './LengthBar';
import { NudgePad } from './NudgePad';
import { SelectionRows } from './SelectionRows';
import { describeSelection } from './selectionFacts';
import type { useNoteDetail } from './useNoteDetail';

export interface SelectionBodyProps {
  detail: ReturnType<typeof useNoteDetail>;
  selection: Chosen;
  onSelect: (selection: Chosen) => void;
}

export function SelectionBody({
  detail,
  selection,
  onSelect
}: SelectionBodyProps): React.JSX.Element {
  const { colors } = useTheme();

  // One thing: its facts and its verbs. Several: what they are, so a row can
  // be pressed to find it on the graph (INV-NOTES-094).
  const only = selection.length === 1 ? selection[0] : null;
  const shown = only
    ? describeSelection(only, detail, colors.primary500, () => onSelect([]))
    : null;

  return (
    <ScrollView contentContainerStyle={styles.body}>
      {/* At the top, because these act on everything chosen and the list
          below is what "everything" means (INV-NOTES-097). Moving comes
          before lengthening: a wrong note is the commoner correction, and it
          is the one drag is worst at (INV-NOTES-111). */}
      {selection.some(
        (one) => one.kind === 'melodyNote' || one.kind === 'chordTone'
      ) ? (
        <NudgePad
          onPitch={detail.nudgeChosen}
          onTime={detail.shiftChosen}
          canMoveInTime={
            detail.hasGrid &&
            selection.every((one) => one.kind === 'melodyNote')
          }
        />
      ) : null}
      {selection.some((one) => one.kind === 'melodyNote') ? (
        <LengthBar
          onResize={detail.resizeChosen}
          canResize={detail.hasGrid}
          onResetAll={detail.hasResized ? detail.resetLengths : undefined}
        />
      ) : null}

      {!shown && selection.length > 1 ? (
        <SelectionRows
          detail={detail}
          selection={selection}
          onSelect={onSelect}
        />
      ) : null}

      {shown ? (
        <>
          <View style={styles.head}>
            <View style={[styles.swatch, { backgroundColor: shown.accent }]} />
            <Text style={[styles.title, { color: colors.typography }]}>
              {shown.title}
            </Text>
          </View>

          {shown.facts.map((fact) => (
            <View key={fact.label} style={styles.factRow}>
              <Text style={[styles.factLabel, { color: colors.gray300 }]}>
                {fact.label}
              </Text>
              <Text style={[styles.factValue, { color: colors.typography }]}>
                {fact.value}
              </Text>
            </View>
          ))}

          <View style={styles.actions}>
            {shown.actions.map((action) => (
              <Pressable
                key={action.label}
                accessibilityRole="button"
                onPress={action.run}
                style={({ pressed }) => [
                  styles.pill,
                  {
                    borderColor: action.isDestructive
                      ? colors.error
                      : colors.neutral500,
                    backgroundColor: pressed
                      ? colors.neutral300
                      : colors.neutral100
                  }
                ]}
              >
                <Text
                  style={[
                    styles.pillText,
                    {
                      color: action.isDestructive
                        ? colors.error
                        : colors.primary500
                    }
                  ]}
                >
                  {action.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}

export default SelectionBody;

const styles = StyleSheet.create({
  body: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 28 },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12
  },
  swatch: { width: 12, height: 12, borderRadius: 6 },
  title: { fontSize: 20, fontWeight: '700' },
  factRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5
  },
  factLabel: { fontSize: 13 },
  factValue: { fontSize: 13, fontWeight: '600' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  pill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14
  },
  pillText: { fontSize: 13, fontWeight: '600' }
});
