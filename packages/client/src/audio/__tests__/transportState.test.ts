/**
 * What a transport is doing, as one word (INV-TPORT-001).
 *
 * Pure, so the rules a transport runs by can be argued with here rather
 * than on a device. Every one of them was a fault first.
 */
import {
  accepts,
  isBusy,
  isSounding,
  keepsTheMoment,
  nextState
} from '../transportState';

describe('what a state means', () => {
  it('knows when a sound is running', () => {
    expect(isSounding('playing')).toBe(true);
    expect(isSounding('paused')).toBe(false);
    // Loading is busy, and busy is not sounding. Conflating them is how a
    // control came to offer pause over a take that had not started.
    expect(isSounding('loading')).toBe(false);
  });

  it('refuses a press only while a decode is under way', () => {
    expect(isBusy('loading')).toBe(true);
    expect(isBusy('playing')).toBe(false);
  });

  it('knows which command keeps the moment', () => {
    // The difference between pause and stop, and the whole reason both
    // exist. It used to live in a comment.
    expect(keepsTheMoment('pause')).toBe(true);
    expect(keepsTheMoment('stop')).toBe(false);
  });
});

describe('what a state will accept', () => {
  it('will not start a take that is already on its way', () => {
    expect(accepts('loading', 'play')).toBe(false);
    expect(accepts('playing', 'play')).toBe(false);
    expect(accepts('stopped', 'play')).toBe(true);
    expect(accepts('failed', 'play')).toBe(true);
  });

  it('takes a silencing command whatever it is doing', () => {
    // Refusing to silence would make every control ask first, and a
    // control that has to ask is a control with an opinion.
    for (const state of ['idle', 'loading', 'playing', 'paused', 'stopped'] as const) {
      expect(accepts(state, 'pause')).toBe(true);
      expect(accepts(state, 'stop')).toBe(true);
    }
  });
});

describe('where a command leaves it', () => {
  it('sends a press to loading before it sounds', () => {
    expect(nextState('stopped', 'play')).toBe('loading');
  });

  it('pauses only what was actually playing', () => {
    expect(nextState('playing', 'pause')).toBe('paused');
    // There is no moment to hold, and calling it paused would promise one.
    expect(nextState('stopped', 'pause')).toBe('stopped');
  });

  it('INV-TPORT-016: stops a take still loading rather than holding it there', () => {
    // This said 'loading', which is a promise that a run is on its way —
    // and pausing is what cancels the run. The state was left spinning
    // with nothing left to resolve it.
    expect(nextState('loading', 'pause')).toBe('stopped');
  });

  it('stops from anywhere', () => {
    expect(nextState('playing', 'stop')).toBe('stopped');
    expect(nextState('loading', 'stop')).toBe('stopped');
  });

  it('leaves seeking to decide nothing about sound', () => {
    expect(nextState('playing', 'seek')).toBe('playing');
    expect(nextState('stopped', 'seek')).toBe('stopped');
  });
});
