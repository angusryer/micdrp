/**
 * INV-NOTES-271 — which takes are kept to hand.
 */
import { favourites, isFavourite, setFavourite, toggleFavourite } from '../favourites';
import { remove } from '../store';

beforeEach(() => {
  remove('notes.favourites');
});

describe('favourites', () => {
  it('starts with none', () => {
    expect(favourites()).toEqual([]);
    expect(isFavourite('n1')).toBe(false);
  });

  it('keeps one to hand, and says so', () => {
    expect(setFavourite('n1', true)).toBe(true);
    expect(isFavourite('n1')).toBe(true);
  });

  it('stops, without disturbing the others', () => {
    setFavourite('n1', true);
    setFavourite('n2', true);
    setFavourite('n1', false);
    expect(isFavourite('n1')).toBe(false);
    expect(isFavourite('n2')).toBe(true);
  });

  it('says the same thing twice without keeping it twice', () => {
    setFavourite('n1', true);
    setFavourite('n1', true);
    expect(favourites()).toEqual(['n1']);
  });

  it('toggles', () => {
    expect(toggleFavourite('n1')).toBe(true);
    expect(toggleFavourite('n1')).toBe(false);
  });
});
