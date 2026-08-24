/**
 * INV-NOTES-102 — the applied metre stays quieter than the downbeats.
 *
 * On the graph there are two kinds of vertical line and only one of them can
 * be picked up. The metre is a reading the system produced; a downbeat is a
 * claim a person placed and can move. Drawn with equal weight the wrong one
 * looked like the important one, and the lines that could be moved read as
 * scenery.
 */
import { DOWNBEAT_OPACITY, metreLineStyle } from '../metreLines';

describe('the applied metre', () => {
  it('never draws as strongly as the lines that can be moved', () => {
    for (const isBar of [true, false]) {
      expect(metreLineStyle(isBar).opacity).toBeLessThan(DOWNBEAT_OPACITY / 2);
    }
  });

  it('is dotted rather than solid, so it reads as a ruling', () => {
    for (const isBar of [true, false]) {
      const [on, off] = metreLineStyle(isBar).intervals;
      expect(on).toBeGreaterThan(0);
      // More gap than mark: a dash that is mostly ink is a solid line with
      // nicks in it.
      expect(off).toBeGreaterThan(on);
    }
  });

  it('reads a bar more easily than a beat within it', () => {
    expect(metreLineStyle(true).opacity).toBeGreaterThan(
      metreLineStyle(false).opacity
    );
  });
});
