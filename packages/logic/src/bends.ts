/**
 * bends — telling a change of note from a voice on its way to one.
 *
 * Segmentation reads frames in order and has to decide, as it goes, whether
 * the pitch moving means a new note. It cannot see what happens next, so a
 * scoop into a note and a release out of it both arrive looking like notes of
 * their own.
 *
 * Read afterwards, in company, they are obvious: a change of note is at least
 * a semitone, because that is what a different note is. Anything nearer than
 * that is the same note bending, and the evidence is entirely in how near it
 * sits to what surrounds it (INV-PITCH-020).
 */
import type { NoteEvent } from './segmentation';

/**
 * The shortest a deliberately sung note can be, in milliseconds.
 *
 * This is a fact about the instrument rather than about the music. Changing
 * pitch means changing the length and tension of the vocal folds, and that
 * takes time: the fastest trained melisma runs at roughly ten notes a second
 * and ordinary singing at half that. Nothing briefer than this was articulated
 * on purpose.
 *
 * It is worth saying why this number is trusted when the analysis windows
 * elsewhere are not. A window in milliseconds is a guess about tempo, and
 * tempo is the singer's to choose — which is why the chord reading counts
 * notes instead. This is a limit of the body, and the body does not speed up
 * because the song does.
 */
export const MIN_ARTICULATION_MS = 90;

export interface BendOptions {
  /**
   * The widest silence two notes may be separated by and still be one note
   * bending (default 40ms, matching the segmenter's own tolerance).
   */
  maxJoinGapMs?: number;
  /**
   * How far apart two notes must be to be different notes, in semitones
   * (default 1).
   *
   * A singer moving between scale degrees crosses at least a semitone.
   * Anything smaller is the voice travelling rather than arriving.
   */
  stepSemitones?: number;
}

/** A note's pitch including its deviation, which is what to compare. */
function pitchOf(note: NoteEvent): number {
  return note.midi + note.cents / 100;
}

/**
 * Fold one note into another, keeping the pitch of whichever was held longer.
 *
 * The held one is the note being sung; the other is the way in or the way
 * out. Taking the longer is what makes a scooped note read at the pitch it
 * settled on rather than somewhere between there and where it started.
 */
/** How loud the two together were, by how long each of them lasted. */
function weighDb(a: NoteEvent, b: NoteEvent): number | null {
  const parts = [a, b].filter((n) => n.loudnessDb != null);
  if (parts.length === 0) {
    return null;
  }
  const total = parts.reduce((sum, n) => sum + n.durationMs, 0);
  if (!(total > 0)) {
    return parts[0].loudnessDb;
  }
  return (
    parts.reduce((sum, n) => sum + (n.loudnessDb ?? 0) * n.durationMs, 0) /
    total
  );
}

function fold(a: NoteEvent, b: NoteEvent): NoteEvent {
  const held = a.durationMs >= b.durationMs ? a : b;
  const startMs = Math.min(a.startMs, b.startMs);
  const endMs = Math.max(a.endMs, b.endMs);
  const total = a.durationMs + b.durationMs;
  return {
    midi: held.midi,
    cents: held.cents,
    startMs,
    endMs,
    durationMs: endMs - startMs,
    clarity:
      total > 0
        ? (a.clarity * a.durationMs + b.clarity * b.durationMs) / total
        : held.clarity,
    // Weighted the same way, and only over the parts that had a reading: a
    // fragment nobody measured must not drag the note towards silence
    // (INV-PITCH-020).
    loudnessDb: weighDb(a, b)
  };
}

/**
 * Join notes that are really one note bending.
 *
 * Repeats until nothing is left within a semitone of its neighbour, so an
 * approach, a note and a release collapse to one rather than to two. Each
 * pass folds into whichever neighbour was held longer, so the sustained pitch
 * survives however many fragments surround it.
 */
export function mergeBends(
  notes: readonly NoteEvent[],
  options: BendOptions = {}
): NoteEvent[] {
  const step = options.stepSemitones ?? 1;
  // A bend is continuous: the voice slides from one pitch to the next without
  // stopping, so its parts touch. Two notes separated by real silence were
  // separated on purpose, and joining them across the gap is what turned "da
  // da da da" into one held note (INV-PITCH-023).
  const maxGap = options.maxJoinGapMs ?? 40;
  if (notes.length < 2) {
    return [...notes];
  }

  let current = [...notes];
  // Bounded by the input: every pass removes at least one note, or stops.
  for (let pass = 0; pass < notes.length; pass++) {
    let nearest = -1;
    let nearestGap = step;
    for (let i = 0; i + 1 < current.length; i++) {
      if (current[i + 1].startMs - current[i].endMs > maxGap) {
        continue;
      }
      const gap = Math.abs(pitchOf(current[i + 1]) - pitchOf(current[i]));
      // The closest pair first, so a fragment joins the note it actually
      // belongs to rather than whichever it happened to sit left of.
      if (gap < nearestGap) {
        nearestGap = gap;
        nearest = i;
      }
    }
    if (nearest === -1) {
      break;
    }
    current = [
      ...current.slice(0, nearest),
      fold(current[nearest], current[nearest + 1]),
      ...current.slice(nearest + 2)
    ];
  }
  return current;
}

/**
 * Drop anything too brief to have been sung on purpose.
 *
 * The limit is on how fast one note can FOLLOW another, not on how long a
 * note may sound. The body cannot re-articulate faster than about ten times a
 * second; it has no trouble at all making a short sound and then stopping.
 * Measuring the sounding duration conflated the two and threw away every
 * staccato note in the take (INV-PITCH-023).
 *
 * Run after merging, not before: a scoop is brief and belongs to its note, so
 * discarding short things first would throw away the approach rather than
 * joining it. What survives merging and is still this short was never a note
 * — a detector slip, an octave error, a click.
 *
 * A rejection, not a detector. It cannot say where a note begins; it can only
 * say that this one cannot have been meant.
 */
export function dropTooBriefToSing(
  notes: readonly NoteEvent[],
  minMs: number = MIN_ARTICULATION_MS
): NoteEvent[] {
  return notes.filter((note, i) => {
    if (note.durationMs >= minMs) {
      return true;
    }
    // Short, but is it short because it was played short? The spacing to its
    // neighbour says: a deliberate staccato leaves room around it, and a
    // detector slip is crowded up against whatever it slipped out of. The
    // last note of a run has only a note before it, and belongs to the run
    // just as much as the ones that do have a next.
    const next = notes[i + 1];
    const previous = notes[i - 1];
    const spacing =
      next != null
        ? next.startMs - note.startMs
        : previous != null
          ? note.startMs - previous.startMs
          : 0;
    return spacing >= minMs;
  });
}
