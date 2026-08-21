/**
 * Telling "the backend was briefly away" apart from "the work went wrong" —
 * INV-DOG-025.
 *
 * Getting this wrong in one direction spends the loop's lives on a routine
 * deploy; getting it wrong in the other means a loop genuinely broken keeps
 * running forever. So both directions are pinned.
 */
import { isTransient } from '../transient';

describe('isTransient', () => {
  it('recognises an unreachable backend, which is what started this', () => {
    // PocketBase reports a server it could not reach as status 0. A fly.io
    // deploy restarting mid-run produced exactly this, twice.
    expect(isTransient({ status: 0, message: 'Something went wrong.' })).toBe(true);
  });

  it.each([408, 425, 429, 500, 502, 503, 504])('retries on %s', (status) => {
    expect(isTransient({ status })).toBe(true);
  });

  it.each([400, 401, 403, 404, 409, 422])('does not retry on %s', (status) => {
    // These say the request was wrong. Asking again changes nothing, and
    // treating them as transient would hide a real fault forever.
    expect(isTransient({ status })).toBe(false);
  });

  it.each(['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNRESET', 'EAI_AGAIN'])(
    'recognises %s',
    (code) => {
      expect(isTransient({ code })).toBe(true);
    }
  );

  it('looks inside a wrapped cause, where fetch puts the real reason', () => {
    expect(isTransient({ message: 'x', cause: { code: 'ECONNREFUSED' } })).toBe(true);
  });

  it('recognises a bare fetch failure by its message', () => {
    expect(isTransient(new TypeError('fetch failed'))).toBe(true);
    expect(isTransient({ message: 'Network request failed' })).toBe(true);
  });

  it('does not treat an ordinary error as the backend being away', () => {
    // The important half: a genuine bug must still count toward the halt.
    expect(isTransient(new Error('preflight failed'))).toBe(false);
    expect(isTransient({ message: 'delivery failed: protected path' })).toBe(false);
  });

  it('handles things that are not errors at all', () => {
    expect(isTransient(null)).toBe(false);
    expect(isTransient(undefined)).toBe(false);
    expect(isTransient('offline')).toBe(false);
    expect(isTransient(42)).toBe(false);
  });

  it('does not loop forever on an error that causes itself', () => {
    const circular: { cause?: unknown; message: string } = { message: 'x' };
    circular.cause = circular;
    expect(isTransient(circular)).toBe(false);
  });
});
