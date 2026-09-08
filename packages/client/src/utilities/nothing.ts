/**
 * One empty array, shared (INV-NOTES-234).
 *
 * An empty literal written as a default — `notes = []` in a destructure — is
 * a different array on every render, and a different array invalidates every
 * memo it reaches. That has stopped this app twice: once through a reading
 * that had not arrived, and once through three gesture options that fed a
 * dependency array. Both looked like heat and were identity.
 *
 * `readonly never[]` because nothing can be in it, which makes it assignable
 * wherever a `readonly T[]` is wanted without anyone having to declare a
 * typed empty of their own.
 */
export const NOTHING: readonly never[] = [];
