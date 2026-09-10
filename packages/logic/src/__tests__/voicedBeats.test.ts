/**
 * The beat heard in the take — INV-NOTES-242 and INV-NOTES-243.
 *
 * The dismissal tests matter most. A voiced beat is read out of the audio
 * every time, so without a record of the removal every redraw puts back the
 * beat just thrown away, and a re-read that moves the sound three
 * milliseconds does it too.
 */
import { anchorsFrom, isDismissed, removeAnchor } from '../voicedBeats';
import type { TappedBeat } from '../tappedBeats';

const tap = (atMs: number, isDownbeat = false): TappedBeat => ({
  atMs,
  tappedAtMs: atMs,
  isDownbeat
});

const hit = (atMs: number, confidence = 0.9) => ({ atMs, confidence });

describe('anchorsFrom', () => {
  it('makes a beat of every confident sound in the take', () => {
    const anchors = anchorsFrom([], [hit(0), hit(600), hit(1200)]);
    expect(anchors.map((a) => a.atMs)).toEqual([0, 600, 1200]);
    expect(anchors.every((a) => a.isVoiced)).toBe(true);
  });

  it('leaves the quiet noises alone', () => {
    // A breath, a chair, a lip parting. A beat on each is worse than none,
    // because every one has to be thrown away by hand.
    const anchors = anchorsFrom([], [hit(0, 0.9), hit(300, 0.2), hit(600)]);
    expect(anchors.map((a) => a.atMs)).toEqual([0, 600]);
  });

  it('puts taps and voiced beats on one timeline, in time order', () => {
    const anchors = anchorsFrom([tap(900)], [hit(0), hit(1800)]);
    expect(anchors.map((a) => a.atMs)).toEqual([0, 900, 1800]);
    expect(anchors.map((a) => a.isVoiced === true)).toEqual([
      true,
      false,
      true
    ]);
  });

  it('keeps the tap where somebody tapped over their own consonant', () => {
    // The same statement made twice. Two anchors ten milliseconds apart
    // would put a gap of almost nothing between them.
    const anchors = anchorsFrom([tap(600)], [hit(610)]);
    expect(anchors).toHaveLength(1);
    expect(anchors[0].isVoiced).toBeUndefined();
  });

  it('keeps a downbeat mark on the tap that carried it', () => {
    const anchors = anchorsFrom([tap(1200, true)], [hit(0)]);
    expect(anchors.find((a) => a.atMs === 1200)?.isDownbeat).toBe(true);
  });

  it('leaves out a sound that was thrown away', () => {
    const anchors = anchorsFrom([], [hit(0), hit(600), hit(1200)], [600]);
    expect(anchors.map((a) => a.atMs)).toEqual([0, 1200]);
  });

  it('keeps it out when a re-read moves the sound a little', () => {
    // The whole point of matching by nearness: an exact instant would let
    // every dismissed beat back in the next time the take was read.
    const anchors = anchorsFrom([], [hit(620)], [600]);
    expect(anchors).toEqual([]);
  });

  it('does not throw away a different sound nearby', () => {
    const anchors = anchorsFrom([], [hit(900)], [600]);
    expect(anchors.map((a) => a.atMs)).toEqual([900]);
  });
});

describe('removeAnchor', () => {
  const taps = [tap(0), tap(1200)];
  const anchors = anchorsFrom(taps, [hit(600)]);

  it('deletes a tap, which exists nowhere else', () => {
    const after = removeAnchor(anchors, 0, taps, []);
    expect(after.taps.map((t) => t.atMs)).toEqual([1200]);
    expect(after.dismissed).toEqual([]);
  });

  it('writes down that a voiced beat went, since the audio still has it', () => {
    const after = removeAnchor(anchors, 1, taps, []);
    expect(after.taps.map((t) => t.atMs)).toEqual([0, 1200]);
    expect(after.dismissed).toEqual([600]);
  });

  it('does not write the same dismissal twice', () => {
    const after = removeAnchor(anchors, 1, taps, [605]);
    expect(after.dismissed).toEqual([605]);
  });

  it('changes nothing when asked to remove a beat that is not there', () => {
    const after = removeAnchor(anchors, 9, taps, [600]);
    expect(after.taps).toHaveLength(2);
    expect(after.dismissed).toEqual([600]);
  });

  it('keeps a thrown-away voiced beat away on the next read', () => {
    const after = removeAnchor(anchors, 1, taps, []);
    // The take is read again and finds the same consonant, 20ms off.
    const again = anchorsFrom(after.taps, [hit(620)], after.dismissed);
    expect(again.map((a) => a.atMs)).toEqual([0, 1200]);
    expect(isDismissed(620, after.dismissed)).toBe(true);
  });
});
