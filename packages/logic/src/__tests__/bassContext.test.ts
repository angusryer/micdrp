/**
 * INV-NOTES-071 / INV-NOTES-072 — a second take as evidence about harmony.
 *
 * The claim being tested is that a sung bass settles the two weakest
 * inferences in the pipeline: which chord, and when it changes. The tests
 * that matter most are the ones proving it changes nothing when there is no
 * layer — a feature that quietly altered every existing reading would be
 * worse than no feature.
 */
import {
  alignLayer,
  countIn,
  bassChangeTimes,
  bassPitchClassOver,
  bassSpans
} from '../bassContext';
import { chordForSpan } from '../chordMatch';
import { proposeDownbeats } from '../downbeats';
import type { NoteEvent } from '../segmentation';

const note = (midi: number, startMs: number, endMs: number): NoteEvent =>
  ({
    midi,
    startMs,
    endMs,
    durationMs: endMs - startMs,
    cents: 0,
    clarity: 1
  }) as NoteEvent;

const GRID = {
  bpm: 120,
  offsetMs: 0,
  beatsPerBar: 4,
  stepsPerBeat: 4
} as unknown as Parameters<typeof proposeDownbeats>[1];

describe('reading a sung bass', () => {
  it('joins repeats of one pitch class into a single chord', () => {
    // A bass restating the root four times through a bar is one chord. Read
    // as four, it would put a downbeat on every note of it.
    const spans = bassSpans([
      note(48, 0, 200),
      note(48, 250, 450),
      note(48, 500, 700),
      note(53, 1000, 1400)
    ]);
    expect(spans).toHaveLength(2);
    expect(spans[0].pitchClass).toBe(0);
    expect(spans[1].pitchClass).toBe(5);
  });

  it('ignores octave, so it can be hummed anywhere comfortable', () => {
    const low = bassSpans([note(36, 0, 400)]);
    const high = bassSpans([note(60, 0, 400)]);
    expect(low[0].pitchClass).toBe(high[0].pitchClass);
  });

  it('takes whichever root holds longest across a span', () => {
    const spans = bassSpans([note(48, 0, 900), note(55, 900, 1000)]);
    expect(bassPitchClassOver(spans, 0, 1000)).toBe(0);
  });

  it('says nothing where the layer is silent', () => {
    const spans = bassSpans([note(48, 0, 400)]);
    expect(bassPitchClassOver(spans, 5000, 6000)).toBeNull();
  });
});

describe('INV-NOTES-071: a sung root decides the chord', () => {
  // C and E sound over this span — the third of C, but also the fifth of A
  // minor and the root of E. The melody alone cannot say which.
  const ambiguous = [note(60, 0, 500), note(64, 500, 1000)];

  it('settles a span the melody leaves open', () => {
    const asAm = chordForSpan(ambiguous, 0, 1000, { bassPc: 9 });
    const asC = chordForSpan(ambiguous, 0, 1000, { bassPc: 0 });
    expect(asAm?.rootPc).toBe(9);
    expect(asC?.rootPc).toBe(0);
  });

  it('leaves a span the layer does not cover exactly as it was', () => {
    const withoutLayer = chordForSpan(ambiguous, 0, 1000);
    const layerSilent = chordForSpan(ambiguous, 0, 1000, { bassPc: null });
    expect(layerSilent).toEqual(withoutLayer);
  });

  it('does not overrule a melody that plainly states another chord', () => {
    // A full F major triad sung out. A bass on B is a tritone away and
    // belongs to no reading of these notes.
    const stated = [note(65, 0, 400), note(69, 400, 800), note(72, 800, 1200)];
    const read = chordForSpan(stated, 0, 1200, { bassPc: 11 });
    expect(read?.rootPc).toBe(5);
  });
});

