/**
 * A chord's individual notes: moved, silenced, transposed, and stored
 * (INV-NOTES-036/037/038/039).
 */
import {
  collectEdits,
  replayEdits,
  harmonizeToGrid,
  isAltered,
  moveTone,
  toggleMute,
  transposeDiatonic,
  voiceChord,
  voicedTones,
  MAX_TONE_OFFSET
} from '../index';
import type { ChordSlot } from '../harmony';
import type { ChordVoicing } from '../voicing';

const KEY = { tonic: 0, tonicName: 'C', mode: 'major' as const, confidence: 1 };

function slot(over: Partial<ChordSlot> = {}): ChordSlot {
  return {
    bar: 1,
    startMs: 0,
    endMs: 2000,
    rootPc: 9,
    quality: 'min7',
    label: 'Am7',
    roman: 'vi7',
    confidence: 0.8,
    isEdited: false,
    ...over
  };
}

describe('a chord keeps its name while its voicing changes (INV-NOTES-036)', () => {
  it('leaves root, quality, label and roman alone', () => {
    const before = slot();
    const voicing = moveTone(undefined, before.quality, 1, 1);
    const after = { ...before, voicing };

    expect(after.rootPc).toBe(before.rootPc);
    expect(after.quality).toBe(before.quality);
    expect(after.label).toBe('Am7');
    expect(after.roman).toBe('vi7');
  });

  it('reports a moved or silenced note as altered, and a plain one as not', () => {
    expect(isAltered(undefined)).toBe(false);
    expect(isAltered({})).toBe(false);
    expect(isAltered({ offsets: [0, 0, 0, 0] })).toBe(false);
    expect(isAltered(moveTone(undefined, 'min7', 1, 1))).toBe(true);
    expect(isAltered(toggleMute(undefined, 'min7', 2))).toBe(true);
  });

  it('ignores an index that is not a note of the chord', () => {
    // A triad has three; there is no fourth to move or silence.
    expect(isAltered(moveTone(undefined, 'maj', 3, 1))).toBe(false);
    expect(isAltered(toggleMute(undefined, 'maj', -1))).toBe(false);
  });

  it('clamps a note that is pushed too far to still be a voicing', () => {
    const far = moveTone(undefined, 'maj', 0, 99);
    expect(far.offsets?.[0]).toBe(MAX_TONE_OFFSET);
    const down = moveTone(undefined, 'maj', 0, -99);
    expect(down.offsets?.[0]).toBe(-MAX_TONE_OFFSET);
  });
});

describe('a silenced note is quiet, not gone (INV-NOTES-037)', () => {
  it('drops it from what sounds but keeps it in the chord', () => {
    // Am7 voiced from 48: A, C, E, G.
    const plain = voiceChord(9, 'min7', { bottomMidi: 48 });
    expect(plain).toHaveLength(4);

    const muted = toggleMute(undefined, 'min7', 2); // the fifth
    const sounded = voiceChord(9, 'min7', { bottomMidi: 48, voicing: muted });
    expect(sounded).toHaveLength(3);
    // Still four notes in the chord, one of them silent.
    const tones = voicedTones(57, 'min7', muted);
    expect(tones).toHaveLength(4);
    expect(tones[2].muted).toBe(true);
  });

  it('is undone by the same call that made it', () => {
    const once = toggleMute(undefined, 'min7', 2);
    const twice = toggleMute(once, 'min7', 2);
    expect(isAltered(twice)).toBe(false);
  });

  it('leaves an entirely silenced slot present and saying nothing', () => {
    let voicing: ChordVoicing | undefined;
    for (let i = 0; i < 4; i++) {
      voicing = toggleMute(voicing, 'min7', i);
    }
    expect(voiceChord(9, 'min7', { bottomMidi: 48, voicing })).toEqual([]);
  });
});

describe('moving the chord carries its voicing along (INV-NOTES-038)', () => {
  it('sounds the same whether voiced before or after a transpose', () => {
    const voicing = moveTone(toggleMute(undefined, 'min7', 2), 'min7', 1, 1);
    const original = { ...slot(), voicing };

    const moved = transposeDiatonic(original, KEY, 2);
    const voicedAfter = voiceChord(moved.rootPc, moved.quality, {
      bottomMidi: 48,
      voicing: moved.voicing
    });
    // The offset is held against the chord tone, so it survives the move.
    const voicedWithSameVoicing = voiceChord(moved.rootPc, moved.quality, {
      bottomMidi: 48,
      voicing
    });
    expect(voicedAfter).toEqual(voicedWithSameVoicing);
    expect(moved.voicing).toEqual(voicing);
  });

  it('offsets a note relative to its chord tone, not to a fixed pitch', () => {
    const up = moveTone(undefined, 'maj', 1, 1);
    // C major from 60: C E G. The third moved up one is F, not a fixed pitch.
    expect(voicedTones(60, 'maj', up).map((t) => t.midi)).toEqual([60, 65, 67]);
    // The same voicing on a different root moves that root's third.
    expect(voicedTones(62, 'maj', up).map((t) => t.midi)).toEqual([62, 67, 69]);
  });
});

describe('a voicing is kept the way every other edit is kept (INV-NOTES-039)', () => {
  const melody = [
    { midi: 60, startMs: 0, endMs: 500 },
    { midi: 64, startMs: 500, endMs: 1000 },
    { midi: 67, startMs: 1000, endMs: 2000 }
  ];
  const grid = { bpm: 120, offsetMs: 0, beatsPerBar: 4, stepsPerBeat: 4 };

  it('round-trips through collect and replay unchanged', () => {
    const inferred = harmonizeToGrid(melody, grid);
    expect(inferred.length).toBeGreaterThan(0);

    const voicing = moveTone(toggleMute(undefined, inferred[0].quality, 1), inferred[0].quality, 0, -2);
    const edited = [{ ...inferred[0], voicing }, ...inferred.slice(1)];

    const edits = collectEdits(edited);
    expect(edits[0].voicing).toEqual(voicing);

    const replayed = replayEdits(harmonizeToGrid(melody, grid), edits, KEY);
    expect(replayed[0].voicing).toEqual(voicing);
  });

  it('stores a voicing even when the chord itself was left alone', () => {
    const inferred = harmonizeToGrid(melody, grid);
    const voiced = [
      { ...inferred[0], voicing: toggleMute(undefined, inferred[0].quality, 1) },
      ...inferred.slice(1)
    ];
    // isEdited is still false — only the notes moved.
    expect(voiced[0].isEdited).toBe(false);
    expect(collectEdits(voiced)).toHaveLength(1);
  });

  it('drops a voicing whose moment lands in no slot', () => {
    const inferred = harmonizeToGrid(melody, grid);
    const orphan = {
      atMs: 999999,
      rootPc: 0,
      quality: 'maj' as const,
      voicing: toggleMute(undefined, 'maj', 1)
    };
    const replayed = replayEdits(inferred, [orphan], KEY);
    expect(replayed.every((s) => !isAltered(s.voicing))).toBe(true);
  });
});
