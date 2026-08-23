/**
 * A second take, sung against the first, as evidence about the harmony.
 *
 * A monophonic melody only *implies* a chord — which is why naming one from
 * three sung pitch classes is a guess dressed as a reading. The thing the
 * system cannot know is what the singer heard underneath the tune, and the
 * singer can simply sing it. A root is the most decisive part of that.
 *
 * Two readings come out of one layer, and they answer the two weakest
 * inferences in the pipeline:
 *   - which chord (INV-NOTES-071) — the bass names the root;
 *   - and when it changes (INV-NOTES-072) — the chord lasts until the bass
 *     moves.
 *
 * Octave is discarded on purpose. Harmony is carried by pitch class, so the
 * layer can be hummed in whatever range is comfortable rather than sung down
 * where a voice is weak and the detector is least reliable.
 *
 * Pure, dependency-free.
 */
import type { NoteEvent } from './segmentation';

/** One stretch over which the layer holds a single pitch class. */
export interface BassSpan {
  startMs: number;
  endMs: number;
  /** 0..11. What the chord over this stretch is most likely rooted on. */
  pitchClass: number;
}

const pitchClassOf = (midi: number): number =>
  (((Math.round(midi) % 12) + 12) % 12);

/**
 * The layer as stretches of one pitch class each.
 *
 * Repeats of the same pitch class join into one stretch: a bass repeating the
 * root through a bar is one chord, not four, and treating each restatement as
 * a change would put a downbeat on every note of it.
 */
export function bassSpans(bass: readonly NoteEvent[]): BassSpan[] {
  const ordered = [...bass].sort((a, b) => a.startMs - b.startMs);
  const spans: BassSpan[] = [];
  for (const note of ordered) {
    const pitchClass = pitchClassOf(note.midi);
    const open = spans[spans.length - 1];
    if (open && open.pitchClass === pitchClass) {
      open.endMs = Math.max(open.endMs, note.endMs);
      continue;
    }
    spans.push({ startMs: note.startMs, endMs: note.endMs, pitchClass });
  }
  return spans;
}

/**
 * What the layer is rooted on across a span of the take, or null.
 *
 * Whichever pitch class the layer holds for longest inside the span, so a
 * chord read across a bass change still gets the one that dominates rather
 * than whichever happened to start first. Null where the layer is silent —
 * which must leave the reading exactly as it was without a layer at all
 * (INV-NOTES-071).
 */
export function bassPitchClassOver(
  spans: readonly BassSpan[],
  startMs: number,
  endMs: number
): number | null {
  const held = new Map<number, number>();
  for (const span of spans) {
    const overlap = Math.min(span.endMs, endMs) - Math.max(span.startMs, startMs);
    if (overlap > 0) {
      held.set(span.pitchClass, (held.get(span.pitchClass) ?? 0) + overlap);
    }
  }
  let best: number | null = null;
  let longest = 0;
  held.forEach((ms, pitchClass) => {
    if (ms > longest) {
      longest = ms;
      best = pitchClass;
    }
  });
  return best;
}

/**
 * The moments the harmony turns over, stated rather than inferred.
 *
 * Every stretch begins a chord, the first one included: a layer that holds
 * one note throughout is one chord from its first note, not none at all.
 */
export function bassChangeTimes(spans: readonly BassSpan[]): number[] {
  return spans.map((span) => span.startMs);
}
