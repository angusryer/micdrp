/**
 * Where a struck sound is drawn.
 *
 * A hit has no pitch, so it has no height to be placed at — which is the whole
 * reason it cannot live on the melody graph's vertical axis. It gets a lane
 * instead, by what it sounded like, the way a drum machine gives a kick and a
 * hat their own rows (INV-NOTES-117).
 *
 * The horizontal is not its own. It is the melody graph's time axis, handed
 * in, so a drum and the note it landed on are drawn from one mapping and
 * cannot disagree about when they happened — the same rule the chord cards
 * follow (INV-NOTES-061), and the one that took two attempts to get right for
 * the downbeats (INV-NOTES-104).
 */
import type { Hit, HitKind } from 'logic';

import { xForMs, type TimeAxis } from './melodyScale';

/**
 * The lanes as they are drawn, top to bottom.
 *
 * Brightest at the top and deepest at the bottom, so the band reads the same
 * way as the melody graph above it, where a low note sits low. Screen y grows
 * downward, so "deepest at the bottom" means thump comes last, not first.
 *
 * A hit whose kind was never worked out gets the bottom row rather than being
 * dropped: an older engine reports no spectrum, and the sound was still made.
 */
export const RHYTHM_LANES: readonly HitKind[] = [
  'hiss',
  'tap',
  'thump',
  'unknown'
];

export interface HitMark {
  /** Index into the hit list, so a mark can be pointed back at its hit. */
  index: number;
  kind: HitKind;
  /** Where the hit landed, in px on the shared axis. */
  x: number;
  /** How wide it is drawn. A hit is a moment, so this is a minimum. */
  width: number;
  /** The centre of its lane, in px from the top of the band. */
  y: number;
  /** 0..1 — how hard it was struck, for how strongly it is drawn. */
  strength: number;
}

/** The quietest a hit can be and still be drawn at all, in dBFS. */
const FLOOR_DB = -60;

/** Narrower than this and a mark stops being visible at any zoom. */
const MIN_WIDTH = 3;

/**
 * How hard a hit was struck, as a fraction.
 *
 * From the level rather than from confidence: how sure the app is that
 * something was a drum is not a thing the drawing should express as loudness,
 * or a softly-struck sound it is certain about would look weaker than a loud
 * one it is guessing at.
 */
function strengthOf(loudnessDb: number): number {
  const above = loudnessDb - FLOOR_DB;
  return Math.max(0, Math.min(1, above / -FLOOR_DB));
}

/** Which lanes have anything in them, in drawing order. */
export function lanesUsed(hits: readonly Hit[]): HitKind[] {
  const seen = new Set(hits.map((hit) => hit.kind));
  return RHYTHM_LANES.filter((lane) => seen.has(lane));
}

/**
 * Lay the hits out across a band of a given height.
 *
 * Only the lanes actually used get room. A take with nothing but thumps in it
 * should not be drawn as three quarters empty space with a row at the bottom —
 * the band is as tall as it needs to be, and its lanes are what is there.
 */
export function layoutHits(
  hits: readonly Hit[],
  timeAxis: TimeAxis,
  height: number
): HitMark[] {
  const lanes = lanesUsed(hits);
  if (lanes.length === 0 || !(height > 0)) {
    return [];
  }
  const laneHeight = height / lanes.length;
  return hits.map((hit, index) => {
    const x = xForMs(timeAxis, hit.atMs);
    const row = lanes.indexOf(hit.kind);
    return {
      index,
      kind: hit.kind,
      x,
      width: Math.max(MIN_WIDTH, hit.durationMs * timeAxis.pxPerMs),
      y: row * laneHeight + laneHeight / 2,
      strength: strengthOf(hit.loudnessDb)
    };
  });
}
