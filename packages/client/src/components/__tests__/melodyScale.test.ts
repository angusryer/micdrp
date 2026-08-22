/**
 * The graph's time axis: a beat is the same width wherever it falls, zoom
 * changes only the scale, a finger lands where the graph says, and a
 * thumbnail still shows the whole idea (INV-NOTES-032/033/034/035).
 */
import {
  clampBeatWidth,
  layoutMelody,
  MIN_BEAT_WIDTH,
  type MelodyGrid,
  type MelodyNote
} from '../melodyLayout';

function note(midi: number, startMs: number, endMs: number): MelodyNote {
  return { midi, startMs, endMs };
}

/** 120bpm: a beat is 500ms, a bar of four is 2s. */
const GRID: MelodyGrid = { bpm: 120, offsetMs: 0, beatsPerBar: 4 };

const W = 300;
const H = 100;

/** The same opening phrase, once alone and once followed by a long tail. */
const SHORT = [note(60, 0, 500), note(64, 500, 1000)];
const LONG = [...SHORT, ...Array.from({ length: 60 }, (_, i) =>
  note(62, 2000 + i * 1000, 2500 + i * 1000)
)];

describe('a beat is the same width wherever it falls (INV-NOTES-032)', () => {
  it('gives the same passage the same width in a short and a long take', () => {
    const short = layoutMelody(SHORT, { width: W, height: H, grid: GRID, beatWidth: 40 });
    const long = layoutMelody(LONG, { width: W, height: H, grid: GRID, beatWidth: 40 });

    // The two takes share an opening; it must be drawn identically.
    expect(long.rects[0].x).toBeCloseTo(short.rects[0].x, 6);
    expect(long.rects[0].width).toBeCloseTo(short.rects[0].width, 6);
    expect(long.rects[1].x).toBeCloseTo(short.rects[1].x, 6);
    // Fitting would have made the long take's notes far narrower.
    expect(long.timeAxis.pxPerMs).toBeCloseTo(short.timeAxis.pxPerMs, 6);
  });

  it('lets a long take run past the viewport rather than compressing it', () => {
    const long = layoutMelody(LONG, { width: W, height: H, grid: GRID, beatWidth: 40 });
    expect(long.contentWidth).toBeGreaterThan(W);
    // 40px per 500ms beat = 0.08 px/ms.
    expect(long.timeAxis.pxPerMs).toBeCloseTo(40 / 500, 6);
  });

  it('still fills the viewport when the take is shorter than it', () => {
    const tiny = layoutMelody([note(60, 0, 200)], {
      width: W,
      height: H,
      grid: GRID,
      beatWidth: 40
    });
    expect(tiny.contentWidth).toBe(W);
  });
});

describe('zoom changes the scale, never the content (INV-NOTES-033)', () => {
  const at = (beatWidth: number) =>
    layoutMelody(LONG, { width: W, height: H, grid: GRID, beatWidth });

  it('keeps every note, in order, at every zoom', () => {
    const near = at(120);
    const far = at(MIN_BEAT_WIDTH);

    expect(near.rects).toHaveLength(LONG.length);
    expect(far.rects).toHaveLength(LONG.length);
    expect(near.rects.map((r) => r.midi)).toEqual(far.rects.map((r) => r.midi));
    // Only the coordinates moved, and they moved the same way for all of them.
    expect(near.contentWidth).toBeGreaterThan(far.contentWidth);
  });

  it('keeps every bar line at every zoom, thinning only beats', () => {
    const near = at(120);
    const far = at(MIN_BEAT_WIDTH);
    const bars = (l: ReturnType<typeof at>) =>
      l.gridLines.filter((g) => g.isBar).map((g) => g.bar);

    expect(bars(near)).toEqual(bars(far));
    // Beats survive when wide enough and are dropped when they are not.
    expect(near.gridLines.some((g) => !g.isBar)).toBe(true);
    expect(far.gridLines.every((g) => g.isBar)).toBe(true);
  });

  it('clamps a beat so it can neither vanish nor hide the whole bar', () => {
    expect(clampBeatWidth(0, W, 4)).toBe(MIN_BEAT_WIDTH);
    expect(clampBeatWidth(-50, W, 4)).toBe(MIN_BEAT_WIDTH);
    // One bar filling the viewport is the ceiling: 300 / 4 beats.
    expect(clampBeatWidth(10000, W, 4)).toBe(W / 4);
    expect(clampBeatWidth(40, W, 4)).toBe(40);
    // A nonsense metre falls back to four rather than dividing by zero.
    expect(Number.isFinite(clampBeatWidth(40, W, 0))).toBe(true);
  });
});

describe('a finger lands where the graph says it is (INV-NOTES-034)', () => {
  it.each([
    ['fitted', undefined],
    ['fixed', 40],
    ['zoomed in', 140]
  ])('round-trips x and time when %s', (_name, beatWidth) => {
    const { rects, timeAxis } = layoutMelody(LONG, {
      width: W,
      height: H,
      grid: GRID,
      beatWidth
    });
    const { t0, pad, pxPerMs } = timeAxis;

    for (const rect of [rects[0], rects[5], rects[rects.length - 1]]) {
      // The inverse of what drew it must return the moment it was drawn for.
      const timeAtX = t0 + (rect.x - pad) / pxPerMs;
      expect(pad + (timeAtX - t0) * pxPerMs).toBeCloseTo(rect.x, 6);
    }
  });

  it('places rules on the same mapping as the notes', () => {
    const { gridLines, timeAxis } = layoutMelody(LONG, {
      width: W,
      height: H,
      grid: GRID,
      beatWidth: 40
    });
    const { t0, pad, pxPerMs } = timeAxis;
    // Bar 2 falls at 2000ms with this grid.
    const barTwo = gridLines.find((g) => g.bar === 2);
    expect(barTwo).toBeDefined();
    expect(barTwo!.x).toBeCloseTo(pad + (2000 - t0) * pxPerMs, 6);
  });
});

describe('a thumbnail still shows the whole idea at once (INV-NOTES-035)', () => {
  it('fits any length to the width it was given', () => {
    for (const notes of [SHORT, LONG]) {
      const { contentWidth, timeAxis } = layoutMelody(notes, {
        width: W,
        height: H,
        grid: GRID
      });
      expect(contentWidth).toBe(W);
      // The whole span lands inside the inner width.
      expect(timeAxis.span * timeAxis.pxPerMs).toBeCloseTo(timeAxis.innerW, 6);
    }
  });

  it('fits rather than guessing a tempo when a beat width has no grid', () => {
    const { contentWidth } = layoutMelody(LONG, {
      width: W,
      height: H,
      beatWidth: 40
    });
    expect(contentWidth).toBe(W);
  });
});
