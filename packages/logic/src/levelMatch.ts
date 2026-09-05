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
 * The most a take may be lifted, as a multiple of what was recorded.
 *
 * Make-up gain on a quiet recording raises the room with it, so this is
 * about how much noise is worth accepting to hear the singing. Mirrors
 * `kMaxBusLevel` in cpp/dsp/synth.h, which holds anything past it anyway.
 */
const MAX_TAKE_GAIN = 4;

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

/** What the take was recorded at, as an amplitude, or null. */
function amplitudeOf(loudnessDb: number | null): number | null {
  if (loudnessDb == null) {
    return null;
  }
  const amplitude = Math.pow(10, loudnessDb / 20);
  return amplitude > 0 ? amplitude : null;
}

/**
 * How much the take itself is lifted, to sit where a voice sits.
 *
 * Never below one: a take louder than the reference is left alone and the
 * tracks come up to meet it instead. This exists because a bus level could
 * not exceed one, so a quiet take at full level was as loud as it could
 * ever be — the match could only push the tracks down towards it, ran out
 * of room against a genuinely quiet take, and left the accompaniment above
 * the singing (INV-NOTES-141).
 */
export function takeGain(loudnessDb: number | null): number {
  const amplitude = amplitudeOf(loudnessDb);
  if (amplitude == null) {
    return 1;
  }
  return Math.min(MAX_TAKE_GAIN, Math.max(1, VOICE_PEAK / amplitude));
}

/**
 * How much every synthesized track moves, to sit where the take sits.
 *
 * One factor for all of them, so the balance they were given survives and
 * only the whole moves. Measured against the take *after* it has been
 * lifted, so the two halves of the match do not both spend the same
 * difference. Bounded, because a take recorded at arm's length across a
 * room should quieten the accompaniment and not silence it.
 */
export function matchGain(loudnessDb: number | null): number {
  const amplitude = amplitudeOf(loudnessDb);
  if (amplitude == null) {
    return 1;
  }
  const lifted = amplitude * takeGain(loudnessDb);
  return Math.min(MAX_GAIN, Math.max(MIN_GAIN, lifted / VOICE_PEAK));
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
