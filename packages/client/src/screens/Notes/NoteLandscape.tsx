/**
 * NoteLandscape — a note held sideways, where the graph is the view.
 *
 * A sung idea is wide and short, which is the shape of a phone on its side
 * and the opposite of one held upright. Turning it is the cheapest way to see
 * more bars at a readable scale, so here the graph takes the height, with the
 * chord cards riding in its own scroll under the bars they describe
 * (INV-NOTES-061) and nothing else competing for the space (INV-NOTES-041).
 *
 * The transport comes with it. Sideways is where a take is actually studied,
 * and being unable to hear the thing you are looking at meant turning the
 * phone back to press play and losing the view to do it (INV-NOTES-062).
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
import { MIN_GRAPH_HEIGHT, NoteShapeSection } from './NoteShapeSection';
import { PlaybackBar } from './PlaybackBar';
import { SelectionSheet } from './SelectionSheet';
import type { useNoteDetail } from './useNoteDetail';

/** Breathing room at the edges; less than upright, since space is the point. */
const EDGE_PADDING = 12;

/** The graph card's own border, which sits inside the space it is given. */
const CARD_BORDER = 2;



export interface NoteLandscapeProps {
  detail: ReturnType<typeof useNoteDetail>;
  width: number;
}

export function NoteLandscape({
  detail,
  width
}: NoteLandscapeProps): React.JSX.Element {
  const { colors } = useTheme();
  const { note } = detail;
  // What the layout left for the graph once everything else had taken what
  // it needed. Measured rather than predicted, so a new row beneath it can
  // never silently push the bottom one off the screen.
  const [room, setRoom] = useState(0);
  const measure = useCallback(
    (e: LayoutChangeEvent) => setRoom(e.nativeEvent.layout.height),
    []
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.neutral300 }]}>
      <View style={styles.frame}>
        {/* The one piece that yields. Everything else keeps the height it
            needs and this takes what is left (INV-NOTES-060). */}
        <View testID="graph-room" style={styles.graph} onLayout={measure}>
          {room > 0 ? (
            /* No listening controls under it — those stay upright. The
               transport is the exception: it is what the view is for. */
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
        <SelectionSheet
          detail={detail}
          selection={detail.selection}
          onSelect={detail.setSelection}
        />
        {/* Everything together, without turning the phone back to reach it. */}
        {note?.audioPath ? (
          <PlaybackBar
            resolveAudioUri={detail.resolveAudio}
            accompaniment={detail.backdrop}
            voice={detail.melodyVoiceMix}
          />
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
  graph: { flex: 1, minHeight: MIN_GRAPH_HEIGHT }
});
