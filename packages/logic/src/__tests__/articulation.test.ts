/**
 * INV-PITCH-023 — a re-articulated note is a new note.
 *
 * "da da da da" on one pitch, fast, came back as a single held note. Nothing
 * in the reading was wrong on its own terms: the segmenter splits on a change
 * of PITCH, and the pitch never changed. The articulation is not in the pitch
 * at all — it is in the envelope, and until every frame carried a level
 * (INV-PITCH-020) there was nothing to read it from.
 *
 * Three things had to agree for it to survive the pipeline: the segmenter has
 * to split on the silence, the bend merger has to leave the pieces apart, and
 * the brevity filter has to stop treating "short" as "not meant".
 */
import { dropTooBriefToSing, mergeBends } from '../bends';
import { segmentNotes, type PitchFrame } from '../segmentation';

/** One frame every 10ms, which is about what a 1024 hop gives at 44.1kHz. */
const HOP = 10;

/**
 * A run of short notes on one pitch, each sounding then stopping — a tongued
 * "da da da" rather than one held note.
 */
function staccato(options: {
  midi: number;
  slotMs: number;
  soundMs: number;
  count: number;
  levelDb?: number;
  /** How quiet the stop between them is. A real stop is very quiet. */
  gapDb?: number;
}): PitchFrame[] {
  const { midi, slotMs, soundMs, count, levelDb = -12, gapDb = -70 } = options;
  const frames: PitchFrame[] = [];
  for (let i = 0; i < count; i++) {
    const from = i * slotMs;
    for (let t = 0; t < slotMs; t += HOP) {
      const sounding = t < soundMs;
      frames.push({
        timestampMs: from + t,
        midi: sounding ? midi : null,
        cents: sounding ? 0 : null,
        clarity: sounding ? 1 : 0,
        levelDb: sounding ? levelDb : gapDb
      });
    }
  }
  return frames;
}

/** The same pitch held right through, with the detector flickering out. */
function heldWithDropouts(midi: number, ms: number): PitchFrame[] {
  const frames: PitchFrame[] = [];
  for (let t = 0; t < ms; t += HOP) {
    // Every so often the detector loses confidence for a frame or two while
    // the singer is plainly still singing — the level does not move.
    const flicker = t % 200 === 0 || t % 200 === HOP;
    frames.push({
      timestampMs: t,
      midi: flicker ? null : midi,
      cents: flicker ? null : 0,
      clarity: flicker ? 0 : 1,
      levelDb: -12
    });
  }
  return frames;
}

/** What the capture pipeline actually does with a take, in order. */
const read = (frames: PitchFrame[]) =>
  dropTooBriefToSing(mergeBends(segmentNotes(frames)));

describe('notes that were tongued rather than held', () => {
  // Sixteenths at 120bpm: a slot every 125ms, sounding for 70 of it.
  const DA_DA_DA = staccato({
    midi: 62,
    slotMs: 125,
    soundMs: 70,
    count: 8
  });

  it('reads eight notes, not one long one', () => {
    expect(read(DA_DA_DA)).toHaveLength(8);
  });

  it('puts each one where it was sung', () => {
    const notes = read(DA_DA_DA);
    notes.forEach((note, i) => {
      expect(note.startMs).toBeCloseTo(i * 125, -1);
    });
  });

  it('keeps them short, rather than filling the gaps', () => {
    for (const note of read(DA_DA_DA)) {
      expect(note.durationMs).toBeLessThan(125);
    }
  });

  it('reads them at the pitch they were sung', () => {
    for (const note of read(DA_DA_DA)) {
      expect(note.midi).toBe(62);
    }
  });
});

describe('what must not be split', () => {
  it('leaves a held note whole when the detector merely flickers', () => {
    // The distinction that makes this safe. A stop consonant collapses the
    // level; a detector losing confidence does not move it at all, and
    // splitting there would shatter every sustained note in the app.
    expect(read(heldWithDropouts(62, 1200))).toHaveLength(1);
  });

  it('leaves a held note whole when nothing measured the level', () => {
    // Takes from before levels existed keep exactly the reading they had.
    const unmeasured = heldWithDropouts(62, 1200).map((f) => ({
      ...f,
      levelDb: undefined
    }));
    expect(read(unmeasured)).toHaveLength(1);
  });

  it('does not split on the ordinary swell of a sung note', () => {
    // A voice is not a constant amplitude. A few dB of movement inside one
    // note is singing, not articulation.
    const swelling = heldWithDropouts(62, 1200).map((f, i) => ({
      ...f,
      levelDb: -14 + Math.sin(i / 6) * 3
    }));
    expect(read(swelling)).toHaveLength(1);
  });
});

/**
 * A breathy re-attack: "ha ha ha". There is no stop consonant, so the level
 * never collapses to silence and the frames stay voiced throughout. What
 * marks each new note is the rise — a dip and a fast climb back, inside one
 * held pitch (INV-PITCH-024).
 */
function aspirated(options: {
  midi: number;
  slotMs: number;
  count: number;
  peakDb?: number;
  troughDb?: number;
}): PitchFrame[] {
  const { midi, slotMs, count, peakDb = -10, troughDb = -24 } = options;
  const frames: PitchFrame[] = [];
  for (let i = 0; i < count; i++) {
    for (let t = 0; t < slotMs; t += HOP) {
      // Quiet at the very start of each breath, then up and held.
      const inBreath = t < 40;
      frames.push({
        timestampMs: i * slotMs + t,
        midi,
        cents: 0,
        clarity: 1,
        levelDb: inBreath ? troughDb : peakDb
      });
    }
  }
  return frames;
}

describe('notes re-attacked on the breath', () => {
  const HA_HA_HA = aspirated({ midi: 62, slotMs: 300, count: 4 });

  it('reads four notes, not one held one', () => {
    // Nothing goes silent and nothing changes pitch. The only evidence that
    // these are separate notes is how sharply the level climbs.
    expect(read(HA_HA_HA)).toHaveLength(4);
  });

  it('starts each one where the breath pushed', () => {
    read(HA_HA_HA).forEach((note, i) => {
      expect(note.startMs).toBeCloseTo(i * 300, -2);
    });
  });

  it('does not split a note that merely swells into itself', () => {
    // A crescendo covers the same distance over a much longer stretch. The
    // difference between a re-attack and a swell is entirely how fast.
    const swell: PitchFrame[] = [];
    for (let t = 0; t < 1600; t += HOP) {
      swell.push({
        timestampMs: t,
        midi: 62,
        cents: 0,
        clarity: 1,
        levelDb: -30 + (20 * t) / 1600
      });
    }
    expect(read(swell)).toHaveLength(1);
  });

  it('leaves takes with no measured level exactly as they were', () => {
    const unmeasured = HA_HA_HA.map((f) => ({ ...f, levelDb: undefined }));
    expect(read(unmeasured)).toHaveLength(1);
  });
});
