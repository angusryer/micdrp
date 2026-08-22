/**
 * A change of note is at least a semitone; anything nearer is one note
 * bending (INV-PITCH-017, INV-PITCH-018).
 */
import { dropTooBriefToSing, mergeBends } from '../bends';
import type { NoteEvent } from '../segmentation';

function n(midi: number, cents: number, startMs: number, durationMs: number): NoteEvent {
  return {
    midi,
    cents,
    startMs,
    endMs: startMs + durationMs,
    durationMs,
    clarity: 0.9
  };
}

describe('a scoop into a note', () => {
  it('is read as one note at the pitch it settled on', () => {
    // 80 cents flat for a moment, then held on pitch.
    const scooped = [n(60, -80, 0, 90), n(60, 0, 90, 600)];
    const merged = mergeBends(scooped);

    expect(merged).toHaveLength(1);
    expect(merged[0].midi).toBe(60);
    expect(merged[0].cents).toBe(0);
    // It still spans the whole thing, scoop included.
    expect(merged[0].startMs).toBe(0);
    expect(merged[0].endMs).toBe(690);
  });

  it('reads the same as the phrase sung without the scoop', () => {
    const scooped = mergeBends([n(60, -70, 0, 80), n(60, 0, 80, 600), n(64, 0, 680, 600)]);
    const flat = mergeBends([n(60, 0, 0, 680), n(64, 0, 680, 600)]);
    expect(scooped.map((x) => x.midi)).toEqual(flat.map((x) => x.midi));
    expect(scooped.map((x) => x.cents)).toEqual(flat.map((x) => x.cents));
  });
});

describe('an approach, a note and a release', () => {
  it('collapse to one note, not to two', () => {
    const bent = [
      n(60, -60, 0, 70), // sliding in
      n(60, 0, 70, 700), // the note
      n(60, -50, 770, 90) // falling away
    ];
    const merged = mergeBends(bent);
    expect(merged).toHaveLength(1);
    expect(merged[0].cents).toBe(0);
    expect(merged[0].durationMs).toBe(860);
  });

  it('keeps the pitch of whichever was held, not whichever came first', () => {
    // The fragment leads, but the sustained note is what was sung.
    const merged = mergeBends([n(59, 40, 0, 80), n(60, 0, 80, 700)]);
    expect(merged).toHaveLength(1);
    expect(merged[0].midi).toBe(60);
  });
});

describe('real steps survive', () => {
  it('never merges a semitone', () => {
    const step = [n(60, 0, 0, 400), n(61, 0, 400, 400)];
    expect(mergeBends(step)).toHaveLength(2);
  });

  it('never merges a leap', () => {
    const leap = [n(60, 0, 0, 400), n(67, 0, 400, 400), n(72, 0, 800, 400)];
    expect(mergeBends(leap)).toHaveLength(3);
  });

  it('merges the closest pair first, so a fragment joins the right note', () => {
    // The middle fragment is 20 cents from the right note and 80 from the
    // left one; it belongs to the right.
    const merged = mergeBends([n(59, 0, 0, 500), n(59, 80, 500, 60), n(60, 0, 560, 500)]);
    expect(merged).toHaveLength(2);
    expect(merged.map((x) => x.midi)).toEqual([59, 60]);
  });

  it('leaves one note, or none, alone', () => {
    expect(mergeBends([])).toEqual([]);
    expect(mergeBends([n(60, 0, 0, 500)])).toHaveLength(1);
  });
});

describe('too brief to have been sung on purpose', () => {
  it('drops what survives merging and is still shorter than a voice can articulate', () => {
    // 40ms, and a tone from both neighbours so nothing merged it away.
    const withBlip = [n(60, 0, 0, 400), n(67, 0, 400, 40), n(60, 0, 440, 400)];
    const kept = dropTooBriefToSing(mergeBends(withBlip));
    expect(kept.map((x) => x.midi)).toEqual([60, 60]);
  });

  it('keeps a fast but real note', () => {
    const brisk = [n(60, 0, 0, 120), n(62, 0, 120, 120), n(64, 0, 240, 120)];
    expect(dropTooBriefToSing(mergeBends(brisk))).toHaveLength(3);
  });

  it('does not throw away a scoop, because merging ran first', () => {
    const scooped = [n(60, -70, 0, 50), n(60, 0, 50, 600)];
    const kept = dropTooBriefToSing(mergeBends(scooped));
    expect(kept).toHaveLength(1);
    // The scoop is inside the note rather than discarded.
    expect(kept[0].startMs).toBe(0);
  });
});
