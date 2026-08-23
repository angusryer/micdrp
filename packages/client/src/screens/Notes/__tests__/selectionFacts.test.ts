/**
 * INT-NOTES-027 — what the chosen thing is, and what can honestly be done.
 *
 * The strip this replaced named the thing and offered verbs but never said
 * what it was. These pin the facts a person decides from, and the rule that a
 * verb only appears where it would do something — "put it back" on a note
 * nobody moved is a control that reports nothing and does nothing.
 */
import { describeSelection } from '../selectionFacts';
import type { Selection } from '../../../components/graphSelection';
import type { useNoteDetail } from '../useNoteDetail';

const ACCENT = '#0F52BA';

const fakeDetail = (over: Record<string, unknown> = {}) =>
  ({
    melody: [
      { midi: 62, startMs: 1500, endMs: 2000, cents: -18, clarity: 1 }
    ],
    isCorrected: () => false,
    playNote: jest.fn(),
    resetNote: jest.fn(),
    auditionChord: jest.fn(),
    chords: {
      slots: [{ label: 'Am', bar: 1, startMs: 0, endMs: 2000, voicing: undefined }],
      voicing: () => [57, 60, 64],
      toggleTone: jest.fn(),
      resetTone: jest.fn()
    },
    bars: { merge: jest.fn() },
    ...over
  }) as unknown as ReturnType<typeof useNoteDetail>;

const labels = (d: { actions: { label: string }[] }) =>
  d.actions.map((a) => a.label);

describe('a chosen sung note', () => {
  const selection: Selection = { kind: 'melodyNote', index: 0 };

  it('says what it is, not just that it is a note', () => {
    const shown = describeSelection(selection, fakeDetail(), ACCENT, jest.fn());
    expect(shown.title).toBe('D4');
    const facts = Object.fromEntries(shown.facts.map((f) => [f.label, f.value]));
    expect(facts.Starts).toBe('1.50s');
    expect(facts.Lasts).toBe('0.50s');
    // The reason a note looks wrong is usually here.
    expect(facts.Tuning).toBe('-18 cents');
    expect(facts['Read as']).toBe('detected');
  });

  it('offers nothing to undo on a note nobody has moved', () => {
    const shown = describeSelection(selection, fakeDetail(), ACCENT, jest.fn());
    expect(labels(shown)).toEqual(['Hear it']);
  });

  it('offers to put back a note that was moved by hand', () => {
    const shown = describeSelection(
      selection,
      fakeDetail({ isCorrected: () => true }),
      ACCENT,
      jest.fn()
    );
    expect(labels(shown)).toContain('Put it back');
    expect(
      Object.fromEntries(shown.facts.map((f) => [f.label, f.value]))['Read as']
    ).toBe('moved by hand');
  });

  it('reports a note sitting on the pitch as in tune, not as zero', () => {
    const shown = describeSelection(
      selection,
      fakeDetail({
        melody: [{ midi: 62, startMs: 0, endMs: 500, cents: 0, clarity: 1 }]
      }),
      ACCENT,
      jest.fn()
    );
    expect(
      Object.fromEntries(shown.facts.map((f) => [f.label, f.value])).Tuning
    ).toBe('in tune');
  });
});

describe('a chosen chord note', () => {
  const selection: Selection = { kind: 'chordTone', slot: 0, tone: 1 };

  it('names the chord, the part it plays, and the pitch it sounds', () => {
    const shown = describeSelection(selection, fakeDetail(), ACCENT, jest.fn());
    expect(shown.title).toBe('Am');
    const facts = Object.fromEntries(shown.facts.map((f) => [f.label, f.value]));
    expect(facts.Part).toBe('third');
    expect(facts.Pitch).toBe('C4');
  });

  it('takes its colour from the part it plays, not the selection accent', () => {
    // The colour says which part of the chord it is, and must survive being
    // chosen (INV-NOTES-052).
    const shown = describeSelection(selection, fakeDetail(), ACCENT, jest.fn());
    expect(shown.accent).not.toBe(ACCENT);
  });
});

describe('a chosen bar line', () => {
  const selection: Selection = { kind: 'barLine', lineIndex: 0 };

  it('says which bar it opens and what chord starts there', () => {
    const shown = describeSelection(selection, fakeDetail(), ACCENT, jest.fn());
    const facts = Object.fromEntries(shown.facts.map((f) => [f.label, f.value]));
    expect(facts['Opens bar']).toBe('1');
    expect(facts.Chord).toBe('Am');
  });

  it('marks removal as taking something away', () => {
    const shown = describeSelection(selection, fakeDetail(), ACCENT, jest.fn());
    expect(shown.actions[0].isDestructive).toBe(true);
  });

  it('puts the selection down, since what it referred to has gone', () => {
    const onSelect = jest.fn();
    const detail = fakeDetail();
    describeSelection(selection, detail, ACCENT, onSelect).actions[0].run();
    expect(onSelect).toHaveBeenCalledWith(null);
  });
});
