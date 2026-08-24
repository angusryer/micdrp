/**
 * Turn a stream of per-frame pitch analyses into discrete sung notes.
 *
 * Pure and dependency-free. The input {@link PitchFrame} is structurally
 * compatible with the native-boundary `PitchSample` (audio `contract.ts`), so a
 * `PitchSample[]` can be passed directly without importing across packages.
 */

export interface PitchFrame {
  timestampMs: number;
  midi: number | null;
  cents: number | null;
  clarity: number;
  /**
   * How loud this frame was, in dBFS. Absent when the engine did not report
   * one — an older binary running a newer bundle.
   */
  levelDb?: number;
}

export interface NoteEvent {
  midi: number;
  startMs: number;
  endMs: number;
  durationMs: number;
  /** Mean cents deviation across the note. */
  cents: number;
  /** Mean clarity across the note, in [0, 1]. */
  clarity: number;
  /**
   * How loud the note was, in dBFS, or null when nothing measured it.
   *
   * Null rather than a floor value, because "nobody looked" and "it was
   * silent" are different claims and only one of them is about the singing.
   * Anything comparing notes has to be able to tell them apart
   * (INV-PITCH-020).
   */
  loudnessDb: number | null;
}

export interface SegmentOptions {
  /** Discard notes shorter than this many ms (default 60). */
  minDurationMs?: number;
  /** Tolerate unvoiced/changed gaps up to this many ms within a note (default 40). */
  maxGapMs?: number;
  /**
   * How far the pitch may wander from a note's centre and still be that note,
   * in semitones (default 0.6).
   *
   * This is the vibrato width. A wide, operatic vibrato needs more; a
   * deliberately flat delivery wants less, so that real steps are not
   * swallowed. Adjustable because voices differ more than any one default
   * can cover (INV-PITCH-015).
   */
  vibratoSemitones?: number;
  /**
   * How long a departure must last to count as a new note (default 90ms).
   *
   * A pitch that moves and stays moved is a new note; one that moves and
   * comes back is the same note wobbling. What tells them apart is how long
   * it stayed, not which semitone it touched.
   */
  pitchHoldMs?: number;
  /**
   * How far the level must fall during a gap for it to be an articulation
   * rather than the detector flickering (default 12dB).
   *
   * A note is split on a change of pitch, which says nothing about "da da da"
   * on one pitch — that articulation lives entirely in the envelope. A stop
   * consonant collapses the level by tens of dB; a detector losing confidence
   * for a frame does not move it at all, and that difference is what makes
   * splitting here safe (INV-PITCH-023).
   */
  articulationDropDb?: number;
}

/**
 * How much of a note to hear before fixing where its centre is.
 *
 * About one cycle of the slowest vibrato a voice produces, so the anchor is
 * taken over a whole oscillation rather than part of one.
 */
const ANCHOR_MS = 200;

const mean = (values: readonly number[]): number =>
  values.reduce((a, b) => a + b, 0) / values.length;

/** The middle value, which a scoop into a note does not drag. */
function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

