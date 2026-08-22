/**
 * ZoomableMelody — the melody graph at a scale you control, scrolled sideways.
 *
 * A beat is a fixed width here rather than the take being squeezed to fit
 * (INV-NOTES-032), so the take runs past the screen and you move along it.
 * The scale itself, and the pinch that changes it, live in useMelodyZoom.
 *
 * Anything drawn over the melody is given the drawing's width so it lines up
 * with what is under it, and shares its scale so a gesture lands where the
 * graph says (INV-NOTES-034).
 */
import React, { useCallback, useRef } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent
} from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';

import { MelodyView } from './MelodyView';
import type { MelodyGrid, MelodyLayout, MelodyNote } from './melodyLayout';
import { useMelodyZoom } from './useMelodyZoom';

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
  /**
   * Told when the scale moves off the one the take opened at, and handed the
   * way back. Offering a reset that does nothing would be noise, so it is
   * only shown once there is something to undo (INV-NOTES-044).
   */
  onScaleChange?: (state: { isDefault: boolean; reset: () => void }) => void;
}

export function ZoomableMelody({
  notes,
  grid,
  width,
  height,
  alsoShow,
  children,
  onScaleChange
}: ZoomableMelodyProps): React.JSX.Element {
  const scroller = useRef<ScrollView>(null);
  const scrollX = useRef(0);

  const { beatWidth, layout, pinch } = useMelodyZoom({
    notes,
    grid,
    width,
    height,
    alsoShow,
    scroller,
    scrollX,
    onScaleChange
  });

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollX.current = e.nativeEvent.contentOffset.x;
  }, []);

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
