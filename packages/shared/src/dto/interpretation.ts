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
  /**
   * Which beats of the bar those taps were meant for (INV-NOTES-209).
   *
   * While you are singing you do not yet know whether you will tap every
   * beat or only the backbeat, so the tap means nothing and the meaning is
   * supplied afterwards. A sentence the singer says about their own take,
   * which is why it lives with the edits and not with the reading — and why
   * absent means nobody has said, so the grid stays exactly as it was
   * (INV-NOTES-161).
   */
  tapPattern?: { beats: number[]; beatsPerBar: number };
  /**
   * That somebody asked for the harmony, and what read it (INV-NOTES-171).
   *
   * Absent means nobody has asked, and a note nobody has asked shows no
   * chords. The chords used to appear on their own, built on a tempo nobody
   * had confirmed and a metre nobody had stated — the app asserting the
   * harmony of somebody's idea before they had said what the beat was.
   *
   * The version is kept so a reading made by an older engine can be found and
   * offered again (INV-NOTES-116).
   */
  harmony?: { askedAtMs: number; analysisVersion: number };
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
/** A tap that says where it was and whether it starts a bar. */
function isTappedBeat(raw: unknown): raw is TappedBeatDto {
  const v = raw as TappedBeatDto | null;
  return (
    v != null &&
    typeof v.atMs === 'number' &&
    typeof v.tappedAtMs === 'number' &&
    typeof v.isDownbeat === 'boolean'
  );
}

/** Which beats of the bar the taps were meant for (INV-NOTES-209). */
function isTapPattern(
  raw: unknown
): raw is { beats: number[]; beatsPerBar: number } {
  const v = raw as { beats?: unknown; beatsPerBar?: unknown } | null;
  return (
    v != null &&
    Array.isArray(v.beats) &&
    v.beats.length > 0 &&
    v.beats.every((b) => Number.isInteger(b) && (b as number) >= 1) &&
    typeof v.beatsPerBar === 'number' &&
    Number.isInteger(v.beatsPerBar) &&
    v.beatsPerBar > 0
  );
}

/** That somebody asked for the harmony, and what read it. */
function isHarmonyAsk(
  raw: unknown
): raw is { askedAtMs: number; analysisVersion: number } {
  const v = raw as { askedAtMs?: unknown; analysisVersion?: unknown } | null;
  return (
    v != null &&
    typeof v.askedAtMs === 'number' &&
    typeof v.analysisVersion === 'number'
  );
}

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
      ...(Array.isArray(v.notes) ? { notes: v.notes.filter(isNoteEdit) } : {}),
      // Everything below is a decision a person made about their own take,
      // and every one of them was being dropped here. The parser listed
      // the fields it carried, so each one added since was silently left
      // behind: the tempo somebody set, the beat they tapped in, what
      // those taps were for, and that they had asked for the harmony at
      // all. A person tapping a beat that does not survive being read back
      // is the app forgetting what it was told (INV-NOTES-130).
      ...(typeof v.bpm === 'number' && v.bpm > 0 ? { bpm: v.bpm } : {}),
      ...(Array.isArray(v.beats) ? { beats: v.beats.filter(isTappedBeat) } : {}),
      ...(isTapPattern(v.tapPattern) ? { tapPattern: v.tapPattern } : {}),
      ...(isHarmonyAsk(v.harmony) ? { harmony: v.harmony } : {})
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
