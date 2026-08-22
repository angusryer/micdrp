/**
 * ZoomableMelody — the melody graph at a scale you control, scrolled sideways.
 *
 * A beat is a fixed width here rather than the take being squeezed to fit
 * (INV-NOTES-032), so the take runs past the screen and you move along it.
 * Pinching changes that width within bounds and changes nothing else
 * (INV-NOTES-033).
 *
 * Zooming holds the moment in the middle of the screen still. Without that,
 * changing scale throws you somewhere else in the take, and you have to find
 * your place again every time you look closer — which is precisely when you
 * least want to lose it.
 *
 * Anything drawn over the melody is given the drawing's width so it lines up
 * with what is under it, and shares its scale so a gesture lands where the
 * graph says (INV-NOTES-034).
 */
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { MelodyView } from './MelodyView';
import {
  layoutMelody,
  type MelodyGrid,
  type MelodyLayout,
  type MelodyNote
} from './melodyLayout';
import { anchorZoom, clampBeatWidth, DEFAULT_BEAT_WIDTH } from './melodyScale';

export interface ZoomableMelodyProps {
  notes: readonly MelodyNote[];
  grid: MelodyGrid;
  /** The viewport. The drawing is usually wider. */
  width: number;
  height: number;
  /** Other pitches sharing this axis — the chord notes under the line. */
  alsoShow?: readonly number[];
  /**
   * Drawn over the melody, given the drawing's size and both of its axes so
   * whatever it paints lines up with what is under it (INV-NOTES-034).
   */
  children?: (frame: {
    contentWidth: number;
    beatWidth: number;
    timeAxis: MelodyLayout['timeAxis'];
    pitchAxis: MelodyLayout['pitchAxis'];
  }) => React.ReactNode;
}

export function ZoomableMelody({
  notes,
  grid,
  width,
  height,
  alsoShow,
  children
}: ZoomableMelodyProps): React.JSX.Element {
  const beatsPerBar = grid.beatsPerBar > 0 ? grid.beatsPerBar : 4;
  const [beatWidth, setBeatWidth] = useState(() =>
    clampBeatWidth(DEFAULT_BEAT_WIDTH, width, beatsPerBar)
  );

  const scroller = useRef<ScrollView>(null);
  const scrollX = useRef(0);
  /** The width at the moment a pinch began, so the gesture is not compounded. */
  const pinchStart = useRef(beatWidth);

  const layout = useMemo(
    () => layoutMelody(notes, { width, height, grid, beatWidth, alsoShow }),
    [notes, width, height, grid, beatWidth, alsoShow]
  );

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollX.current = e.nativeEvent.contentOffset.x;
  }, []);

  /**
   * Re-scale about the middle of the screen: find the moment sitting there,
   * then scroll so it is still there at the new scale.
   */
  const zoomTo = useCallback(
    (desired: number) => {
      const next = clampBeatWidth(desired, width, beatsPerBar);
      if (next === beatWidth || !(beatWidth > 0)) {
        return;
      }
      const nextX = anchorZoom(
        scrollX.current,
        width,
        layout.timeAxis.pad,
        next / beatWidth
      );
      setBeatWidth(next);
      scroller.current?.scrollTo({ x: nextX, animated: false });
    },
    [beatWidth, beatsPerBar, layout.timeAxis.pad, width]
  );

  const pinch = useMemo(
    () =>
      Gesture.Pinch()
        .onBegin(() => {
          pinchStart.current = beatWidth;
        })
        .onUpdate((e) => {
          zoomTo(pinchStart.current * e.scale);
        })
        .runOnJS(true),
    [beatWidth, zoomTo]
  );

  return (
    <GestureDetector gesture={pinch}>
      <ScrollView
        ref={scroller}
        horizontal
        style={{ width, height }}
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        // The drawing sets the width; the scroll view must not stretch it.
        contentContainerStyle={styles.content}
      >
        <View style={{ width: layout.contentWidth, height }}>
          <MelodyView
            notes={notes}
            width={width}
            height={height}
            grid={grid}
            beatWidth={beatWidth}
            alsoShow={alsoShow}
          />
          {children?.({
            contentWidth: layout.contentWidth,
            beatWidth,
            timeAxis: layout.timeAxis,
            pitchAxis: layout.pitchAxis
          })}
        </View>
      </ScrollView>
    </GestureDetector>
  );
}

export default ZoomableMelody;

const styles = StyleSheet.create({
  content: { flexGrow: 0 }
});
