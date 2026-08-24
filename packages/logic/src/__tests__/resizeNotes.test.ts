/**
 * INV-NOTES-095 / INV-NOTES-096 — changing how long a note lasts.
 *
 * The rule that matters most is that notes never overlap. A moment belonging
 * to exactly one note is what lets an edit be anchored to a moment inside it,
 * and what lets the harmony read a span — so an edit that produced an overlap
 * would quietly break two things a long way from here.
 */
import {
  collectNoteEdits,
  settleOverlaps,
  MIN_NOTE_MS,
  replayNoteEdits,
  resizeNotes
} from '../noteEdits';
import type { NoteEvent } from '../segmentation';

const note = (midi: number, startMs: number, endMs: number): NoteEvent =>
  ({
    midi,
    startMs,
    endMs,
    durationMs: endMs - startMs,
    cents: 0,
    clarity: 1
  }) as NoteEvent;

// Three notes, half a second each, with a 100ms gap after the first. The
// second is a different pitch from the first; the third differs again.
const PHRASE = [note(60, 0, 500), note(62, 600, 1100), note(64, 1100, 1600)];

/** The same shape, but the first two notes are the one pitch. */
const HELD = [note(60, 0, 500), note(60, 600, 1100), note(64, 1100, 1600)];

const overlaps = (notes: readonly NoteEvent[]) =>
  notes.some((n, i) => i > 0 && n.startMs < notes[i - 1].endMs);

describe('changing how long a note lasts', () => {
  it('leaves every other note exactly where it was', () => {
    // Pushing the rest of the phrase along was tried and is worse to use:
    // a length you were happy with keeps sliding away while you work on the
    // note before it.
    const longer = resizeNotes(PHRASE, [0], 200);
    // Stopped at its neighbour rather than reaching the 700 it was pulled to,
    // and stopped here rather than at settle time: which note is being pulled
    // is only known here, and the length readout has to be honest as it moves.
    expect(longer[0].endMs).toBe(600);
    expect(longer[1].startMs).toBe(600);
    expect(longer[2].startMs).toBe(1100);
  });

  it('joins a note lengthened into one of the same pitch', () => {
    // Two notes at one pitch run together is a singer saying the detector
    // split a held note in two.
    const joined = settleOverlaps(resizeNotes(HELD, [0], 200));
    expect(joined).toHaveLength(2);
    expect(joined[0].midi).toBe(60);
    // Nothing audible is lost: it runs to whichever ended later.
    expect(joined[0].endMs).toBe(1100);
  });

  it('stops against a neighbour of a different pitch', () => {
    // Swallowing it would delete a note nobody asked to delete, and there is
    // no reading of "make this longer" that means "and remove that".
    const settled = settleOverlaps(resizeNotes(PHRASE, [0], 200));
    expect(settled).toHaveLength(3);
    expect(settled[0].endMs).toBe(600);
    expect(settled[1]).toEqual(PHRASE[1]);
  });

  it('stops however far it is dragged past a different pitch', () => {
    const settled = settleOverlaps(resizeNotes(PHRASE, [0], 60_000));
    expect(settled).toHaveLength(3);
    expect(settled[0].endMs).toBe(600);
  });

  it('never leaves two notes sounding at once, however far it is dragged', () => {
    for (const phrase of [PHRASE, HELD]) {
      for (const delta of [-2000, -600, -100, 100, 900, 5000]) {
        expect(
          overlaps(settleOverlaps(resizeNotes(phrase, [1], delta)))
        ).toBe(false);
      }
    }
  });

  it('runs through every note of the same pitch it reaches', () => {
    const held = [note(60, 0, 500), note(60, 600, 1100), note(60, 1200, 1700)];
    const joined = settleOverlaps(resizeNotes(held, [0], 5000));
    expect(joined).toHaveLength(1);
    expect(joined[0].endMs).toBe(5500);
  });

  it('will not shorten a note past being a note', () => {
    const shorter = resizeNotes(PHRASE, [0], -10_000);
    expect(shorter[0].endMs - shorter[0].startMs).toBe(MIN_NOTE_MS);
    expect(overlaps(shorter)).toBe(false);
  });

  it('leaves the notes alone when nothing is chosen', () => {
    expect(resizeNotes(PHRASE, [], 500)).toEqual(PHRASE);
  });

  it('keeps each note its own length when it was not chosen', () => {
    const longer = resizeNotes(PHRASE, [0], 50);
    expect(longer[1].endMs - longer[1].startMs).toBe(500);
    expect(longer[2].endMs - longer[2].startMs).toBe(500);
  });
});

