/**
 * synthPlayer — tone players backed by the one native synth.
 *
 * Every player made here schedules into the same native engine: one sample
 * clock, one voice pool, four busses (INV-NOTES-028/029). The player keeps
 * the ReferenceTonePlayer shape so call sites do not change; what changes is
 * that "three things sounding at once" is three busses of one graph rather
 * than three AudioContexts that cannot agree on a moment.
 *
 * On a binary without the native module — bundles ship over the air to
 * binaries built before it existed — the factory returns the old per-context
 * player instead, so playback degrades to what it was rather than to silence
 * (INV-NOTES-030).
 */
import { midiToFrequency, type TargetNote } from 'logic';

import NativeSynth from '../specs/NativeSynth';
import {
  createReferenceTonePlayer,
  type ReferenceToneOptions,
  type ReferenceTonePlayer
} from './referenceTone';

/** Which of the native engine's busses a player sounds on. */
export const SynthBus = {
  Take: 0,
  Melody: 1,
  Chords: 2,
  Audition: 3
} as const;
export type SynthBusValue = (typeof SynthBus)[keyof typeof SynthBus];

/**
 * The per-note peak the old players used by default. A caller's `peakGain`
 * keeps its old meaning by being read against this: the bus level becomes
 * `level * peakGain / REFERENCE_PEAK_GAIN`, so a mix tuned by ear against the
 * old players still holds.
 */
const REFERENCE_PEAK_GAIN = 0.2;

/** Scheduled this far past the clock read, so the first note is not already late. */
const LEAD_MS = 50;

/** Players currently holding the engine; the last one out stops it. */
let holders = 0;
let startPromise: Promise<void> | null = null;

function acquireEngine(): Promise<void> {
  holders += 1;
  if (!startPromise) {
    startPromise = NativeSynth ? NativeSynth.start() : Promise.resolve();
  }
  return startPromise;
}

function releaseEngine(): void {
  holders -= 1;
  if (holders <= 0) {
    holders = 0;
    startPromise = null;
    void NativeSynth?.stop();
  }
}

function createNativePlayer(
  synth: NonNullable<typeof NativeSynth>,
  bus: SynthBusValue,
  peakGain: number
): ReferenceTonePlayer {
  let level = 1;
  let holding = false;
  /** Bumped by stop(): a play still awaiting start() must not schedule. */
  let generation = 0;

  const busLevel = () =>
    Math.min(1, Math.max(0, (level * peakGain) / REFERENCE_PEAK_GAIN));

  function stop(): void {
    generation += 1;
    if (holding) {
      synth.clearBus(bus);
      holding = false;
      releaseEngine();
    }
  }

  function setLevel(next: number): void {
    level = Math.min(Math.max(next, 0), 1);
    if (holding) {
      synth.setBusLevel(bus, busLevel());
    }
  }

  /** Hold the engine from first play until stop; a re-play keeps the hold. */
  function ensureHolding(): Promise<void> {
    if (!holding) {
      holding = true;
      return acquireEngine();
    }
    return startPromise ?? Promise.resolve();
  }

  function play(notes: readonly TargetNote[]): void {
    if (notes.length === 0) {
      stop(); // what the old player did: play nothing = stop
      return;
    }
    if (holding) {
      synth.clearBus(bus);
    }
    const gen = (generation += 1);
    void ensureHolding().then(() => {
      if (gen !== generation || !holding) {
        return; // stopped, or replaced by a later play, while starting
      }
      synth.setBusLevel(bus, busLevel());
      const anchorMs = synth.nowMs() + LEAD_MS;
      synth.schedule(
        notes.map((note) => ({
          bus,
          frequencyHz: midiToFrequency(note.midi),
          startMs: anchorMs + note.startMs,
          endMs: anchorMs + note.endMs
        }))
      );
    });
  }

  return { play, stop, setLevel };
}

/**
 * A ReferenceTonePlayer sounding on `bus` of the shared native synth, or the
 * old per-context player when the binary has no synth (INV-NOTES-030).
 * `options.peakGain` keeps its old meaning; the rest of the options only
 * apply to the fallback.
 */
export function createTonePlayer(
  bus: SynthBusValue,
  options: ReferenceToneOptions = {}
): ReferenceTonePlayer {
  if (!NativeSynth) {
    return createReferenceTonePlayer(options);
  }
  return createNativePlayer(
    NativeSynth,
    bus,
    options.peakGain ?? REFERENCE_PEAK_GAIN
  );
}
