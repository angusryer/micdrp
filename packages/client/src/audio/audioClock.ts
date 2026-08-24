/**
 * The one clock everything sounding is measured against.
 *
 * The synth schedules on the engine's sample clock, which advances with the
 * audio device. The take was being tracked with `Date.now()`, which advances
 * with the CPU. Two clocks that are not the same clock do not merely differ by
 * a constant — they drift, so a backdrop that started in time wanders out of
 * it over a long take, and no fixed correction can hold it (INV-NOTES-126).
 *
 * So there is one reading, from the audio device where there is one, and the
 * wall clock only where there is no engine to ask. A binary older than
 * `nowMs()` gets exactly the behaviour it had.
 */
import NativeSynth from '../specs/NativeSynth';

/**
 * How far ahead of now anything is scheduled.
 *
 * Long enough for a command to reach the audio thread and be admitted at the
 * next block, short enough that a press does not feel delayed. Shared, because
 * two things scheduled with different leads are two things out of time with
 * each other by the difference (INV-NOTES-126).
 */
export const SCHEDULE_LEAD_MS = 50;

/**
 * Now, on the audio device's clock, in ms.
 *
 * Falls back to the wall clock where there is no engine to ask. The fallback
 * is not equivalent and is not meant to be: it is what the app did before, and
 * a take that drifts slightly is better than one that will not play.
 */
export function audioNowMs(): number {
  const engine = NativeSynth;
  if (engine == null) {
    return Date.now();
  }
  try {
    return engine.nowMs();
  } catch {
    return Date.now();
  }
}

/** Whether the reading above is the audio clock rather than the wall clock. */
export function hasAudioClock(): boolean {
  return NativeSynth != null;
}
