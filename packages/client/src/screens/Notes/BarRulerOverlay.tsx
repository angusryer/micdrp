/**
 * The bar ruler, positioned over the melody it belongs to.
 *
 * A thin piece: it turns the arrangement and the view's own time axis into the
 * geometry the ruler needs. Deriving the axis from the layout that drew the
 * lines rather than recomputing it is what stops a drag landing beside them
 * instead of on them.
 */
import React, { useCallback, useMemo } from 'react';

import { layoutMelody, type MelodyGrid, type MelodyNote } from '../../components/melodyLayout';
import type { BarArrangement } from './useBarLayout';
import { BarRuler } from './BarRuler';
import { barHandles, previewSignatures, stepAtX } from './barRulerModel';

export interface BarRulerOverlayProps {
  bars: BarArrangement;
  notes: readonly MelodyNote[];
  grid: MelodyGrid;
  width: number;
  height: number;
  /**
   * The scale the melody underneath was drawn at. It has to be the same one,
   * or the handles sit beside the lines they move (INV-NOTES-034).
   */
  beatWidth?: number;
}

export function BarRulerOverlay({
  bars,
  notes,
  grid,
  width,
  height,
  beatWidth
}: BarRulerOverlayProps): React.JSX.Element | null {
  const geometry = useMemo(() => {
    const { timeAxis } = layoutMelody(notes, { width, height, grid, beatWidth });
    const beatMs = grid.bpm > 0 ? 60000 / grid.bpm : 0;
    const stepsPerBeat = grid.stepsPerBeat ?? 4;
    if (!(beatMs > 0) || !(stepsPerBeat > 0) || !(timeAxis.span > 0)) {
      return null;
    }
    // pxPerMs comes from the layout rather than being derived again here: two
    // converters disagree the moment one gains a scale the other lacks.
    return {
      originX: timeAxis.pad + (grid.offsetMs - timeAxis.t0) * timeAxis.pxPerMs,
      stepWidth: (beatMs / stepsPerBeat) * timeAxis.pxPerMs
    };
  }, [notes, width, height, grid, beatWidth]);

  const toStep = useCallback(
    (x: number) => (geometry ? stepAtX(x, geometry) : 0),
    [geometry]
  );
  const preview = useCallback(
    (lineIndex: number, step: number) =>
      previewSignatures(bars.layout, bars.totalSteps, lineIndex, step),
    [bars.layout, bars.totalSteps]
  );

  if (!geometry) {
    return null;
  }

  return (
    <BarRuler
      handles={barHandles(bars.layout, geometry)}
      originX={geometry.originX}
      stepWidth={geometry.stepWidth}
      width={width}
      height={height}
      stepAtX={toStep}
      previewAt={preview}
      onMove={bars.move}
      onSplit={bars.split}
      onMerge={bars.merge}
    />
  );
}

export default BarRulerOverlay;
