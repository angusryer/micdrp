/**
 * How long the reading actually takes, on a take the size of a real one.
 *
 * Not a correctness test. It exists because the last two arguments about where
 * work should live were both settled by measuring and both went against the
 * intuition: an FFT was assumed heavy and turned out to cost a twentieth of
 * what the detector already spent, and the detector itself was spending nine
 * percent of a core doing an O(n^2) sum it did not need to do.
 *
 * So this prints a table rather than asserting a speed. A threshold would
 * either be so loose it never fires or so tight it fails on a loaded machine,
 * and neither tells anyone anything. What it does assert is the shape of the
 * thing — that a take of ordinary length is read in well under the time it
 * took to sing, which is the only claim a person would notice being wrong.
 *
 * Run it and read the numbers:
 *   yarn test logic pipelineBench --silent=false
 */
import { dropTooBriefToSing, mergeBends } from '../bends';
import { harmonizeToGrid } from '../harmony';
import { detectKey } from '../key';
import { readPercussion } from '../percussion';
import { quantize } from '../quantize';
import { segmentNotes, type PitchFrame } from '../segmentation';
import { smoothPitch } from '../smoothing';

/** A hop at 44.1kHz with the hop halved, which is what the engine emits. */
const HOP_MS = 512 / 44.1;

/** Two minutes: longer than a sung idea, which is the point of the test. */
const TAKE_MS = 120_000;

/** A take of alternating phrases and rests, with some struck sounds in it. */
function realisticTake(): PitchFrame[] {
  const frames: PitchFrame[] = [];
  const scale = [60, 62, 64, 65, 67, 69, 71, 72];
  for (let t = 0; t < TAKE_MS; t += HOP_MS) {
    const bar = Math.floor(t / 2000);
    const resting = bar % 5 === 4;
    const struck = bar % 7 === 3;
    const midi = scale[Math.floor(t / 400) % scale.length];
    frames.push({
      timestampMs: t,
      midi: resting || struck ? null : midi,
      cents: resting || struck ? null : Math.round(Math.sin(t / 90) * 12),
      clarity: resting ? 0 : struck ? 0.15 : 0.95,
      levelDb: resting ? -70 : struck ? -14 : -16,
      centroidHz: struck ? 2500 : 300,
      flatness: struck ? 0.7 : 0.05,
      fluxDb: -40
    });
  }
  return frames;
}

const time = (label: string, run: () => unknown): number => {
  const from = performance.now();
  run();
  const took = performance.now() - from;
  // eslint-disable-next-line no-console
  console.log(`  ${label.padEnd(22)} ${took.toFixed(1).padStart(7)} ms`);
  return took;
};

describe('reading a two-minute take', () => {
  const frames = realisticTake();

  it('reads it in far less time than it took to sing', () => {
    // eslint-disable-next-line no-console
    console.log(
      `\n  ${frames.length} frames over ${TAKE_MS / 1000}s of audio\n`
    );

    let smoothed: PitchFrame[] = [];
    let notes = segmentNotes([]);
    let total = 0;

    total += time('smoothPitch', () => (smoothed = smoothPitch(frames)));
    total += time('segmentNotes', () => (notes = segmentNotes(smoothed)));
    total += time('mergeBends', () => (notes = mergeBends(notes)));
    total += time('dropTooBriefToSing', () => (notes = dropTooBriefToSing(notes)));
    total += time('readPercussion', () => readPercussion(frames));
    const grid = quantize(notes).grid;
    total += time('quantize', () => quantize(notes));
    total += time('detectKey', () => detectKey(notes));
    total += time('harmonizeToGrid', () => harmonizeToGrid(notes, grid));

    // eslint-disable-next-line no-console
    console.log(
      `\n  ${'TOTAL'.padEnd(22)} ${total.toFixed(1).padStart(7)} ms  ` +
        `(${((total / TAKE_MS) * 100).toFixed(2)}% of the take's length)\n`
    );

    expect(notes.length).toBeGreaterThan(0);
    // Generous by an order of magnitude on purpose. This catches a stage
    // going quadratic, which is the failure that actually happens; it is not
    // a performance budget, and tightening it would make the suite flaky on
    // a busy machine without telling anyone anything true.
    expect(total).toBeLessThan(TAKE_MS / 10);
  });
});
