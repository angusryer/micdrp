/**
 * Transition tests for the recordingMachine.
 *
 * These exercise the pure machine with NO injected services — using both the
 * synchronous `transition()` API (state algebra) and an `interpret`ed service
 * (context assignment over time). No device, no audio, no UI.
 */

import { interpret } from 'xstate';
import {
  recordingMachine,
  RECORDING_MACHINE_ID,
  INITIAL_RECORDING_CONTEXT
} from '../recordingMachine';
import type { RecordingHandle } from '../../audio/contract';

const handle: RecordingHandle = {
  id: 'rec-1',
  uri: 'file:///tmp/rec-1.caf',
  sampleRateHz: 44100,
  durationMs: 1234,
  samples: [
    { timestampMs: 0, frequencyHz: 440, clarity: 0.99, midi: 69, cents: 0 }
  ]
};

describe('recordingMachine', () => {
  it('has the expected id and initial state', () => {
    expect(recordingMachine.id).toBe(RECORDING_MACHINE_ID);
    expect(recordingMachine.initial).toBe('idle');
    expect(recordingMachine.initialState.context).toEqual(
      INITIAL_RECORDING_CONTEXT
    );
  });

  it('idle -> requestingPermission on REQUEST_PERMISSION', () => {
    const next = recordingMachine.transition('idle', {
      type: 'REQUEST_PERMISSION'
    });
    expect(next.matches('requestingPermission')).toBe(true);
  });

  it('requestingPermission -> recording on PERMISSION_GRANTED', () => {
    const next = recordingMachine.transition('requestingPermission', {
      type: 'PERMISSION_GRANTED'
    });
    expect(next.matches('recording')).toBe(true);
  });

  it('requestingPermission -> error on PERMISSION_DENIED, with a message', () => {
    const next = recordingMachine.transition('requestingPermission', {
      type: 'PERMISSION_DENIED'
    });
    expect(next.matches('error')).toBe(true);
    expect(typeof next.context.errorMessage).toBe('string');
    expect(next.context.errorMessage).not.toBeNull();
  });

  it('recording -> analyzing on STOP', () => {
    const next = recordingMachine.transition('recording', { type: 'STOP' });
    expect(next.matches('analyzing')).toBe(true);
  });

  it('analyzing -> result on ANALYZED, capturing the handle', () => {
    const next = recordingMachine.transition('analyzing', {
      type: 'ANALYZED',
      data: handle
    });
    expect(next.matches('result')).toBe(true);
    expect(next.context.handle).toEqual(handle);
    expect(next.context.errorMessage).toBeNull();
  });

  it('result -> idle on RESET, clearing the handle', () => {
    const inResult = recordingMachine.transition('analyzing', {
      type: 'ANALYZED',
      data: handle
    });
    const next = recordingMachine.transition(inResult, { type: 'RESET' });
    expect(next.matches('idle')).toBe(true);
    // idle entry clears context.
    expect(next.context.handle).toBeNull();
    expect(next.context.errorMessage).toBeNull();
  });

  it('idle -> recording on START (permission already held)', () => {
    const next = recordingMachine.transition('idle', { type: 'START' });
    expect(next.matches('recording')).toBe(true);
  });

  it('ERROR from any state lands in error with the supplied message', () => {
    const next = recordingMachine.transition('recording', {
      type: 'ERROR',
      message: 'mic unplugged'
    });
    expect(next.matches('error')).toBe(true);
    expect(next.context.errorMessage).toBe('mic unplugged');
  });

  it('error -> idle on RESET and -> requestingPermission on REQUEST_PERMISSION', () => {
    const reset = recordingMachine.transition('error', { type: 'RESET' });
    expect(reset.matches('idle')).toBe(true);

    const retry = recordingMachine.transition('error', {
      type: 'REQUEST_PERMISSION'
    });
    expect(retry.matches('requestingPermission')).toBe(true);
  });

  it('drives a full happy-path session through an interpreted service', (done) => {
    const service = interpret(recordingMachine).onTransition((state) => {
      if (state.matches('result')) {
        expect(state.context.handle).toEqual(handle);
        expect(state.context.errorMessage).toBeNull();
        service.stop();
        done();
      }
    });
    service.start();

    service.send({ type: 'REQUEST_PERMISSION' });
    service.send({ type: 'PERMISSION_GRANTED' });
    service.send({ type: 'STOP' });
    service.send({ type: 'ANALYZED', data: handle });
  });

  it('lets the screen inject side effects via withConfig without changing transitions', () => {
    const engineStart = jest.fn();
    const engineStop = jest.fn();
    const onResult = jest.fn();

    const configured = recordingMachine.withConfig({
      actions: { engineStart, engineStop, onResult }
    });

    const service = interpret(configured).start();
    service.send({ type: 'START' });
    expect(engineStart).toHaveBeenCalledTimes(1);
    service.send({ type: 'STOP' });
    expect(engineStop).toHaveBeenCalledTimes(1);
    service.send({ type: 'ANALYZED', data: handle });
    expect(onResult).toHaveBeenCalledTimes(1);
    expect(service.state.matches('result')).toBe(true);
    service.stop();
  });
});
