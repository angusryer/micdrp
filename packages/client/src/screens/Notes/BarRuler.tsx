/**
 * BarRuler — the downbeat in hand, drawn.
 *
 * Only the chosen one. Every downbeat is already marked by the dotted rule
 * behind the notes (INV-NOTES-102), which is drawn from the same arrangement
 * this reads, so a solid line over each of them said the same thing twice and
 * read as a second kind of object nobody could pick up (INV-NOTES-104). What
 * is left is the one job the dotted rule cannot do: show which line is in
 * hand.
 *
 * Paint only. Touches on the graph are read by one surface above every layer
 * (INT-NOTES-015), so this knows nothing about gestures — which is what fixed
 * the chord notes being unreachable: this used to carry a full-size gesture
 * layer that swallowed everything beneath it.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '../../theme';
import { BarLineHandle } from './BarLineHandle';
import type { BarHandle } from './barRulerModel';

export interface BarRulerProps {
  handles: readonly BarHandle[];
  width: number;
  height: number;
  /** Which line is the chosen thing. The only one drawn. */
  selectedLine: number | null;
}

export function BarRuler({
  handles,
  width,
  height,
  selectedLine
}: BarRulerProps): React.JSX.Element {
  const { colors } = useTheme();

  return (
    <View
      style={[styles.fill, { width, height }]}
      pointerEvents="none"
      testID="bar-ruler"
    >
      {handles
        .filter((handle) => handle.lineIndex === selectedLine)
        .map((handle) => (
          <BarLineHandle
            key={handle.lineIndex}
            handle={handle}
            height={height}
            color={colors.primary500}
          />
        ))}
    </View>
  );
}

export default BarRuler;

const styles = StyleSheet.create({
  fill: { position: 'absolute', top: 0, left: 0 }
});
