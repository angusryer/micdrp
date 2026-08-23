/**
 * An editable harmonic backdrop for a sung line.
 *
 * `impliedHarmony` answers "what chord does this stretch of melody imply?" over
 * fixed-length windows. That is the right question for corpus statistics and
 * the wrong one for someone shaping an idea: a 2000ms window cuts across bar
 * lines, so the chords it returns cannot be placed on a chart, played back as
 * a progression, or edited as musical objects.
 *
 * This module puts chords ON THE GRID — one slot per bar, or per half bar —
 * and makes them editable. Each slot carries the inferred chord, whether it
 * was inferred or chosen by hand, and how strongly the melody supported it.
 *
 * The editing operations are all pure functions returning new slots, which is
 * what makes undo, comparison and "try it and hear it" cheap for a caller.
 *
 * The important choice here is that dragging a chord moves it DIATONICALLY by
 * default. Chromatic motion is available, but a singer exploring a backdrop
 * for their own melody almost always wants the next chord in the key, not the
 * one a semitone up; offering twelve steps where seven are wanted turns a
 * one-gesture change into a fiddly one.
 *
 * Pure, dependency-free, ES5-safe Math only.
 */

import type { ChordQuality, Melody } from './analysis';
import { bassPitchClassOver, bassSpans } from './bassContext';
import type { NoteEvent } from './segmentation';
import { chordForSpan } from './chordMatch';
import { rootMidiAtOrAbove, voicedTones, type ChordVoicing } from './voicing';
import { relabel, type ChordSlot } from './chordSlot';

export * from './chordSlot';
export * from './chordEdits';
import { detectKey, type KeyEstimate } from './key';
import type { MusicalGrid } from './quantize';

export interface HarmonizeOptions {
  /** Chords per bar (default 1). Two gives a chord on each half bar. */
  chordsPerBar?: number;
  /** Chord set to infer from (default 'triads'). */
  vocabulary?: 'triads' | 'sevenths';
  /** Precomputed key; detected from the melody when omitted. */
  key?: KeyEstimate;
  /**
   * Where the slots actually start, as grid steps — the downbeats a person
   * placed. Given, these are the slots: arbitrary in number and in length.
   * Omitted, the grid's own even division is used, which is the opening
   * proposal rather than a claim about the music.
   */
  downbeatSteps?: readonly number[];
  /**
   * A layer sung against the take, naming the root under each span.
   *
   * The one thing a melody cannot state about its own harmony, so where it
   * exists it is the strongest evidence there is — weighted, not obeyed
   * (INV-NOTES-071).
   */
  bass?: readonly NoteEvent[];
}

export function harmonizeToGrid(
  notes: Melody,
  grid: MusicalGrid,
  options: HarmonizeOptions = {}
): ChordSlot[] {
  if (notes.length === 0 || grid.bpm <= 0) {
    return [];
  }
  const key = options.key ?? detectKey(notes);

  let endOfMelody = 0;
  let startOfMelody = Infinity;
  for (const n of notes) {
    if (n.endMs > endOfMelody) {
      endOfMelody = n.endMs;
    }
    if (n.startMs < startOfMelody) {
      startOfMelody = n.startMs;
    }
  }

  const spans = options.downbeatSteps?.length
    ? spansFromDownbeats(options.downbeatSteps, grid, endOfMelody)
    : evenSpans(grid, options.chordsPerBar ?? 1, startOfMelody, endOfMelody);

  // Read once for the whole take rather than per span: the layer does not
  // change, and re-deriving it inside the loop would be the same answer
  // computed as many times as there are chords.
  const bass = options.bass?.length ? bassSpans(options.bass) : null;

  const slots: ChordSlot[] = [];
  for (const span of spans) {
    // Matched over exactly the span it covers, rather than against a sweep of
    // fixed windows that a person's own downbeats would cut across.
    const match = chordForSpan(notes, span.startMs, span.endMs, {
      vocabulary: options.vocabulary ?? 'triads',
      bassPc: bass
        ? bassPitchClassOver(bass, span.startMs, span.endMs)
        : null
    });
    if (!match) {
      continue;
    }
    slots.push(
      relabel(
        {
          bar: slots.length + 1,
          startMs: Math.round(span.startMs),
          endMs: Math.round(span.endMs),
          rootPc: match.rootPc,
          quality: match.quality,
          label: '',
          roman: '',
          confidence: match.confidence,
          isEdited: false
        },
        key
      )
    );
  }
  return slots;
}

/** One chord slot's span, in ms. */
interface Span {
  startMs: number;
  endMs: number;
}

