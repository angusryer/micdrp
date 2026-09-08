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

import { OVER_THE_GRAPH, Sheet } from '../../components/Sheet';
import { ShareTakeSection } from '../../dogfood/ShareTakeSection';

import { notesSummary } from '../../analysis/summary';
import { useTheme } from '../../theme';
import { useTranslation } from '../../i18n';
import { ExportSheet } from '../Results/ExportSheet';
import { NoteStats } from './NoteStats';
import { RereadCard } from './RereadCard';
import { TuningPanel } from './TuningPanel';
import { TempoRow } from './TempoRow';
import { TapPatternRow } from './TapPatternRow';
import { PickupRow } from './PickupRow';
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
      detents={OVER_THE_GRAPH}
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
          {/* First, all three of them: the sheet opens part way over the
              graph so the bar lines can be watched moving as these change
              (INV-NOTES-078, INV-NOTES-222). What moves them belongs where
              it is reachable without scrolling past what does not.

              Every other reading here can be corrected; the one everything
              else is measured against could not (INV-NOTES-123). */}
          <TempoRow
            bpm={detail.bpm}
            readBpm={detail.readBpm}
            isByHand={detail.isBpmByHand}
            tappedBpm={detail.tappedBpm}
            tappedRange={detail.tappedRange}
            onSet={detail.setBpm}
          />

          {/* How far into a bar the singing started. Beside the tap pattern
              because they are the same kind of sentence: both say where the
              bar sits, and neither is a reading of the take
              (INV-NOTES-211). */}
          <PickupRow
            beats={Math.round(detail.bars.pickup / detail.grid.stepsPerBeat)}
            beatsPerBar={detail.grid.beatsPerBar}
            onSet={(beats) =>
              detail.bars.setPickup(beats * detail.grid.stepsPerBeat)
            }
          />

          {/* Beside the tempo because it is one: this is how the taps become
              a tempo at all (INV-NOTES-209). */}
          <TapPatternRow
            pattern={detail.tapPattern}
            tapCount={detail.tapCount}
            bpm={detail.patternedTempo?.bpm ?? null}
            onSet={detail.setTapPattern}
          />

          {/* Read once and then left alone, so it sits under the controls
              rather than above them (INV-NOTES-222). A note is asked about
              by touching it on the graph, which says everything the column
              here said and more (INV-NOTES-213). */}
          {/* The take as it has been corrected, not as it was first heard —
              the same reading the card in the list describes, from the same
              derivation, so the two can never disagree (INV-NOTES-228). Live
              here rather than kept: these are being read while the
              corrections are made. */}
          <NoteStats
            note={{
              ...note,
              ...notesSummary(melody),
              // Measured against the recording, which a correction does not
              // change: it says the detector misheard it (INV-NOTES-195).
              inTuneRatio: note.inTuneRatio
            }}
            grid={detail.grid}
            hasGrid={detail.hasGrid}
            chordCount={detail.chords.slots.length}
          />

          {/* Below what moves the bar lines, because tuning a detector is a
              slower loop than saying where the bar sits, and the knobs are a
              long list to scroll past on the way to a stepper
              (INV-NOTES-172, INV-NOTES-222). */}
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
            noteId={detail.note?.id ?? null}
          />

          {/* Last, because it replaces everything above it (INV-NOTES-116). */}
          <RereadCard
            isStale={detail.isStale}
            onReread={detail.reread}
            canUndo={detail.canUndoReread}
            onUndo={detail.undoReread}
          />

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
