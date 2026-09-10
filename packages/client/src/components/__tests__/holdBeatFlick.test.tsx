/**
 * INV-NOTES-244 — a held beat can still be thrown away.
 *
 * The flick lives in useGraphDrag too, and there is a unit test for the
 * decision it makes. Neither could see this bug: useHoldBeat wins the race
 * for anything that starts on a beat, so useGraphDrag's end-of-gesture check
 * never ran on one, and isFlickAway went on returning true to nobody.
 *
 * So this drives the hold's own handlers, in order, as a finger would. That
 * is the level the bug was at — the gesture had no onEnd at all, and every
 * test below it passed. Driving the composed gesture instead was tried and
 * cannot work: the jest utils emit state transitions but not touch events,
 * so the hold never picks a beat up and every assertion passes vacuously.
 */
import { renderHook } from '@testing-library/react-native';

import { useHoldBeat } from '../useHoldBeat';

const BEAT_X = 100;

interface Travel {
  translationX: number;
  translationY: number;
  velocityY: number;
}

/** The options the graph hands its gestures, with one beat to land on. */
const options = (
  onRemoveBeat: jest.Mock,
  onMoveBeat: jest.Mock,
  onSelect: jest.Mock
) =>
  ({
    tones: [],
    bars: [],
    notes: [],
    layerNotes: [],
    hits: [],
    beats: [{ index: 2, x: BEAT_X }],
    laneHeight: 8,
    originX: 0,
    stepWidth: 10,
    selection: [],
    onSelect,
    onMoveBeat,
    onRemoveBeat
  }) as never;

/** A hold that lands on the beat, then travels as told. */
const hold = (
  gesture: { handlers: Record<string, (...args: never[]) => void> },
  travel: Travel
) => {
  const h = gesture.handlers as unknown as Record<string, Function>;
  const state = { fail: jest.fn(), activate: jest.fn() };
  h.onTouchesDown?.(
    { changedTouches: [{ x: BEAT_X, y: 100 }] } as never,
    state as never
  );
  h.onStart?.({} as never);
  h.onUpdate?.({ ...travel, x: BEAT_X + travel.translationX } as never);
  h.onEnd?.({ ...travel } as never);
  return state;
};

const setup = async () => {
  const onRemoveBeat = jest.fn();
  const onMoveBeat = jest.fn();
  const onSelect = jest.fn();
  const { result } = await renderHook(() =>
    useHoldBeat(options(onRemoveBeat, onMoveBeat, onSelect))
  );
  return { gesture: result.current as never, onRemoveBeat, onMoveBeat, onSelect };
};

describe('a beat held under the finger', () => {
  it('is thrown away by a flick straight up', async () => {
    const { gesture, onRemoveBeat } = await setup();
    hold(gesture, { translationX: 2, translationY: -80, velocityY: -1400 });
    expect(onRemoveBeat).toHaveBeenCalledWith(2);
  });

  it('is not dragged sideways on its way off the graph', async () => {
    const { gesture, onMoveBeat } = await setup();
    hold(gesture, { translationX: 4, translationY: -80, velocityY: -1400 });
    expect(onMoveBeat).not.toHaveBeenCalled();
  });

  it('still moves when the finger travels along the graph instead', async () => {
    const { gesture, onMoveBeat, onRemoveBeat } = await setup();
    hold(gesture, { translationX: 60, translationY: 4, velocityY: 0 });
    expect(onMoveBeat).toHaveBeenCalled();
    expect(onRemoveBeat).not.toHaveBeenCalled();
  });

  it('keeps a slow vertical drag, which is somebody undecided', async () => {
    const { gesture, onRemoveBeat, onMoveBeat } = await setup();
    hold(gesture, { translationX: 2, translationY: -80, velocityY: -100 });
    expect(onRemoveBeat).not.toHaveBeenCalled();
    // Left alone rather than dragged: it was travelling across, not along.
    expect(onMoveBeat).not.toHaveBeenCalled();
  });

  it('refuses a hold that did not land on a beat', async () => {
    const { gesture, onRemoveBeat } = await setup();
    const h = (gesture as { handlers: Record<string, Function> }).handlers;
    const state = { fail: jest.fn(), activate: jest.fn() };
    h.onTouchesDown?.(
      { changedTouches: [{ x: BEAT_X + 300, y: 100 }] } as never,
      state as never
    );
    h.onEnd?.({ translationX: 0, translationY: -80, velocityY: -1400 } as never);
    expect(state.fail).toHaveBeenCalled();
    expect(onRemoveBeat).not.toHaveBeenCalled();
  });
});
