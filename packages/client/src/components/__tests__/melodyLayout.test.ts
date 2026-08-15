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

describe('layoutMelody — grid rules', () => {
  const grid = { bpm: 120, offsetMs: 0, beatsPerBar: 4 };
  // 8 beats at 120bpm = 4000ms, i.e. two full bars.
  const twoBars = [
    { midi: 60, startMs: 0, endMs: 500 },
    { midi: 62, startMs: 2000, endMs: 2500 },
    { midi: 64, startMs: 3500, endMs: 4000 }
  ];

  it('draws no rules unless a grid is supplied', () => {
    const layout = layoutMelody(twoBars, { width: 300, height: 100 });
    expect(layout.gridLines).toEqual([]);
  });

  it('marks bar lines every beatsPerBar beats', () => {
    const layout = layoutMelody(twoBars, { width: 300, height: 100, grid });
    const bars = layout.gridLines.filter((g) => g.isBar);
    // Bar lines at 0ms and 2000ms and 4000ms across a 0-4000ms span.
    expect(bars.map((b) => b.bar)).toEqual([1, 2, 3]);
    expect(layout.gridLines.some((g) => !g.isBar)).toBe(true);
  });

  it('places rules on the same time scale as the notes', () => {
    const layout = layoutMelody(twoBars, { width: 300, height: 100, grid });
    const secondBar = layout.gridLines.find((g) => g.bar === 2)!;
    // 2000ms is halfway through the 0-4000ms span, as is the second note.
    expect(secondBar.x).toBeCloseTo(layout.rects[1].x, 5);
  });

  it('keeps every rule inside the drawn area', () => {
    const layout = layoutMelody(twoBars, { width: 300, height: 100, grid });
    for (const line of layout.gridLines) {
      expect(line.x).toBeGreaterThanOrEqual(0);
      expect(line.x).toBeLessThanOrEqual(300);
    }
  });

  // A long take at speed implies hundreds of beats, which at phone width is a
  // grey wash. Past the cap the beats go and the bar lines stay.
  it('drops beat rules but keeps bar lines on a long take', () => {
    const long = [
      { midi: 60, startMs: 0, endMs: 400 },
      { midi: 62, startMs: 120000, endMs: 120400 }
    ];
    const layout = layoutMelody(long, { width: 300, height: 100, grid });
    expect(layout.gridLines.every((g) => g.isBar)).toBe(true);
    expect(layout.gridLines.length).toBeGreaterThan(0);
  });

  it('ignores a grid with no usable tempo', () => {
    const layout = layoutMelody(twoBars, {
      width: 300,
      height: 100,
      grid: { bpm: 0, offsetMs: 0, beatsPerBar: 4 }
    });
    expect(layout.gridLines).toEqual([]);
  });
});
