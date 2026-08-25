/**
 * INV-NOTES-129 — a rhythm tapped in is a statement, not a reading.
 *
 * Mouth drums must be heard through a microphone and told apart from singing,
 * which is a reading and can be wrong. A tap is not a reading at all: the
 * moment is the moment the finger landed. It is the most certain input the
 * app has, and it works in a noisy room and for parts nobody can sing.
 */
import { hitsFromTaps, mergeHits, type Tap } from '../tappedRhythm';
import type { Hit } from '../percussion';
import type { MusicalGrid } from '../quantize';

const GRID: MusicalGrid = {
  bpm: 120,
  offsetMs: 0,
  beatsPerBar: 4,
  isCompound: false,
  stepsPerBeat: 4,
  timeSignature: '4/4',
  confidence: 1,
  meterConfidence: 1,
  meterIsStated: true,
  meterIsCounted: false
};

const tap = (atMs: number, kind: Tap['kind'] = 'thump'): Tap => ({ atMs, kind });

const heard = (atMs: number): Hit => ({
  atMs,
  durationMs: 50,
  loudnessDb: -14,
  centroidHz: 300,
  flatness: 0.7,
  kind: 'thump',
  confidence: 0.6
});

describe('a rhythm tapped in', () => {
  it('puts a hit exactly where the finger landed', () => {
    const hits = hitsFromTaps([tap(0), tap(507), tap(1013)]);
    expect(hits.map((h) => h.atMs)).toEqual([0, 507, 1013]);
  });

  it('is certain, because it was done on purpose', () => {
    // Confidence here is not a guess about whether it happened.
    for (const hit of hitsFromTaps([tap(0), tap(500)])) {
      expect(hit.confidence).toBe(1);
    }
  });

  it('claims nothing about what it sounded like', () => {
    // Nothing about a finger says where the energy sat. The kind is what was
    // chosen; the timbre is the player's to decide (INV-PITCH-020).
    const [hit] = hitsFromTaps([tap(0, 'hiss')]);
    expect(hit.kind).toBe('hiss');
    expect(hit.centroidHz).toBeNull();
    expect(hit.flatness).toBeNull();
  });

  it('keeps what was tapped where it was tapped, unless asked otherwise', () => {
    // A tap is already exact. Rounding it is a claim about intent rather than
    // about timing, so it is asked for rather than assumed.
    expect(hitsFromTaps([tap(507)], GRID)[0].atMs).toBe(507);
    expect(hitsFromTaps([tap(507)], GRID, { snapToGrid: true })[0].atMs).toBe(
      500
    );
  });

  it('reads a bouncing finger as one press', () => {
    expect(hitsFromTaps([tap(500), tap(515), tap(530)])).toHaveLength(1);
  });

  it('does not stack two taps snapped onto one step', () => {
    const hits = hitsFromTaps([tap(495), tap(505)], GRID, { snapToGrid: true });
    expect(hits).toHaveLength(1);
  });

  it('takes them in time order however they arrive', () => {
    expect(hitsFromTaps([tap(900), tap(100)]).map((h) => h.atMs)).toEqual([
      100, 900
    ]);
  });

  it('never places one before the recording began', () => {
    expect(hitsFromTaps([tap(-200)])[0].atMs).toBe(0);
  });

  it('has nothing to say about a take nobody tapped', () => {
    expect(hitsFromTaps([])).toEqual([]);
  });
});

describe('tapped and sung together', () => {
  it('keeps both where they do not collide', () => {
    const merged = mergeHits([heard(1000)], hitsFromTaps([tap(0)]));
    expect(merged.map((h) => h.atMs)).toEqual([0, 1000]);
  });

  it('lets the tap win where they describe one moment', () => {
    // A tap is a statement and a detected hit is a reading. Where the two
    // disagree about one moment, the statement is the one to keep.
    const merged = mergeHits([heard(1000)], hitsFromTaps([tap(1010)]));
    expect(merged).toHaveLength(1);
    expect(merged[0].confidence).toBe(1);
  });

  it('leaves a take with no taps exactly as it was read', () => {
    const detected = [heard(0), heard(500)];
    expect(mergeHits(detected, [])).toEqual(detected);
  });

  it('gives back a take that was only tapped', () => {
    expect(mergeHits([], hitsFromTaps([tap(0), tap(500)]))).toHaveLength(2);
  });
});
