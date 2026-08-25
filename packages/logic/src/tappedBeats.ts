/**
 * The beat, tapped in by the person who sang it.
 *
 * Everything else in the app infers where the beat is. The fitter deduces it
 * from onsets, which is genuinely hard; a sung count states it but only for
 * the bars somebody counted (INV-PITCH-022). Tapping along says it for the
 * whole take, continuously, by the one party who knows — and there is nothing
 * to detect, so there is nothing to get wrong (INV-NOTES-130).
 *
 * That makes it the top of the order. A tapped beat outranks a counted one,
 * which outranks a fitted one.
 *
 * A tapped beat can be moved, and remembers where the finger actually landed.
 * Tapping along is played rather than typed, so a beat can be a little late
 * without being wrong about which beat it is — and correcting one must not
 * destroy the evidence of what was performed (INV-NOTES-022).
 */

export interface TappedBeat {
  /** Where it sits now, after any correction. */
  atMs: number;
  /** Where the finger actually landed. Kept, so a move is reversible. */
  tappedAtMs: number;
  /** Marked as the start of a bar. */
  isDownbeat: boolean;
}

/** Two taps closer than this are one finger bouncing, not two beats. */
const DEBOUNCE_MS = 90;

/** Fewer than this and there is no tempo to read, only a moment. */
const MIN_FOR_TEMPO = 3;

export interface TappedTempo {
  bpm: number;
  /** 0..1 — how evenly it was tapped. */
  confidence: number;
  /** Where the first beat sits, which is the grid's phase. */
  offsetMs: number;
  /** Beats to a bar, where enough were marked to say. Null otherwise. */
  beatsPerBar: number | null;
}

/** A tap becomes a beat exactly where it landed. */
export function beatFromTap(atMs: number): TappedBeat {
  const at = Math.max(0, atMs);
  return { atMs: at, tappedAtMs: at, isDownbeat: false };
}

/**
 * Add a tap to what has been tapped, ignoring a bouncing finger.
 *
 * In time order, because a tap made after scrubbing backwards belongs where
 * it landed rather than at the end of the list.
 */
export function addTap(
  beats: readonly TappedBeat[],
  atMs: number
): TappedBeat[] {
  const beat = beatFromTap(atMs);
  if (beats.some((b) => Math.abs(b.atMs - beat.atMs) < DEBOUNCE_MS)) {
    return [...beats];
  }
  return [...beats, beat].sort((a, b) => a.atMs - b.atMs);
}

/** Move one beat, keeping the record of where it was actually tapped. */
export function moveBeat(
  beats: readonly TappedBeat[],
  index: number,
  toMs: number
): TappedBeat[] {
  return beats
    .map((beat, i) =>
      i === index ? { ...beat, atMs: Math.max(0, toMs) } : beat
    )
    .sort((a, b) => a.atMs - b.atMs);
}

/** Put one beat back where the finger landed. */
export function resetBeat(
  beats: readonly TappedBeat[],
  index: number
): TappedBeat[] {
  return beats
    .map((beat, i) => (i === index ? { ...beat, atMs: beat.tappedAtMs } : beat))
    .sort((a, b) => a.atMs - b.atMs);
}

/** Mark or unmark a beat as the start of a bar. */
export function markDownbeat(
  beats: readonly TappedBeat[],
  index: number,
  isDownbeat: boolean
): TappedBeat[] {
  return beats.map((beat, i) =>
    i === index ? { ...beat, isDownbeat } : beat
  );
}

const median = (values: readonly number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
};

/**
 * The tempo the tapping states.
 *
 * The median interval rather than the mean: tapping along is played, so a
 * single late tap is ordinary and should not drag the whole reading with it.
 *
 * Null below three beats. Two taps are an interval, not a tempo — nothing in
 * them says whether it would have happened again.
 */
export function tempoFromBeats(
  beats: readonly TappedBeat[]
): TappedTempo | null {
  if (beats.length < MIN_FOR_TEMPO) {
    return null;
  }
  const ordered = [...beats].sort((a, b) => a.atMs - b.atMs);
  const gaps: number[] = [];
  for (let i = 1; i < ordered.length; i++) {
    gaps.push(ordered[i].atMs - ordered[i - 1].atMs);
  }
  const beatMs = median(gaps);
  if (!(beatMs > 0)) {
    return null;
  }
  // How evenly it was tapped, as the average miss against the beat. A human
  // tapping along is never exact, so this is a reading of steadiness rather
  // than a test to pass.
  const drift =
    gaps.reduce((sum, gap) => sum + Math.abs(gap - beatMs), 0) /
    (gaps.length * beatMs);

  const marked = ordered.filter((beat) => beat.isDownbeat);
  return {
    bpm: 60000 / beatMs,
    confidence: Math.max(0, Math.min(1, 1 - drift * 2)),
    // Phase comes from the first marked bar where there is one, since that is
    // a statement about where a bar begins; otherwise from the first beat.
    offsetMs: (marked[0] ?? ordered[0]).atMs,
    beatsPerBar: barLengthOf(ordered)
  };
}

/**
 * How many beats to a bar, from the beats marked as bar starts.
 *
 * Null unless two bars were marked — one mark says where a bar begins and
 * nothing at all about how long one is.
 */
function barLengthOf(ordered: readonly TappedBeat[]): number | null {
  const at: number[] = [];
  ordered.forEach((beat, index) => {
    if (beat.isDownbeat) {
      at.push(index);
    }
  });
  if (at.length < 2) {
    return null;
  }
  const spans: number[] = [];
  for (let i = 1; i < at.length; i++) {
    spans.push(at[i] - at[i - 1]);
  }
  const bar = Math.round(median(spans));
  return bar > 0 ? bar : null;
}

/** The moments a bar begins, from the beats marked as bar starts. */
export function downbeatsFromBeats(beats: readonly TappedBeat[]): number[] {
  return [...beats]
    .sort((a, b) => a.atMs - b.atMs)
    .filter((beat) => beat.isDownbeat)
    .map((beat) => beat.atMs);
}
