import { notesToMidi } from '../midi';
import type { NoteEvent } from '../segmentation';

function note(midi: number, startMs: number, endMs: number): NoteEvent {
  return {
    midi,
    startMs,
    endMs,
    durationMs: endMs - startMs,
    cents: 0,
    clarity: 0.9
  };
}

describe('notesToMidi', () => {
  it('writes a valid SMF header and track', () => {
    const smf = notesToMidi([note(69, 0, 500)], {
      bpm: 120,
      ticksPerQuarter: 480
    });
    const bytes = Array.from(smf);

    // MThd, length 6, format 0, 1 track, division 480 (0x01E0).
    expect(bytes.slice(0, 4)).toEqual([0x4d, 0x54, 0x68, 0x64]);
    expect(bytes.slice(4, 8)).toEqual([0, 0, 0, 6]);
    expect(bytes.slice(8, 10)).toEqual([0, 0]);
    expect(bytes.slice(10, 12)).toEqual([0, 1]);
    expect(bytes.slice(12, 14)).toEqual([0x01, 0xe0]);
    // MTrk chunk follows the 14-byte header.
    expect(bytes.slice(14, 18)).toEqual([0x4d, 0x54, 0x72, 0x6b]);
    // Note-on and note-off status bytes are present.
    expect(bytes).toContain(0x90);
    expect(bytes).toContain(0x80);
    // Ends with the end-of-track meta event.
    expect(bytes.slice(-3)).toEqual([0xff, 0x2f, 0x00]);
  });

  it('produces a valid (empty) file for no notes', () => {
    const bytes = Array.from(notesToMidi([]));
    expect(bytes.slice(0, 4)).toEqual([0x4d, 0x54, 0x68, 0x64]);
    expect(bytes.slice(-3)).toEqual([0xff, 0x2f, 0x00]);
    expect(bytes).not.toContain(0x90);
  });

  it('derives velocity from clarity when not fixed', () => {
    const bytes = Array.from(notesToMidi([note(60, 0, 250)]));
    const onIndex = bytes.indexOf(0x90);
    expect(onIndex).toBeGreaterThan(-1);
    // velocity byte follows status + note number
    const velocity = bytes[onIndex + 2];
    expect(velocity).toBeGreaterThan(0);
    expect(velocity).toBeLessThanOrEqual(127);
  });
});
