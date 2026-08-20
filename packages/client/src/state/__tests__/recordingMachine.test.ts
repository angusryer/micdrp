/**
 * Transition tests for the recordingMachine.
 *
 * XState 5 removed the v4 shorthand of transitioning from a bare state-value
 * string; `transition()` now needs a snapshot and an actor scope. Driving a
 * real actor to the state under test is both simpler and closer to how the
 * screen uses the machine, so that is what `actorAfter` does. Still no device,
 * no audio, no UI.
 */

import { createActor } from 'xstate';
import {
  recordingMachine,
  RECORDING_MACHINE_ID,
  INITIAL_RECORDING_CONTEXT
} from '../recordingMachine';
import type { RecordingEvent } from '../recordingMachine';
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

/** Start an actor and drive it with the given events, returning it running. */
function actorAfter(...events: RecordingEvent[]) {
  const actor = createActor(recordingMachine).start();
  events.forEach((event) => actor.send(event));
  return actor;
}

/** The snapshot reached after the given events. */
function snapshotAfter(...events: RecordingEvent[]) {
  const actor = actorAfter(...events);
  const snapshot = actor.getSnapshot();
  actor.stop();
  return snapshot;
}

describe('recordingMachine', () => {
  it('has the expected id and initial state', () => {
    expect(recordingMachine.id).toBe(RECORDING_MACHINE_ID);
    const initial = snapshotAfter();
    expect(initial.matches('idle')).toBe(true);
    expect(initial.context).toEqual(INITIAL_RECORDING_CONTEXT);
  });

  it('idle -> requestingPermission on REQUEST_PERMISSION', () => {
    expect(
      snapshotAfter({ type: 'REQUEST_PERMISSION' }).matches(
        'requestingPermission'
      )
    ).toBe(true);
  });

  it('requestingPermission -> recording on PERMISSION_GRANTED', () => {
    const next = snapshotAfter(
      { type: 'REQUEST_PERMISSION' },
      { type: 'PERMISSION_GRANTED' }
    );
    expect(next.matches('recording')).toBe(true);
  });

  it('requestingPermission -> error on PERMISSION_DENIED, with a message', () => {
    const next = snapshotAfter(
      { type: 'REQUEST_PERMISSION' },
      { type: 'PERMISSION_DENIED' }
    );
    expect(next.matches('error')).toBe(true);
    expect(typeof next.context.errorMessage).toBe('string');
    expect(next.context.errorMessage).not.toBeNull();
  });

  it('recording -> analyzing on STOP', () => {
    const next = snapshotAfter({ type: 'START' }, { type: 'STOP' });
    expect(next.matches('analyzing')).toBe(true);
  });

  it('analyzing -> result on ANALYZED, capturing the handle', () => {
    const next = snapshotAfter(
      { type: 'START' },
      { type: 'STOP' },
      { type: 'ANALYZED', data: handle }
    );
    expect(next.matches('result')).toBe(true);
    expect(next.context.handle).toEqual(handle);
    expect(next.context.errorMessage).toBeNull();
  });

  it('result -> idle on RESET, clearing the handle', () => {
    const next = snapshotAfter(
      { type: 'START' },
      { type: 'STOP' },
      { type: 'ANALYZED', data: handle },
      { type: 'RESET' }
    );
    expect(next.matches('idle')).toBe(true);
    // idle entry clears context.
    expect(next.context.handle).toBeNull();
    expect(next.context.errorMessage).toBeNull();
  });

  it('idle -> recording on START (permission already held)', () => {
    expect(snapshotAfter({ type: 'START' }).matches('recording')).toBe(true);
  });

  it('ERROR from any state lands in error with the supplied message', () => {
    const next = snapshotAfter(
      { type: 'START' },
      { type: 'ERROR', message: 'mic unplugged' }
    );
    expect(next.matches('error')).toBe(true);
    expect(next.context.errorMessage).toBe('mic unplugged');
  });

  it('error -> idle on RESET and -> requestingPermission on REQUEST_PERMISSION', () => {
    const denied: RecordingEvent[] = [
      { type: 'REQUEST_PERMISSION' },
      { type: 'PERMISSION_DENIED' }
    ];
    expect(snapshotAfter(...denied, { type: 'RESET' }).matches('idle')).toBe(
      true
    );
    expect(
      snapshotAfter(...denied, { type: 'REQUEST_PERMISSION' }).matches(
        'requestingPermission'
      )
    ).toBe(true);
  });

  it('drives a full happy-path session through a running actor', () => {
    const actor = actorAfter(
      { type: 'REQUEST_PERMISSION' },
      { type: 'PERMISSION_GRANTED' },
      { type: 'STOP' },
      { type: 'ANALYZED', data: handle }
    );
    const snapshot = actor.getSnapshot();
    expect(snapshot.matches('result')).toBe(true);
    expect(snapshot.context.handle).toEqual(handle);
    expect(snapshot.context.errorMessage).toBeNull();
    actor.stop();
  });

  it('lets the screen inject side effects via provide without changing transitions', () => {
    const engineStart = jest.fn();
    const engineStop = jest.fn();
    const onResult = jest.fn();

    const configured = recordingMachine.provide({
      actions: { engineStart, engineStop, onResult }
    });

    const actor = createActor(configured).start();
    actor.send({ type: 'START' });
    expect(engineStart).toHaveBeenCalledTimes(1);
    actor.send({ type: 'STOP' });
    expect(engineStop).toHaveBeenCalledTimes(1);
    actor.send({ type: 'ANALYZED', data: handle });
    expect(onResult).toHaveBeenCalledTimes(1);
    expect(actor.getSnapshot().matches('result')).toBe(true);
    actor.stop();
  });
});

describe('recording a second time — INV-NOTES-013 / ACC-NOTES-025', () => {
  const throughOneCapture: RecordingEvent[] = [
    { type: 'REQUEST_PERMISSION' },
    { type: 'PERMISSION_GRANTED' },
    { type: 'STOP' },
    { type: 'ANALYZED', data: handle }
  ];

  it('parks in result, which by itself cannot start another capture', () => {
    // This is the shape of the bug: the state reached after a capture ignores
    // the events the record control sends.
    const after = snapshotAfter(...throughOneCapture, {
      type: 'REQUEST_PERMISSION'
    });
    expect(after.value).toBe('result');
  });

  it('accepts a new capture once reset, which is what start() now sends', () => {
    const after = snapshotAfter(
      ...throughOneCapture,
      { type: 'RESET' },
      { type: 'REQUEST_PERMISSION' },
      { type: 'PERMISSION_GRANTED' }
    );
    expect(after.value).toBe('recording');
  });

  it('recovers from a failed capture the same way', () => {
    const after = snapshotAfter(
      { type: 'REQUEST_PERMISSION' },
      { type: 'PERMISSION_DENIED' },
      { type: 'RESET' },
      { type: 'REQUEST_PERMISSION' },
      { type: 'PERMISSION_GRANTED' }
    );
    expect(after.value).toBe('recording');
  });

  it('ignores a reset from idle, so the first capture is unaffected', () => {
    const after = snapshotAfter(
      { type: 'RESET' },
      { type: 'REQUEST_PERMISSION' },
      { type: 'PERMISSION_GRANTED' }
    );
    expect(after.value).toBe('recording');
  });
});

