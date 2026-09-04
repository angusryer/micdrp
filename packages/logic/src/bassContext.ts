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

/**
 * The same performance, moved earlier by the round trip it was heard through.
 *
 * A voice sung against playback reaches the microphone after the output and
 * input paths have run, so every onset lands late by a fixed few tens of
 * milliseconds. Left alone, every downbeat the layer states is dragged late
 * with it, and the take reads worse with the layer than without one
 * (INV-NOTES-074).
 *
 * Nothing is moved before the start of the take: a note that would land at a
 * negative moment is clamped rather than dropped, because a bass note sung
 * fractionally early is still the chord it states.
 */
export function alignLayer(
  notes: readonly NoteEvent[],
  latencyMs: number
): NoteEvent[] {
  if (!(latencyMs > 0)) {
    return notes as NoteEvent[];
  }
  return notes.map((note) => {
    const startMs = Math.max(0, note.startMs - latencyMs);
    const endMs = Math.max(startMs, note.endMs - latencyMs);
    return { ...note, startMs, endMs, durationMs: endMs - startMs };
  });
}

/** A click in the count, as the player wants it. */
export interface CountBeat {
  midi: number;
  startMs: number;
  endMs: number;
}

/** How long a click sounds. Short enough to be a tick rather than a note. */
const CLICK_MS = 45;

/** The pitch of a click, and of the one that marks the beat you come in on. */
const CLICK_MIDI = 96;
const DOWNBEAT_MIDI = 103;

/** A count, and how long the take must wait for it to finish. */
export interface CountIn {
  clicks: CountBeat[];
  /**
   * How much silence to put before the take so the whole count fits.
   *
   * 0 when the take already has enough pickup to hold it. Otherwise the
   * take waits: a count that is cut short is worse than none, because the
   * singer comes in on a beat that was never established.
   */
  leadInMs: number;
}

/**
 * The beats before the singing starts, so a second voice knows when to come
 * in (INV-NOTES-088).
 *
 * Counted backwards from the first sung note at the take's own tempo. Where
 * the take has no room for the whole count — most takes, since most begin
 * near enough their first note — the take is delayed rather than the count
 * shortened. A count is only useful if it establishes the beat before the
 * beat you are counting to.
 *
 * The last click lands on the first note itself, which is the one that says
 * "here" rather than "soon".
 */
/**
 * A click through the whole take, counting you in on the way.
 *
 * The count was only ever the beats before the first note, which is what you
 * need to come in on time and nothing at all once you have. Keeping time
 * through a take is the same job continued, so it is the same clicks continued
 * — one voice, not two, and the count is simply its opening bars
 * (INV-NOTES-119).
 *
 * Accented on the downbeat, from the arrangement's own bar length, so the
 * click says where you are rather than only that time is passing.
 */
export function metronome(
  firstNoteMs: number,
  bpm: number,
  durationMs: number,
  beatsPerBar = 4,
  maxBeats = 4
): CountIn {
  const counted = countIn(firstNoteMs, bpm, maxBeats);
  if (!(bpm > 0) || !(durationMs > 0)) {
    return counted;
  }
  const beatMs = 60000 / bpm;
  const clicks = [...counted.clicks];
  // On from the beat the count landed on, to the end of the recording. The
  // count already sounded that one, so this starts after it.
  const from = firstNoteMs + counted.leadInMs;
  const end = durationMs + counted.leadInMs;
  let beat = 1;
  for (let at = from + beatMs; at < end; at += beatMs, beat += 1) {
    const isDownbeat = beatsPerBar > 0 && beat % beatsPerBar === 0;
    clicks.push({
      midi: isDownbeat ? DOWNBEAT_MIDI : CLICK_MIDI,
      startMs: at,
      endMs: at + CLICK_MS
    });
  }
  return { clicks, leadInMs: counted.leadInMs };
}

export function countIn(
  firstNoteMs: number,
  bpm: number,
  maxBeats = 4
): CountIn {
  if (!(bpm > 0) || !(maxBeats > 0)) {
    return { clicks: [], leadInMs: 0 };
  }
  const beatMs = 60000 / bpm;
  const wantedStart = firstNoteMs - maxBeats * beatMs;
  const leadInMs = Math.max(0, -wantedStart);

  const clicks: CountBeat[] = [];
  for (let i = maxBeats; i >= 1; i -= 1) {
    const startMs = firstNoteMs - i * beatMs + leadInMs;
    clicks.push({ midi: CLICK_MIDI, startMs, endMs: startMs + CLICK_MS });
  }
  clicks.push({
    midi: DOWNBEAT_MIDI,
    startMs: firstNoteMs + leadInMs,
    endMs: firstNoteMs + leadInMs + CLICK_MS
  });
  return { clicks, leadInMs };
}
