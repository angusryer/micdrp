/**
 * SelectionBar — what can be done to the thing chosen on the graph.
 *
 * Outside the drawing and named, rather than another gesture to remember
 * (INT-NOTES-015). The graph is a small space and every verb added to it as a
 * gesture made the next one harder to reach; once a thing has been chosen,
 * saying which thing is meant is already done, so the verbs can simply be
 * buttons.
 *
 * A card rather than a row of words: these are the only controls in the app
 * that appear and vanish under you, and a strip of bare text reads as a
 * caption on the graph instead of a thing to press. It carries the chosen
 * object's own colour along its leading edge, which is what connects it to
 * the lit thing above it — for a chord note that colour also says which part
 * of the chord is in hand.
 *
 * Absent when nothing is chosen, so it costs nothing until it is useful.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { isAltered } from 'logic';

import { chordRoleAt, chordRoleColour } from '../../components/chordRoles';
import type { Selection } from '../../components/graphSelection';
import { useTheme } from '../../theme';
import { useTranslation } from '../../i18n';
import { midiToLabel } from '../Results/NoteList';
import type { useNoteDetail } from './useNoteDetail';

export interface SelectionBarProps {
  detail: ReturnType<typeof useNoteDetail>;
  selection: Selection | null;
  onSelect: (selection: Selection | null) => void;
}

export function SelectionBar({
  detail,
  selection,
  onSelect
}: SelectionBarProps): React.JSX.Element | null {
  const { colors } = useTheme();
  const { t } = useTranslation();

  if (!selection) {
    return null;
  }

  const actions: Array<{ label: string; run: () => void }> = [];
  let title: string;
  // The same colour the graph is lighting it in, so the card and the object
  // are plainly about each other.
  let accent = colors.primary500;

  if (selection.kind === 'chordTone') {
    const slot = detail.chords.slots[selection.slot];
    accent = chordRoleColour(selection.tone);
    title = `${slot?.label ?? ''} · ${t(
      `notes.role.${chordRoleAt(selection.tone)}`
    )}`;
    actions.push({
      label: t('notes.action.silence'),
      run: () => detail.chords.toggleTone(selection.slot, selection.tone)
    });
    actions.push({
      label: t('notes.action.audition'),
      run: () => detail.auditionChord(selection.slot)
    });
    // Offered only where there is something to undo.
    if (isAltered(slot?.voicing)) {
      actions.push({
        label: t('notes.action.reset'),
        run: () => detail.chords.resetTone(selection.slot, selection.tone)
      });
    }
  } else if (selection.kind === 'melodyNote') {
    const note = detail.melody[selection.index];
    title = `${t('notes.sungNote')} · ${note ? midiToLabel(note.midi) : ''}`;
    actions.push({
      label: t('notes.action.hear'),
      run: () => note && detail.playNote(note.midi)
    });
    if (detail.isCorrected(selection.index)) {
      actions.push({
        label: t('notes.action.reset'),
        run: () => detail.resetNote(selection.index)
      });
    }
  } else {
    title = t('notes.barLine');
    actions.push({
      label: t('notes.action.remove'),
      run: () => {
        detail.bars.merge(selection.lineIndex);
        // What it referred to has gone, so nothing is chosen any more.
        onSelect(null);
      }
    });
  }

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.neutral100,
          borderColor: colors.neutral500,
          borderLeftColor: accent
        }
      ]}
    >
      <View style={styles.head}>
        <Text
          style={[styles.title, { color: colors.typography }]}
          numberOfLines={1}
        >
          {title}
        </Text>
        <Text
          accessibilityRole="button"
          onPress={() => onSelect(null)}
          style={[styles.done, { color: colors.gray300 }]}
        >
          {t('notes.action.done')}
        </Text>
      </View>
      <View style={styles.actions}>
        {actions.map((action) => (
          <Pressable
            key={action.label}
            accessibilityRole="button"
            onPress={action.run}
            style={({ pressed }) => [
              styles.pill,
              {
                borderColor: colors.neutral500,
                backgroundColor: pressed ? colors.neutral300 : colors.neutral50
              }
            ]}
          >
            <Text style={[styles.pillText, { color: colors.primary500 }]}>
              {action.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export default SelectionBar;

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderLeftWidth: 3,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 10,
    gap: 10
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12
  },
  title: { fontSize: 13, fontWeight: '700', flexShrink: 1 },
  done: { fontSize: 12, fontWeight: '600' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 14
  },
  pillText: { fontSize: 13, fontWeight: '600' }
});
