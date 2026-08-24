/**
 * INV-NOTES-117 — where a struck sound is drawn.
 *
 * A hit has no pitch, so it has no height to be placed at, which is why it
 * cannot live on the melody graph's vertical axis. It gets a lane by what it
 * sounded like instead.
 *
 * Its horizontal position is not its own: it is the melody graph's time axis,
 * handed in, so a drum and the note it landed on cannot disagree about when
 * they happened. Two mappings over one timeline is the failure that took two
 * attempts to fix for the downbeats (INV-NOTES-104).
 */
import { layoutHits, lanesUsed, RHYTHM_LANES } from '../rhythmLanes';
import { xForMs, type TimeAxis } from '../melodyScale';
import type { Hit, HitKind } from 'logic';

const AXIS: TimeAxis = { t0: 0, span: 4000, pad: 10, innerW: 400, pxPerMs: 0.1 };

const hit = (atMs: number, kind: HitKind, loudnessDb = -12): Hit => ({
  atMs,
  durationMs: 40,
  loudnessDb,
  centroidHz: 1000,
  flatness: 0.7,
  kind,
  confidence: 0.8
});

describe('laying out the struck sounds', () => {
  it('places each one on the graph time axis it was handed', () => {
    // The property that matters most: one mapping, so a drum lands under the
    // note it was struck against.
    const marks = layoutHits([hit(500, 'thump'), hit(1500, 'hiss')], AXIS, 60);
    expect(marks[0].x).toBe(xForMs(AXIS, 500));
    expect(marks[1].x).toBe(xForMs(AXIS, 1500));
  });

  it('gives each kind its own lane', () => {
    const marks = layoutHits(
      [hit(0, 'thump'), hit(100, 'hiss'), hit(200, 'thump')],
      AXIS,
      60
    );
    expect(marks[0].y).toBe(marks[2].y);
    expect(marks[0].y).not.toBe(marks[1].y);
  });

  it('puts the deepest sound at the bottom, as on the graph above it', () => {
    const marks = layoutHits([hit(0, 'thump'), hit(100, 'hiss')], AXIS, 60);
    const thump = marks.find((m) => m.kind === 'thump');
    const hiss = marks.find((m) => m.kind === 'hiss');
    expect((thump?.y ?? 0)).toBeGreaterThan(hiss?.y ?? 0);
  });

  it('only gives room to lanes that have something in them', () => {
    // A take of nothing but thumps should not be drawn as mostly empty space.
    const only = [hit(0, 'thump'), hit(400, 'thump')];
    expect(lanesUsed(only)).toEqual(['thump']);
    const marks = layoutHits(only, AXIS, 60);
    expect(marks.every((m) => m.y === 30)).toBe(true);
  });

  it('draws a harder hit more strongly than a softer one', () => {
    const marks = layoutHits([hit(0, 'tap', -6), hit(400, 'tap', -45)], AXIS, 60);
    expect(marks[0].strength).toBeGreaterThan(marks[1].strength);
  });

  it('keeps strength inside its range however loud or quiet', () => {
    const marks = layoutHits([hit(0, 'tap', 20), hit(400, 'tap', -200)], AXIS, 60);
    for (const mark of marks) {
      expect(mark.strength).toBeGreaterThanOrEqual(0);
      expect(mark.strength).toBeLessThanOrEqual(1);
    }
  });

  it('stays visible at any zoom', () => {
    // A hit is a moment. Scaled to its own duration it would vanish when the
    // take is zoomed out, which is when the rhythm is most worth seeing.
    const tiny = { ...AXIS, pxPerMs: 0.0001 };
    expect(layoutHits([hit(0, 'tap')], tiny, 60)[0].width).toBeGreaterThan(0);
  });

  it('draws nothing where there is nothing, or nowhere to draw it', () => {
    expect(layoutHits([], AXIS, 60)).toEqual([]);
    expect(layoutHits([hit(0, 'tap')], AXIS, 0)).toEqual([]);
    expect(lanesUsed([])).toEqual([]);
  });

  it('has a lane for a hit whose kind was never worked out', () => {
    // An older binary reports no spectrum, so a hit is real and its kind is
    // unknown. Dropping it would hide a sound that was made.
    expect(RHYTHM_LANES).toContain('unknown');
    expect(layoutHits([hit(0, 'unknown')], AXIS, 60)).toHaveLength(1);
  });
});
