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
 * strip off the bottom. Both dimensions are measured now that the selection
 * panel takes width from beside it (INV-NOTES-099), for the same reason.
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
import { SelectionPanel } from './SelectionPanel';
import type { useNoteDetail } from './useNoteDetail';

/**
 * Breathing room above and below only. Sideways the graph runs from the left
 * edge of the screen to the right edge — or to the selection panel when one
 * is out — because every pixel of width is a moment of the take
 * (INV-NOTES-101).
 */
const EDGE_PADDING = 12;



export interface NoteLandscapeProps {
  detail: ReturnType<typeof useNoteDetail>;
}

export function NoteLandscape({
  detail
}: NoteLandscapeProps): React.JSX.Element {
  const { colors } = useTheme();
  const { note } = detail;
  // What the layout left for the graph once everything else had taken what
  // it needed. Measured rather than predicted, so a new row beneath it can
  // never silently push the bottom one off the screen.
  const [room, setRoom] = useState({ width: 0, height: 0 });
  const measure = useCallback((e: LayoutChangeEvent) => {
    const { width: w, height: h } = e.nativeEvent.layout;
    setRoom((was) => (was.width === w && was.height === h ? was : { width: w, height: h }));
  }, []);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.neutral300 }]}>
      <View style={styles.frame}>
        <View style={styles.row}>
          {/* The one piece that yields. Everything else keeps the room it
              needs and this takes what is left (INV-NOTES-060). */}
          <View testID="graph-room" style={styles.graph} onLayout={measure}>
            {room.height > 0 ? (
            /* No listening controls under it — those stay upright. The
               transport is the exception: it is what the view is for. */
              <NoteShapeSection
                detail={detail}
                width={room.width}
                height={Math.max(MIN_GRAPH_HEIGHT, room.height)}
                showControls={false}
                selection={detail.selection}
                onSelect={detail.setSelection}
                flashing={detail.flashing}
              />
            ) : null}
          </View>
          {/* In from the right, taking width rather than covering the graph. */}
          <SelectionPanel
            detail={detail}
            selection={detail.selection}
            onSelect={detail.setSelection}
          />
        </View>
        {/* Everything together, without turning the phone back to reach it.
            Padded on its own, since the graph above it is not. */}
        {note?.audioPath ? (
          <View style={styles.transport}>
          <PlaybackBar
            resolveAudioUri={detail.resolveAudio}
            accompaniment={detail.backdrop}
            voice={detail.melodyVoiceMix}
            rhythm={detail.rhythmMix}
            layers={detail.layerVoices}
            bass={detail.bassMix}
            beats={detail.clickBeats}
            listening={detail.listening}
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
  frame: { flex: 1, paddingVertical: EDGE_PADDING },
  transport: { paddingHorizontal: EDGE_PADDING },
  row: { flex: 1, flexDirection: 'row', minHeight: MIN_GRAPH_HEIGHT },
  // minHeight lets it shrink below its content, which is what makes it the
  // piece that gives way rather than the piece that overflows.
  graph: { flex: 1, minHeight: MIN_GRAPH_HEIGHT, minWidth: 0 }
});
