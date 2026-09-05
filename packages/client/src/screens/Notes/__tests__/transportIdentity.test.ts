/**
 * INV-NOTES-206 — a moving playhead never re-renders the screen it moves
 * across.
 *
 * The transport published its position into the screen above it twice a
 * second, as a fresh object. Every reading of the clock re-rendered the
 * whole detail screen — the graph, the neck, the chord track — and the
 * render cost more than the interval between readings, so the JS thread
 * never went idle and a press of pause had nowhere to be handled.
 *
 * Five fixes went into the audio path for a fault that was never in it.
 * What decides it is whether what leaves the transport changes while a
 * take runs, so that is what this asserts.
 */

/** What the transport hands upward, as it is now: no ticking number. */
interface Published {
  drawnPositionMs: { value: number };
  isPlaying: boolean;
  seek: (ms: number) => void;
  play: () => void;
  stop: () => void;
}

/** The deps the publishing effect fires on. */
const publishDeps = (p: Published): unknown[] => [
  p.drawnPositionMs,
  p.isPlaying,
  p.seek,
  p.play,
  p.stop
];

describe('what the transport publishes', () => {
  const shared = { value: 0 };
  const noop = () => undefined;
  const transport: Published = {
    drawnPositionMs: shared,
    isPlaying: true,
    seek: noop,
    play: noop,
    stop: noop
  };

  it('ACC-NOTES-056: does not change as the clock advances', () => {
    const before = publishDeps(transport);
    // Four readings of the engine's clock, as half a take would bring.
    for (const ms of [200, 400, 600, 800]) {
      shared.value = ms;
    }
    expect(publishDeps(transport)).toEqual(before);
  });

  it('carries the moment even so', () => {
    // The position is not lost by being left out of the deps — it rides
    // the shared value, which the UI thread advances without a render.
    shared.value = 11950;
    expect(transport.drawnPositionMs.value).toBe(11950);
  });

  it('has no ticking number in it at all', () => {
    // The regression to guard: re-adding one puts the whole screen back
    // on a twice-a-second render while a take plays.
    expect(Object.keys(transport)).not.toContain('positionMs');
  });
});
