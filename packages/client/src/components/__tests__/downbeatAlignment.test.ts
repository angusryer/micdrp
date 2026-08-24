/**
 * INV-NOTES-104 — a downbeat is drawn where it can be picked up.
 *
 * There are two things that have to agree about where a downbeat is: the rule
 * drawn behind the notes, and the handle the touch surface reads. They used to
 * be worked out separately, and the second one laid the take out again from
 * the notes alone — so it never learned about the pickup, and every line it
 * placed sat the whole length of that pickup earlier than the downbeat it was
 * marking. That is a picture in which nothing can be selected where it looks.
 *
 * What this pins is that both come out of one time axis, with a pickup in
 * play, which is the case that broke.
 */
import { layoutGridLines, type MelodyGrid } from '../melodyGrid';
import { barHandles, xAtStep } from '../../screens/Notes/barRulerModel';
import type { BarLayout } from 'logic';

const GRID: MelodyGrid = {
  bpm: 120,
  // The first downbeat is a second and a half in: everything before it is
  // pickup, and that gap is what the second layout used to lose.
  offsetMs: 1500,
  beatsPerBar: 4,
  stepsPerBeat: 4,
  barSteps: [0, 16, 32]
};

/** The recording starts at zero; the singing starts later. */
const T0 = 0;
const SPAN = 12_000;
const PAD = 12;
const PX_PER_MS = 0.2;

/** The geometry the touch surface is given, from the graph's own axis. */
const geometry = {
  originX: PAD + (GRID.offsetMs - T0) * PX_PER_MS,
  stepWidth: (60_000 / GRID.bpm / (GRID.stepsPerBeat ?? 4)) * PX_PER_MS
};

const layout: BarLayout = {
  lines: [...(GRID.barSteps ?? [])],
  stepsPerBeat: 4,
  isCompound: false
};

describe('a downbeat, drawn and grabbed', () => {
  it('is drawn exactly where the surface reads it, pickup and all', () => {
    const drawn = layoutGridLines(GRID, T0, SPAN, PAD, PX_PER_MS).filter(
      (line) => line.isBar
    );
    const grabbed = barHandles(layout, geometry);

    expect(drawn).toHaveLength(grabbed.length);
    drawn.forEach((line, i) => {
      expect(line.x).toBeCloseTo(grabbed[i].x, 6);
    });
  });

  it('places the first downbeat after the pickup, not at the start', () => {
    // The bug drew it at the very left edge, which is what made it look like
    // a line marking the beginning of the recording.
    const [first] = layoutGridLines(GRID, T0, SPAN, PAD, PX_PER_MS).filter(
      (line) => line.isBar
    );
    expect(first.x).toBeCloseTo(PAD + GRID.offsetMs * PX_PER_MS, 6);
    expect(first.x).toBeGreaterThan(PAD);
  });

  it('still draws the pulse between arranged bars', () => {
    // Supplying the arrangement used to replace the whole grid, so arranging
    // the bars silently took the beats away with it.
    const beats = layoutGridLines(GRID, T0, SPAN, PAD, PX_PER_MS).filter(
      (line) => !line.isBar
    );
    expect(beats.length).toBeGreaterThan(0);
  });

  it('draws no beat rule on top of a bar line', () => {
    const lines = layoutGridLines(GRID, T0, SPAN, PAD, PX_PER_MS);
    const bars = lines.filter((l) => l.isBar).map((l) => Math.round(l.x));
    for (const beat of lines.filter((l) => !l.isBar)) {
      expect(bars).not.toContain(Math.round(beat.x));
    }
  });

  it('agrees with the surface for every step, not only the drawn ones', () => {
    for (const step of GRID.barSteps ?? []) {
      const timeMs = GRID.offsetMs + step * (60_000 / GRID.bpm / 4);
      expect(xAtStep(step, geometry)).toBeCloseTo(
        PAD + (timeMs - T0) * PX_PER_MS,
        6
      );
    }
  });
});