describe('INV-NOTES-072: where the bass moves is where the chord changes', () => {
  const melody = [
    note(60, 0, 500),
    note(62, 500, 1000),
    note(64, 1000, 1500),
    note(65, 1500, 2000),
    note(67, 2000, 2500),
    note(69, 2500, 3000)
  ];

  it('follows the layer rather than the melody', () => {
    const bass = [note(48, 0, 1500), note(53, 1500, 3000)];
    const steps = proposeDownbeats(melody, GRID, { bass });
    // One chord from the start, another where the bass moves at 1500ms:
    // 1500ms at 120bpm with 4 steps per beat is step 12.
    expect(steps).toEqual([0, 12]);
  });

  it('proposes one downbeat for a layer that never moves', () => {
    const steps = proposeDownbeats(melody, GRID, {
      bass: [note(48, 0, 3000)]
    });
    expect(steps).toEqual([0]);
  });

  it('leaves the melodic reading untouched when there is no layer', () => {
    const withNothing = proposeDownbeats(melody, GRID);
    expect(proposeDownbeats(melody, GRID, { bass: [] })).toEqual(withNothing);
    expect(proposeDownbeats(melody, GRID, {})).toEqual(withNothing);
  });

  it('every stretch begins a chord, the first included', () => {
    const spans = bassSpans([note(48, 250, 800), note(50, 800, 1200)]);
    expect(bassChangeTimes(spans)).toEqual([250, 800]);
  });
});

describe('INV-NOTES-074: placing an overdub where it was sung', () => {
  const heard = [note(48, 120, 620), note(53, 620, 1120)];

  it('moves every timing earlier by the round trip', () => {
    const placed = alignLayer(heard, 100);
    expect(placed[0].startMs).toBe(20);
    expect(placed[0].endMs).toBe(520);
    expect(placed[1].startMs).toBe(520);
  });

  it('keeps each note as long as it was', () => {
    const placed = alignLayer(heard, 100);
    placed.forEach((n, i) => {
      expect(n.endMs - n.startMs).toBe(heard[i].endMs - heard[i].startMs);
      expect(n.durationMs).toBe(n.endMs - n.startMs);
    });
  });

  it('corrects a layer sung with nothing playing by nothing at all', () => {
    // The session reports 0 when it will not say, and a wrong correction is
    // worse than none.
    expect(alignLayer(heard, 0)).toEqual(heard);
    expect(alignLayer(heard, -5)).toEqual(heard);
  });

  it('clamps rather than drops a note that would land before the take', () => {
    const early = alignLayer([note(48, 30, 200)], 100);
    expect(early[0].startMs).toBe(0);
    expect(early).toHaveLength(1);
  });
});

describe('INV-NOTES-088: counting a second voice in', () => {
  it('counts back from the first note at the take\'s own tempo', () => {
    // 120bpm is a beat every 500ms, and 2s of pickup holds all four.
    const { clicks, leadInMs } = countIn(2000, 120);
    expect(leadInMs).toBe(0);
    expect(clicks.map((c) => c.startMs)).toEqual([0, 500, 1000, 1500, 2000]);
  });

  it('marks the beat you come in on differently from the ones before it', () => {
    const { clicks } = countIn(2000, 120);
    const last = clicks[clicks.length - 1];
    expect(last.startMs).toBe(2000);
    expect(last.midi).not.toBe(clicks[0].midi);
  });

  it('delays the take rather than cutting the count short', () => {
    // Only 600ms of pickup, but four beats need 2000ms — so the take waits
    // 1400ms and the count is still four beats.
    const { clicks, leadInMs } = countIn(600, 120);
    expect(leadInMs).toBe(1400);
    expect(clicks).toHaveLength(5);
    expect(clicks[0].startMs).toBe(0);
    // The singer still comes in where the take's first note now falls.
    expect(clicks[clicks.length - 1].startMs).toBe(600 + 1400);
  });

  it('counts a take in that begins immediately', () => {
    // The case that matters: most takes start near their first note, and
    // that is exactly when a second voice most needs telling when to come in.
    const { clicks, leadInMs } = countIn(0, 120);
    expect(leadInMs).toBe(2000);
    expect(clicks).toHaveLength(5);
    expect(clicks.every((c) => c.startMs >= 0)).toBe(true);
  });

  it('says nothing when the take has no tempo to count at', () => {
    expect(countIn(2000, 0)).toEqual({ clicks: [], leadInMs: 0 });
  });

  it('never counts more beats than it was asked for', () => {
    expect(countIn(60000, 120, 4).clicks).toHaveLength(5);
  });
});
