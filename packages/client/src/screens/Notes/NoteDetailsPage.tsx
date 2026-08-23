/**
 * NoteDetailsPage — everything about a take that the graph does not draw.
 *
 * Every note as a row you can tap to hear, what was measured about the take,
 * and the way to export it. These sat below the graph, so every visit
 * scrolled past them and every edit pushed them further away — read
 * occasionally and edited never, which is what belongs behind a control
 * rather than under the thing being worked on (INT-NOTES-023).
 *
 * A page presented over the note rather than a route of its own. A second
 * route would take the note's id and read it again, and reading a take twice
 * re-measures it — two readings can disagree while an edit is still being
 * made. Sharing the open note means there is one reading, and it is the one
 * on the graph behind this.
 */
import React from 'react';
import { Modal, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../../theme';
import { useTranslation } from '../../i18n';
import { ExportSheet } from '../Results/ExportSheet';
import { NoteList } from '../Results/NoteList';
import { NoteStats } from './NoteStats';
import type { useNoteDetail } from './useNoteDetail';

export interface NoteDetailsPageProps {
  detail: ReturnType<typeof useNoteDetail>;
  isOpen: boolean;
  onClose: () => void;
}

export function NoteDetailsPage({
  detail,
  isOpen,
  onClose
}: NoteDetailsPageProps): React.JSX.Element | null {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { note, melody } = detail;

  if (!note) {
    return null;
  }

  return (
    <Modal animationType="slide" visible={isOpen} onRequestClose={onClose}>
      <SafeAreaView
        style={[styles.safe, { backgroundColor: colors.neutral300 }]}
      >
        <View style={styles.head}>
          <Text style={[styles.title, { color: colors.typography }]} numberOfLines={1}>
            {note.title}
          </Text>
          <Text
            accessibilityRole="button"
            onPress={onClose}
            style={[styles.done, { color: colors.primary500 }]}
          >
            {t('notes.action.done')}
          </Text>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <Text style={[styles.section, { color: colors.gray500 }]}>
            {t('notes.analysis')}
          </Text>
          <NoteStats
            note={note}
            grid={detail.grid}
            hasGrid={detail.hasGrid}
            chordCount={detail.chords.slots.length}
          />

          <Text style={[styles.section, { color: colors.gray500 }]}>
            {t('notes.notesTapToHear')}
          </Text>
          <NoteList notes={melody} onPressNote={detail.playNote} />

          <ExportSheet midiUri={detail.midiUri} title={note.title} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

export default NoteDetailsPage;

const styles = StyleSheet.create({
  safe: { flex: 1 },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 12
  },
  title: { fontSize: 18, fontWeight: '700', flexShrink: 1 },
  done: { fontSize: 15, fontWeight: '600' },
  content: { paddingHorizontal: 20, paddingBottom: 32, gap: 4 },
  section: { fontSize: 13, fontWeight: '600', marginTop: 18 }
});
