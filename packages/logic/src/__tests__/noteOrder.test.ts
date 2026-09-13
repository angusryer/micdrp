/**
 * INV-NOTES-271 — a favourite stays at the top.
 */
import { orderedNotes } from '../noteOrder';

const note = (id: string, createdAtMs: number) => ({ id, createdAtMs });

const takes = [note('a', 300), note('b', 200), note('c', 100)];

describe('orderedNotes', () => {
  it('is newest first when nothing is favourite', () => {
    expect(orderedNotes(takes, () => false).map((n) => n.id)).toEqual(['a', 'b', 'c']);
  });

  it('lifts a favourite above everything newer than it', () => {
    expect(orderedNotes(takes, (id) => id === 'c').map((n) => n.id)).toEqual([
      'c',
      'a',
      'b'
    ]);
  });

  it('keeps favourites newest first among themselves', () => {
    expect(orderedNotes(takes, (id) => id !== 'b').map((n) => n.id)).toEqual([
      'a',
      'c',
      'b'
    ]);
  });

  it('leaves the list it was given alone', () => {
    const before = takes.map((n) => n.id);
    orderedNotes(takes, (id) => id === 'c');
    expect(takes.map((n) => n.id)).toEqual(before);
  });
});
