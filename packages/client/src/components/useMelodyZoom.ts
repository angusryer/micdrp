/**
 * useMelodyZoom — the scale of the graph, the layout at that scale, and the
 * pinch that changes it.
 *
 * Split from the view so that file paints and this one decides how big
 * things are. It owns the layout too, because the layout is a consequence of
 * the scale: separating them would mean two places deciding one thing.
 *
 * Zooming is anchored to the midpoint between the fingers (INV-NOTES-043),
 * stops when the whole take fits (INV-NOTES-044), and can always be put back.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ScrollView } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';

import {
  layoutMelody,
  type MelodyGrid,
  type MelodyNote
} from './melodyLayout';
import {
  anchorZoom,
  beatWidthShowingAll,
  clampBeatWidth,
  DEFAULT_BEAT_WIDTH
} from './melodyScale';

export interface MelodyZoomOptions {
  notes: readonly MelodyNote[];
  grid: MelodyGrid;
  width: number;
  height: number;
  alsoShow?: readonly number[];
  scroller: React.RefObject<ScrollView | null>;
  scrollX: React.RefObject<number>;
  onScaleChange?: (state: { isDefault: boolean; reset: () => void }) => void;
}

export function useMelodyZoom({
  notes,
  grid,
  width,
  height,
  alsoShow,
  scroller,
  scrollX,
  onScaleChange
}: MelodyZoomOptions) {
  const beatsPerBar = grid.beatsPerBar > 0 ? grid.beatsPerBar : 4;
  const [beatWidth, setBeatWidth] = useState(() =>
    clampBeatWidth(DEFAULT_BEAT_WIDTH, width, beatsPerBar)
  );

  /** The width at the moment a pinch began, so the gesture is not compounded. */
  const pinchStart = useRef(beatWidth);
  /** Where the pinch is centred, held from its first moment. */
  const focal = useRef(0);

  const layout = useMemo(
    () => layoutMelody(notes, { width, height, grid, beatWidth, alsoShow }),
    [notes, width, height, grid, beatWidth, alsoShow]
  );

  // Zooming out stops when the whole take fits, pickup included: past that
  // there is nothing further to see. Derived from this take rather than
  // fixed, since "everything at once" means something different for eight
  // bars than for two minutes.
  const floor = useMemo(
    () =>
      beatWidthShowingAll(
        layout.timeAxis.span,
        layout.timeAxis.innerW,
        60000 / grid.bpm
      ),
    [layout.timeAxis.span, layout.timeAxis.innerW, grid.bpm]
  );

  const opened = useMemo(
    () => clampBeatWidth(DEFAULT_BEAT_WIDTH, width, beatsPerBar, floor),
    [width, beatsPerBar, floor]
  );

  const pad = layout.timeAxis.pad;

  const zoomTo = useCallback(
    (desired: number, focalX: number) => {
      const next = clampBeatWidth(desired, width, beatsPerBar, floor);
      if (next === beatWidth || !(beatWidth > 0)) {
        return;
      }
      const nextX = anchorZoom(scrollX.current, focalX, pad, next / beatWidth);
      setBeatWidth(next);
      scroller.current?.scrollTo({ x: nextX, animated: false });
    },
    [beatWidth, beatsPerBar, floor, pad, scroller, scrollX, width]
  );

  const pinch = useMemo(
    () =>
      Gesture.Pinch()
        .onBegin((e) => {
          pinchStart.current = beatWidth;
          // The midpoint between the fingers when the pinch began, held for
          // the whole gesture so the moment under it does not drift.
          focal.current = e.focalX;
        })
        .onUpdate((e) => zoomTo(pinchStart.current * e.scale, focal.current))
        .runOnJS(true),
    [beatWidth, zoomTo]
  );

  /**
   * Open the graph up by a factor, held about a point.
   *
   * What a chord too narrow to read asks for: exactly enough that its own
   * card fits (INV-NOTES-063). It goes through the same clamp as a pinch, so
   * it can never ask for a scale the take does not allow.
   */
  const zoomBy = useCallback(
    (factor: number, focalX: number) => zoomTo(beatWidth * factor, focalX),
    [beatWidth, zoomTo]
  );

  /** Back to the scale the take opened at, about the middle of the screen. */
  const reset = useCallback(
    () => zoomTo(opened, width / 2),
    [opened, width, zoomTo]
  );

  // A short take can have a floor above the default, so the width chosen
  // before the take was measured may be out of range. Correct it rather than
  // draw one frame at a scale the take does not allow.
  useEffect(() => {
    const allowed = clampBeatWidth(beatWidth, width, beatsPerBar, floor);
    if (allowed !== beatWidth) {
      setBeatWidth(allowed);
    }
  }, [beatWidth, beatsPerBar, floor, width]);

  // Offer the way back only once there is something to undo.
  useEffect(() => {
    onScaleChange?.({ isDefault: beatWidth === opened, reset });
  }, [beatWidth, opened, reset, onScaleChange]);

  return { beatWidth, layout, pinch, zoomBy };
}
