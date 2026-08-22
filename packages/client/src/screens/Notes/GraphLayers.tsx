/**
 * GraphLayers — everything drawn over the melody, and the one layer that
 * reads touches.
 *
 * The order matters and is the whole point. The chord notes and the bar lines
 * only paint; a single surface sits above them and interprets every touch
 * (INT-NOTES-015). Before this, each overlay carried its own full-size
 * gesture layer, so whichever was drawn last swallowed the touches meant for
 * everything beneath it — which is why the chord notes could not be reached
 * at all.
 *
 * Laying the chord tones out here rather than inside the band means the thing
 * that draws them and the thing that hit-tests them are working from one set
 * of rectangles, so a note can never be somewhere different from where it can
 * be touched.
 */
import React, { useMemo } from 'react';

import { ChordBand } from '../../components/ChordBand';
import { GraphSurface } from '../../components/GraphSurface';
import { layoutChordTones } from '../../components/chordLayout';
import type { MelodyLayout, NoteRect } from '../../components/melodyLayout';
import type { Selection } from '../../components/graphSelection';
import { BarRulerOverlay } from './BarRulerOverlay';
import { barHandles } from './barRulerModel';
import type { useNoteDetail } from './useNoteDetail';

export interface GraphLayersProps {
  detail: ReturnType<typeof useNoteDetail>;
  /** The sung notes as drawn, so touching one lands where it looks. */
  noteRects: readonly NoteRect[];
  contentWidth: number;
  beatWidth: number;
  height: number;
  timeAxis: MelodyLayout['timeAxis'];
  pitchAxis: MelodyLayout['pitchAxis'];
  selection: Selection | null;
  onSelect: (selection: Selection | null) => void;
}

export function GraphLayers({
  detail,
  noteRects,
  contentWidth,
  beatWidth,
  height,
  timeAxis,
  pitchAxis,
  selection,
  onSelect
}: GraphLayersProps): React.JSX.Element {
  const { melody, gridForView, chords, floorMidi, bars } = detail;

  const tones = useMemo(
    () => layoutChordTones(chords.slots, timeAxis, pitchAxis, floorMidi),
    [chords.slots, timeAxis, pitchAxis, floorMidi]
  );

  // The same geometry the ruler draws its handles from, so a touch lands on
  // the line it appears to land on (INV-NOTES-034).
  const geometry = useMemo(() => {
    const beatMs = gridForView ? 60000 / gridForView.bpm : 0;
    const stepsPerBeat = gridForView?.stepsPerBeat ?? 4;
    if (!(beatMs > 0) || !(stepsPerBeat > 0) || !gridForView) {
      return null;
    }
    return {
      originX:
        timeAxis.pad + (gridForView.offsetMs - timeAxis.t0) * timeAxis.pxPerMs,
      stepWidth: (beatMs / stepsPerBeat) * timeAxis.pxPerMs
    };
  }, [gridForView, timeAxis]);

  const handles = useMemo(
    () => (geometry ? barHandles(bars.layout, geometry) : []),
    [bars.layout, geometry]
  );

  const chosenTone =
    selection?.kind === 'chordTone'
      ? { slot: selection.slot, tone: selection.tone }
      : null;

  return (
    <>
      {/* The chords as individual notes, on the same pitch ruler as the line
          above them. Paint only. */}
      <ChordBand
        slots={chords.slots}
        timeAxis={timeAxis}
        pitchAxis={pitchAxis}
        floorMidi={floorMidi}
        width={contentWidth}
        height={height}
        selected={chosenTone}
      />
      {/* Over the melody rather than beside it: the bars are a claim about
          this take, and correcting one means seeing both. Paint only. */}
      {gridForView != null ? (
        <BarRulerOverlay
          bars={bars}
          notes={melody}
          grid={gridForView}
          width={contentWidth}
          height={height}
          beatWidth={beatWidth}
          selectedLine={
            selection?.kind === 'barLine' ? selection.lineIndex : null
          }
        />
      ) : null}
      {/* Above both, and the only thing that reads a touch. */}
      {geometry != null ? (
        <GraphSurface
          width={contentWidth}
          height={height}
          tones={tones}
          bars={handles}
          notes={noteRects}
          laneHeight={pitchAxis.lane}
          originX={geometry.originX}
          stepWidth={geometry.stepWidth}
          selection={selection}
          onSelect={onSelect}
          onMoveBar={bars.move}
          onMoveTone={chords.moveTone}
          onMoveNote={detail.correctNote}
          onAddBar={bars.split}
        />
      ) : null}
    </>
  );
}

export default GraphLayers;
