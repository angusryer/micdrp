/**
 * The recording/playback contract — INV-PITCH-012.
 *
 * This file exists because its absence cost every note ever recorded. The
 * tests proved a capture file was written and never that anything could read
 * it back, so a format the decoder cannot open shipped and stayed shipped.
 */
import {
  CAPTURE_AUDIO_EXTENSION,
  PLAYABLE_AUDIO_EXTENSIONS,
  audioExtensionOf,
  isPlayableAudioPath
} from '../dto/audioFormat';

describe('the capture format', () => {
  it('INV-PITCH-012: is one the decoder can open', () => {
    // The whole bug in one assertion. Changing capture to a format playback
    // cannot read fails here rather than on someone's phone.
    expect(PLAYABLE_AUDIO_EXTENSIONS).toContain(CAPTURE_AUDIO_EXTENSION);
  });

  it('is wav, which miniaudio reads without ffmpeg', () => {
    expect(CAPTURE_AUDIO_EXTENSION).toBe('wav');
  });
});

describe('isPlayableAudioPath', () => {
  it('rejects caf, which is what shipped and never played', () => {
    expect(isPlayableAudioPath('file:///var/mobile/tmp/micdrp-abc.caf')).toBe(false);
  });

  it('accepts a local capture', () => {
    expect(isPlayableAudioPath('file:///var/mobile/tmp/micdrp-abc.wav')).toBe(true);
  });

  it('accepts a backend URL carrying a file token', () => {
    // The token is a query string; it must not be mistaken for the extension.
    expect(
      isPlayableAudioPath('https://micdrp-backend.fly.dev/api/files/notes/n1/audio.wav?token=t0ken')
    ).toBe(true);
  });

  it.each(['mp3', 'flac', 'm4a', 'aac', 'mp4'])('accepts %s', (ext) => {
    expect(isPlayableAudioPath(`/tmp/take.${ext}`)).toBe(true);
  });

  it('is not fooled by case', () => {
    expect(isPlayableAudioPath('/tmp/TAKE.WAV')).toBe(true);
  });

  it('rejects a path with no extension at all', () => {
    expect(isPlayableAudioPath('/tmp/take')).toBe(false);
  });

  it('rejects a directory that merely contains a dot', () => {
    expect(isPlayableAudioPath('/tmp/v1.2/take')).toBe(false);
  });
});

describe('audioExtensionOf', () => {
  it('strips a query string before reading the extension', () => {
    expect(audioExtensionOf('https://x/a.wav?token=abc')).toBe('wav');
  });

  it('strips a fragment too', () => {
    expect(audioExtensionOf('https://x/a.wav#t=1')).toBe('wav');
  });
});
