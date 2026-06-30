import {
  layoutMelody,
  pitchBounds,
  type MelodyNote
} from '../melodyLayout';

function note(midi: number, startMs: number, endMs: number): MelodyNote {
  return { midi, startMs, endMs };
}

describe('pitchBounds', () => {
  it('pads a normal range by a semitone each side', () => {
    expect(pitchBounds([note(60, 0, 1), note(67, 1, 2)])).toEqual({
      low: 59,
      high: 68
    });
  });

  it('widens a near-monotone melody to a centred window', () => {
    const b = pitchBounds([note(60, 0, 1), note(60, 1, 2)]);
    expect(b.low).toBeLessThanOrEqual(58);
    expect(b.high).toBeGreaterThanOrEqual(62);
  });

  it('handles an empty melody', () => {
    expect(pitchBounds([])).toEqual({ low: -2, high: 2 });
  });
});

describe('layoutMelody', () => {
  const W = 300;
  const H = 100;

  it('runs time left→right and pitch bottom→top', () => {
    const notes = [note(60, 0, 500), note(64, 500, 1000), note(67, 1000, 1500)];
    const { rects } = layoutMelody(notes, { width: W, height: H });

    expect(rects).toHaveLength(3);
    // Time increases → x increases.
    expect(rects[0].x).toBeLessThan(rects[1].x);
    expect(rects[1].x).toBeLessThan(rects[2].x);
    // Higher pitch → smaller y (towards the top).
    expect(rects[0].cy).toBeGreaterThan(rects[1].cy);
    expect(rects[1].cy).toBeGreaterThan(rects[2].cy);
  });

  it('keeps every bar inside the padded canvas', () => {
    const notes = [note(55, 0, 300), note(72, 300, 900)];
    const { rects } = layoutMelody(notes, { width: W, height: H, padding: 6 });
    for (const r of rects) {
      expect(r.x).toBeGreaterThanOrEqual(6 - 0.001);
      expect(r.x + r.width).toBeLessThanOrEqual(W - 6 + 0.001);
      expect(r.y).toBeGreaterThanOrEqual(6 - 0.001);
      expect(r.y + r.height).toBeLessThanOrEqual(H - 6 + 0.001);
    }
  });

  it('scales bar width with note duration', () => {
    const notes = [note(60, 0, 200), note(62, 200, 1000)]; // 200ms then 800ms
    const { rects } = layoutMelody(notes, { width: W, height: H, padding: 0 });
    expect(rects[1].width).toBeGreaterThan(rects[0].width);
  });

  it('is stable on an empty melody', () => {
    const { rects, midiLow, midiHigh } = layoutMelody([], {
      width: W,
      height: H
    });
    expect(rects).toEqual([]);
    expect(midiHigh).toBeGreaterThan(midiLow);
  });
});
