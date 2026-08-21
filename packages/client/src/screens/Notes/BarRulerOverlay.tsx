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
}

export function BarRulerOverlay({
  bars,
  notes,
  grid,
  width,
  height
}: BarRulerOverlayProps): React.JSX.Element | null {
  const geometry = useMemo(() => {
    const { timeAxis } = layoutMelody(notes, { width, height, grid });
    const beatMs = grid.bpm > 0 ? 60000 / grid.bpm : 0;
    const stepsPerBeat = grid.stepsPerBeat ?? 4;
    if (!(beatMs > 0) || !(stepsPerBeat > 0) || !(timeAxis.span > 0)) {
      return null;
    }
    const stepMs = beatMs / stepsPerBeat;
    const pxPerMs = timeAxis.innerW / timeAxis.span;
    return {
      originX: timeAxis.pad + (grid.offsetMs - timeAxis.t0) * pxPerMs,
      stepWidth: stepMs * pxPerMs
    };
  }, [notes, width, height, grid]);

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
