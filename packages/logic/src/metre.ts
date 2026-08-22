/**
 * metre — the time signature a set of downbeats implies.
 *
 * Read back from where the chords were placed rather than constraining where
 * they may go (INV-NOTES-050). Nothing in the editing surface consumes this:
 * it exists for what gets written out — a MIDI file has to say something —
 * and for whatever later wants a notated reading.
 *
 * It cannot be authoritative, because it cannot see intent. Three half notes
 * meant as a bar of four are six beats to any arithmetic, and only the person
 * who sang them knows they were not in six four. So this proposes, and a
 * stated choice replaces it outright.
 */
import type { MusicalGrid } from './quantize';

export interface MetreReading {
  /** Beats in a bar. */
  beatsPerBar: number;
  /** What a beat is worth, as the lower number of a time signature. */
  beatUnit: number;
  /** How the two read together, e.g. "4/4". */
  label: string;
  /** True when a person stated this rather than it being read. */
  isStated: boolean;
}

/**
 * Groupings to prefer, in order.
 *
 * Four first because most sung ideas are in four, then three, then two. A
 * grouping is only chosen when the spacing is actually consistent with it,
 * so this ordering breaks ties rather than imposing anything.
 */
const PREFERRED = [4, 3, 2, 6, 5, 7];

/** A time signature someone stated, which needs no reading. */
export function statedMetre(beatsPerBar: number, beatUnit = 4): MetreReading {
  const beats = Math.max(1, Math.round(beatsPerBar));
  return {
    beatsPerBar: beats,
    beatUnit,
    label: `${beats}/${beatUnit}`,
    isStated: true
  };
}

/**
 * The gaps between consecutive downbeats, in beats.
 *
 * Rounded, because a downbeat sits on a grid step and the gaps we care about
 * are whole beats — a gap of 3.98 beats is four beats measured through a
 * tempo that is a hair off.
 */
export function gapsInBeats(
  downbeatSteps: readonly number[],
  stepsPerBeat: number
): number[] {
  const perBeat = stepsPerBeat > 0 ? stepsPerBeat : 4;
  const sorted = Array.from(new Set(downbeatSteps)).sort((a, b) => a - b);
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    gaps.push(Math.round((sorted[i] - sorted[i - 1]) / perBeat));
  }
  return gaps.filter((g) => g > 0);
}

/**
 * The metre a set of downbeats implies.
 *
 * Takes the largest grouping the spacing is consistent with rather than the
 * spacing itself: downbeats every two beats are as much a bar of four with
 * the harmony changing halfway as they are a bar of two, and four is the
 * better guess. Reading the gap directly would put the half-bar problem back
 * one stage further down.
 */
export function readMetre(
  downbeatSteps: readonly number[],
  grid: MusicalGrid
): MetreReading {
  const beatUnit = grid.isCompound ? 8 : 4;
  const gaps = gapsInBeats(downbeatSteps, grid.stepsPerBeat);
  if (gaps.length === 0) {
    // Nothing placed, or one downbeat: fall back to what the grid guessed.
    const beats = Math.max(1, Math.round(grid.beatsPerBar || 4));
    return { beatsPerBar: beats, beatUnit, label: `${beats}/${beatUnit}`, isStated: false };
  }

  const smallest = Math.min(...gaps);
  // A grouping works when every gap divides into it — several chords may sit
  // inside one bar, but a chord may not straddle a bar line.
  const fits = (bar: number) => gaps.every((g) => bar % g === 0);

  for (const candidate of PREFERRED) {
    if (candidate >= smallest && fits(candidate)) {
      return {
        beatsPerBar: candidate,
        beatUnit,
        label: `${candidate}/${beatUnit}`,
        isStated: false
      };
    }
  }

  // Nothing common fits, so the take has its own shape: the most frequent gap
  // is the most honest thing to call a bar.
  const counts = new Map<number, number>();
  for (const g of gaps) {
    counts.set(g, (counts.get(g) ?? 0) + 1);
  }
  let best = smallest;
  let bestCount = 0;
  for (const [gap, count] of counts) {
    if (count > bestCount || (count === bestCount && gap > best)) {
      best = gap;
      bestCount = count;
    }
  }
  return {
    beatsPerBar: best,
    beatUnit,
    label: `${best}/${beatUnit}`,
    isStated: false
  };
}
