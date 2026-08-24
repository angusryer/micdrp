/**
 * How long the chosen notes last, dragged from either end.
 *
 * A blue span with grey either side of it. Pull an edge outward and the notes
 * grow; push it inward and they shrink, a sixteenth per notch. Letting go springs
 * the edge back to where it started, so the same short drag can be repeated
 * as far as you like without the control running out of room
 * (INV-NOTES-097).
 *
 * Notched rather than accelerating. Acceleration makes the same gesture mean
 * different amounts depending how fast the hand moved, which is impossible to
 * aim with when the intent is exactly two beats — and the spring-back already
 * solves the range problem acceleration was there to solve.
 *
 * The two ends are not a mirror of one thing: dragging the right edge moves
 * where the notes end, and dragging the left edge moves where they begin.
 */
import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { useTheme } from '../../theme';

/** How far the hand travels for one sixteenth. */
const NOTCH_PX = 26;

export interface LengthBarProps {
  /**
   * Change the length by this many sixteenths, from one end or the other.
   * Negative shortens.
   */
  onResize: (steps: number, edge: 'start' | 'end') => void;
  /** False when the take has no tempo, so a sixteenth means nothing. */
  canResize: boolean;
  /** Put every length back to what was heard. Absent when none were changed. */
  onResetAll?: () => void;
}

export function LengthBar({
  onResize,
  canResize,
  onResetAll
}: LengthBarProps): React.JSX.Element {
  const { colors } = useTheme();
  // What this drag has already committed, so each notch fires once as it is
  // crossed rather than on every frame after it.
  const [applied, setApplied] = useState(0);
  const [nudge, setNudge] = useState(0);

  const edgeDrag = useCallback(
    (side: 1 | -1) =>
      Gesture.Pan()
        .withTestId(side > 0 ? 'length-end' : 'length-start')
        .onUpdate((e) => {
          const notches = Math.round(e.translationX / NOTCH_PX);
          setNudge(e.translationX);
          if (notches === applied) {
            return;
          }
          // Pulling the right edge right lengthens; pulling the left edge
          // left lengthens too, which is why the side decides the sign. Which
          // end moved is what the notes are told, since one moves where they
          // end and the other where they begin.
          onResize((notches - applied) * side, side > 0 ? 'end' : 'start');
          setApplied(notches);
        })
        .onFinalize(() => {
          // Home again, ready to be dragged the same short distance for the
          // next sixteenth.
          setApplied(0);
          setNudge(0);
        })
        .runOnJS(true),
    [applied, onResize]
  );

  if (!canResize) {
    return (
      <Text style={[styles.none, { color: colors.gray300 }]}>
        No steady beat was found in this take, so there is nothing to measure
        a note's length against.
      </Text>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={[styles.track, { backgroundColor: colors.neutral300 }]}>
        <View
          style={[
            styles.span,
            {
              backgroundColor: colors.primary500,
              transform: [{ translateX: nudge / 2 }],
              // The span itself stretches with the hand, so the drag looks
              // like the thing it is doing while it is doing it.
              width: `${33 + Math.abs(nudge) / 8}%`
            }
          ]}
        >
          <GestureDetector gesture={edgeDrag(-1)}>
            <View
              accessibilityLabel="Drag to move where the notes begin"
              style={styles.grip}
            />
          </GestureDetector>
          <GestureDetector gesture={edgeDrag(1)}>
            <View
              accessibilityLabel="Drag to move where the notes end"
              style={styles.grip}
            />
          </GestureDetector>
        </View>
      </View>
      <View style={styles.footer}>
        <Text style={[styles.hint, { color: colors.gray300 }]}>
          {applied === 0
            ? 'Drag either end — a sixteenth a notch'
            : `${applied > 0 ? '+' : ''}${applied} sixteenth${
                Math.abs(applied) === 1 ? '' : 's'
              }`}
        </Text>
        {/* Offered only where there is something to undo (INV-NOTES-098). */}
        {onResetAll ? (
          <Text
            accessibilityRole="button"
            onPress={onResetAll}
            style={[styles.reset, { color: colors.primary500 }]}
          >
            Put every length back
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export default LengthBar;

const styles = StyleSheet.create({
  wrap: { marginBottom: 14 },
  track: {
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    overflow: 'hidden'
  },
  span: {
    height: 26,
    borderRadius: 13,
    alignSelf: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  // Wide enough to catch without hunting, at both ends of the blue.
  grip: { width: 44, height: 26 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    gap: 12
  },
  hint: { fontSize: 11 },
  reset: { fontSize: 11, fontWeight: '600' },
  none: { fontSize: 12, lineHeight: 17, marginBottom: 12 }
});