/**
 * Slots from the downbeats a person placed: each one runs to the next, and
 * the last runs to the end of what was sung.
 *
 * This is the arrangement being the thing rather than a decoration over an
 * even division — a downbeat is where a new chord may start, so the number
 * of them and the distance between them are both the singer's to choose
 * (INV-NOTES-048).
 */
function spansFromDownbeats(
  steps: readonly number[],
  grid: MusicalGrid,
  endOfMelody: number
): Span[] {
  const beatMs = 60000 / grid.bpm;
  const stepsPerBeat = grid.stepsPerBeat > 0 ? grid.stepsPerBeat : 4;
  const stepMs = beatMs / stepsPerBeat;
  const starts = Array.from(new Set(steps))
    .sort((a, b) => a - b)
    .map((step) => grid.offsetMs + step * stepMs);

  const spans: Span[] = [];
  for (let i = 0; i < starts.length; i++) {
    const startMs = starts[i];
    const endMs = i + 1 < starts.length ? starts[i + 1] : endOfMelody;
    // A downbeat past the end of the take opens nothing.
    if (endMs > startMs && startMs < endOfMelody) {
      spans.push({ startMs, endMs: Math.min(endMs, endOfMelody) });
    }
  }
  return spans;
}

/** The even division a grid proposes, when nobody has placed anything. */
function evenSpans(
  grid: MusicalGrid,
  chordsPerBar: number,
  startOfMelody: number,
  endOfMelody: number
): Span[] {
  const beatMs = 60000 / grid.bpm;
  const perBar = Math.max(1, Math.round(chordsPerBar));
  const slotMs = (beatMs * grid.beatsPerBar) / perBar;
  const first = Math.floor((startOfMelody - grid.offsetMs) / slotMs);
  const last = Math.ceil((endOfMelody - grid.offsetMs) / slotMs) - 1;

  const spans: Span[] = [];
  for (let i = first; i <= last; i++) {
    const startMs = grid.offsetMs + i * slotMs;
    spans.push({ startMs, endMs: startMs + slotMs });
  }
  return spans;
}

// ── Voicing ────────────────────────────────────────────────────────────────

/** Where a chord should sound, as a MIDI note range. */
export interface VoicingOptions {
  /**
   * Lowest MIDI note the voicing may use (default 48, the C below middle C).
   * A backdrop under a sung line wants to sit below it without booming.
   */
  bottomMidi?: number;
  /** 0 for root position, 1 for first inversion, and so on. */
  inversion?: number;
  /**
   * Per-note offsets and silences. Silenced notes are left out of what
   * sounds while staying in the slot, so they can be brought back
   * (INV-NOTES-037).
   */
  voicing?: ChordVoicing;
}

/**
 * Turn a chord into MIDI notes to play.
 *
 * Voiced upward from `bottomMidi` so successive chords stay in one register
 * instead of leaping an octave whenever the root crosses B to C.
 */
export function voiceChord(
  rootPc: number,
  quality: ChordQuality,
  options: VoicingOptions = {}
): number[] {
  const bottom = options.bottomMidi ?? 48;
  const inversion = Math.max(0, Math.round(options.inversion ?? 0));

  // Absolute pitches in root position, starting at or above `bottom`.
  const rootMidi = rootMidiAtOrAbove(rootPc, bottom);
  const notes: number[] = [];
  for (const tone of voicedTones(rootMidi, quality, options.voicing)) {
    if (!tone.muted) {
      notes.push(tone.midi);
    }
  }
  if (notes.length === 0) {
    // Every note silenced: the slot is still there, it just says nothing.
    return notes;
  }

  // Sorted before inverting, because an offset can put a tone below the one
  // under it and "lift the lowest" has to mean the lowest that is sounding.
  notes.sort(function (a, b) {
    return a - b;
  });
  for (let i = 0; i < inversion % notes.length; i++) {
    notes[i] += 12;
  }
  notes.sort(function (a, b) {
    return a - b;
  });
  return notes;
}

/** A progression as playable events, one per slot. */
export interface ChordPlayback {
  midi: number[];
  startMs: number;
  endMs: number;
}

/** Voice a whole progression for playback under the melody. */
export function voiceProgression(
  slots: readonly ChordSlot[],
  options: VoicingOptions = {}
): ChordPlayback[] {
  return slots.map(function (slot) {
    return {
      midi: voiceChord(slot.rootPc, slot.quality, {
        ...options,
        voicing: slot.voicing
      }),
      startMs: slot.startMs,
      endMs: slot.endMs
    };
  });
}
