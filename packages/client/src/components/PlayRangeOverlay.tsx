/**
 * A playable stretch, drawn over whatever is on the time axis.
 *
 * Takes an axis, a stretch and two callbacks. It does not know what the
 * stretch was marked around, what plays it, or what it is drawn over — so the
 * same overlay serves a retimed note now and a loop or a section to practise
 * later (INV-NOTES-178, INV-NOTES-179).
 *
 * Laid over the content rather than painted into it, so the two ends and the
 * control are real touch targets rather than shapes that have to be
 * hit-tested.
 */
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { RangeHandle } from './RangeHandle';
import { Icon } from './Icon';
import { msForX, xForMs, type TimeAxis } from './melodyScale';
import type { PlayRange, RangeEdge } from './playRange';

/** How much of the graph the shading takes, 0..1. */
const SHADE_OPACITY = 0.16;

export interface PlayRangeOverlayProps {
  range: PlayRange | null;
  timeAxis: TimeAxis;
  height: number;
  /** The stretch's fill, and the two ends' own colours. */
  shade: string;
  fromColor: string;
  toColor: string;
  /** Where the control sits, drawn on the shade. */
  controlColor: string;
  onMoveEnd: (edge: RangeEdge, toMs: number) => void;
  onPlay: () => void;
  isPlaying: boolean;
}

export function PlayRangeOverlay({
  range,
  timeAxis,
  height,
  shade,
  fromColor,
  toColor,
  controlColor,
  onMoveEnd,
  onPlay,
  isPlaying
}: PlayRangeOverlayProps): React.JSX.Element | null {
  if (!range) {
    return null;
  }
  const left = xForMs(timeAxis, range.fromMs);
  const right = xForMs(timeAxis, range.toMs);

  return (
    // Non-blocking as a whole: the notes underneath stay touchable, and only
    // the two ends and the control take a finger.
    <View style={styles.layer} pointerEvents="box-none">
      <View
        testID="play-range-shade"
        pointerEvents="none"
        style={[
          styles.shade,
          {
            left,
            width: Math.max(0, right - left),
            height,
            backgroundColor: shade,
            opacity: SHADE_OPACITY
          }
        ]}
      />
      <RangeHandle
        testID="play-range-from"
        x={left}
        height={height}
        color={fromColor}
        facing="left"
        onMove={(x) => onMoveEnd('from', msForX(timeAxis, x))}
      />
      <RangeHandle
        testID="play-range-to"
        x={right}
        height={height}
        color={toColor}
        facing="right"
        onMove={(x) => onMoveEnd('to', msForX(timeAxis, x))}
      />
      <Pressable
        testID="play-range-play"
        accessibilityRole="button"
        onPress={onPlay}
        style={[styles.play, { left: left + 6, backgroundColor: controlColor }]}>
        <Icon name={isPlaying ? 'stop' : 'play'} size={14} color={shade} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  shade: { position: 'absolute', top: 0 },
  // Low and inside the stretch's own start, where it is out of the way of the
  // notes being judged but unambiguously part of this stretch.
  play: {
    position: 'absolute',
    bottom: 6,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center'
  }
});

export default PlayRangeOverlay;
