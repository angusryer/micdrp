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
 *
 * A sheet that opens part way, not a full-screen page (INV-NOTES-180). The
 * knobs in here are turned in a loop — turn one, read the take again, look at
 * what changed — and that loop cannot be run through something covering the
 * thing being looked at. It opens at two fifths, drags up to most of the
 * screen, and leaves the graph undimmed behind it.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions
} from 'react-native';
import { TrueSheet } from '@lodev09/react-native-true-sheet';

import { useTheme } from '../../theme';
import { useTranslation } from '../../i18n';
import { ExportSheet } from '../Results/ExportSheet';
import { NoteList } from '../Results/NoteList';
import { NoteStats } from './NoteStats';
import { RereadCard } from './RereadCard';
import { TuningPanel } from './TuningPanel';
import { TempoRow } from './TempoRow';
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
  const { height } = useWindowDimensions();
  const { note, melody } = detail;
  // Held here so the button can say it is working while the take is re-read.
  const [isTuning, setIsTuning] = useState(false);
  const sheet = useRef<TrueSheet>(null);

  // Driven from the caller's boolean, as every other sheet here is: they all
  // already hold "is it open", and a second way of saying it is a second
  // thing to keep in step.
  useEffect(() => {
    if (isOpen) {
      void sheet.current?.present();
    } else {
      void sheet.current?.dismiss();
    }
  }, [isOpen]);

  if (!note) {
    return null;
  }

  return (
    <TrueSheet
      ref={sheet}
      name="note-analysis"
      // Two fifths to open at, most of the screen to drag to. Not 'auto':
      // what is in here is nearly a screenful, so fitting the content would
      // put it back where it started.
      detents={[0.4, 0.9]}
      // The graph behind it is the thing being watched while these are
      // turned. Dimming it would hide the very change being looked for.
      dimmed={false}
      grabber
      grabberOptions={{ topMargin: 12 }}
      cornerRadius={16}
      backgroundColor={colors.neutral300}
      onDidDismiss={onClose}
    >
      <View style={styles.safe}>
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

        <ScrollView
          style={{ maxHeight: Math.round(height * 0.86) }}
          contentContainerStyle={styles.content}
          contentInsetAdjustmentBehavior="never"
        >
          <Text style={[styles.section, { color: colors.gray500 }]}>
            {t('notes.analysis')}
          </Text>
          {/* First, because it is what this sheet is opened for while a
              detector is being tuned. Everything below is read once; this is
              read on every turn of the loop (INV-NOTES-172). */}
          <TuningPanel
            onReread={() => {
              setIsTuning(true);
              void detail.reread().finally(() => setIsTuning(false));
            }}
            isReading={isTuning}
          />

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

          {/* Every other reading here can be corrected; the one everything
              else is measured against could not (INV-NOTES-123). */}
          <TempoRow
            bpm={detail.bpm}
            readBpm={detail.readBpm}
            isByHand={detail.isBpmByHand}
            onSet={detail.setBpm}
          />

          {/* Last, because it replaces everything above it (INV-NOTES-116). */}
          <RereadCard isStale={detail.isStale} onReread={detail.reread} />

          <ExportSheet midiUri={detail.midiUri} title={note.title} />
        </ScrollView>
      </View>
    </TrueSheet>
  );
}

export default NoteDetailsPage;

const styles = StyleSheet.create({
  safe: { flexShrink: 1 },
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
