/**
 * ACC-NOTES-249 / INV-NOTES-234 — a note with no reading yet hands the same
 * absence upward on every render.
 *
 * The sibling of transportIdentityLive: same failure family, found by the
 * same question. An empty array written at the point of use is a different
 * array every render, and every memo below it recomputes for ever. Here it
 * fed eleven of them.
 *
 * Driven through the real hook, because a test that asserts a hand-written
 * object cannot see the code it governs — which is exactly how the transport
 * loop shipped with a passing test.
 */
import { act, create } from 'react-test-renderer';
import React from 'react';

import { useNoteDetail } from '../useNoteDetail';
import { cachedNotes } from '../../../data/notesSync';

jest.mock('../../../data/notesSync', () => ({
  cachedNotes: jest.fn(() => []),
  cacheReading: jest.fn()
}));

const cachedMock = cachedNotes as jest.MockedFunction<typeof cachedNotes>;

const seen: ReturnType<typeof useNoteDetail>[] = [];

function Probe(): null {
  seen.push(useNoteDetail('note-1'));
  return null;
}

beforeEach(() => {
  seen.length = 0;
  cachedMock.mockReset();
});

/** Three renders with nothing changed underneath. */
const renderThrice = async () => {
  let tree!: ReturnType<typeof create>;
  await act(async () => {
    tree = create(<Probe />);
  });
  await act(async () => {
    tree.update(<Probe />);
  });
  await act(async () => {
    tree.update(<Probe />);
  });
  await act(async () => {
    tree.unmount();
  });
};

it('ACC-NOTES-249: a note that is not there yields one absence, not a new one each render', async () => {
  cachedMock.mockReturnValue([]);
  await renderThrice();

  expect(seen.length).toBeGreaterThanOrEqual(3);
  const first = seen[0];
  for (const later of seen.slice(1)) {
    // The reading itself, and the corrected reading derived from it. A fresh
    // array at either point invalidates everything downstream.
    expect(later.shownMelody).toBe(first.shownMelody);
  }
});

it('ACC-NOTES-249: a note whose take has been kept but not read does the same', async () => {
  cachedMock.mockReturnValue([
    {
      id: 'note-1',
      title: 'Just sung',
      melody: undefined,
      interpretations: undefined
    }
  ] as never);
  await renderThrice();

  const first = seen[0];
  for (const later of seen.slice(1)) {
    expect(later.shownMelody).toBe(first.shownMelody);
  }
});
