import {
  analyzeCorpus,
  avoidanceProfile,
  chordReflection,
  corpusIntervals,
  fragmentToTargets,
  frequentFragments,
  impliedHarmony,
  intervalClass,
  intervalClassName,
  intervalHistogram,
  intervalName,
  melodyToIntervals,
  melodyToPhrases,
  midiSequenceToTargets,
  type Melody
} from '../analysis';
import type { NoteEvent } from '../segmentation';

function note(midi: number, startMs: number, endMs: number): NoteEvent {
  return {
    midi,
    startMs,
    endMs,
    durationMs: endMs - startMs,
    cents: 0,
    clarity: 0.95
  };
}

/** Tile a MIDI sequence into back-to-back notes of `dur` ms starting at `startAt`. */
function tiled(midis: number[], dur = 500, startAt = 0): NoteEvent[] {
  return midis.map((m, i) =>
    note(m, startAt + i * dur, startAt + (i + 1) * dur)
  );
}

describe('interval naming', () => {
  it('folds compound intervals to a class but keeps the octave distinct', () => {
    expect(intervalClass(0)).toBe(0); // unison
    expect(intervalClass(4)).toBe(4); // M3
    expect(intervalClass(-4)).toBe(4); // direction folded
    expect(intervalClass(12)).toBe(12); // octave kept distinct from unison
    expect(intervalClass(14)).toBe(2); // M9 -> M2
    expect(intervalClass(24)).toBe(12); // two octaves -> octave
  });

  it('names classes and directional intervals', () => {
    expect(intervalClassName(7)).toBe('P5');
    expect(intervalName(7)).toBe('+P5');
    expect(intervalName(-7)).toBe('-P5');
    expect(intervalName(0)).toBe('P1');
    expect(intervalName(4)).toBe('+M3');
  });
});

describe('melodyToPhrases / melodyToIntervals', () => {
  it('keeps a gap-free melody as one phrase', () => {
    const melody = tiled([60, 62, 64, 65]);
    const phrases = melodyToPhrases(melody);
    expect(phrases).toHaveLength(1);
    expect(melodyToIntervals(melody)).toEqual([2, 2, 1]);
  });

  it('splits on a long rest and never counts an interval across it', () => {
    // Two phrases: 60->62 then (1s rest) 72->74. The 62->72 leap is not sung as
    // an adjacency, so it must not appear in the intervals.
    const melody = [
      note(60, 0, 500),
      note(62, 500, 1000),
      note(72, 2000, 2500), // 1000ms rest before this
      note(74, 2500, 3000)
    ];
    const phrases = melodyToPhrases(melody, { maxRestMs: 600 });
    expect(phrases.map((p) => p.length)).toEqual([2, 2]);
    expect(melodyToIntervals(melody, { maxRestMs: 600 })).toEqual([2, 2]);
  });
});

describe('intervalHistogram', () => {
  it('counts directional and folded-class occurrences', () => {
    // +2, +2, -2 -> M2 appears 3 times by class; +M2 twice, -M2 once directional.
    const corpus: Melody[] = [tiled([60, 62, 64, 62])];
    const hist = intervalHistogram(corpusIntervals(corpus));
    expect(hist.total).toBe(3);

    const up = hist.directional.find((d) => d.semitones === 2);
    const down = hist.directional.find((d) => d.semitones === -2);
    expect(up?.count).toBe(2);
    expect(down?.count).toBe(1);

    const m2Class = hist.byClass.find((c) => c.ic === 2);
    expect(m2Class?.count).toBe(3);
    expect(m2Class?.name).toBe('M2');
    expect(m2Class?.ratio).toBeCloseTo(1);
  });
});

describe('frequentFragments', () => {
  it('finds a recurring transposition-invariant motif with a playable example', () => {
    // The shape [+2, +2] (three rising whole-tones) sung twice, in two keys.
    const phraseA = tiled([60, 62, 64], 400, 0);
    const phraseB = tiled([67, 69, 71], 400, 2000); // same shape, transposed up a 5th
    const melody = [...phraseA, ...phraseB];
    const fragments = frequentFragments([melody], {
      nRange: [3, 3],
      minCount: 2
    });
    expect(fragments).toHaveLength(1);
    expect(fragments[0].intervals).toEqual([2, 2]);
    expect(fragments[0].count).toBe(2);
    expect(fragments[0].noteCount).toBe(3);
    // The example is an actual realization, playable as-is.
    expect(fragments[0].exampleMidi).toEqual([60, 62, 64]);
  });

  it('drops shapes that do not recur (minCount)', () => {
    const melody = tiled([60, 64, 67, 60]); // no repeated 2-interval shape
    expect(frequentFragments([melody], { nRange: [3, 3], minCount: 2 })).toEqual(
      []
    );
  });

  it('never forms a fragment across a phrase break', () => {
    // [60,62] | rest | [64,66] — no 3-note fragment exists within a phrase.
    const melody = [
      note(60, 0, 400),
      note(62, 400, 800),
      note(64, 2000, 2400),
      note(66, 2400, 2800)
    ];
    expect(
      frequentFragments([melody], { nRange: [3, 3], minCount: 1 })
    ).toEqual([]);
  });
});

