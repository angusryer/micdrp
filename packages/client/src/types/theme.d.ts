import { ColorSchemeName, ColorValue } from 'react-native';
import { ETheme } from '../configs/theme';
/**
 * This module contains the complete set of design system
 * type, interface and enumerator definitions.
 */

export type EThemeKeys = keyof typeof ETheme;
export type DeviceScheme = Exclude<ColorSchemeName, null | undefined>;

declare interface ITheme extends IThemePalette {
  palettes: Record<EThemeKeys, IThemePalette>;
}

declare interface IThemePalette {
  selectedPalette: EThemeKeys | ETheme;
  colors: IPaletteColors;
}

/**
 * Design system definition for a single color palette
 *
 * @variation primary500: Primary color
 * @variation neutral50: Navigation bar and button background
 * @variation neutral100: Tile and card background
 * @variation neutral300: Page backbround
 * @variation neutral500: Divider lines
 */
declare interface IPaletteColors {
  white: ColorValue | string;
  black: ColorValue | string;
  typography: ColorValue | string;
  gold: ColorValue | string;
  error: ColorValue | string;
  neutral50: ColorValue | string; // Navigation bar and button background
  neutral100: ColorValue | string; // Tile and card background
  neutral300: ColorValue | string; // Page backbround
  neutral500: ColorValue | string; // Divider lines
  primary25: ColorValue | string;
  primary50: ColorValue | string;
  primary100: ColorValue | string;
  primary300: ColorValue | string;
  primary500: ColorValue | string;
  primary700: ColorValue | string;
  primary900: ColorValue | string;
  gray50: ColorValue | string;
  gray100: ColorValue | string;
  gray300: ColorValue | string;
  gray500: ColorValue | string;
  gray700: ColorValue | string;
}

// New values must be copied over to ../styles/theme.ts
// need to change this to reduce errors.
declare interface IThemeDimensions {
  radii: {
    [2]: 2;
    [4]: 4;
    [10]: 10;
    [32]: 32;
    rounded: 9999;
  };
  spaces: {
    [1]: 1;
    [2]: 2;
    [4]: 4;
    [6]: 6;
    [8]: 8;
    [12]: 12;
    [16]: 16;
    [20]: 20;
    [24]: 24;
    [28]: 28;
    [32]: 32;
    [48]: 48;
  };
  heights: {
    [14]: 14;
    [24]: 24;
    [32]: 32;
    [40]: 40;
    [56]: 56;
    [64]: 64;
    [72]: 72;
    [80]: 80;
    [90]: 90;
  };
  widths: {
    [32]: 32;
    [56]: 56;
    [128]: 128;
  };
  icons: {
    [12]: 12;
    [14]: 14;
    [16]: 16;
    [20]: 20;
    [24]: 24;
    [28]: 28;
    [32]: 32;
    [36]: 36;
    [42]: 42;
    [128]: 128;
    [256]: 256;
  };
}

type FontFamilyKeys = 'primaryRegular' | 'primarySemibold' | 'primaryBold';
type FontFamilies = 'Futura-Bold' | 'GillSans' | 'GillSans-Bold';
type FontWeights =
  | 'normal'
  | 'bold'
  | '100'
  | '200'
  | '300'
  | '400'
  | '500'
  | '600'
  | '700'
  | '800'
  | '900'
  | undefined;
type FontSizes = 24 | 20 | 18 | 16 | 14 | 12 | 9;
type LineHeights = 34 | 22 | 20 | 19 | 12;

interface FontParams {
  fontFamily: FontFamilies;
  fontWeight: FontWeights;
  fontSize: FontSizes;
  lineHeight: LineHeights;
}

declare interface IThemeTypography {
  h1: FontParams;
  h2: FontParams;
  h3: FontParams;
  h4: FontParams;
  h5: FontParams;
  h6: FontParams;
  label: FontParams;
  paragraph: FontParams;
  smallParagraph: FontParams;
  button: FontParams;
}
