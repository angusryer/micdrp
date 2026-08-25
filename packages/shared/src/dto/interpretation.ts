/**
 * What a person made of a take, as it crosses the wire.
 *
 * A note holds several readings and one is active. The active one carries only
 * what someone overrode and is replayed against whatever analysis now infers;
 * a frozen one carries the whole reading, because its purpose is to survive
 * detection changing underneath it (INV-NOTES-023).
 */

export interface ChordSlotEditDto {
  /** A time inside the slot this applies to, in ms. */
  atMs: number;
  rootPc: number;
  quality: string;
}

/** A pitch someone corrected, anchored to a moment inside the note. */
export interface NoteEditDto {
  /**
   * A time inside the note, as the detector originally heard it — which is
   * what makes it findable after the note has been moved (INV-NOTES-096).
   */
  atMs: number;
  /** The pitch it should have been, when that is what changed. */
  midi?: number;
  /** When it should have begun and ended, when that is what changed. */
  startMs?: number;
  endMs?: number;
}

/** One tapped beat — mirrors `logic`'s `TappedBeat` field-for-field. */
export interface TappedBeatDto {
  atMs: number;
  /** Where the finger actually landed, so a correction is reversible. */
  tappedAtMs: number;
  isDownbeat: boolean;
}

export interface InterpretationDto {
  id: string;
  name: string;
  createdAtMs: number;
  /** True once kept aside from re-analysis; never replayed, never changed. */
  isFrozen: boolean;
  chords: ChordSlotEditDto[];
  /** Grid step indices where bars begin, when a person has arranged them. */
  barLines?: number[];
  /** Pitches a person corrected, where the detector heard wrongly. */
  notes?: NoteEditDto[];
  /**
   * The tempo a person set, where the one read from the take was wrong.
   *
   * An override rather than a correction to the reading: the detector's
   * estimate stays what it was, and this stands in front of it. Kept with the
   * edits because it is a decision about the take rather than a fact of it,
   * and it must survive the take being read again (INV-NOTES-123).
   */
  bpm?: number;
  /**
   * The beat, tapped in against the take.
   *
   * A statement about where the pulse is, from the person who sang it, so it
   * outranks every reading of the same thing (INV-NOTES-130). Kept with the
   * edits for the same reason the tempo is: it is a decision about the take
   * rather than a fact of it, and it must survive a re-read.
   */
  beats?: TappedBeatDto[];
}

const QUALITIES = [
  'maj', 'min', 'dim', 'aug', 'maj7', 'dom7', 'min7', 'm7b5', 'dim7'
];

function isChordEdit(value: unknown): value is ChordSlotEditDto {
  const v = value as ChordSlotEditDto | null;
  return (
    v != null &&
    typeof v.atMs === 'number' &&
    Number.isFinite(v.atMs) &&
    typeof v.rootPc === 'number' &&
    v.rootPc >= 0 &&
    v.rootPc <= 11 &&
    typeof v.quality === 'string' &&
    QUALITIES.includes(v.quality)
  );
}

function isNoteEdit(value: unknown): value is NoteEditDto {
  const v = value as NoteEditDto | null;
  return (
    v != null &&
    typeof v.atMs === 'number' &&
    Number.isFinite(v.atMs) &&
    typeof v.midi === 'number' &&
    Number.isInteger(v.midi) &&
    v.midi >= 0 &&
    v.midi <= 127
  );
}

/**
 * Read stored readings, discarding anything malformed.
 *
 * A reading that cannot be parsed is dropped rather than allowed to break the
 * screen: someone's note opening at all matters more than one bad record, and
 * the alternative is a take nobody can look at (INV-NOTES-022).
 */
export function parseInterpretations(raw: unknown): InterpretationDto[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const out: InterpretationDto[] = [];
  for (const entry of raw) {
    const v = entry as InterpretationDto | null;
    if (v == null || typeof v.id !== 'string' || typeof v.name !== 'string') {
      continue;
    }
    out.push({
      id: v.id,
      name: v.name,
      createdAtMs: typeof v.createdAtMs === 'number' ? v.createdAtMs : 0,
      isFrozen: v.isFrozen === true,
      chords: Array.isArray(v.chords) ? v.chords.filter(isChordEdit) : [],
      ...(Array.isArray(v.barLines)
        ? { barLines: v.barLines.filter((n) => Number.isInteger(n) && n >= 0) }
        : {}),
      ...(Array.isArray(v.notes) ? { notes: v.notes.filter(isNoteEdit) } : {})
    });
  }
  return out;
}

/** The reading currently being edited, or null when a note has none. */
export function activeInterpretation(
  all: readonly InterpretationDto[]
): InterpretationDto | null {
  return all.find((i) => !i.isFrozen) ?? null;
}
