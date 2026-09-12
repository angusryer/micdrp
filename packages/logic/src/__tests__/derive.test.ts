/**
 * The four layers and the one function between them — INV-NOTES-255..260.
 *
 * The re-analysis test is the point of the whole module: derive a take from
 * one reading, then from a later reading of the same performance with the
 * same statements, and every statement is still in force. Everything else
 * here is the boundary — that a layer cannot be moved by anything above it.
 */
import {
  derive,
  deriveTranscription,
  transcriptionSlice,
  type Statements
} from '../derive';
import type { NoteEvent } from '../segmentation';

const sung = (startMs: number, endMs: number, midi: number): NoteEvent => ({
  midi,
  startMs,
  endMs,
  durationMs: endMs - startMs,
  cents: 0,
  clarity: 0.9,
  loudnessDb: -12
});

/** A steady tune at 120: eight quarter notes over four seconds. */
const READING_V1 = {
  notes: [60, 62, 64, 65, 67, 65, 64, 62].map((midi, i) =>
    sung(i * 500, i * 500 + 450, midi)
  ),
  hits: []
};

/** The same performance read by a better reader: every onset 20ms later. */
const READING_V2 = {
  notes: READING_V1.notes.map((n) => ({
    ...n,
    startMs: n.startMs + 20,
    endMs: n.endMs + 20
  })),
  hits: []
};

const INPUTS = { durationMs: 4000 };

const tap = (atMs: number) => ({ atMs, tappedAtMs: atMs, isDownbeat: false });

/** One statement in every layer. */
const STATEMENTS: Statements = {
  notes: [{ atMs: 1010, midi: 63 }],
  writtenNotes: [{ atMs: 3600, endMs: 3700, midi: 69 }],
  deletedNotes: [2510],
  beats: [tap(0), tap(500), tap(1000), tap(1500)],
  bpm: 120,
  pickup: { beats: 4, beatMs: 500, endMs: 0 },
  harmony: { askedAtMs: 1, analysisVersion: 1 }
};

describe('derive', () => {
  it('returns the three derived layers from a reading and its statements', () => {
    const out = derive(READING_V1, STATEMENTS, INPUTS);
    expect(out.transcription.notes.length).toBeGreaterThan(0);
    expect(out.rhythm.grid.bpm).toBe(120);
    expect(out.harmony.slots.length).toBeGreaterThan(0);
  });

  it('is the same for the same inputs, so no two callers can disagree', () => {
    const a = derive(READING_V1, STATEMENTS, INPUTS);
    const b = derive(READING_V1, STATEMENTS, INPUTS);
    expect(b).toEqual(a);
  });
});

describe('INV-NOTES-256: statements survive a newer reading', () => {
  const before = derive(READING_V1, STATEMENTS, INPUTS);
  const after = derive(READING_V2, STATEMENTS, INPUTS);

  it('keeps a corrected pitch on the note it corrected', () => {
    const was = before.transcription.notes.find((n) => n.startMs === 1000);
    const now = after.transcription.notes.find((n) => n.startMs === 1020);
    expect(was?.midi).toBe(63);
    expect(now?.midi).toBe(63);
  });

  it('keeps a deleted note deleted', () => {
    expect(after.transcription.notes.some((n) => n.startMs === 2520)).toBe(false);
  });

  it('keeps a written note, which no reading could produce', () => {
    expect(after.transcription.notes.some((n) => n.isWritten)).toBe(true);
  });

  it('keeps every tapped beat exactly where it was tapped', () => {
    const tapped = after.rhythm.beatLine
      .filter((b) => b.kind === 'tapped')
      .map((b) => b.atMs);
    expect(tapped).toEqual([0, 500, 1000, 1500]);
  });

  it('keeps the count-in and the tempo set by hand', () => {
    expect(after.rhythm.pickup).toEqual(STATEMENTS.pickup);
    expect(after.rhythm.grid.bpm).toBe(120);
  });
});

describe('INV-NOTES-257: the transcription carries no rhythm', () => {
  const plain = derive(READING_V1, { notes: STATEMENTS.notes }, INPUTS);

  it('is unmoved by a tempo, taps, bar lines or a count-in', () => {
    const loud = derive(
      READING_V1,
      {
        notes: STATEMENTS.notes,
        bpm: 37,
        beats: [tap(0), tap(700), tap(1400)],
        barLines: [0, 8, 16],
        tapPattern: { beats: [1], beatsPerBar: 3 },
        pickup: { beats: 8, beatMs: 250, endMs: 900 }
      },
      INPUTS
    );
    expect(loud.transcription).toEqual(plain.transcription);
  });
});

describe('INV-NOTES-260: each derivation sees only its slice', () => {
  it('derives the same transcription from the full document as from its slice alone', () => {
    const fromAll = deriveTranscription(READING_V1.notes, transcriptionSlice(STATEMENTS));
    const fromSlice = deriveTranscription(READING_V1.notes, {
      notes: STATEMENTS.notes ?? [],
      writtenNotes: STATEMENTS.writtenNotes ?? [],
      deletedNotes: STATEMENTS.deletedNotes ?? []
    });
    expect(fromAll).toEqual(fromSlice);
  });
});

describe('INV-NOTES-255: nothing writes downward', () => {
  it('leaves the rhythm untouched by a chord edit', () => {
    const without = derive(READING_V1, STATEMENTS, INPUTS);
    const withEdit = derive(
      READING_V1,
      { ...STATEMENTS, chords: [{ atMs: 100, rootPc: 7, quality: 'maj' }] },
      INPUTS
    );
    expect(withEdit.rhythm).toEqual(without.rhythm);
    expect(withEdit.transcription).toEqual(without.transcription);
  });
});
