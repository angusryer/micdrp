/**
 * INV-PITCH-025 — the sounds in a take that are hits rather than notes.
 *
 * A mouth drum is not a badly sung note. It has no pitch to report and
 * nothing for the harmony to read, and until now every one was discarded
 * twice: the voicing floor threw it out for having no periodicity, and the
 * brevity filter threw out whatever survived for being too short.
 *
 * What kind of hit it was comes from brightness alone. A "puh" and a "tss"
 * are both unvoiced and both brief; nothing else the engine reports
 * distinguishes them.
 */
import { readPercussion, type Hit } from '../percussion';
import type { PitchFrame } from '../segmentation';

const HOP = 10;

/** An unpitched burst: loud, brief, and at a given brightness. */
function hit(options: {
  atMs: number;
  durationMs: number;
  levelDb?: number;
  brightnessHz?: number;
}): PitchFrame[] {
  const { atMs, durationMs, levelDb = -14, brightnessHz = 1500 } = options;
  const frames: PitchFrame[] = [];
  for (let t = 0; t < durationMs; t += HOP) {
    frames.push({
      timestampMs: atMs + t,
      midi: null,
      cents: null,
      clarity: 0.1,
      levelDb,
      brightnessHz
    });
  }
  return frames;
}

/** Silence, which separates one hit from the next. */
const quiet = (fromMs: number, toMs: number): PitchFrame[] =>
  Array.from({ length: Math.ceil((toMs - fromMs) / HOP) }, (_, i) => ({
    timestampMs: fromMs + i * HOP,
    midi: null,
    cents: null,
    clarity: 0,
    levelDb: -75,
    brightnessHz: 0
  }));

/** A sung note: pitched, clear, and held. */
const sung = (fromMs: number, toMs: number): PitchFrame[] =>
  Array.from({ length: Math.ceil((toMs - fromMs) / HOP) }, (_, i) => ({
    timestampMs: fromMs + i * HOP,
    midi: 62,
    cents: 0,
    clarity: 0.95,
    levelDb: -14,
    brightnessHz: 294
  }));

const kinds = (hits: Hit[]) => hits.map((h) => h.kind);

describe('hits in a take', () => {
  it('finds each burst, and only as many as there were', () => {
    const frames = [
      ...hit({ atMs: 0, durationMs: 60 }),
      ...quiet(60, 300),
      ...hit({ atMs: 300, durationMs: 60 }),
      ...quiet(360, 600),
      ...hit({ atMs: 600, durationMs: 60 })
    ];
    const found = readPercussion(frames);
    expect(found).toHaveLength(3);
    expect(found.map((h) => h.atMs)).toEqual([0, 300, 600]);
  });

  it('tells a thump from a tap from a hiss, by brightness alone', () => {
    // The whole reason brightness is measured. Every other reading is the
    // same for all three.
    const frames = [
      ...hit({ atMs: 0, durationMs: 50, brightnessHz: 300 }),
      ...quiet(50, 200),
      ...hit({ atMs: 200, durationMs: 50, brightnessHz: 1800 }),
      ...quiet(250, 400),
      ...hit({ atMs: 400, durationMs: 50, brightnessHz: 6000 })
    ];
    expect(kinds(readPercussion(frames))).toEqual(['thump', 'tap', 'hiss']);
  });

  it('says how hard it was struck', () => {
    const soft = readPercussion(hit({ atMs: 0, durationMs: 50, levelDb: -30 }));
    const hard = readPercussion(hit({ atMs: 0, durationMs: 50, levelDb: -8 }));
    expect(hard[0].loudnessDb).toBeGreaterThan(soft[0].loudnessDb);
  });

  it('is surer of a shorter burst', () => {
    const brief = readPercussion(hit({ atMs: 0, durationMs: 30 }));
    const long = readPercussion(hit({ atMs: 0, durationMs: 120 }));
    expect(brief[0].confidence).toBeGreaterThan(long[0].confidence);
  });
});

describe('what is not a hit', () => {
  it('ignores a sung note, however loud', () => {
    expect(readPercussion(sung(0, 800))).toEqual([]);
  });

  it('ignores silence, which is unpitched but not a sound', () => {
    expect(readPercussion(quiet(0, 800))).toEqual([]);
  });

  it('ignores an unpitched stretch too long to have been struck', () => {
    // A breathy sigh is unvoiced and loud and lasts a second. It is not a
    // drum, and calling it one would fill every take with phantom hits.
    expect(readPercussion(hit({ atMs: 0, durationMs: 900 }))).toEqual([]);
  });

  it('finds nothing at all when the level was never measured', () => {
    // Without loudness there is no telling a hit from the detector losing
    // the pitch for a moment. Takes from before levels existed stay as they
    // were rather than sprouting drums.
    const unmeasured = hit({ atMs: 0, durationMs: 50 }).map((f) => ({
      ...f,
      levelDb: undefined
    }));
    expect(readPercussion(unmeasured)).toEqual([]);
  });

  it('says it does not know the kind when brightness is absent', () => {
    // An older binary reports no brightness. A hit is still a hit; what it
    // sounded like is simply unknown, which is not the same as a thump.
    const noBrightness = hit({ atMs: 0, durationMs: 50 }).map((f) => ({
      ...f,
      brightnessHz: undefined
    }));
    const found = readPercussion(noBrightness);
    expect(found).toHaveLength(1);
    expect(found[0].kind).toBe('unknown');
    expect(found[0].brightnessHz).toBeNull();
  });

  it('does not read silence as the darkest possible thump', () => {
    // Brightness is zero when there was no rate worth stating, and averaging
    // that in would drag every hit towards "thump".
    const patchy = hit({ atMs: 0, durationMs: 50, brightnessHz: 6000 }).map(
      (f, i) => (i % 2 === 0 ? f : { ...f, brightnessHz: 0 })
    );
    expect(readPercussion(patchy)[0].kind).toBe('hiss');
  });
});

describe('a take that mixes the two', () => {
  it('reads the hits and leaves the singing alone', () => {
    const frames = [
      ...hit({ atMs: 0, durationMs: 50, brightnessHz: 300 }),
      ...quiet(50, 200),
      ...sung(200, 900),
      ...quiet(900, 1000),
      ...hit({ atMs: 1000, durationMs: 50, brightnessHz: 6000 })
    ];
    const found = readPercussion(frames);
    expect(found).toHaveLength(2);
    expect(kinds(found)).toEqual(['thump', 'hiss']);
  });
});
