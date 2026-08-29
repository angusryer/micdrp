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
import { SelectionGlow } from '../../components/SelectionGlow';
import { layoutChordTones } from '../../components/chordLayout';
import { layoutHits } from '../../components/rhythmLanes';
import { TappedBeats, beatLines } from '../../components/TappedBeats';
import { msForX } from '../../components/melodyScale';
import type { MelodyLayout, NoteRect } from '../../components/melodyLayout';
import type { Chosen, Selection } from '../../components/graphSelection';
import { useTheme } from '../../theme';
import { BarRuler } from './BarRuler';
import { barHandles } from './barRulerModel';
import type { useNoteDetail } from './useNoteDetail';

export interface GraphLayersProps {
  detail: ReturnType<typeof useNoteDetail>;
  /** The sung notes as drawn, so touching one lands where it looks. */
  noteRects: readonly NoteRect[];
  contentWidth: number;
  height: number;
  /** The layer's notes, laid out with the melody (INV-NOTES-118). */
  noteRectsUnder?: readonly NoteRect[];
  /** Room below the drawing holding the rhythm band, on the same surface. */
  underHeight?: number;
  timeAxis: MelodyLayout['timeAxis'];
  pitchAxis: MelodyLayout['pitchAxis'];
  selection: Chosen;
  onSelect: (selection: Chosen) => void;
  /** Made to flash from its row in the sheet (INV-NOTES-094). */
  flashing?: Selection | null;
}

export function GraphLayers({
  detail,
  noteRects,
  contentWidth,
  height,
  noteRectsUnder = [],
  underHeight = 0,
  timeAxis,
  pitchAxis,
  selection,
  onSelect,
  flashing
}: GraphLayersProps): React.JSX.Element {
  const { colors } = useTheme();
  const { gridForView, chords, floorMidi, bars } = detail;

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

  // ChordBand draws one as "in hand"; with several chosen it is the first,
  // which is the one the glow behind them all makes unambiguous anyway.
  const firstTone = selection.find((one) => one.kind === 'chordTone');
  const chosenTone =
    firstTone?.kind === 'chordTone'
      ? { slot: firstTone.slot, tone: firstTone.tone }
      : null;
  const firstBar = selection.find((one) => one.kind === 'barLine');

  // Where each struck sound's mark sits, in the band below the drawing. The
  // same layout the band paints from, offset into the surface's coordinates,
  // so a hit can be touched exactly where it is drawn (INV-NOTES-118).
  // Where each tapped beat is drawn, from the same layout that paints them
  // (INV-NOTES-104).
  const beatMarks = useMemo(
    () => beatLines(detail.beats, timeAxis),
    [detail.beats, timeAxis]
  );

  const hitPoints = useMemo(
    () =>
      layoutHits(detail.hits, timeAxis, underHeight).map((mark) => ({
        index: mark.index,
        x: mark.x,
        y: height + mark.y
      })),
    [detail.hits, timeAxis, underHeight, height]
  );

  return (
    <>
      {/* Underneath everything it lights, so the chosen thing blooms at its
          edges and is never covered by its own halo (INV-NOTES-057). */}
      <SelectionGlow
        selection={selection}
        flashing={flashing}
        tones={tones}
        bars={handles}
        notes={noteRects}
        layerNotes={noteRectsUnder}
        hits={hitPoints}
        beatLines={beatMarks}
        width={contentWidth}
        height={height + underHeight}
        colour={colors.primary500}
      />
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
      {/* The same handles the surface below reads touches from, so a line is
          drawn exactly where it can be picked up. It used to lay itself out
          again from the notes, which produced a second time axis that did not
          know about the pickup — so every line was drawn the length of the
          pickup earlier than the downbeat it marked (INV-NOTES-104). */}
      {/* Over the rules and under the surface: stated rather than ruled, so
          it reads above the metre it may replace (INV-NOTES-130). */}
      <TappedBeats
        beats={detail.beats}
        timeAxis={timeAxis}
        contentWidth={contentWidth}
        height={height}
      />
      <BarRuler
        handles={handles}
        width={contentWidth}
        height={height}
        selectedLine={firstBar?.kind === 'barLine' ? firstBar.lineIndex : null}
      />
      {/* Above both, and the only thing that reads a touch. */}
      {geometry != null ? (
        <GraphSurface
          width={contentWidth}
          height={height + underHeight}
          tones={tones}
          bars={handles}
          notes={noteRects}
          layerNotes={noteRectsUnder}
          hits={hitPoints}
          beats={beatMarks}
          laneHeight={pitchAxis.lane}
          originX={geometry.originX}
          stepWidth={geometry.stepWidth}
          selection={selection}
          onSelect={onSelect}
          onMoveBar={bars.move}
          onMoveTone={chords.moveTone}
          onMoveNote={detail.correctNote}
          onMoveBeat={(index, xPx) =>
            detail.moveBeatTo(index, msForX(timeAxis, xPx))
          }
          onAddBar={bars.split}
          isSnapping={detail.listening.snapToGrid}
          onRemoveBar={bars.merge}
          onRemoveBeat={detail.removeBeatAt}
          onHear={detail.hearDragged}
        />
      ) : null}
    </>
  );
}

export default GraphLayers;
