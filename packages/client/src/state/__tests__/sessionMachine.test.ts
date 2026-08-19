/**
 * Transition tests for the sessionMachine. Pure, no device.
 *
 * XState 5 dropped transitioning from a bare state-value string, so these
 * drive a real actor to the state under test instead.
 */

import { createActor } from 'xstate';
import {
  sessionMachine,
  SESSION_MACHINE_ID,
  INITIAL_SESSION_CONTEXT
} from '../sessionMachine';
import type { SessionEvent } from '../sessionMachine';

/** The snapshot reached after the given events. */
function snapshotAfter(...events: SessionEvent[]) {
  const actor = createActor(sessionMachine).start();
  events.forEach((event) => actor.send(event));
  const snapshot = actor.getSnapshot();
  actor.stop();
  return snapshot;
}

describe('sessionMachine', () => {
  it('has the expected id and initial state', () => {
    expect(sessionMachine.id).toBe(SESSION_MACHINE_ID);
    const initial = snapshotAfter();
    expect(initial.matches('booting')).toBe(true);
    expect(initial.context).toEqual(INITIAL_SESSION_CONTEXT);
  });

  it('booting -> ready on READY', () => {
    expect(snapshotAfter({ type: 'READY' }).matches('ready')).toBe(true);
  });

  it('booting -> failed on BOOT_FAILED, with a message', () => {
    const next = snapshotAfter({
      type: 'BOOT_FAILED',
      message: 'store unavailable'
    });
    expect(next.matches('failed')).toBe(true);
    expect(next.context.errorMessage).toBe('store unavailable');
  });

  it('BOOT_FAILED without a message falls back to a default', () => {
    const next = snapshotAfter({ type: 'BOOT_FAILED' });
    expect(next.matches('failed')).toBe(true);
    expect(typeof next.context.errorMessage).toBe('string');
    expect(next.context.errorMessage).not.toBeNull();
  });

  it('failed -> booting on RELOAD, clearing any prior error', () => {
    const next = snapshotAfter(
      { type: 'BOOT_FAILED', message: 'boom' },
      { type: 'RELOAD' }
    );
    expect(next.matches('booting')).toBe(true);
    // booting entry clears the error.
    expect(next.context.errorMessage).toBeNull();
  });

  it('ready -> booting on RELOAD', () => {
    const next = snapshotAfter({ type: 'READY' }, { type: 'RELOAD' });
    expect(next.matches('booting')).toBe(true);
  });

  it('fires injected lifecycle actions via provide', () => {
    const onBoot = jest.fn();
    const onReady = jest.fn();

    const configured = sessionMachine.provide({
      actions: { onBoot, onReady }
    });

    const actor = createActor(configured).start();
    // onBoot fires on the initial entry to `booting`.
    expect(onBoot).toHaveBeenCalledTimes(1);
    actor.send({ type: 'READY' });
    expect(onReady).toHaveBeenCalledTimes(1);
    expect(actor.getSnapshot().matches('ready')).toBe(true);

    actor.send({ type: 'RELOAD' });
    expect(onBoot).toHaveBeenCalledTimes(2);
    expect(actor.getSnapshot().matches('booting')).toBe(true);
    actor.stop();
  });
});