describe('impliedHarmony', () => {
  it('reads a C-major arpeggio window as C major', () => {
    const melody = tiled([60, 64, 67, 72], 500); // C E G C over 2s
    const chords = impliedHarmony(melody, { windowMs: 2000 });
    expect(chords).toHaveLength(1);
    expect(chords[0].rootPc).toBe(0);
    expect(chords[0].quality).toBe('maj');
    expect(chords[0].label).toBe('Cmaj');
    expect(chords[0].confidence).toBeGreaterThan(0);
  });

  it('reads a dominant-seventh colour with the sevenths vocabulary', () => {
    const melody = tiled([67, 71, 74, 77], 500); // G B D F -> G7
    const chords = impliedHarmony(melody, {
      windowMs: 2000,
      vocabulary: 'sevenths'
    });
    expect(chords[0].rootPc).toBe(7);
    expect(chords[0].quality).toBe('dom7');
    expect(chords[0].label).toBe('G7');
  });

  it('labels chords as roman numerals when key-relative', () => {
    // A clear C-major arpeggio; the implied C chord is the tonic -> 'I'.
    const melody = tiled([60, 64, 67, 60, 64, 67], 350);
    const chords = impliedHarmony(melody, {
      windowMs: 4000,
      keyRelative: true
    });
    expect(chords[0].label).toBe('I');
  });
});

describe('chordReflection', () => {
  it('aggregates common chords and changes key-relative across the corpus', () => {
    // Each melody: a tonic arpeggio then a dominant arpeggio (I then V in C).
    // The corpus emphasises G, so we pin the key to C major to test the
    // roman-numeral *labelling* rather than the (separately tested) key detector.
    const cMajor = {
      tonic: 0,
      tonicName: 'C',
      mode: 'major' as const,
      confidence: 1
    };
    const make = () => [
      ...tiled([60, 64, 67], 666, 0), // ~2s C major
      ...tiled([67, 71, 74], 666, 2000) // ~2s G major
    ];
    const corpus = [make(), make()];
    const reflection = chordReflection(corpus, {
      windowMs: 2000,
      key: cMajor
    });

    const changeLabels = reflection.changes.map((c) => c.label);
    expect(changeLabels).toContain('I→V');
    expect(reflection.changes[0].count).toBe(2);

    const chordLabels = reflection.chords.map((c) => c.label);
    expect(chordLabels).toContain('I');
    expect(chordLabels).toContain('V');
  });
});

describe('avoidanceProfile', () => {
  it('ranks never-sung intervals furthest from the singer centroid', () => {
    // Stepwise melody: only M2 and m2 are ever sung.
    const corpus = [tiled([60, 62, 64, 65, 67])]; // +2,+2,+1,+2
    const avoided = avoidanceProfile(corpus);

    // The most-avoided pattern is one the singer never sang (presence 0).
    expect(avoided[0].presence).toBe(0);

    // A perfect fifth (ic 7) was never sung -> high distance, presence 0.
    const p5 = avoided.find((a) => a.ic === 7);
    expect(p5?.presence).toBe(0);

    // M2 (ic 2) is the staple -> lowest distance, present.
    const m2 = avoided.find((a) => a.ic === 2);
    expect(m2?.presence).toBeGreaterThan(0);
    expect(m2?.distance).toBeLessThan(p5?.distance ?? Infinity);

    // Unison is excluded by default.
    expect(avoided.some((a) => a.ic === 0)).toBe(false);
  });
});

describe('analyzeCorpus', () => {
  it('produces every insight in one call', () => {
    const corpus = [tiled([60, 62, 64, 65, 67, 65, 64, 62, 60])];
    const analysis = analyzeCorpus(corpus);
    expect(analysis.melodyCount).toBe(1);
    expect(analysis.noteCount).toBe(9);
    expect(analysis.intervals.total).toBe(8);
    expect(Array.isArray(analysis.fragments)).toBe(true);
    expect(Array.isArray(analysis.chords.changes)).toBe(true);
    expect(analysis.avoided.length).toBeGreaterThan(0);
  });

  it('is stable on an empty corpus', () => {
    const analysis = analyzeCorpus([]);
    expect(analysis.melodyCount).toBe(0);
    expect(analysis.noteCount).toBe(0);
    expect(analysis.intervals.total).toBe(0);
    expect(analysis.fragments).toEqual([]);
  });
});

describe('playback helpers', () => {
  it('tiles a MIDI sequence into back-to-back targets', () => {
    const targets = midiSequenceToTargets([60, 64, 67], 400);
    expect(targets).toEqual([
      { midi: 60, startMs: 0, endMs: 400 },
      { midi: 64, startMs: 400, endMs: 800 },
      { midi: 67, startMs: 800, endMs: 1200 }
    ]);
  });

  it('realizes an interval shape from a root', () => {
    const targets = fragmentToTargets(60, [2, 2], 400);
    expect(targets.map((t) => t.midi)).toEqual([60, 62, 64]);
  });
});
