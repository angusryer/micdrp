/**
 * INV-NOTES-102 — what each kind of vertical line is drawn at.
 *
 * Three things are drawn down the graph and they are not the same kind of
 * claim. A bar's rule marks a downbeat, which can be picked up and moved. A
 * beat's rule marks the pulse between them, which cannot. And a solid line
 * marks the one downbeat currently in hand.
 *
 * The order has to hold: the line in hand over the bar rule over the beat
 * rule. Drawn any other way the picture says the wrong thing about which
 * lines can be touched, which is exactly what it used to say.
 */
import { DOWNBEAT_OPACITY, metreLineStyle } from '../metreLines';

describe('the drawn metre', () => {
  it('reads a downbeat more plainly than the pulse under it', () => {
    expect(metreLineStyle(true).opacity).toBeGreaterThan(
      metreLineStyle(false).opacity
    );
  });

  it('never draws as strongly as the downbeat actually in hand', () => {
    for (const isBar of [true, false]) {
      expect(metreLineStyle(isBar).opacity).toBeLessThan(DOWNBEAT_OPACITY);
    }
  });

  it('is dotted rather than solid, so it reads as a ruling', () => {
    for (const isBar of [true, false]) {
      const [on, off] = metreLineStyle(isBar).intervals;
      expect(on).toBeGreaterThan(0);
      // A dash mostly made of ink is a solid line with nicks in it.
      expect(off).toBeGreaterThanOrEqual(on);
    }
  });

  it('leaves more gap in the pulse than in the downbeats', () => {
    // The beat rule is texture; the bar rule is something to follow across
    // the take, so it is the more continuous of the two.
    const ink = (isBar: boolean) => {
      const [on, off] = metreLineStyle(isBar).intervals;
      return on / (on + off);
    };
    expect(ink(true)).toBeGreaterThan(ink(false));
  });
});
