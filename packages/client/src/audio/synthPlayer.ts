/**
 * synthPlayer — tone players backed by the one native synth.
 *
 * Every player made here schedules into the same native engine: one sample
 * clock, one voice pool, five busses (INV-NOTES-028/029). The player keeps
 * the TonePlayer shape so call sites do not change; what changes is
 * that "three things sounding at once" is three busses of one graph rather
 * than three AudioContexts that cannot agree on a moment.
 *
 * There is one implementation. A per-context player used to stand in on
 * binaries built before the engine existed; carrying it meant two clocks and
 * two sets of behaviour for builds nobody runs (INV-NOTES-133).
 */
import { midiToFrequency, type TargetNote } from 'logic';

import NativeSynth from '../specs/NativeSynth';
import type { TonePlayer, TonePlayerOptions } from './tonePlayer';

/**
 * Which of the native engine's buses a player sounds on.
 *
 * Numbers rather than names natively: the synth's whole notion of a bus is an
 * index into a level array, so what one means is decided here and adding one
 * costs no build at all (INV-NOTES-121).
 *
 * This is the bus that is not a track: a tapped note, heard on its own and
 * belonging to no mix. The tracks take theirs from the registry, counting up
 * from zero, so the two ranges must not overlap — this starts well past where
 * the registry stops. The bass used to be here too, until it became a track
 * of its own (INV-NOTES-135).
 */
export const AUDITION_BUS = 8;

export const SynthBus = {
  Audition: AUDITION_BUS
} as const;
/**
 * A bus, as a number.
 *
 * Any index the engine has room for is a bus. Narrowing this to a union of
 * named ones would put the registry's numbers outside the type and make
 * adding a track a change here as well (INV-NOTES-121).
 */
export type SynthBusValue = number;

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
): TonePlayer {
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
 * A player sounding on `bus` of the one native engine.
 *
 * There is no second way any more. A binary with no engine cannot make a
 * sound at all, so this says so plainly rather than quietly substituting a
 * different graph on a different clock (INV-NOTES-133).
 */
export function createTonePlayer(
  bus: SynthBusValue,
  options: TonePlayerOptions = {}
): TonePlayer {
  if (!NativeSynth) {
    console.warn(
      '[synthPlayer] no audio engine in this binary; nothing will sound'
    );
    return {
      play: () => undefined,
      setLevel: () => undefined,
      stop: () => undefined
    };
  }
  return createNativePlayer(
    NativeSynth,
    bus,
    options.peakGain ?? REFERENCE_PEAK_GAIN
  );
}
