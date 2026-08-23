import { ColorSchemeName } from 'react-native';
import { ETheme } from '../configs/theme';
/**
 * This module contains the complete set of design system
 * type, interface and enumerator definitions.
 */

export type EThemeKeys = keyof typeof ETheme;
// RN 0.86 widened ColorSchemeName to include 'unspecified'. The design system
// only defines light and dark palettes; consumers already fold 'unspecified'
// into light, so exclude it here rather than inventing a third palette.
export type DeviceScheme = Exclude<
  ColorSchemeName,
  null | undefined | 'unspecified'
>;

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
  white: string;
  black: string;
  typography: string;
  gold: string;
  error: string;
  caution: string; // A step short of error: running low, not yet wrong
  neutral50: string; // Navigation bar and button background
  neutral100: string; // Tile and card background
  neutral300: string; // Page backbround
  neutral500: string; // Divider lines
  primary25: string;
  primary50: string;
  primary100: string;
  primary300: string;
  primary500: string;
  primary700: string;
  primary900: string;
  gray50: string;
  gray100: string;
  gray300: string;
  gray500: string;
  gray700: string;
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
