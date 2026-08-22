/**
 * SelectionBar — what can be done to the thing chosen on the graph.
 *
 * Outside the drawing and named, rather than another gesture to remember
 * (INT-NOTES-015). The graph is a small space and every verb added to it as a
 * gesture made the next one harder to reach; once a thing has been chosen,
 * saying which thing is meant is already done, so the verbs can simply be
 * buttons.
 *
 * Absent when nothing is chosen, so it costs nothing until it is useful.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { isAltered } from 'logic';

import { chordRoleAt } from '../../components/chordRoles';
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

  if (selection.kind === 'chordTone') {
    const slot = detail.chords.slots[selection.slot];
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

  actions.push({ label: t('notes.action.done'), run: () => onSelect(null) });

  return (
    <View
      style={[
        styles.bar,
        { backgroundColor: colors.neutral100, borderColor: colors.neutral500 }
      ]}
    >
      <Text style={[styles.title, { color: colors.typography }]} numberOfLines={1}>
        {title}
      </Text>
      <View style={styles.actions}>
        {actions.map((action) => (
          <Text
            key={action.label}
            accessibilityRole="button"
            onPress={action.run}
            style={[styles.action, { color: colors.primary500 }]}
          >
            {action.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

export default SelectionBar;

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 8,
    gap: 12
  },
  title: { fontSize: 13, fontWeight: '600', flexShrink: 1 },
  actions: { flexDirection: 'row', gap: 16 },
  action: { fontSize: 13, fontWeight: '600' }
});
