/**
 * ACC-NOTES-228 / INV-NOTES-213 — a note is asked about by touching it.
 *
 * The analysis sheet carried a column of every note: name, when it starts,
 * how long it lasts, how far off it was. That was a second way to ask the
 * same question and the worse one — it named a note by its number in a list,
 * while the graph names it by where it is in the music, and reading down
 * forty rows to find the note you are already looking at is work the picture
 * had done.
 *
 * These pin that nothing was lost with it, which is the only reason it could
 * go. Written before the column was taken out.
 */
import { describeSelection } from '../selectionFacts';
import type { useNoteDetail } from '../useNoteDetail';

const NOTE = {
  midi: 69,
  startMs: 1500,
  endMs: 2250,
  durationMs: 750,
  cents: -12,
  clarity: 0.9,
  loudnessDb: -18
};

const detail = (over: Record<string, unknown> = {}) =>
  ({
    melody: [NOTE],
    isCorrected: () => false,
    playNote: jest.fn(),
    resetNote: jest.fn(),
    ...over
  }) as unknown as ReturnType<typeof useNoteDetail>;

const chosen = (over?: Record<string, unknown>) =>
  describeSelection(
    { kind: 'melodyNote', index: 0 } as never,
    detail(over),
    '#000',
    jest.fn()
  );

/** What a fact says, by the label the sheet shows against it. */
const fact = (of: ReturnType<typeof chosen>, label: string) =>
  of.facts.find((f) => f.label === label)?.value;

describe('ACC-NOTES-228: what the column used to say', () => {
  it('names the note, as the first column did', () => {
    expect(chosen().title).toBe('A4');
  });

  it('says when it starts, as the second column did', () => {
    expect(fact(chosen(), 'Starts')).toBeTruthy();
    expect(fact(chosen(), 'Starts')).toContain('1.5');
  });

  it('says how long it lasts, as the third column did', () => {
    expect(fact(chosen(), 'Lasts')).toBeTruthy();
    expect(fact(chosen(), 'Lasts')).toContain('0.7');
  });

  it('says how far off it was, as the fourth column did', () => {
    expect(fact(chosen(), 'Tuning')).toContain('12');
  });
});

describe('and what the column never said', () => {
  it('says how loud it was', () => {
    // Which the level match is derived from, and which the column had no
    // room for (INV-NOTES-141).
    expect(fact(chosen(), 'Loudness')).toBeTruthy();
  });

  it('says whether it was read or moved by hand', () => {
    expect(fact(chosen(), 'Read as')).toBe('detected');
    expect(fact(chosen({ isCorrected: () => true }), 'Read as')).toBe(
      'moved by hand'
    );
  });

  it('offers to sound it, which is why a row was tapped at all', () => {
    expect(chosen().actions.map((a) => a.label)).toContain('Hear it');
  });

  it('offers to put a corrected note back', () => {
    const actions = chosen({ isCorrected: () => true }).actions.map(
      (a) => a.label
    );
    expect(actions).toContain('Put it back');
  });
});
