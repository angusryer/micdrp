/**
 * ACC-NOTES-239 / INV-NOTES-225 — what an edit does, it does once.
 *
 * The transport object carries the state it is in, so it is a different
 * object the moment anything is playing. Both listen-back effects listed the
 * callbacks they used, every one of which was rebuilt from that object — so
 * both ran on every render: mark the stretch, seek to it, play it, clear it,
 * silence it. Pressing play re-rendered the screen, which seeked back to the
 * last retimed note and stopped the take, so a take could not be played at
 * all once a note had been moved in time.
 *
 * Driven through the real hook with a transport rebuilt each render, because
 * a test holding one object cannot see any of that.
 */
import { act, create } from 'react-test-renderer';
import React from 'react';

import { useListenBack } from '../useListenBack';
import type { Chosen } from '../../../components/graphSelection';

const seek = jest.fn();
const play = jest.fn();
const stop = jest.fn();

/** Stable, so choosing nothing new is not read as choosing something. */
const NOTHING_CHOSEN: Chosen = [];

function Probe({
  nth,
  selection = NOTHING_CHOSEN
}: {
  nth: number;
  selection?: Chosen;
}): null {
  useListenBack({
    // A fresh object every render — what the screen actually hands down.
    transport: { seek, play, stop },
    durationMs: 20000,
    retimed: { fromMs: 2000, toMs: 2500, nth },
    selection
  });
  return null;
}

/** Held so every test can take its screen away again. */
let tree: ReturnType<typeof create> | null = null;

const render = async (element: React.ReactElement): Promise<void> => {
  await act(async () => {
    if (tree == null) {
      tree = create(element);
    } else {
      tree.update(element);
    }
  });
};

beforeEach(() => {
  seek.mockReset();
  play.mockReset();
  stop.mockReset();
});

// The stretch stops itself on a timer. Leaving the screen up leaves that
// timer to fire into a torn-down test.
afterEach(async () => {
  const up = tree;
  tree = null;
  await act(async () => up?.unmount());
});

it('ACC-NOTES-239: plays the marked stretch once, however often the screen redraws', async () => {
  await render(<Probe nth={1} />);
  await render(<Probe nth={1} />);
  await render(<Probe nth={1} />);
  expect(play).toHaveBeenCalledTimes(1);
  // And the head was moved once, to the start of the stretch, rather than
  // dragged back there on every redraw.
  expect(seek).toHaveBeenCalledTimes(1);
});

it('plays again when the note is moved again', async () => {
  await render(<Probe nth={1} />);
  await render(<Probe nth={2} />);
  // The same note moved twice is two edits, and asks to be heard twice.
  expect(play).toHaveBeenCalledTimes(2);
});

it('takes the mark away when something else is chosen', async () => {
  await render(<Probe nth={1} />);
  await render(<Probe nth={1} selection={[{ kind: 'melodyNote', index: 3 }]} />);
  // A stretch belongs to the edit that marked it, and it was sounding.
  expect(stop).toHaveBeenCalled();
});
