/**
 * ACC-NOTES-232 / ACC-NOTES-233 — INV-NOTES-218, INV-NOTES-219.
 *
 * The offered patterns were four-four and three-four. A phrase sung in
 * six-eight and tapped on one, three and five is none of them, and there was
 * no way to say so — the only sentences available were ones somebody else
 * had written down.
 *
 * The point of supplying the meaning after the singing is that the singer
 * knows what the taps were for. A closed list takes that back.
 */
import {
  MAX_BEATS_PER_BAR,
  MIN_BEATS_PER_BAR,
  isUsablePattern,
  tempoFromPattern,
  withBeatToggled,
  withBeatsPerBar,
  type TapPattern
} from '..';

const SIX_EIGHT: TapPattern = { beats: [1, 3, 5], beatsPerBar: 6 };

describe('ACC-NOTES-232: a pattern no preset contains', () => {
  it('is one a bar can hold', () => {
    expect(isUsablePattern(SIX_EIGHT)).toBe(true);
  });

  it('is built by choosing beats one at a time', () => {
    let pattern: TapPattern = withBeatsPerBar(
      { beats: [1], beatsPerBar: 4 },
      6
    );
    pattern = withBeatToggled(pattern, 3);
    pattern = withBeatToggled(pattern, 5);
    expect(pattern).toEqual(SIX_EIGHT);
  });

  it('reads a tempo from taps that sit on it', () => {
    // Taps on beats 1, 3 and 5 of a six-beat bar at 120 beats a minute:
    // 500ms a beat, so 0, 1000, 2000, then 3000 for beat 7.
    const taps = [0, 1000, 2000, 3000].map((atMs) => ({ atMs }));
    const tempo = tempoFromPattern(taps, SIX_EIGHT);
    expect(tempo).not.toBeNull();
    expect(Math.round(tempo!.bpm)).toBe(120);
    expect(tempo!.beatsPerBar).toBe(6);
  });

  it('puts the downbeat where these beats put it, not where 2-and-4 would', () => {
    // The whole reason the pattern has to be sayable. Against 2 and 4 of 4
    // the taps space the same way, so the rate is identical — what moves is
    // the bar: tapping beat one means the first tap IS a downbeat, and
    // tapping two and four means the downbeat is a beat before it.
    const taps = [0, 1000, 2000, 3000].map((atMs) => ({ atMs }));
    const six = tempoFromPattern(taps, SIX_EIGHT)!;
    const four = tempoFromPattern(taps, { beats: [2, 4], beatsPerBar: 4 })!;
    expect(Math.round(six.offsetMs)).toBe(0);
    expect(Math.round(four.offsetMs)).toBe(-500);
    expect(six.beatsPerBar).not.toBe(four.beatsPerBar);
  });

  it('reads a different rate where the beats are spaced differently', () => {
    // One bar's worth of taps, a second apart. Read as beats 1, 3 and 5 they
    // are two beats apart, so a beat is 500ms; read as 1, 2 and 3 they are
    // one beat apart, so a beat is a second. Same taps, half the tempo —
    // which is the mistake a closed list of patterns forces on a take it
    // does not happen to describe.
    const taps = [0, 1000, 2000].map((atMs) => ({ atMs }));
    const six = tempoFromPattern(taps, SIX_EIGHT)!;
    const four = tempoFromPattern(taps, { beats: [1, 2, 3], beatsPerBar: 4 })!;
    expect(Math.round(six.bpm)).toBe(120);
    expect(Math.round(four.bpm)).toBe(60);
  });
});

describe('ACC-NOTES-233: changing how long the bar is', () => {
  it('drops the beats that no longer fit', () => {
    expect(withBeatsPerBar(SIX_EIGHT, 4)).toEqual({
      beats: [1, 3],
      beatsPerBar: 4
    });
  });

  it('keeps the ones that do, in order', () => {
    expect(withBeatsPerBar(SIX_EIGHT, 8).beats).toEqual([1, 3, 5]);
  });

  it('never leaves a bar with nothing tapped in it', () => {
    // Beat one, which is what somebody shortening a bar almost always still
    // means (INV-NOTES-219).
    expect(withBeatsPerBar({ beats: [5, 6], beatsPerBar: 6 }, 3)).toEqual({
      beats: [1],
      beatsPerBar: 3
    });
  });

  it('refuses a bar shorter than one beat or longer than the row', () => {
    expect(withBeatsPerBar(SIX_EIGHT, 0).beatsPerBar).toBe(MIN_BEATS_PER_BAR);
    expect(withBeatsPerBar(SIX_EIGHT, 99).beatsPerBar).toBe(MAX_BEATS_PER_BAR);
  });

  it('refuses a bar length that is not a count', () => {
    expect(withBeatsPerBar(SIX_EIGHT, Number.NaN).beatsPerBar).toBe(
      MIN_BEATS_PER_BAR
    );
    expect(withBeatsPerBar(SIX_EIGHT, 4.4).beatsPerBar).toBe(4);
  });

  it('leaves what it returns usable', () => {
    for (let n = 1; n <= MAX_BEATS_PER_BAR; n += 1) {
      expect(isUsablePattern(withBeatsPerBar(SIX_EIGHT, n))).toBe(true);
    }
  });
});

describe('choosing which beats were tapped', () => {
  it('adds one that was not chosen, in order', () => {
    expect(withBeatToggled(SIX_EIGHT, 2).beats).toEqual([1, 2, 3, 5]);
  });

  it('removes one that was', () => {
    expect(withBeatToggled(SIX_EIGHT, 3).beats).toEqual([1, 5]);
  });

  it('INV-NOTES-219: refuses to remove the last one', () => {
    // "The taps say nothing" is a real answer with a control of its own. It
    // must not also be reachable by turning off the last beat, where it
    // would look like a pattern that had stopped working.
    const one: TapPattern = { beats: [3], beatsPerBar: 4 };
    expect(withBeatToggled(one, 3)).toEqual(one);
  });

  it('ignores a beat the bar does not have', () => {
    expect(withBeatToggled(SIX_EIGHT, 7)).toEqual(SIX_EIGHT);
    expect(withBeatToggled(SIX_EIGHT, 0)).toEqual(SIX_EIGHT);
    expect(withBeatToggled(SIX_EIGHT, 2.5)).toEqual(SIX_EIGHT);
  });

  it('starts a pattern from nothing chosen', () => {
    // Which is what the editor shows before anybody has said anything.
    const unsaid: TapPattern = { beats: [], beatsPerBar: 4 };
    expect(withBeatToggled(unsaid, 3)).toEqual({
      beats: [3],
      beatsPerBar: 4
    });
  });

  it('leaves what it returns usable', () => {
    let pattern = SIX_EIGHT;
    for (const beat of [2, 4, 6, 1, 3]) {
      pattern = withBeatToggled(pattern, beat);
      expect(isUsablePattern(pattern)).toBe(true);
    }
  });
});
