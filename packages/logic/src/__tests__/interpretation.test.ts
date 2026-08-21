/**
 * Keeping a person's decisions apart from what analysis inferred —
 * INV-NOTES-022.
 *
 * The property that matters most is the round trip: reducing a progression to
 * its differences and putting them back must return what you started with. If
 * that ever fails, someone's chords change by themselves.
 */
import {
  collectEdits,
  replayEdits,
  setChord,
  type ChordSlot,
  type KeyEstimate
} from '../index';

const C_MAJOR: KeyEstimate = {
  tonic: 0,
  tonicName: 'C',
  mode: 'major',
  confidence: 0.9
};

/** A three-bar progression, two seconds a bar, nothing edited. */
function progression(): ChordSlot[] {
  return [0, 1, 2].map((i) => ({
    bar: i + 1,
    startMs: i * 2000,
    endMs: (i + 1) * 2000,
    rootPc: 0,
    quality: 'maj' as const,
    label: 'C',
    roman: 'I',
    confidence: 0.5,
    isEdited: false
  }));
}

describe('collectEdits', () => {
  it('collects nothing from a progression nobody touched', () => {
    expect(collectEdits(progression())).toEqual([]);
  });

  it('collects only the slots a person changed', () => {
    const slots = progression();
    slots[1] = setChord(slots[1], C_MAJOR, 9, 'min');
    const edits = collectEdits(slots);
    expect(edits).toHaveLength(1);
    expect(edits[0]).toMatchObject({ rootPc: 9, quality: 'min' });
  });

  it('anchors an edit inside the slot it came from', () => {
    const slots = progression();
    slots[2] = setChord(slots[2], C_MAJOR, 7, 'dom7');
    const [edit] = collectEdits(slots);
    expect(edit.atMs).toBeGreaterThanOrEqual(slots[2].startMs);
    expect(edit.atMs).toBeLessThan(slots[2].endMs);
  });
});

describe('replayEdits', () => {
  it('returns the inferred progression when there is nothing to replay', () => {
    const inferred = progression();
    expect(replayEdits(inferred, [], C_MAJOR)).toEqual(inferred);
  });

  it('INV-NOTES-022: a slot with no edit against it follows inference', () => {
    // The whole point of storing differences: improving detection improves
    // every note nobody has overridden.
    const inferred = progression();
    inferred[0].rootPc = 5;
    inferred[0].label = 'F';
    const replayed = replayEdits(inferred, [{ atMs: 4000, rootPc: 9, quality: 'min' }], C_MAJOR);
    expect(replayed[0]).toMatchObject({ rootPc: 5, label: 'F', isEdited: false });
  });

  it('marks a replayed slot as edited so inference stops overwriting it', () => {
    const replayed = replayEdits(
      progression(),
      [{ atMs: 2500, rootPc: 9, quality: 'min' }],
      C_MAJOR
    );
    expect(replayed[1]).toMatchObject({ rootPc: 9, quality: 'min', isEdited: true });
  });

  it('relabels the slot it lands on', () => {
    const replayed = replayEdits(
      progression(),
      [{ atMs: 100, rootPc: 9, quality: 'min' }],
      C_MAJOR
    );
    expect(replayed[0].label).toBe('Am');
  });

  it('drops an edit that lands in no slot rather than guessing', () => {
    // Happens when re-analysis produces a shorter take. Inventing a home for
    // it would put someone's chord somewhere they never placed it.
    const replayed = replayEdits(
      progression(),
      [{ atMs: 999_999, rootPc: 9, quality: 'min' }],
      C_MAJOR
    );
    expect(replayed.map((s) => s.isEdited)).toEqual([false, false, false]);
  });

  it('treats a slot end as belonging to the next slot', () => {
    const replayed = replayEdits(
      progression(),
      [{ atMs: 2000, rootPc: 9, quality: 'min' }],
      C_MAJOR
    );
    expect(replayed[0].isEdited).toBe(false);
    expect(replayed[1].isEdited).toBe(true);
  });

  it('leaves the progression it was given alone', () => {
    const inferred = progression();
    replayEdits(inferred, [{ atMs: 100, rootPc: 9, quality: 'min' }], C_MAJOR);
    expect(inferred[0].isEdited).toBe(false);
  });
});

describe('the round trip', () => {
  it('collecting then replaying returns the same progression', () => {
    const slots = progression();
    slots[0] = setChord(slots[0], C_MAJOR, 5, 'maj7');
    slots[2] = setChord(slots[2], C_MAJOR, 7, 'dom7');

    const replayed = replayEdits(progression(), collectEdits(slots), C_MAJOR);
    expect(replayed).toEqual(slots);
  });

  it('holds when every slot was changed', () => {
    const slots = progression().map((s) => setChord(s, C_MAJOR, 2, 'min7'));
    expect(replayEdits(progression(), collectEdits(slots), C_MAJOR)).toEqual(slots);
  });
});
