/**
 * NoteLandscape — a note held sideways, where the graph is the view.
 *
 * A sung idea is wide and short, which is the shape of a phone on its side
 * and the opposite of one held upright. Turning it is the cheapest way to see
 * more bars at a readable scale, so here the graph takes the height and the
 * chord track keeps a thin row beneath it — harmony stays visible and
 * editable against the line, and nothing else competes for the space
 * (INV-NOTES-041).
 *
 * It reads the same useNoteDetail as the upright page, so turning the phone
 * changes the presentation and nothing about the note.
 */
import React from 'react';
import { SafeAreaView, StyleSheet, View } from 'react-native';

import { useTheme } from '../../theme';
import { ChordTrack } from './ChordTrack';
import { NoteShapeSection } from './NoteShapeSection';
import { SelectionBar } from './SelectionBar';
import type { useNoteDetail } from './useNoteDetail';

/** Room for one row of chord cards under the graph. */
const CHORD_STRIP_HEIGHT = 92;

/** Breathing room at the edges; less than upright, since space is the point. */
const EDGE_PADDING = 12;

export interface NoteLandscapeProps {
  detail: ReturnType<typeof useNoteDetail>;
  width: number;
  height: number;
}

export function NoteLandscape({
  detail,
  width,
  height
}: NoteLandscapeProps): React.JSX.Element {
  const { colors } = useTheme();
  const { chords } = detail;

  const hasChords = chords.slots.length > 0;
  const graphHeight =
    height - 2 * EDGE_PADDING - (hasChords ? CHORD_STRIP_HEIGHT : 0);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.neutral300 }]}>
      <View style={styles.frame}>
        {/* No controls under it: sideways the graph is the view, and the
            transport lives on the upright page. */}
        <NoteShapeSection
          detail={detail}
          width={width - 2 * EDGE_PADDING}
          height={Math.max(120, graphHeight)}
          showControls={false}
          selection={detail.selection}
          onSelect={detail.setSelection}
        />
        <SelectionBar
          detail={detail}
          selection={detail.selection}
          onSelect={detail.setSelection}
        />
        {hasChords ? (
          <View style={styles.strip}>
            <ChordTrack
              slots={chords.slots}
              onNudge={chords.nudge}
              onReshape={chords.reshape}
              onAudition={detail.auditionChord}
              onRevert={chords.revert}
            />
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

export default NoteLandscape;

const styles = StyleSheet.create({
  safe: { flex: 1 },
  frame: { flex: 1, padding: EDGE_PADDING },
  strip: { height: CHORD_STRIP_HEIGHT, justifyContent: 'center' }
});
