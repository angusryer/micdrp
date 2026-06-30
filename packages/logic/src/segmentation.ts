/**
 * Turn a stream of per-frame pitch analyses into discrete sung notes.
 *
 * Pure and dependency-free. The input is structurally compatible with
 * `models.PitchSample` (so a `PitchSample[]` can be passed directly) without
 * importing across packages.
 */

export interface PitchFrame {
  timestampMs: number;
  midi: number | null;
  cents: number | null;
  clarity: number;
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
}

export interface SegmentOptions {
  /** Discard notes shorter than this many ms (default 60). */
  minDurationMs?: number;
  /** Tolerate unvoiced/changed gaps up to this many ms within a note (default 40). */
  maxGapMs?: number;
}

export function segmentNotes(
  frames: PitchFrame[],
  options: SegmentOptions = {}
): NoteEvent[] {
  const minDuration = options.minDurationMs ?? 60;
  const maxGap = options.maxGapMs ?? 40;

  const notes: NoteEvent[] = [];

  let curMidi: number | null = null;
  let startMs = 0;
  let lastVoicedMs = 0;
  let centsSum = 0;
  let claritySum = 0;
  let count = 0;

  function close(): void {
    if (curMidi == null) {
      return;
    }
    const durationMs = lastVoicedMs - startMs;
    if (durationMs >= minDuration && count > 0) {
      notes.push({
        midi: curMidi,
        startMs,
        endMs: lastVoicedMs,
        durationMs,
        cents: Math.round(centsSum / count),
        clarity: claritySum / count
      });
    }
    curMidi = null;
    centsSum = 0;
    claritySum = 0;
    count = 0;
  }

  for (const f of frames) {
    if (f.midi == null) {
      // Unvoiced frame: end the current note only if the gap is too long.
      if (curMidi != null && f.timestampMs - lastVoicedMs > maxGap) {
        close();
      }
      continue;
    }

    if (curMidi == null) {
      curMidi = f.midi;
      startMs = f.timestampMs;
    } else if (f.midi !== curMidi) {
      close();
      curMidi = f.midi;
      startMs = f.timestampMs;
    }

    lastVoicedMs = f.timestampMs;
    centsSum += f.cents ?? 0;
    claritySum += f.clarity;
    count++;
  }

  close();
  return notes;
}
