/**
 * SelectionGlow — the chosen thing, lit from behind.
 *
 * Choosing used to be legible only from the controls appearing below the
 * graph, which is a long way from the thing being pointed at and says which
 * kind of thing was chosen rather than which one; a sung note gave no sign at
 * all (INV-NOTES-057).
 *
 * The halo is a blurred *stroke*, not a blurred fill. A fill large enough to
 * read as backlighting would sit over the small thing it is lighting and grey
 * it out — and for a chord note the colour is not decoration, it says which
 * part of the chord the note is playing and has to survive being chosen
 * (INV-NOTES-052). A stroke leaves the middle untouched, so the object keeps
 * its own colour and only its edges bloom.
 *
 * Two passes: a wide faint one for the spill and a tight bright one for the
 * edge. One pass alone reads as either a fog or an outline, never as light.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { BlurMask, Canvas, Line, RoundedRect, vec } from '@shopify/react-native-skia';

import { chordRoleColour } from './chordRoles';
import type { ChordToneRect } from './chordLayout';
import type { NoteRect } from './melodyLayout';
import type { BarHandlePoint, Chosen, Selection } from './graphSelection';

/** The spill, and the edge. */
const OUTER = { blur: 9, stroke: 7, opacity: 0.32 };
const INNER = { blur: 3, stroke: 2.5, opacity: 0.85 };
/** A third pass, wide and bright, for the one being pointed at. */
const FLASH = { blur: 14, stroke: 10, opacity: 0.55 };

export interface SelectionGlowProps {
  selection: Chosen;
  /** Lit brighter for a moment, to answer "which one is that row?". */
  flashing?: Selection | null;
  tones: readonly ChordToneRect[];
  bars: readonly BarHandlePoint[];
  notes: readonly NoteRect[];
  width: number;
  height: number;
  /** What a sung note or a bar line glows in, the chords having their own. */
  colour: string;
}

export function SelectionGlow({
  selection,
  flashing,
  tones,
  bars,
  notes,
  width,
  height,
  colour
}: SelectionGlowProps): React.JSX.Element | null {
  const lit = selection
    .map((one) => litShape(one, tones, bars, notes, colour))
    .filter((shape): shape is Lit => shape != null);
  // The flash rides on top of the rest, so a row pressed in the sheet is
  // findable among four things that are all already lit (INV-NOTES-094).
  const flashed = flashing
    ? litShape(flashing, tones, bars, notes, colour)
    : null;
  if (lit.length === 0 && !flashed) {
    return null;
  }

  return (
    <View style={[styles.fill, { width, height }]} pointerEvents="none">
      <Canvas style={{ width, height }}>
        {[...lit, ...(flashed ? [flashed] : [])].flatMap((shape, n) =>
          [OUTER, INNER, ...(flashed === shape ? [FLASH] : [])].map((pass, i) =>
          shape.kind === 'line' ? (
            <Line
              key={`${n}-${i}`}
              p1={vec(shape.x, 0)}
              p2={vec(shape.x, height)}
              // A line has no inside to protect, so the passes widen instead
              // of stroking: the spill either side is the whole effect.
              strokeWidth={pass.stroke * 1.6}
              color={shape.colour}
              opacity={pass.opacity}
            >
              <BlurMask blur={pass.blur} style="normal" />
            </Line>
          ) : (
            <RoundedRect
              key={`${n}-${i}`}
              x={shape.x}
              y={shape.y}
              width={shape.width}
              height={shape.height}
              r={3}
              style="stroke"
              strokeWidth={pass.stroke}
              color={shape.colour}
              opacity={pass.opacity}
            >
              <BlurMask blur={pass.blur} style="normal" />
            </RoundedRect>
          )
          )
        )}
      </Canvas>
    </View>
  );
}

type Lit =
  | { kind: 'line'; x: number; colour: string }
  | {
      kind: 'rect';
      x: number;
      y: number;
      width: number;
      height: number;
      colour: string;
    };

/** Where the light goes, and what colour it is. */
export function litShape(
  selection: Selection | null,
  tones: readonly ChordToneRect[],
  bars: readonly BarHandlePoint[],
  notes: readonly NoteRect[],
  colour: string
): Lit | null {
  if (!selection) {
    return null;
  }
  if (selection.kind === 'barLine') {
    const bar = bars.find((b) => b.lineIndex === selection.lineIndex);
    return bar ? { kind: 'line', x: bar.x, colour } : null;
  }
  if (selection.kind === 'melodyNote') {
    const rect = notes[selection.index];
    return rect
      ? { kind: 'rect', ...rectOf(rect), colour }
      : null;
  }
  const tone = tones.find(
    (r) => r.slot === selection.slot && r.tone === selection.tone
  );
  // Its own role colour, so being chosen never hides what part it plays.
  return tone
    ? { kind: 'rect', ...rectOf(tone), colour: chordRoleColour(tone.tone) }
    : null;
}

/** Just wide enough that the light sits outside the thing, not on it. */
function rectOf(r: { x: number; y: number; width: number; height: number }) {
  const pad = 2;
  return {
    x: r.x - pad,
    y: r.y - pad,
    width: r.width + pad * 2,
    height: r.height + pad * 2
  };
}

export default SelectionGlow;

const styles = StyleSheet.create({
  fill: StyleSheet.absoluteFill
});
