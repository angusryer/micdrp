/**
 * ChordBand — the chords, drawn as individual notes under the sung line and
 * editable one note at a time.
 *
 * Drag a note up or down to move it against its chord tone; double-tap it to
 * silence it or bring it back. The chord keeps its name through all of it —
 * what changes is the voicing, not the harmony (INV-NOTES-036).
 *
 * It paints on the melody's own axes, so a note here and a note of the melody
 * at the same pitch sit at the same height.
 */
import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Canvas, Rect, RoundedRect } from '@shopify/react-native-skia';
import { GestureDetector } from 'react-native-gesture-handler';

import { chordRoleColour } from './chordRoles';
import { layoutChordTones, type PlacedChord } from './chordLayout';
import { useChordToneGestures } from './useChordToneGestures';
import type { PitchAxis, TimeAxis } from './melodyLayout';

export interface ChordBandProps {
  slots: readonly PlacedChord[];
  timeAxis: TimeAxis;
  pitchAxis: PitchAxis;
  floorMidi: number;
  width: number;
  height: number;
  /** Move one note of one chord by whole semitones. */
  onMoveTone: (slot: number, tone: number, semitones: number) => void;
  /** Silence one note, or bring it back. */
  onToggleMute: (slot: number, tone: number) => void;
}

export function ChordBand({
  slots,
  timeAxis,
  pitchAxis,
  floorMidi,
  width,
  height,
  onMoveTone,
  onToggleMute
}: ChordBandProps): React.JSX.Element | null {

  const rects = useMemo(
    () => layoutChordTones(slots, timeAxis, pitchAxis, floorMidi),
    [slots, timeAxis, pitchAxis, floorMidi]
  );

  // Which note is in hand, so it can be shown as picked up. Set once on the
  // hold and once on release, so a drag re-renders no more than it already
  // does for each semitone it crosses.
  const [held, setHeld] = useState<{ slot: number; tone: number } | null>(null);
  const gesture = useChordToneGestures(rects, {
    onMoveTone,
    onToggleMute,
    onHold: setHeld
  });

  if (rects.length === 0) {
    return null;
  }

  return (
    <GestureDetector gesture={gesture}>
      <View style={[styles.fill, { width, height }]}>
        <Canvas style={{ width, height }}>
          {rects.map((r, i) => {
            // The part it plays decides the colour, through every state: a
            // note keeps saying what it is while silenced and while held
            // (INV-NOTES-052).
            const colour = chordRoleColour(r.tone);
            const inHand = held?.slot === r.slot && held?.tone === r.tone;
            if (r.muted) {
              // Silenced: an outline, so it is plainly still there to bring
              // back, and still plainly the third or the fifth.
              return (
                <Rect
                  key={i}
                  x={r.x}
                  y={r.y}
                  width={r.width}
                  height={r.height}
                  style="stroke"
                  strokeWidth={1.5}
                  color={colour}
                />
              );
            }
            return (
              <RoundedRect
                key={i}
                // In hand: a little proud of the rest, so there is no doubt
                // which note the drag has hold of — without borrowing a
                // colour that would hide what part it plays.
                x={inHand ? r.x - 1 : r.x}
                y={inHand ? r.y - 2 : r.y}
                width={inHand ? r.width + 2 : r.width}
                height={inHand ? r.height + 4 : r.height}
                r={inHand ? 3 : 2}
                color={colour}
              />
            );
          })}
        </Canvas>
      </View>
    </GestureDetector>
  );
}

export default ChordBand;

const styles = StyleSheet.create({
  fill: StyleSheet.absoluteFill
});
