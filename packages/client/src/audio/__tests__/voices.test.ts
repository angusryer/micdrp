/**
 * INV-NOTES-144 — each track has a voice of its own.
 *
 * Every synthesized voice was a sine: five parts at once were five things the
 * ear had only pitch and level to separate.
 */
import { VOICES, voiceTitle, waveOf } from '../voices';
import { TRACKS, trackSpec } from '../../screens/Notes/trackRegistry';

describe('the voices a track can speak in', () => {
  it('numbers them as the engine does', () => {
    // The order mirrors `Wave` in cpp/dsp/wave.h. A mismatch here would be a
    // track speaking in somebody else's timbre.
    expect(VOICES.map((v) => v.wave)).toEqual([0, 1, 2, 3, 4]);
  });

  it('falls back to pure for a name it does not know', () => {
    // The engine ignores a shape it does not know and speaks in a sine, so a
    // mismatch is dull rather than dangerous.
    expect(waveOf(undefined)).toBe(0);
  });

  it('names every one of them', () => {
    for (const one of VOICES) {
      expect(voiceTitle(one.name)).toBeTruthy();
    }
  });

  it('says what each is for, since five names say nothing on their own', () => {
    for (const one of VOICES) {
      expect(one.hint.length).toBeGreaterThan(10);
    }
  });
});

describe('what each track speaks in to begin with', () => {
  it('gives every track a voice', () => {
    for (const track of TRACKS) {
      expect(waveOf(trackSpec(track.name).voice)).toBeGreaterThanOrEqual(0);
    }
  });

  it('tells the synthesized parts apart from each other', () => {
    // Timbre as well as pitch: the point of the whole change.
    const sounded = TRACKS.filter((t) => t.role !== 'recording');
    expect(new Set(sounded.map((t) => t.voice)).size).toBeGreaterThan(1);
  });

  it('gives the drums no pitch to clash with the harmony', () => {
    expect(trackSpec('rhythm').voice).toBe('noise');
  });
});
