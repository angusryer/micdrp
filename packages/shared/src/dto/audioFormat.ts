/**
 * Which audio formats this app can actually play back.
 *
 * Recording and playback are two halves of one contract, and for a long time
 * only one half was ever checked. Capture wrote CAF holding Float32 PCM;
 * playback decodes through miniaudio, which opens WAV, MP3 and FLAC and hands
 * only .mp4, .m4a and .aac to ffmpeg. CAF matched nothing, so every note ever
 * recorded failed to play and the UI said "Playback failed" without naming a
 * format (INV-PITCH-012).
 *
 * The list lives here, beside the other rules both sides agree on, so a change
 * to what is captured is checked against what can be read rather than assumed
 * to be compatible.
 */

/**
 * Formats the playback decoder opens, lower-case and without the dot.
 *
 * Derived from the decoder's real behaviour, not from what seems reasonable:
 * miniaudio handles the first three natively, and the decoder routes the last
 * three to ffmpeg by file extension.
 */
export const PLAYABLE_AUDIO_EXTENSIONS = [
  'wav',
  'mp3',
  'flac',
  'mp4',
  'm4a',
  'aac'
] as const;

/**
 * What a capture is written as.
 *
 * WAV because miniaudio reads it without ffmpeg, and 16-bit because that is
 * what every decoder agrees on and it halves what has to be uploaded.
 */
export const CAPTURE_AUDIO_EXTENSION = 'wav';

/** The extension of a path or URL, lower-case, without the dot. */
export function audioExtensionOf(pathOrUrl: string): string {
  // Query strings carry the file token on a backend URL, so strip them before
  // looking at the end of the name.
  const withoutQuery = pathOrUrl.split(/[?#]/)[0];
  const lastDot = withoutQuery.lastIndexOf('.');
  // A dot earlier in the path belongs to a directory, not to the file: the
  // name in "/takes/v1.2/recording" has no extension at all.
  const lastSlash = withoutQuery.lastIndexOf('/');
  return lastDot <= lastSlash ? '' : withoutQuery.slice(lastDot + 1).toLowerCase();
}

/** Whether the decoder can open what sits at this path or URL. */
export function isPlayableAudioPath(pathOrUrl: string): boolean {
  const ext = audioExtensionOf(pathOrUrl);
  return (PLAYABLE_AUDIO_EXTENSIONS as readonly string[]).includes(ext);
}