export function segmentNotes(
  frames: PitchFrame[],
  options: SegmentOptions = {}
): NoteEvent[] {
  const minDuration = options.minDurationMs ?? 60;
  const maxGap = options.maxGapMs ?? 40;
  const vibrato = options.vibratoSemitones ?? 0.6;
  const hold = options.pitchHoldMs ?? 90;
  const articulationDrop = options.articulationDropDb ?? 12;

  const notes: NoteEvent[] = [];

  /** Fractional MIDI of every frame in the note being built. */
  let pitches: number[] = [];
  let clarities: number[] = [];
  let levels: number[] = [];
  let centre: number | null = null;
  let startMs = 0;
  let lastVoicedMs = 0;

  /** A departure that has not yet lasted long enough to be a new note. */
  let awayFrom: number | null = null;
  let awaySince = 0;
  /** Whether the centre has settled, so the window stops moving. */
  let anchored = false;

  function close(): void {
    if (centre == null || pitches.length === 0) {
      centre = null;
      pitches = [];
      clarities = [];
      levels = [];
      awayFrom = null;
      return;
    }
    const durationMs = lastVoicedMs - startMs;
    if (durationMs >= minDuration) {
      // The middle of what was sung, not the average of it: singers slide
      // into notes and vibrato is rarely symmetrical (INV-PITCH-016).
      const core = median(pitches);
      const midi = Math.round(core);
      notes.push({
        midi,
        startMs,
        endMs: lastVoicedMs,
        durationMs,
        cents: Math.round((core - midi) * 100),
        clarity: clarities.reduce((a, b) => a + b, 0) / clarities.length,
        // In dB, so the average is a ratio rather than a sum of pressures —
        // which is what makes one note's loudness subtractable from another's
        // (INV-PITCH-020). Null when no frame carried one.
        loudnessDb:
          levels.length > 0
            ? levels.reduce((a, b) => a + b, 0) / levels.length
            : null
      });
    }
    centre = null;
    pitches = [];
    clarities = [];
    levels = [];
    awayFrom = null;
    anchored = false;
  }

  function begin(frame: PitchFrame, pitch: number, atMs: number): void {
    centre = pitch;
    startMs = atMs;
    lastVoicedMs = atMs;
    pitches = [pitch];
    clarities = [frame.clarity];
    levels = frame.levelDb != null ? [frame.levelDb] : [];
    awayFrom = null;
    anchored = false;
  }

  for (const f of frames) {
    if (f.midi == null) {
      // A gap of two kinds. One is the detector losing confidence while the
      // singing continues, which `maxGap` exists to ride out. The other is
      // the singer stopping — a tongued consonant, a breath — and that is a
      // note ending however brief it is. The level tells them apart: silence
      // collapses it, a flicker does not (INV-PITCH-023).
      const quiet =
        centre != null &&
        f.levelDb != null &&
        levels.length > 0 &&
        mean(levels) - f.levelDb >= articulationDrop;
      if (centre != null && (quiet || f.timestampMs - lastVoicedMs > maxGap)) {
        close();
      }
      continue;
    }

    const pitch = f.midi + (f.cents ?? 0) / 100;

    if (centre == null) {
      begin(f, pitch, f.timestampMs);
      continue;
    }

    // While the note is still arriving the window is generous: a singer
    // sliding in covers ground, and clipping those frames would bias the
    // anchor that is about to be taken from them.
    const window = anchored ? vibrato : vibrato * 2;
    if (Math.abs(pitch - centre) <= window) {
      // Still this note, wobble and all.
      pitches.push(pitch);
      clarities.push(f.clarity);
      if (f.levelDb != null) {
        levels.push(f.levelDb);
      }
      lastVoicedMs = f.timestampMs;
      // The centre follows while the note is still arriving — singers slide
      // in, and the first frame is a poor guess at where they are heading —
      // and then stops. A centre that keeps following chases the wobble, and
      // a window moving with the oscillation clips one side of it, biasing
      // the very median it exists to protect.
      if (!anchored && f.timestampMs - startMs >= ANCHOR_MS) {
        // Taken once, over a whole window rather than frame by frame: a
        // centre that keeps following chases the wobble, and a window moving
        // with the oscillation clips one side of it, biasing the very median
        // it exists to protect.
        centre = median(pitches);
        anchored = true;
      }
      awayFrom = null;
      continue;
    }

    // Away from the centre. Whether that is a new note depends on how long
    // it stays there, not on which semitone it touched.
    if (awayFrom == null || Math.abs(pitch - awayFrom) > vibrato) {
      awayFrom = pitch;
      awaySince = f.timestampMs;
    }

    if (f.timestampMs - awaySince >= hold) {
      const from = awaySince;
      close();
      begin(f, pitch, from);
      lastVoicedMs = f.timestampMs;
    }
  }

  close();
  return notes;
}
