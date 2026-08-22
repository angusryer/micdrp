/**
 * BarRuler — the bar lines, drawn.
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
  /** Which line is the chosen thing, drawn heavier. */
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
      {handles.map((handle) => (
        <BarLineHandle
          key={handle.lineIndex}
          handle={handle}
          height={height}
          color={colors.primary700}
          chosenColor={colors.primary500}
          isChosen={handle.lineIndex === selectedLine}
        />
      ))}
    </View>
  );
}

export default BarRuler;

const styles = StyleSheet.create({
  fill: { position: 'absolute', top: 0, left: 0 }
});
