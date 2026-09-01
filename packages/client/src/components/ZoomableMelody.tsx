/**
 * ZoomableMelody — the melody graph at a scale you control, scrolled sideways.
 *
 * A beat is a fixed width here rather than the take being squeezed to fit
 * (INV-NOTES-032), so the take runs past the screen and you move along it.
 * The scale itself, and the pinch that changes it, live in useMelodyZoom.
 *
 * Anything drawn over the melody is given the drawing's width so it lines up
 * with what is under it, and shares its scale so a gesture lands where the
 * graph says (INV-NOTES-034). A footer travels in the same scroll, which is
 * what lets the chord cards sit under the bars they describe rather than in a
 * row of their own that drifts out of step (INV-NOTES-061).
 */
import React, { useCallback, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent
} from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  scrollTo,
  useAnimatedRef,
  useAnimatedReaction,
  useSharedValue,
  type SharedValue
} from 'react-native-reanimated';

import { MelodyView } from './MelodyView';
import type { MelodyGrid, MelodyLayout, MelodyNote } from './melodyLayout';
import { useMelodyZoom } from './useMelodyZoom';
import { offsetCentring, offsetShowing, xForMs } from './melodyScale';

export interface ZoomableMelodyProps {
  notes: readonly MelodyNote[];
  grid: MelodyGrid;
  /** The viewport. The drawing is usually wider. */
  width: number;
  height: number;
  /** Other pitches sharing this axis — the chord notes under the line. */
  alsoShow?: readonly number[];
  /** A second performance drawn behind the sung line, in its own colour. */
  underlay?: readonly MelodyNote[];
  underlayColor?: string;
  /** Where the recording began, when earlier than the first sung note. */
  fromMs?: number;
  /** Where the recording ended, when later than the last note (INV-NOTES-108). */
  toMs?: number;
  /** How many opening notes were counting rather than singing. */
  countedNotes?: number;
  /**
   * Drawn above the melody and inside the same scroll — the scrubber, which
   * has to sit clear of the drawing rather than over it (INV-NOTES-081).
   */
  header?: (frame: {
    contentWidth: number;
    timeAxis: MelodyLayout['timeAxis'];
    firstNoteMs: number;
  }) => React.ReactNode;
  headerHeight?: number;
  /**
   * Drawn over the melody, given the drawing's size and both of its axes so
   * whatever it paints lines up with what is under it (INV-NOTES-034).
   */
  children?: (frame: {
    contentWidth: number;
    beatWidth: number;
    timeAxis: MelodyLayout['timeAxis'];
    pitchAxis: MelodyLayout['pitchAxis'];
    /** The sung notes as drawn, for anything that has to touch one. */
    rects: MelodyLayout['rects'];
    /** The layer's notes, on the same axes, for anything that touches one. */
    underRects: MelodyLayout['underRects'];
    /** Room below the drawing, on the same axis and the same surface. */
    underHeight: number;
  }) => React.ReactNode;
  /**
   * Told when the scale moves off the one the take opened at, and handed the
   * way back. Offering a reset that does nothing would be noise, so it is
   * only shown once there is something to undo (INV-NOTES-044).
   */
  onScaleChange?: (state: { isDefault: boolean; reset: () => void }) => void;
  /**
   * Handed the way to bring a moment of the take into view (INV-NOTES-177).
   *
   * The scroll lives in here, so a caller that knows what has been chosen has
   * no way to reach it. This is the same shape as `onScaleChange`: the thing
   * that owns the machinery hands out the one verb, rather than the caller
   * reaching in for the ScrollView.
   */
  onViewport?: (view: { bringIntoView: (atMs: number) => void }) => void;
  /**
   * The moment being played, read every frame, for the view to follow
   * (INV-NOTES-193).
   *
   * The same value the head is drawn from, so the two cannot disagree about
   * where the take has reached.
   */
  followMs?: SharedValue<number>;
  /** Whether to follow it. Off, the view stays where it was left. */
  isFollowing?: boolean;
  /**
   * Drawn beneath the melody and inside the same scroll, so it keeps step
   * with the take at every scale and scroll position.
   */
  footer?: (frame: {
    contentWidth: number;
    timeAxis: MelodyLayout['timeAxis'];
    /** Open the graph up by a factor, held about a point in the drawing. */
    zoomBy: (factor: number, focalX: number) => void;
  }) => React.ReactNode;
  /** How much room the footer takes, which the scroll has to account for. */
  footerHeight?: number;
  /**
   * Room below the drawing that is still part of it: on the same time axis,
   * inside the same scroll, and under the same touch surface.
   *
   * The rhythm band lives here (INV-NOTES-117). It is not a footer, because a
   * footer is outside the drawing and cannot be touched by the surface that
   * reads the graph — and a struck sound has to be selectable the same way a
   * note is (INT-NOTES-015).
   */
  underHeight?: number;
}

