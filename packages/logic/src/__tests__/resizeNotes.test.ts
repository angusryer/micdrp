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

// Three notes, half a second each, with a 100ms gap after the first.
const PHRASE = [note(60, 0, 500), note(62, 600, 1100), note(64, 1100, 1600)];

const overlaps = (notes: readonly NoteEvent[]) =>
  notes.some((n, i) => i > 0 && n.startMs < notes[i - 1].endMs);

describe('changing how long a note lasts', () => {
  it('moves everything after it by the same amount', () => {
    const longer = resizeNotes(PHRASE, [0], 200);
    expect(longer[0].endMs).toBe(700);
    expect(longer[1].startMs).toBe(800);
    expect(longer[2].startMs).toBe(1300);
  });

  it('keeps the gaps the singer left', () => {
    // The space after a note is part of the phrase; swallowing it would
    // rewrite rhythm nobody asked to change.
    const longer = resizeNotes(PHRASE, [0], 200);
    expect(longer[1].startMs - longer[0].endMs).toBe(100);
    expect(longer[2].startMs - longer[1].endMs).toBe(0);
  });

  it('never lets two notes sound at once, however far it is dragged', () => {
    for (const delta of [-2000, -600, -100, 100, 900, 5000]) {
      expect(overlaps(resizeNotes(PHRASE, [1], delta))).toBe(false);
    }
  });

  it('accumulates when several notes are changed together', () => {
    const longer = resizeNotes(PHRASE, [0, 1], 200);
    expect(longer[0].endMs).toBe(700);
    expect(longer[1].startMs).toBe(800);
    expect(longer[1].endMs).toBe(1500);
    // Two notes grew by 200 each, so the last one moves by 400.
    expect(longer[2].startMs).toBe(1500);
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
    const longer = resizeNotes(PHRASE, [0], 200);
    expect(longer[1].endMs - longer[1].startMs).toBe(500);
    expect(longer[2].endMs - longer[2].startMs).toBe(500);
  });
});

describe('INV-NOTES-096: a timing edit finds its note again', () => {
  it('anchors where the detector heard it, not where the edit puts it', () => {
    const edited = resizeNotes(PHRASE, [0], 200);
    const edits = collectNoteEdits(PHRASE, edited);
    // Anchored to the original start, which is what replay searches.
    expect(edits[0].atMs).toBe(PHRASE[0].startMs);
    expect(replayNoteEdits(PHRASE, edits)).toEqual(edited);
  });

  it('leaves one edit per note however many things about it changed', () => {
    const moved = resizeNotes(PHRASE, [0], 200).map((n, i) =>
      i === 0 ? { ...n, midi: 67 } : n
    );
    const edits = collectNoteEdits(PHRASE, moved);
    // One for the note itself carrying both changes, and one each for the
    // notes the ripple moved — they really are at different times now.
    expect(edits).toHaveLength(3);
    expect(edits[0].midi).toBe(67);
    expect(edits[0].endMs).toBe(700);
    expect(edits[1].midi).toBeUndefined();
  });

  it('finds every note even when an edit lengthened the one before it', () => {
    // The anchor search must run against what was heard: hunting the array
    // being edited would find the lengthened note for the next anchor, and
    // every later edit would land one note early.
    const edited = resizeNotes(PHRASE, [0], 200);
    const replayed = replayNoteEdits(PHRASE, collectNoteEdits(PHRASE, edited));
    expect(replayed.map((n) => n.startMs)).toEqual([0, 800, 1300]);
  });

  it('replays a pitch-only edit without inventing a timing change', () => {
    const moved = PHRASE.map((n, i) => (i === 1 ? { ...n, midi: 65 } : n));
    const edits = collectNoteEdits(PHRASE, moved);
    expect(edits[0].startMs).toBeUndefined();
    expect(replayNoteEdits(PHRASE, edits)[1].startMs).toBe(600);
  });
});
