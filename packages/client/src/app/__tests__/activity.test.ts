/**
 * INV-UPD-004 — an update never interrupts singing — and INV-UPD-007, the
 * deferral that must not become a nag.
 *
 * These two are the whole of the prompt's policy, and both are pure, so they
 * are tested here rather than through the component.
 */
import { deferUpdate, isDeferred, resetDeferralsForTests } from '../../updates/apply';
import {
  isBusy,
  markBusy,
  resetBusyForTests,
  subscribeToBusy
} from '../activity';

beforeEach(() => {
  resetBusyForTests();
  resetDeferralsForTests();
});

describe('busy', () => {
  it('is idle until something says otherwise', () => {
    expect(isBusy()).toBe(false);
  });

  it('ACC-UPD-014: a capture makes the app busy', () => {
    markBusy('capture');
    expect(isBusy()).toBe(true);
  });

  it('ACC-UPD-016: ending the capture makes it idle again', () => {
    const done = markBusy('capture');
    done();
    expect(isBusy()).toBe(false);
  });

  it('stays busy while any one activity is still running', () => {
    const capture = markBusy('capture');
    markBusy('practice session');
    capture();
    expect(isBusy()).toBe(true);
  });

  it('a release is idempotent, so a double unmount cannot end someone else', () => {
    const capture = markBusy('capture');
    capture();
    markBusy('practice session');
    capture();
    expect(isBusy()).toBe(true);
  });

  it('announces the transition, so a held prompt can present at once', () => {
    const seen: boolean[] = [];
    subscribeToBusy(() => seen.push(isBusy()));
    const done = markBusy('capture');
    done();
    expect(seen).toEqual([true, false]);
  });

  it('stops announcing once unsubscribed', () => {
    const listener = jest.fn();
    subscribeToBusy(listener)();
    markBusy('capture');
    expect(listener).not.toHaveBeenCalled();
  });
});

describe('deferral', () => {
  it('ACC-UPD-018: a deferred bundle stays deferred', () => {
    deferUpdate('b2');
    expect(isDeferred('b2')).toBe(true);
  });

  it('ACC-UPD-020: deferring one bundle does not defer the next', () => {
    deferUpdate('b2');
    expect(isDeferred('b3')).toBe(false);
  });
});
