/**
 * INV-PITCH-020 — how loud each note was, and the difference between quiet
 * and unmeasured.
 *
 * The point of keeping it is that accent is a ratio: what makes the stressed
 * beat of a count-in the stressed one is how many times louder it was than
 * its neighbours. That only survives if the reading is in dB, if it reaches
 * the note through every stage that rebuilds a frame or folds two notes, and
 * if a note nobody measured says so rather than reporting silence.
 *
 * The stage that actually broke was the smoothing: it rebuilt each frame
 * field by field, so the level was dropped before segmentation ever saw it,
 * and every note came out unmeasured with nothing to indicate why.
 */
import { mergeBends } from '../bends';
import { segmentNotes, type PitchFrame } from '../segmentation';
import { smoothPitch } from '../smoothing';

/** A steady note at one pitch and one level, as hop-spaced frames. */
function held(
  midi: number,
  fromMs: number,
  toMs: number,
  levelDb?: number
): PitchFrame[] {
  const frames: PitchFrame[] = [];
  for (let t = fromMs; t < toMs; t += 20) {
    frames.push({ timestampMs: t, midi, cents: 0, clarity: 1, levelDb });
  }
  return frames;
}

const silence = (fromMs: number, toMs: number): PitchFrame[] =>
  Array.from({ length: Math.ceil((toMs - fromMs) / 20) }, (_, i) => ({
    timestampMs: fromMs + i * 20,
    midi: null,
    cents: null,
    clarity: 0
  }));

describe('how loud a note was', () => {
  it('reports the level the frames were heard at', () => {
    const [note] = segmentNotes(held(60, 0, 500, -12));
    expect(note.loudnessDb).toBeCloseTo(-12, 6);
  });

  it('keeps one note louder than another, which is what accent is', () => {
    // A count-in is read from exactly this: the stressed beat is the one
    // several dB above the ones around it.
    const notes = segmentNotes([
      ...held(60, 0, 400, -8),
      ...silence(400, 600),
      ...held(60, 600, 1000, -20)
    ]);
    expect(notes).toHaveLength(2);
    expect((notes[0].loudnessDb ?? 0) - (notes[1].loudnessDb ?? 0)).toBeCloseTo(
      12,
      6
    );
  });

  it('says nothing measured it, rather than saying it was silent', () => {
    // Different claims. One is about the singing; the other is about the
    // engine that heard it, which may be older than this bundle.
    const [note] = segmentNotes(held(60, 0, 500));
    expect(note.loudnessDb).toBeNull();
  });

  it('survives the smoothing that runs before it', () => {
    // The smoothing rebuilds every frame to decide which note was sung. How
    // loud it was is not something a median over neighbours can improve, and
    // dropping it here emptied the loudness of every note in the take.
    const [note] = segmentNotes(smoothPitch(held(60, 0, 500, -15)));
    expect(note.loudnessDb).toBeCloseTo(-15, 6);
  });

  it('ignores frames with no reading rather than counting them as silent', () => {
    // Half measured at -10, half not. The answer is -10, not the average of
    // -10 and nothing.
    const frames = held(60, 0, 400, -10).map((f, i) =>
      i % 2 === 0 ? f : { ...f, levelDb: undefined }
    );
    expect(segmentNotes(frames)[0].loudnessDb).toBeCloseTo(-10, 6);
  });
});

describe('loudness through a bend', () => {
  it('weighs the parts by how long each lasted', () => {
    // One note bending, so the loudness of the whole is the loudness of the
    // sustained part rather than of the scoop into it.
    const [note] = mergeBends(
      segmentNotes([
        ...held(60, 0, 100, -30),
        ...held(61, 100, 900, -10)
      ])
    );
    expect(note.loudnessDb).toBeGreaterThan(-15);
    expect(note.loudnessDb).toBeLessThan(-10);
  });

  it('is not dragged towards silence by a part nobody measured', () => {
    const [note] = mergeBends(
      segmentNotes([...held(60, 0, 100), ...held(61, 100, 900, -10)])
    );
    expect(note.loudnessDb).toBeCloseTo(-10, 6);
  });

  it('stays unknown when neither part was measured', () => {
    const [note] = mergeBends(
      segmentNotes([...held(60, 0, 100), ...held(61, 100, 900)])
    );
    expect(note.loudnessDb).toBeNull();
  });
});
