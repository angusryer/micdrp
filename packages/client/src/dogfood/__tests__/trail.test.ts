/**
 * INV-DOG-002 — a remark is never separated from what it was about.
 *
 * "Move this button" is unactionable without the screen it was said over, so
 * the trail is not a nicety; it is what makes a clip usable at all.
 */
import { ScreenTrail } from '../trail';

describe('ScreenTrail', () => {
  it('records where a remark started', () => {
    const trail = new ScreenTrail();
    trail.visit('Notes', 0);
    expect(trail.entries()).toEqual([{ route: 'Notes', atMs: 0 }]);
  });

  it('ACC-DOG-001: follows the maintainer across screens', () => {
    const trail = new ScreenTrail();
    trail.visit('Notes', 0);
    trail.visit('Practice', 4200);
    expect(trail.entries().map((v) => v.route)).toEqual(['Notes', 'Practice']);
  });

  it('keeps the offset each screen appeared at', () => {
    const trail = new ScreenTrail();
    trail.visit('Notes', 0);
    trail.visit('Practice', 4200);
    expect(trail.entries()[1].atMs).toBe(4200);
  });

  it('ignores a repeat of the screen already showing', () => {
    // A re-render or a tab settling is not new context, and a trail full of
    // duplicates is harder to read for no gain.
    const trail = new ScreenTrail();
    trail.visit('Notes', 0);
    trail.visit('Notes', 900);
    expect(trail.entries()).toHaveLength(1);
  });

  it('records returning to a screen after leaving it', () => {
    const trail = new ScreenTrail();
    trail.visit('Notes', 0);
    trail.visit('Practice', 1000);
    trail.visit('Notes', 2000);
    expect(trail.entries()).toHaveLength(3);
  });

  it('reports the screen currently on show', () => {
    const trail = new ScreenTrail();
    expect(trail.current()).toBeNull();
    trail.visit('Dashboard', 0);
    expect(trail.current()).toBe('Dashboard');
  });
});
