/**
 * Transition tests for the sessionMachine. Pure, no device.
 */

import { interpret } from 'xstate';
import {
  sessionMachine,
  SESSION_MACHINE_ID,
  INITIAL_SESSION_CONTEXT
} from '../sessionMachine';

describe('sessionMachine', () => {
  it('has the expected id and initial state', () => {
    expect(sessionMachine.id).toBe(SESSION_MACHINE_ID);
    expect(sessionMachine.initial).toBe('booting');
    expect(sessionMachine.initialState.context).toEqual(
      INITIAL_SESSION_CONTEXT
    );
  });

  it('booting -> ready on READY', () => {
    const next = sessionMachine.transition('booting', { type: 'READY' });
    expect(next.matches('ready')).toBe(true);
  });

  it('booting -> failed on BOOT_FAILED, with a message', () => {
    const next = sessionMachine.transition('booting', {
      type: 'BOOT_FAILED',
      message: 'store unavailable'
    });
    expect(next.matches('failed')).toBe(true);
    expect(next.context.errorMessage).toBe('store unavailable');
  });

  it('BOOT_FAILED without a message falls back to a default', () => {
    const next = sessionMachine.transition('booting', {
      type: 'BOOT_FAILED'
    });
    expect(next.matches('failed')).toBe(true);
    expect(typeof next.context.errorMessage).toBe('string');
    expect(next.context.errorMessage).not.toBeNull();
  });

  it('ready -> booting on RELOAD, clearing any prior error', () => {
    const failed = sessionMachine.transition('booting', {
      type: 'BOOT_FAILED',
      message: 'boom'
    });
    const reload = sessionMachine.transition(failed, { type: 'RELOAD' });
    expect(reload.matches('booting')).toBe(true);
    // booting entry clears the error.
    expect(reload.context.errorMessage).toBeNull();
  });

  it('failed -> booting on RELOAD', () => {
    const next = sessionMachine.transition('failed', { type: 'RELOAD' });
    expect(next.matches('booting')).toBe(true);
  });

  it('fires injected lifecycle actions via withConfig', () => {
    const onBoot = jest.fn();
    const onReady = jest.fn();

    const configured = sessionMachine.withConfig({
      actions: { onBoot, onReady }
    });

    const service = interpret(configured).start();
    // onBoot fires on the initial entry to `booting`.
    expect(onBoot).toHaveBeenCalledTimes(1);
    service.send({ type: 'READY' });
    expect(onReady).toHaveBeenCalledTimes(1);
    expect(service.state.matches('ready')).toBe(true);

    service.send({ type: 'RELOAD' });
    expect(onBoot).toHaveBeenCalledTimes(2);
    expect(service.state.matches('booting')).toBe(true);
    service.stop();
  });
});