export function ZoomableMelody({
  notes,
  grid,
  width,
  height,
  alsoShow,
  underlay,
  underlayColor,
  fromMs,
  toMs,
  countedNotes,
  header,
  headerHeight = 0,
  children,
  onScaleChange,
  onViewport,
  followMs,
  isFollowing = false,
  footer,
  footerHeight = 0,
  underHeight = 0
}: ZoomableMelodyProps): React.JSX.Element {
  const scroller = useAnimatedRef<Animated.ScrollView>();
  const scrollX = useRef(0);
  /**
   * Set while a hand is on the graph, so following lets go of the view.
   *
   * Two things scrolling one view fight, and the hand must win: a person who
   * has taken hold of the drawing is looking at something.
   */
  const isHeld = useSharedValue(false);

  const { beatWidth, layout, pinch, zoomBy } = useMelodyZoom({
    notes,
    grid,
    width,
    height,
    alsoShow,
    fromMs,
    toMs,
    underlay,
    scroller,
    scrollX,
    onScaleChange
  });

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollX.current = e.nativeEvent.contentOffset.x;
  }, []);

  /**
   * Follow the take, holding the moment being played in the middle.
   *
   * On the UI thread, for the same reason the head itself is drawn there: a
   * view scrolled from JavaScript moves at whatever rate renders happen,
   * which is the judder the head was moved off that thread to avoid
   * (INV-NOTES-136).
   */
  const axis = layout.timeAxis;
  const contentWidth = layout.contentWidth;
  useAnimatedReaction(
    () => (isFollowing && followMs ? followMs.value : null),
    (atMs) => {
      'worklet';
      if (atMs == null || isHeld.value) {
        return;
      }
      scrollTo(
        scroller,
        offsetCentring(
          axis.pad + (atMs - axis.t0) * axis.pxPerMs,
          width,
          contentWidth
        ),
        0,
        false
      );
    },
    [isFollowing, followMs, axis, contentWidth, width]
  );

  // Only where the drawing is wider than the window: with the whole take in
  // view there is nothing to bring into it.
  const bringIntoView = useCallback(
    (atMs: number) => {
      const wanted = offsetShowing(
        xForMs(layout.timeAxis, atMs),
        width,
        layout.contentWidth,
        scrollX.current,
        width / 4
      );
      if (wanted != null) {
        scroller.current?.scrollTo({ x: wanted, animated: true });
      }
    },
    [layout.timeAxis, layout.contentWidth, width]
  );

  useEffect(() => {
    onViewport?.({ bringIntoView });
  }, [onViewport, bringIntoView]);

  // Starting to play takes the view back, so a take followed once, scrolled
  // away from, and played again follows once more.
  useEffect(() => {
    if (isFollowing) {
      isHeld.value = false;
    }
  }, [isFollowing, isHeld]);

  return (
    <GestureDetector gesture={pinch}>
      <Animated.ScrollView
        ref={scroller}
        // A hand on the drawing stops it following, until the take is played
        // again. Two things scrolling one view fight, and the hand wins.
        onScrollBeginDrag={() => {
          isHeld.value = true;
        }}
        horizontal
        style={{
          width,
          height: height + headerHeight + underHeight + footerHeight
        }}
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        // The drawing sets the width; the scroll view must not stretch it.
        contentContainerStyle={styles.content}
      >
        {header != null && headerHeight > 0 ? (
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: layout.contentWidth,
              height: headerHeight
            }}
          >
            {header({
              contentWidth: layout.contentWidth,
              timeAxis: layout.timeAxis,
              firstNoteMs: layout.firstNoteMs
            })}
          </View>
        ) : null}
        <View
          style={{
            width: layout.contentWidth,
            height: height + underHeight,
            marginTop: headerHeight
          }}
        >
          <MelodyView
            notes={notes}
            width={width}
            height={height}
            grid={grid}
            beatWidth={beatWidth}
            alsoShow={alsoShow}
            fromMs={fromMs}
            toMs={toMs}
            countedNotes={countedNotes}
            underlay={underlay}
            underlayColor={underlayColor}
          />
          {children?.({
            contentWidth: layout.contentWidth,
            beatWidth,
            timeAxis: layout.timeAxis,
            pitchAxis: layout.pitchAxis,
            rects: layout.rects,
            underRects: layout.underRects,
            underHeight
          })}
        </View>
        {footer != null && footerHeight > 0 ? (
          <View
            style={{
              position: 'absolute',
              top: headerHeight + height + underHeight,
              left: 0,
              width: layout.contentWidth,
              height: footerHeight
            }}
          >
            {footer({
              contentWidth: layout.contentWidth,
              timeAxis: layout.timeAxis,
              zoomBy
            })}
          </View>
        ) : null}
      </Animated.ScrollView>
    </GestureDetector>
  );
}

export default ZoomableMelody;

const styles = StyleSheet.create({
  content: { flexGrow: 0 }
});
