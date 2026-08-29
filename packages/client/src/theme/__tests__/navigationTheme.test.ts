/**
 * The palette, as React Navigation understands it.
 *
 * The tab navigator styled its own header and the stacks did not, so every
 * screen pushed on top of the tabs came up with React Navigation's own light
 * header over a dark app.
 */
import { navigationTheme } from '../navigationTheme';
import { palettes } from '../../configs/theme';
import { ETheme } from '../../configs/theme';

const dark = palettes.dark[ETheme.Blue].colors;
const light = palettes.light[ETheme.Blue].colors;

describe('the navigator theme', () => {
  it('draws a header in the app’s own ground, not the framework’s', () => {
    // `card` is what a header and a tab bar are drawn in.
    expect(navigationTheme(dark, 'dark').colors.card).toBe(dark.neutral300);
    expect(navigationTheme(light, 'light').colors.card).toBe(light.neutral300);
  });

  it('says which it is, so the framework picks its own defaults to match', () => {
    expect(navigationTheme(dark, 'dark').dark).toBe(true);
    expect(navigationTheme(light, 'light').dark).toBe(false);
  });

  it('takes its title colour from the app’s typography', () => {
    expect(navigationTheme(dark, 'dark').colors.text).toBe(dark.typography);
  });

  it('keeps whatever the framework needs that the palette has no word for', () => {
    // Fonts, and anything else added later: taken from the base rather than
    // invented, so a version that wants more does not arrive undefined.
    expect(navigationTheme(dark, 'dark').fonts).toBeDefined();
  });
});
