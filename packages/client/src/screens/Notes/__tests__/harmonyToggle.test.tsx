/**
 * ACC-NOTES-246 / INV-NOTES-231 — the chords are put on the graph and taken
 * off it by one control, and taking them off forgets nothing.
 *
 * The decisions made about the chords are differences replayed onto whatever
 * is inferred (INV-NOTES-022), so hiding them and asking afresh is a question
 * about what is drawn rather than about what is known.
 */
import { act, create } from 'react-test-renderer';
import React from 'react';

import { useInterpretation } from '../useInterpretation';
import { resetInterpretationQueueForTests } from '../../../data/interpretationQueue';

jest.mock('../../../data/notesRepo', () => ({
  notesRepo: { saveInterpretations: () => Promise.resolve() }
}));

const chosen = [{ atMs: 0, rootPc: 7, quality: 'maj' as const }];

/** The hook, driven directly: what is being asked about is its own state. */
const held = () => {
  const seen: { current: ReturnType<typeof useInterpretation> } = {
    current: null as never
  };
  function Probe(): null {
    seen.current = useInterpretation('note-1', []);
    return null;
  }
  act(() => {
    create(React.createElement(Probe));
  });
  return seen;
};

beforeEach(() => resetInterpretationQueueForTests());

it('ACC-NOTES-246: asks, forgets, and asks again', () => {
  const reading = held();

  expect(reading.current.hasHarmony).toBe(false);
  act(() => reading.current.askForHarmony(3));
  expect(reading.current.hasHarmony).toBe(true);

  act(() => reading.current.forgetHarmony());
  expect(reading.current.hasHarmony).toBe(false);

  act(() => reading.current.askForHarmony(3));
  expect(reading.current.hasHarmony).toBe(true);
});

it('keeps what was decided about the chords when they are taken off', () => {
  const reading = held();

  act(() => reading.current.askForHarmony(3));
  act(() => reading.current.update(chosen));
  act(() => reading.current.forgetHarmony());

  // Off the graph, not undone: they replay onto the next reading.
  expect(reading.current.savedEdits).toEqual(chosen);
});
