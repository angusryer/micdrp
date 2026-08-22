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
 *
 * The graph is measured from the room actually left to it rather than
 * calculated by subtracting the things that might be beside it (INV-NOTES-060).
 * That arithmetic had to be updated every time something new could appear
 * under the graph, and the options card — which shows up only once something
 * is chosen — was never added to it, so choosing anything pushed the chord
 * strip off the bottom.
 */
import React, { useCallback, useState } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  View,
  type LayoutChangeEvent
} from 'react-native';

import { useTheme } from '../../theme';
import { ChordTrack } from './ChordTrack';
import { NoteShapeSection } from './NoteShapeSection';
import { SelectionBar } from './SelectionBar';
import type { useNoteDetail } from './useNoteDetail';

/** Room for one row of chord cards under the graph. */
const CHORD_STRIP_HEIGHT = 92;

/** Breathing room at the edges; less than upright, since space is the point. */
const EDGE_PADDING = 12;

/** The graph card's own border, which sits inside the space it is given. */
const CARD_BORDER = 2;

/** Below this the drawing is not a graph any more, so it scrolls instead. */
const MIN_GRAPH_HEIGHT = 96;

export interface NoteLandscapeProps {
  detail: ReturnType<typeof useNoteDetail>;
  width: number;
}

export function NoteLandscape({
  detail,
  width
}: NoteLandscapeProps): React.JSX.Element {
  const { colors } = useTheme();
  const { chords } = detail;
  // What the layout left for the graph once everything else had taken what
  // it needed. Measured rather than predicted, so a new row beneath it can
  // never silently push the bottom one off the screen.
  const [room, setRoom] = useState(0);
  const measure = useCallback(
    (e: LayoutChangeEvent) => setRoom(e.nativeEvent.layout.height),
    []
  );

  const hasChords = chords.slots.length > 0;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.neutral300 }]}>
      <View style={styles.frame}>
        {/* The one piece that yields. Everything else keeps the height it
            needs and this takes what is left (INV-NOTES-060). */}
        <View testID="graph-room" style={styles.graph} onLayout={measure}>
          {room > 0 ? (
            /* No controls under it: sideways the graph is the view, and the
               transport lives on the upright page. */
            <NoteShapeSection
              detail={detail}
              width={width - 2 * EDGE_PADDING}
              height={Math.max(MIN_GRAPH_HEIGHT, room - CARD_BORDER)}
              showControls={false}
              selection={detail.selection}
              onSelect={detail.setSelection}
            />
          ) : null}
        </View>
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
  // minHeight lets it shrink below its content, which is what makes it the
  // piece that gives way rather than the piece that overflows.
  graph: { flex: 1, minHeight: MIN_GRAPH_HEIGHT },
  strip: { height: CHORD_STRIP_HEIGHT, justifyContent: 'center' }
});
