/**
 * Starting the tracks at the loudness the take was actually sung at
 * (INV-NOTES-141).
 *
 * The tracks were balanced at fixed numbers chosen by ear against one take.
 * Against a take sung twice as quietly the same numbers bury it; against a
 * loud one they vanish under it. The singer then does by hand, on every note,
 * what a measurement could do once.
 *
 * Measured from the notes rather than from the file. A file's average
 * includes every silence between phrases and the room behind them, so a take
 * with long gaps reads as quiet when the singing was not — which would raise
 * the floor instead of matching the voice. The per-note loudness is exactly
 * what was sung (INV-PITCH-020).
 */

/**
 * The amplitude one synthesized voice reaches at full level.
 *
 * Mirrors `kVoicePeak` in cpp/dsp/synth.cpp. Stated here because the match is
 * a ratio between that and the take, and a ratio needs both halves — the
 * engine cannot be asked from a pure function, and a number invented here
 * would silently drift from the one that makes the sound.
 */
export const VOICE_PEAK = 0.18;

/** Below this a reading is the room rather than a voice, and says nothing. */
const SILENT_DB = -60;

/** How far the match may move the tracks, so one odd take cannot mute them. */
const MIN_GAIN = 0.25;
const MAX_GAIN = 2;

/**
 * How loud the sung notes were, in dBFS, or null when nothing measured them.
 *
 * The median, because one shouted note is not the loudness of a performance.
 * Notes nothing measured are left out rather than counted as silence: "nobody
 * looked" and "it was silent" are different claims and only one is about the
 * singing.
 */
export function sungLoudnessDb(
  melody: readonly { loudnessDb?: number | null }[]
): number | null {
  const measured = melody
    .map((note) => note.loudnessDb)
    .filter((db): db is number => db != null && db > SILENT_DB)
    .sort((a, b) => a - b);
  if (measured.length === 0) {
    return null;
  }
  const mid = measured.length >> 1;
  return measured.length % 2 === 0
    ? (measured[mid - 1] + measured[mid]) / 2
    : measured[mid];
}

/**
 * How much every synthesized track moves, to sit where the take sits.
 *
 * One factor for all of them, so the balance they were given survives and
 * only the whole moves. Bounded, because a take recorded at arm's length
 * across a room should quieten the accompaniment and not silence it.
 */
export function matchGain(loudnessDb: number | null): number {
  if (loudnessDb == null) {
    return 1;
  }
  const takeAmplitude = Math.pow(10, loudnessDb / 20);
  const wanted = takeAmplitude / VOICE_PEAK;
  return Math.min(MAX_GAIN, Math.max(MIN_GAIN, wanted));
}

/**
 * The levels a note starts at.
 *
 * Recording tracks are left where they are: they are the thing being matched
 * to, and moving them would be matching the take to itself.
 */
export function matchedLevels<T extends string>(
  defaults: Readonly<Record<T, number>>,
  loudnessDb: number | null,
  isRecording: (track: T) => boolean
): Record<T, number> {
  const gain = matchGain(loudnessDb);
  const out = {} as Record<T, number>;
  for (const track of Object.keys(defaults) as T[]) {
    out[track] = isRecording(track)
      ? defaults[track]
      : Math.min(1, Math.max(0, defaults[track] * gain));
  }
  return out;
}
