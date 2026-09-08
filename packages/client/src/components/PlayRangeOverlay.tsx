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
 *
 * Where the two ends sit is owned by the UI thread (INV-NOTES-235). The
 * shading and the play control are drawn from the same two values, so all
 * three move together with the finger and none of them costs a render. React
 * hears about it once, when the finger leaves.
 */
import React, { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue
} from 'react-native-reanimated';

import { RangeHandle } from './RangeHandle';
import { Icon } from './Icon';
import { xForMs, type TimeAxis } from './melodyScale';
import { dragLimits, settledAt } from './playRangeDrag';
import type { PlayRange, RangeEdge } from './playRange';

/** How much of the graph the shading takes, 0..1. */
const SHADE_OPACITY = 0.16;

/** How far in from the stretch's start the play control sits, in px. */
const PLAY_INSET = 6;

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
  /** The first touch on either end, so what is sounding stops once. */
  onGrab: () => void;
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
  onGrab,
  onMoveEnd,
  onPlay,
  isPlaying
}: PlayRangeOverlayProps): React.JSX.Element | null {
  /**
   * How far each end has been taken from where the committed stretch puts it.
   *
   * Offsets rather than positions, so what is drawn is right on the very
   * first frame — the committed place alone is already correct, and an
   * overlay that had to wait for an effect to learn where it was would paint
   * one frame at nothing every time a stretch appeared.
   */
  const fromDrag = useSharedValue(0);
  const toDrag = useSharedValue(0);

  const left = range ? xForMs(timeAxis, range.fromMs) : 0;
  const right = range ? xForMs(timeAxis, range.toMs) : 0;

  // Back to nothing once the commit has landed. Invisible by construction:
  // the drag settled at `left + fromDrag`, and this runs on the render where
  // `left` has become exactly that — so zero moves it by zero.
  useEffect(() => {
    fromDrag.value = 0;
  }, [fromDrag, left]);
  useEffect(() => {
    toDrag.value = 0;
  }, [toDrag, right]);

  const limits = useMemo(
    () => dragLimits(timeAxis, left, right),
    [timeAxis, left, right]
  );
  // Stable, because each is a dep of its handle's gesture: an arrow written
  // at the call site would rebuild that gesture on every render, which during
  // a drag is every frame of the drag itself (INV-NOTES-235).
  const settleFrom = useMemo(
    () => settledAt(timeAxis, 'from', onMoveEnd),
    [timeAxis, onMoveEnd]
  );
  const settleTo = useMemo(
    () => settledAt(timeAxis, 'to', onMoveEnd),
    [timeAxis, onMoveEnd]
  );

  const stretch = useAnimatedStyle(() => {
    const at = left + fromDrag.value;
    return {
      transform: [{ translateX: at }],
      width: Math.max(0, right + toDrag.value - at)
    };
  });

  const control = useAnimatedStyle(() => ({
    transform: [{ translateX: left + fromDrag.value + PLAY_INSET }]
  }));

  if (!range) {
    return null;
  }

  return (
    // Non-blocking as a whole: the notes underneath stay touchable, and only
    // the two ends and the control take a finger.
    <View style={styles.layer} pointerEvents="box-none">
      <Animated.View
        testID="play-range-shade"
        pointerEvents="none"
        style={[
          styles.shade,
          { height, backgroundColor: shade, opacity: SHADE_OPACITY },
          stretch
        ]}
      />
      <RangeHandle
        testID="play-range-from"
        baseX={left}
        drag={fromDrag}
        lowX={limits.from.lowX}
        highX={limits.from.highX}
        height={height}
        color={fromColor}
        facing="left"
        onGrab={onGrab}
        onSettled={settleFrom}
      />
      <RangeHandle
        testID="play-range-to"
        baseX={right}
        drag={toDrag}
        lowX={limits.to.lowX}
        highX={limits.to.highX}
        height={height}
        color={toColor}
        facing="right"
        onGrab={onGrab}
        onSettled={settleTo}
      />
      <AnimatedPressable
        testID="play-range-play"
        accessibilityRole="button"
        onPress={onPlay}
        style={[styles.play, { backgroundColor: controlColor }, control]}>
        <Icon name={isPlaying ? 'stop' : 'play'} size={14} color={shade} />
      </AnimatedPressable>
    </View>
  );
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const styles = StyleSheet.create({
  layer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  // Placed by a transform rather than by `left`: the UI thread can write one
  // without a layout pass, which is what lets the shade follow the finger.
  shade: { position: 'absolute', top: 0, left: 0 },
  // Low and inside the stretch's own start, where it is out of the way of the
  // notes being judged but unambiguously part of this stretch.
  play: {
    position: 'absolute',
    bottom: 6,
    left: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center'
  }
});

export default PlayRangeOverlay;
