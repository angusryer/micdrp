/**
 * INV-NOTES-096 — an edit finds its note after the reading has moved.
 *
 * Found by the re-analysis test rather than by anyone: every edit was
 * anchored at exactly the millisecond a re-read moves, so a better reader
 * that placed an onset one millisecond later orphaned every correction. The
 * corpus tool exists to run a better reader over every take, which is
 * precisely when this bites.
 */
import {
  ANCHOR_SLACK_MS,
  anchorOf,
  collectNoteEdits,
  noteAt,
  replayNoteEdits
} from '../noteEdits';
import type { NoteEvent } from '../segmentation';
import { withoutDeleted } from '../writtenNotes';

const sung = (startMs: number, endMs: number, midi: number): NoteEvent => ({
  midi,
  startMs,
  endMs,
  durationMs: endMs - startMs,
  cents: 0,
  clarity: 0.9,
  loudnessDb: -12
});

const heard = [sung(0, 450, 60), sung(500, 950, 62), sung(1000, 1450, 64)];
/** The same performance read again, every onset 20ms later. */
const reread = heard.map((n) => ({ ...n, startMs: n.startMs + 20, endMs: n.endMs + 20 }));

describe('noteAt', () => {
  it('finds the note covering the anchor', () => {
    expect(noteAt(heard, 700)).toBe(1);
  });

  it('finds the nearest note when the anchor fell just outside it', () => {
    // 10ms before the second note began: a re-read moved the onset later.
    expect(noteAt(heard, 490)).toBe(1);
  });

  it('gives up beyond the slack, rather than guessing a far note', () => {
    expect(noteAt([sung(0, 100, 60)], 100 + ANCHOR_SLACK_MS + 1)).toBe(-1);
  });

  it('prefers the nearer of two notes either side of a gap', () => {
    // 460 is 10ms after the first ends and 40ms before the second begins.
    expect(noteAt(heard, 460)).toBe(0);
  });
});

describe('an edit collected today', () => {
  it('is anchored at the middle of the note, not its first moment', () => {
    const edits = collectNoteEdits(heard, [{ ...heard[1], midi: 63 }, heard[0], heard[2]].sort((a, b) => a.startMs - b.startMs));
    expect(edits).toHaveLength(1);
    expect(edits[0].atMs).toBe(anchorOf(heard[1]));
  });

  it('survives every onset moving later', () => {
    const corrected = [heard[0], { ...heard[1], midi: 63 }, heard[2]];
    const edits = collectNoteEdits(heard, corrected);
    expect(replayNoteEdits(reread, edits)[1].midi).toBe(63);
  });
});

describe('an edit stored before the anchor moved', () => {
  it('still lands, because it sits within the slack', () => {
    // Anchored at the old first millisecond, as every stored edit is.
    const old = [{ atMs: heard[1].startMs, midi: 63 }];
    expect(replayNoteEdits(reread, old)[1].midi).toBe(63);
  });
});

describe('a deletion', () => {
  it('stays in force after the onset moves', () => {
    const left = withoutDeleted(reread, [anchorOf(heard[1])]);
    expect(left.map((n) => n.midi)).toEqual([60, 64]);
  });

  it('stays in force when it was anchored the old way', () => {
    const left = withoutDeleted(reread, [heard[1].startMs]);
    expect(left.map((n) => n.midi)).toEqual([60, 64]);
  });
});
