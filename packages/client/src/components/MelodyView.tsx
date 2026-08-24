/**
 * MelodyView — a static "piano-roll" of a whole melody: time on the x-axis,
 * pitch on the y-axis. Each sung note is a rounded bar and nothing else.
 *
 * A line once joined their centres to show the melodic shape. It read as a
 * claim the take does not make — the voice does not travel between notes the
 * way a straight line between two centres suggests — and now that the notes
 * are things you can pick up and move, a line drawn across them is one more
 * thing in the way of the ones that matter.
 *
 * All positioning is the pure `melodyLayout` math (unit-tested); this component
 * only paints. It is off the live audio path — safe to render anywhere.
 */
import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Canvas,
  DashPathEffect,
  Line,
  Path,
  RoundedRect,
  Skia,
  vec
} from '@shopify/react-native-skia';

import { BAR_RULE, BEAT_RULE, BOUNDARY_OPACITY } from './metreLines';
import { writePickupHatch } from './pickupHatch';
import { useTheme } from '../theme';
import {
  layoutMelody,
  xForMs,
  yForMidi,
  type MelodyGrid,
  type MelodyNote
} from './melodyLayout';

export interface MelodyViewProps {
  notes: readonly MelodyNote[];
  width: number;
  height: number;
  /** Override the bar colour (defaults to the theme primary). */
  color?: string;
  /**
   * Draw bar and beat rules behind the melody.
   *
   * Omit it and the view is exactly as it was: a shape, with no claim about
   * where the beat sits. Supplying a grid is what turns the piano roll into
   * something you can read rhythm off.
   */
  grid?: MelodyGrid;
  /**
   * Pixels per beat. Given, a beat is that wide wherever it falls and the
   * drawing runs past `width` for a caller to scroll (INV-NOTES-032).
   * Omitted, the whole take is fitted to `width`, which is what a thumbnail
   * wants (INV-NOTES-035).
   */
  beatWidth?: number;
  /** Other pitches sharing this axis, so the window makes room for them. */
  alsoShow?: readonly number[];
  /** Where the recording began, when earlier than the first sung note. */
  fromMs?: number;
  /** Where the recording ended, when later than the last note (INV-NOTES-108). */
  toMs?: number;
  /**
   * How many of the opening notes were somebody counting, not singing.
   *
   * A count is always the leading run (INV-PITCH-022), so a number is enough
   * and no note needs a flag of its own.
   */
  countedNotes?: number;
  /**
   * A second performance drawn behind the sung line — the bass hummed
   * against it. Its own colour, because it is a different voice and reading
   * the picture depends on telling them apart (INV-NOTES-079).
   */
  underlay?: readonly MelodyNote[];
  underlayColor?: string;
}

