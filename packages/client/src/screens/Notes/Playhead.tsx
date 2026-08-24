/**
 * Playhead — where the take is, drawn down the whole graph.
 *
 * The scrubber's handle sits in its own band above the drawing so it never
 * covers the notes (INV-NOTES-081), but a mark only in that band answers
 * "where am I" for the top edge and leaves the eye to guess the rest. This is
 * the same moment carried the full height, over the notes rather than under
 * them: a line hidden behind the bars it is passing is not a playhead
 * (INV-NOTES-100).
 *
 * Paint only. It is drawn after the surface that reads touches and takes
 * none, so nothing it crosses becomes harder to pick up.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { xForMs, type TimeAxis } from '../../components/melodyScale';
import { useTheme } from '../../theme';

export interface PlayheadProps {
  /** Where the take is now, in ms. */
  positionMs: number;
  timeAxis: TimeAxis;
  contentWidth: number;
  height: number;
}

export function Playhead({
  positionMs,
  timeAxis,
  contentWidth,
  height
}: PlayheadProps): React.JSX.Element | null {
  const { colors } = useTheme();
  const last = timeAxis.t0 + timeAxis.span;
  if (!(timeAxis.pxPerMs > 0) || positionMs < timeAxis.t0 || positionMs > last) {
    return null;
  }

  return (
    <View
      testID="playhead"
      pointerEvents="none"
      style={[styles.layer, { width: contentWidth, height }]}
    >
      <View
        style={[
          styles.line,
          {
            left: xForMs(timeAxis, positionMs),
            height,
            backgroundColor: colors.primary500
          }
        ]}
      />
    </View>
  );
}

export default Playhead;

const styles = StyleSheet.create({
  layer: { position: 'absolute', top: 0, left: 0 },
  // Thin and not quite solid: it crosses every note in the take, and a heavy
  // line would read as one more thing drawn rather than as a position.
  line: { position: 'absolute', top: 0, width: 1, opacity: 0.75 }
});
