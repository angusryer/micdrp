/**
 * Hearing a take as sung or as written — INV-NOTES-026.
 *
 * The point of having both is that a complaint about playback stops being
 * ambiguous: one mode is the detector's doing, the other is notation's.
 */
import {
  asNotated,
  asSung,
  playbackTargets,
  type NoteEvent,
  type QuantizedNote
} from '../index';

const note = (over: Partial<NoteEvent> = {}): NoteEvent => ({
  midi: 60,
  startMs: 100,
  endMs: 600,
  durationMs: 500,
  cents: 0,
  clarity: 0.95,
    loudnessDb: null,
  ...over
});

const quantized = (over: Partial<QuantizedNote> = {}): QuantizedNote => ({
  ...note(),
  gridStartMs: 0,
  gridDurationMs: 500,
  deviationMs: 100,
  bar: 1,
  beat: 1,
  durationBeats: 1,
  durationLabel: 'quarter',
  ...over
});

describe('asSung', () => {
  it('keeps the cents, so what plays is what was detected', () => {
    // A note sung forty cents flat should sound forty cents flat, not be
    // quietly corrected on the way out.
    expect(asSung([note({ cents: -40 })])[0].midi).toBeCloseTo(59.6);
  });

  it('keeps the timing exactly as detected', () => {
    const [t] = asSung([note({ startMs: 137, endMs: 642 })]);
    expect(t).toMatchObject({ startMs: 137, endMs: 642 });
  });

  it('rounds nothing at all', () => {
    const targets = asSung([note({ cents: 3 }), note({ cents: -47 })]);
    expect(targets[0].midi).not.toBe(Math.round(targets[0].midi));
    expect(targets[1].midi).toBeCloseTo(59.53);
  });
});

describe('asNotated', () => {
  it('plays the notated pitch, not the sung one', () => {
    expect(asNotated([quantized({ cents: -40 })])[0].midi).toBe(60);
  });

  it('plays on the grid, not where the note actually landed', () => {
    const [t] = asNotated([quantized({ startMs: 137, gridStartMs: 0 })]);
    expect(t.startMs).toBe(0);
  });

  it('lasts its notated length', () => {
    const [t] = asNotated([quantized({ gridStartMs: 500, gridDurationMs: 250 })]);
    expect(t.endMs - t.startMs).toBe(250);
  });
});

describe('playbackTargets', () => {
  it('differs between the modes for a take that was neither exact', () => {
    const sung = note({ cents: -40, startMs: 137, endMs: 642 });
    const grid = quantized({ cents: -40, startMs: 137, endMs: 642 });
    expect(playbackTargets([sung], [grid], 'as-sung')).not.toEqual(
      playbackTargets([sung], [grid], 'as-notated')
    );
  });

  it('agrees between the modes for a take that was exact', () => {
    // Sung dead in tune and dead on the beat: nothing for notation to change.
    const exact = note({ cents: 0, startMs: 0, endMs: 500 });
    const grid = quantized({ cents: 0, startMs: 0, endMs: 500 });
    expect(playbackTargets([exact], [grid], 'as-sung')).toEqual(
      playbackTargets([exact], [grid], 'as-notated')
    );
  });

  it('plays what was sung when there is no grid to notate against', () => {
    // A take too short or too free to fit a pulse still has a pitch, and
    // refusing to play it would be worse than playing it honestly.
    expect(playbackTargets([note({ cents: 20 })], null, 'as-notated')[0].midi)
      .toBeCloseTo(60.2);
    expect(playbackTargets([note({ cents: 20 })], [], 'as-notated')[0].midi)
      .toBeCloseTo(60.2);
  });
});
