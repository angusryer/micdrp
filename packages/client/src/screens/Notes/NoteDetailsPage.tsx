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
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Sheet } from '../../components/Sheet';
import { ShareTakeSection } from '../../dogfood/ShareTakeSection';

import { useTheme } from '../../theme';
import { useTranslation } from '../../i18n';
import { ExportSheet } from '../Results/ExportSheet';
import { NoteList } from '../Results/NoteList';
import { NoteStats } from './NoteStats';
import { RereadCard } from './RereadCard';
import { TuningPanel } from './TuningPanel';
import { TempoRow } from './TempoRow';
import type { useNoteDetail } from './useNoteDetail';

/**
 * What each way of failing is called (INV-NOTES-184).
 *
 * Two, because they call for different things: a take with no recording
 * behind it will never be readable, and one that would not open might be on
 * the next attempt.
 */
const WHY: Record<'no-recording' | 'unreadable', string> = {
  'no-recording': 'There is no recording of this take to read.',
  unreadable: 'Could not open this recording.'
};

export interface NoteDetailsPageProps {
  detail: ReturnType<typeof useNoteDetail>;
  isOpen: boolean;
  onClose: () => void;
  /** Told what it is covering, so the page beneath can scroll clear of it. */
  onCover?: (name: string, px: number) => void;
}

export function NoteDetailsPage({
  detail,
  isOpen,
  onClose,
  onCover
}: NoteDetailsPageProps): React.JSX.Element | null {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { note, melody } = detail;
  // Held here so the button can say it is working while the take is re-read.
  const [isTuning, setIsTuning] = useState(false);
  // What went wrong with the last reading, or null. Cleared when another is
  // started, so it always describes the most recent attempt (INV-NOTES-184).
  const [problem, setProblem] = useState<string | null>(null);

  if (!note) {
    return null;
  }

  return (
    <Sheet
      name="note-analysis"
      isOpen={isOpen}
      onClose={onClose}
      // Two fifths to open at, most of the screen to drag to. Not 'auto':
      // what is in here is nearly a screenful, so fitting the content would
      // put it back where it started.
      detents={[0.4, 0.9]}
      // The graph behind it is the thing being watched while these are
      // turned. Dimming it would hide the very change being looked for.
      isDimmed={false}
      onCover={onCover}
      background={colors.neutral300}
    >
      <View style={styles.safe}>
        <View style={styles.head}>
          <Text style={[styles.title, { color: colors.typography }]} numberOfLines={1}>
            {note.title}
          </Text>
          {/* Quiet, and left of the close: what to do with the whole take
              rather than with a part of it belongs up here (VIEW-DOG-003). */}
          <ShareTakeSection
            note={note}
            melody={melody}
            resolveAudio={detail.resolveAudio}
          />
          <Text
            accessibilityRole="button"
            onPress={onClose}
            style={[styles.done, { color: colors.primary500 }]}
          >
            {t('notes.action.done')}
          </Text>
        </View>

        <View style={styles.content}>
          <Text style={[styles.section, { color: colors.gray500 }]}>
            {t('notes.analysis')}
          </Text>
          {/* First, because it is what this sheet is opened for while a
              detector is being tuned. Everything below is read once; this is
              read on every turn of the loop (INV-NOTES-172). */}
          <TuningPanel
            onReread={() => {
              setIsTuning(true);
              setProblem(null);
              void detail
                .reread()
                .then((failed) => setProblem(failed ? WHY[failed] : null))
                .catch(() => setProblem(WHY.unreadable))
                .finally(() => setIsTuning(false));
            }}
            isReading={isTuning}
            problem={problem}
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
        </View>
      </View>
    </Sheet>
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