export function MelodyView({
  notes,
  width,
  height,
  color,
  grid,
  beatWidth,
  alsoShow,
  fromMs,
  toMs,
  countedNotes = 0,
  underlay,
  underlayColor
}: MelodyViewProps): React.JSX.Element {
  const { colors } = useTheme();
  const barColor = color ?? colors.primary500;

  const layout = useMemo(
    () =>
      layoutMelody(notes, {
        width,
        height,
        grid,
        beatWidth,
        alsoShow,
        fromMs,
        toMs
      }),
    [notes, width, height, grid, beatWidth, alsoShow, fromMs, toMs]
  );
  // Placed on the melody's OWN axes rather than laid out again: a second
  // layout would derive its own pitch window from its own notes, and the same
  // pitch would sit at two heights on one drawing. The caller passes the bass
  // pitches through `alsoShow` so the shared window already makes room.
  const under = useMemo(() => {
    if (!underlay?.length) {
      return [];
    }
    const barH = Math.max(2, layout.pitchAxis.lane * 0.7);
    return underlay.map((n) => {
      const cy = yForMidi(layout.pitchAxis, n.midi);
      return {
        x: xForMs(layout.timeAxis, n.startMs),
        y: cy - barH / 2,
        width: Math.max(2, (n.endMs - n.startMs) * layout.timeAxis.pxPerMs - 1),
        height: barH
      };
    });
  }, [underlay, layout]);
  // What was actually drawn — `width` when fitted, wider when it scrolls.
  const drawnWidth = layout.contentWidth;

  // The recorded-but-not-sung stretches, drawn as ground rather than as empty
  // graph (INV-NOTES-107). Both ends, in one path: the take runs on after the
  // last note whenever the recording did, and leaving that off made a take
  // look cut short (INV-NOTES-108). One path, since a long stretch at a close
  // zoom is a hundred diagonals and each drawn alone is a hundred nodes.
  const unsung = useMemo(() => {
    const axis = layout.timeAxis;
    const path = Skia.Path.Make();
    let any = false;
    if (axis.t0 < layout.firstNoteMs) {
      writePickupHatch(path, 0, xForMs(axis, layout.firstNoteMs), height);
      any = true;
    }
    const end = axis.t0 + axis.span;
    if (layout.lastNoteMs < end) {
      writePickupHatch(
        path,
        xForMs(axis, layout.lastNoteMs),
        xForMs(axis, end),
        height
      );
      any = true;
    }
    return any ? path : null;
  }, [layout.timeAxis, layout.firstNoteMs, layout.lastNoteMs, height]);

  const radius = Math.min(4, height / 16);

  return (
    <View style={[styles.wrap, { width: drawnWidth, height }]}>
      <Canvas style={{ width: drawnWidth, height }}>
        {/* Under everything: it is ground, not a mark on the graph. */}
        {unsung != null ? (
          <Path
            path={unsung}
            style="stroke"
            strokeWidth={StyleSheet.hairlineWidth}
            color={colors.gray300}
            opacity={0.14}
          />
        ) : null}
        {/* Rules first, so the melody always reads on top of its own grid.
            Dotted and very faint, because this is a metre the system applied
            rather than anything a person placed: solid rules read as content
            and outshone the downbeats, which are the lines that can actually
            be picked up and moved (INV-NOTES-102). */}
        {layout.gridLines.map((g, i) => (
          <Line
            key={`g${i}`}
            p1={vec(g.x, 0)}
            p2={vec(g.x, height)}
            strokeWidth={g.isBar ? 1 : StyleSheet.hairlineWidth}
            color={g.isBar ? colors.neutral500 : colors.neutral100}
            opacity={(g.isBar ? BAR_RULE : BEAT_RULE).opacity}
          >
            <DashPathEffect
              intervals={(g.isBar ? BAR_RULE : BEAT_RULE).intervals}
            />
          </Line>
        ))}
        {/* Where the singing starts, with the pickup before it. Its own
            colour and solid: it marks a boundary in the recording rather than
            a beat in the music (INV-NOTES-080), so it is content and reads
            above the rulings rather than among them (INV-NOTES-102). */}
        {layout.timeAxis.t0 < layout.firstNoteMs ? (
          <Line
            p1={vec(xForMs(layout.timeAxis, layout.firstNoteMs), 0)}
            p2={vec(xForMs(layout.timeAxis, layout.firstNoteMs), height)}
            strokeWidth={1}
            color={colors.gray300}
            opacity={BOUNDARY_OPACITY}
          />
        ) : null}
        {/* Behind the sung line: it is context for it, not a rival to it. */}
        {under.map((r, i) => (
          <RoundedRect
            key={`u${i}`}
            x={r.x}
            y={r.y}
            width={r.width}
            height={r.height}
            r={radius}
            color={underlayColor ?? barColor}
            opacity={0.55}
          />
        ))}
        {layout.rects.map((r, i) => {
          // The counted beats are a performance and belong on the graph, but
          // they are not the music: drawn as the ground they sit on rather
          // than as the line, so the tune reads as starting where it does
          // (INV-NOTES-113).
          const isCount = i < countedNotes;
          return (
            <RoundedRect
              key={i}
              x={r.x}
              y={r.y}
              width={r.width}
              height={r.height}
              r={radius}
              color={isCount ? colors.gray300 : barColor}
              opacity={isCount ? 0.45 : 1}
            />
          );
        })}
      </Canvas>
    </View>
  );
}

export default MelodyView;

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden' }
});
