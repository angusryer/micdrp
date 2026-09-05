/**
 * INV-TPORT-002 — nothing the transport publishes changes while a take
 * runs. Asserted against the real hook, not a sketch of it.
 *
 * There was already a test for the shape of this and it passed while the
 * app looped: it checked a hand-written object, not what `useTakeVoice`
 * actually returns. The hook returned fresh closures on every render,
 * those travelled up into the object the screen is handed, and
 * re-publishing it re-rendered the screen — a loop that starved the JS
 * thread until the app was backgrounded and React stopped rendering.
 *
 * A play that never left its spinner, and audio starting the moment the
 * app went to the background. Both from an invariant that had a test
 * which could not see the code it governed.
 */
import { act, create } from 'react-test-renderer';
import React from 'react';

import { useTakeVoice } from '../useTakeVoice';

const seen: ReturnType<typeof useTakeVoice>[] = [];

function Probe(): null {
  seen.push(useTakeVoice({ resolveAudioUri: () => Promise.resolve(null) }));
  return null;
}

beforeEach(() => {
  seen.length = 0;
});

describe('what the take voice hands upward', () => {
  it('keeps every command identical across renders', async () => {
    let tree!: ReturnType<typeof create>;
    await act(async () => {
      tree = create(<Probe />);
    });
    // A re-render for any other reason at all — a parent redrawing, a
    // level moving, a sibling changing.
    await act(async () => {
      tree.update(<Probe />);
    });
    await act(async () => {
      tree.update(<Probe />);
    });

    expect(seen.length).toBeGreaterThanOrEqual(3);
    const first = seen[0];
    for (const later of seen.slice(1)) {
      expect(later.play).toBe(first.play);
      expect(later.pause).toBe(first.pause);
      expect(later.stop).toBe(first.stop);
      expect(later.seek).toBe(first.seek);
      expect(later.setLevel).toBe(first.setLevel);
      expect(later.elapsedMs).toBe(first.elapsedMs);
      // The head is a shared value; a new one every render would leave
      // every display watching an object nothing writes to.
      expect(later.drawnPositionMs).toBe(first.drawnPositionMs);
    }

    await act(async () => {
      tree.unmount();
    });
  });
});
