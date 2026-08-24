/**
 * Moving the chosen notes without touching them.
 *
 * Dragging a note on the graph is the fast way and stays the fast way, but it
 * has a fault no amount of polish removes: the thing being aimed at is under
 * the hand aiming at it, and a semitone lane is a few points tall. The loupe
 * answers that by showing what is covered (INV-NOTES-110); this answers it by
 * not covering anything — the hand is down here and the note is up there, in
 * full view, moving (INV-NOTES-111).
 *
 * A cross of two bars: up and down move by a semitone, left and right by a
 * sixteenth. Notched exactly like the length control, and for the same reason
 * — one notch is one step, so a heavy thumb cannot land between two of them.
 *
 * It acts on everything chosen, which drag also does but awkwardly, since a
 * set has no single thing to put a finger on.
 */
import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { useTheme } from '../../theme';

/** How far the hand travels for one step. Matches the length control. */
const NOTCH_PX = 26;

export interface NudgePadProps {
  /** Move the chosen notes by this many semitones. Positive is up. */
  onPitch: (semitones: number) => void;
  /** Move them by this many sixteenths. Positive is later. */
  onTime: (steps: number) => void;
  /** False when the take has no tempo, so a sixteenth means nothing. */
  canMoveInTime: boolean;
}

export function NudgePad({
  onPitch,
  onTime,
  canMoveInTime
}: NudgePadProps): React.JSX.Element {
  const { colors } = useTheme();
  // What this drag has already committed, so each notch fires once as it is
  // crossed rather than on every frame after it.
  const [applied, setApplied] = useState(0);
  const [saidPitch, setSaidPitch] = useState(0);
  const [saidTime, setSaidTime] = useState(0);

  const bar = useCallback(
    (axis: 'pitch' | 'time') =>
      Gesture.Pan()
        .withTestId(axis === 'pitch' ? 'nudge-pitch' : 'nudge-time')
        .onUpdate((e) => {
          // Up is up: the screen's y grows downward and a pitch does not.
          const travel = axis === 'pitch' ? -e.translationY : e.translationX;
          const notches = Math.round(travel / NOTCH_PX);
          if (notches === applied) {
            return;
          }
          const step = notches - applied;
          setApplied(notches);
          if (axis === 'pitch') {
            onPitch(step);
            setSaidPitch((was) => was + step);
          } else {
            onTime(step);
            setSaidTime((was) => was + step);
          }
        })
        .onFinalize(() => setApplied(0))
        .runOnJS(true),
    [applied, onPitch, onTime]
  );

  const moved = [
    saidPitch !== 0
      ? `${saidPitch > 0 ? '+' : ''}${saidPitch} semitone${
          Math.abs(saidPitch) === 1 ? '' : 's'
        }`
      : null,
    saidTime !== 0
      ? `${saidTime > 0 ? '+' : ''}${saidTime} sixteenth${
          Math.abs(saidTime) === 1 ? '' : 's'
        }`
      : null
  ].filter(Boolean);

  return (
    <View style={styles.wrap}>
      <View style={styles.cross}>
        {canMoveInTime ? (
          <GestureDetector gesture={bar('time')}>
            <View
              accessibilityLabel="Drag left or right to move the notes in time"
              style={[styles.across, { backgroundColor: colors.neutral500 }]}
            />
          </GestureDetector>
        ) : null}
        <GestureDetector gesture={bar('pitch')}>
          <View
            accessibilityLabel="Drag up or down to move the notes by a semitone"
            style={[styles.upright, { backgroundColor: colors.primary500 }]}
          />
        </GestureDetector>
      </View>
      <Text style={[styles.hint, { color: colors.gray300 }]}>
        {moved.length > 0
          ? moved.join(', ')
          : canMoveInTime
            ? 'Drag up for pitch, across for time'
            : 'Drag up or down for pitch'}
      </Text>
    </View>
  );
}

export default NudgePad;

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', marginBottom: 14 },
  cross: { width: 132, height: 96, justifyContent: 'center' },
  // The upright is the one you reach for most, so it is the coloured one and
  // it sits on top where a thumb lands first.
  upright: {
    position: 'absolute',
    left: 53,
    top: 0,
    width: 26,
    height: 96,
    borderRadius: 13,
    opacity: 0.9
  },
  across: {
    position: 'absolute',
    left: 0,
    top: 35,
    width: 132,
    height: 26,
    borderRadius: 13,
    opacity: 0.55
  },
  hint: { fontSize: 11, marginTop: 6 }
});