describe('INV-NOTES-096: a timing edit finds its note again', () => {
  it('anchors where the detector heard it, not where the edit puts it', () => {
    const edited = resizeNotes(PHRASE, [0], 50);
    const edits = collectNoteEdits(PHRASE, edited);
    // Anchored to the original start, which is what replay searches.
    expect(edits[0].atMs).toBe(PHRASE[0].startMs);
    expect(replayNoteEdits(PHRASE, edits)).toEqual(edited);
  });

  it('leaves one edit per note however many things about it changed', () => {
    const moved = resizeNotes(PHRASE, [0], 50).map((n, i) =>
      i === 0 ? { ...n, midi: 67 } : n
    );
    const edits = collectNoteEdits(PHRASE, moved);
    // Only the note that changed: nothing else moved, so nothing else needs
    // remembering.
    expect(edits).toHaveLength(1);
    expect(edits[0].midi).toBe(67);
    expect(edits[0].endMs).toBe(550);
  });

  it('lands every edit on its own note, not the one before it', () => {
    // The anchor search runs against what was heard rather than against the
    // array being edited: searching the edited copy let a lengthened note
    // swallow the next anchor, and every later edit landed one note early.
    const edited = resizeNotes(PHRASE, [0, 2], 50);
    const replayed = replayNoteEdits(PHRASE, collectNoteEdits(PHRASE, edited));
    expect(replayed.map((n) => n.endMs)).toEqual([550, 1100, 1650]);
  });

  it('replays a pitch-only edit without inventing a timing change', () => {
    const moved = PHRASE.map((n, i) => (i === 1 ? { ...n, midi: 65 } : n));
    const edits = collectNoteEdits(PHRASE, moved);
    expect(edits[0].startMs).toBeUndefined();
    expect(replayNoteEdits(PHRASE, edits)[1].startMs).toBe(600);
  });
});

describe('pulling the left edge', () => {
  // Generous gaps, so there is somewhere to grow backwards into. In PHRASE
  // the notes sit against each other and every backward pull clamps at once.
  const SPACED = [note(60, 0, 400), note(64, 1000, 1400), note(67, 2000, 2400)];
  const SPACED_HELD = [note(60, 0, 400), note(60, 1000, 1400)];

  it('moves where the notes begin, not where they end', () => {
    const longer = resizeNotes(SPACED, [1], 200, 'start');
    expect(longer[1].startMs).toBe(800);
    expect(longer[1].endMs).toBe(1400);
  });

  it('stops against a neighbour of a different pitch', () => {
    // The note being pulled is the one that stops. Clamping at settle time
    // could only guess, and would shorten whichever came first.
    const longer = resizeNotes(SPACED, [1], 5000, 'start');
    expect(longer[1].startMs).toBe(SPACED[0].endMs);
    expect(longer[0]).toEqual(SPACED[0]);
  });

  it('runs back into a neighbour of the same pitch, to be joined', () => {
    const longer = resizeNotes(SPACED_HELD, [1], 800, 'start');
    expect(longer[1].startMs).toBe(200);
    const settled = settleOverlaps(longer);
    expect(settled).toHaveLength(1);
    expect(settled[0].endMs).toBe(1400);
  });

  it('will not shorten a note past being a note', () => {
    const shorter = resizeNotes(SPACED, [1], -10_000, 'start');
    expect(shorter[1].endMs - shorter[1].startMs).toBe(MIN_NOTE_MS);
  });

  it('leaves the other end where it was', () => {
    for (const delta of [-100, 200]) {
      expect(resizeNotes(SPACED, [1], delta, 'start')[1].endMs).toBe(1400);
    }
  });
});
