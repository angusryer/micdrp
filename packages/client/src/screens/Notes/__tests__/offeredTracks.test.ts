/**
 * INT-NOTES-026 — a control for a track that would make no sound is a control
 * that lies.
 *
 * Asked in one place, because both the options list and the rail beside the
 * graph need the answer and two answers to one question drift the moment
 * either is edited.
 */
import { offeredTracks } from '../offeredTracks';

describe('which tracks a note has', () => {
  it('offers the take always, since every note has one', () => {
    expect(offeredTracks({ chords: 4000 })).toContain('take');
  });

  it('offers nothing at all when the take is all there is', () => {
    // A list of one control says less than no list.
    expect(offeredTracks({})).toEqual([]);
  });

  it('leaves out a track with nothing to sound', () => {
    const offered = offeredTracks({ chords: 4000 });
    expect(offered).not.toContain('rhythm');
    expect(offered).not.toContain('layers');
  });

  it('keeps them in the order they are drawn', () => {
    const offered = offeredTracks({ chords: 1, melody: 1, count: 1 });
    expect(offered.indexOf('chords')).toBeLessThan(offered.indexOf('melody'));
    expect(offered.indexOf('melody')).toBeLessThan(offered.indexOf('count'));
  });
});
