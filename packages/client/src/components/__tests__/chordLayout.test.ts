/**
 * Chord notes drawn on the melody's own axes, and picked out by a touch.
 */
import { moveTone, toggleMute } from 'logic';

import {
  chordPitches,
  chordToneAt,
  layoutChordTones,
  HEADPHONE_FLOOR_MIDI,
  SPEAKER_FLOOR_MIDI,
  type PlacedChord
} from '../chordLayout';
import { layoutMelody, type MelodyNote } from '../melodyLayout';

const MELODY: MelodyNote[] = [
  { midi: 72, startMs: 0, endMs: 500 },
  { midi: 76, startMs: 500, endMs: 2000 }
];

const SLOTS: PlacedChord[] = [
  { startMs: 0, endMs: 2000, rootPc: 0, quality: 'maj' },
  { startMs: 2000, endMs: 4000, rootPc: 7, quality: 'dom7' }
];

function layout(slots: readonly PlacedChord[], floor: number) {
  const pitches = chordPitches(slots, floor);
  const melody = layoutMelody(MELODY, {
    width: 400,
    height: 200,
    alsoShow: pitches
  });
  return {
    melody,
    rects: layoutChordTones(slots, melody.timeAxis, melody.pitchAxis, floor)
  };
}

describe('chord notes share the melody axis', () => {
  it('widens the pitch window so the chords are on screen', () => {
    const withoutChords = layoutMelody(MELODY, { width: 400, height: 200 });
    const { melody } = layout(SLOTS, HEADPHONE_FLOOR_MIDI);

    // The melody alone starts around 72; the chords sit far below it.
    expect(withoutChords.midiLow).toBeGreaterThan(HEADPHONE_FLOOR_MIDI);
    expect(melody.midiLow).toBeLessThanOrEqual(HEADPHONE_FLOOR_MIDI);
  });

  it('draws every note of every chord, silenced ones included', () => {
    const { rects } = layout(SLOTS, HEADPHONE_FLOOR_MIDI);
    // A triad and a seventh.
    expect(rects).toHaveLength(3 + 4);
    expect(rects.filter((r) => r.slot === 0)).toHaveLength(3);
  });

  it('puts a lower note lower on the screen, on the same ruler as the melody', () => {
    const { melody, rects } = layout(SLOTS, HEADPHONE_FLOOR_MIDI);
    const chord = rects.filter((r) => r.slot === 0).sort((a, b) => a.midi - b.midi);

    expect(chord[0].y).toBeGreaterThan(chord[chord.length - 1].y);
    // And the sung line, being higher, sits above all of them.
    expect(melody.rects[0].cy).toBeLessThan(chord[chord.length - 1].y);
  });

  it('lifts the chords towards the melody when the speaker has to carry them', () => {
    const low = layout(SLOTS, HEADPHONE_FLOOR_MIDI);
    const lifted = layout(SLOTS, SPEAKER_FLOOR_MIDI);

    const lowest = (r: typeof low.rects) => Math.min(...r.map((t) => t.midi));
    expect(lowest(lifted.rects)).toBeGreaterThan(lowest(low.rects));
  });
});

describe('what was done to a note is visible', () => {
  it('flags a silenced note without removing it', () => {
    const slots: PlacedChord[] = [
      { ...SLOTS[0], voicing: toggleMute(undefined, 'maj', 2) }
    ];
    const { rects } = layout(slots, HEADPHONE_FLOOR_MIDI);
    expect(rects).toHaveLength(3);
    expect(rects.filter((r) => r.muted).map((r) => r.tone)).toEqual([2]);
  });

  it('flags a moved note and draws it where it was moved to', () => {
    const plain = layout([SLOTS[0]], HEADPHONE_FLOOR_MIDI);
    const slots: PlacedChord[] = [
      { ...SLOTS[0], voicing: moveTone(undefined, 'maj', 1, 1) }
    ];
    const moved = layout(slots, HEADPHONE_FLOOR_MIDI);

    expect(moved.rects[1].moved).toBe(true);
    expect(moved.rects[1].midi).toBe(plain.rects[1].midi + 1);
    expect(moved.rects[0].moved).toBe(false);
  });
});

describe('picking a note out with a touch', () => {
  it('finds the note under the finger', () => {
    const { rects } = layout(SLOTS, HEADPHONE_FLOOR_MIDI);
    const target = rects[1];
    const hit = chordToneAt(rects, target.x + 5, target.y + target.height / 2, 20);
    expect(hit?.slot).toBe(target.slot);
    expect(hit?.tone).toBe(target.tone);
  });

  it('takes the nearer of two, so a thumb between them still lands', () => {
    const { rects } = layout(SLOTS, HEADPHONE_FLOOR_MIDI);
    const chord = rects.filter((r) => r.slot === 0).sort((a, b) => a.y - b.y);
    const between = (chord[0].y + chord[1].y) / 2;
    const hit = chordToneAt(rects, chord[0].x + 5, between - 1, 999);
    expect(hit?.tone).toBe(chord[0].tone);
  });

  it('finds nothing beyond its reach, or outside the slot', () => {
    const { rects } = layout(SLOTS, HEADPHONE_FLOOR_MIDI);
    expect(chordToneAt(rects, rects[0].x + 5, rects[0].y - 500, 4)).toBeNull();
    expect(chordToneAt(rects, -50, rects[0].y, 20)).toBeNull();
  });
});
