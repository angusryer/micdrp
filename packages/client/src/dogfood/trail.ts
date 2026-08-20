/**
 * The trail of screens a remark was spoken over (INV-DOG-002).
 *
 * "Move this button lower" is unactionable without knowing which screen was on
 * show when it was said, and the whole point of the feature is to talk while
 * walking through the app. So every navigation during a recording is recorded
 * with the offset it happened at.
 *
 * Offsets exclude time spent paused, so they line up with the audio rather than
 * with the wall clock — a transcript timestamp and a trail offset have to refer
 * to the same moment for the interpretation to resolve a request to a screen.
 */
import type { ScreenVisit } from './types';

export class ScreenTrail {
  private readonly visits: ScreenVisit[] = [];

  /**
   * Record a screen at an offset.
   *
   * Repeating the current screen is ignored: a re-render, a tab settling, or
   * navigating back to where you already were are not new context, and a trail
   * full of duplicates is harder to read for no gain.
   */
  visit(route: string, atMs: number): void {
    const last = this.visits[this.visits.length - 1];
    if (last?.route === route) {
      return;
    }
    this.visits.push({ route, atMs });
  }

  /** The trail so far, oldest first. */
  entries(): ScreenVisit[] {
    return [...this.visits];
  }

  /** The screen currently on show, or null before anything was recorded. */
  current(): string | null {
    return this.visits[this.visits.length - 1]?.route ?? null;
  }

  reset(): void {
    this.visits.length = 0;
  }
}
