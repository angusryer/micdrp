/**
 * SelectionSheet — what you chose, and what can be done to it.
 *
 * Undimmed on purpose. The point of choosing something is to act on it, and
 * dragging is one of the actions — a sheet that covered the graph would make
 * the buttons and the direct manipulation exclusive, when moving the thing is
 * the one that has to be watched while it happens (INV-NOTES-078).
 *
 * What it replaced was a strip of pills that named the thing and offered
 * verbs but never said what the thing was: the pitch, how far off it sat,
 * which bar it fell in. Those are the facts the decision is made from
 * (INT-NOTES-027).
 */
import React, { useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { TrueSheet } from '@lodev09/react-native-true-sheet';

import type { Selection } from '../../components/graphSelection';
import { useTheme } from '../../theme';
import { describeSelection } from './selectionFacts';
import type { useNoteDetail } from './useNoteDetail';

export interface SelectionSheetProps {
  detail: ReturnType<typeof useNoteDetail>;
  selection: Selection | null;
  onSelect: (selection: Selection | null) => void;
}

export function SelectionSheet({
  detail,
  selection,
  onSelect
}: SelectionSheetProps): React.JSX.Element {
  const { colors } = useTheme();
  const sheet = useRef<TrueSheet>(null);

  useEffect(() => {
    if (selection) {
      void sheet.current?.present();
    } else {
      void sheet.current?.dismiss();
    }
  }, [selection]);

  const shown = selection
    ? describeSelection(selection, detail, colors.primary500, onSelect)
    : null;

  return (
    <TrueSheet
      ref={sheet}
      name="selection"
      detents={['auto']}
      grabber
      grabberOptions={{ topMargin: 12 }}
      cornerRadius={16}
      backgroundColor={colors.neutral50}
      // The graph stays live behind it, which is the whole point
      // (INV-NOTES-078).
      dimmed={false}
      // Dragged away means put down, so the graph and the sheet never
      // disagree about whether anything is chosen.
      onDidDismiss={() => onSelect(null)}
    >
      <ScrollView contentContainerStyle={styles.body}>
        {shown ? (
          <>
            <View style={styles.head}>
              <View
                style={[styles.swatch, { backgroundColor: shown.accent }]}
              />
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
    </TrueSheet>
  );
}

export default SelectionSheet;

const styles = StyleSheet.create({
  body: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 28 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
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
