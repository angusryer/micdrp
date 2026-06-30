import { ColorValue } from 'react-native';
import {
  DeviceScheme,
  EThemeKeys,
  FontFamilies,
  FontFamilyKeys,
  IThemeDimensions,
  IThemePalette,
  IThemeTypography
} from '../types/theme';

/**
 * Constants
 */
export const basicColors = {
  white: '#FFFFFF',
  black: '#000000',
  mypeople: '#6897FF',
  mywork: '#74DCFD',
  myhealth: '#FD8863',
  myself: '#EF8DFF',
  admin: '#7CFF86'
};

export enum ETheme {
  Blue = 'Blue',
  Red = 'Red',
  Green = 'Green'
}

/**
 * Design system color palettes
 */
export const palettes: Record<
  DeviceScheme,
  Record<EThemeKeys, IThemePalette>
> = {
  // Light mode palette colors
  light: {
    [ETheme.Blue]: {
      selectedPalette: ETheme.Blue,
      colors: {
        ...basicColors,
        error: '#FF4949',
        gold: '#8D8476',
        typography: '#323E58',
        gray50: '#F3F4F6',
        gray100: '#ADB1B8',
        gray300: '#828894',
        gray500: '#545A63',
        gray700: '#3E444C',
        neutral50: '#FDFBF7',
        neutral100: '#FBF6EE',
        neutral300: '#F8F0E3',
        neutral500: '#D9CEBD',
        primary25: '#F3F8FF',
        primary50: '#CADFFF',
        primary100: '#A7C8FC',
        primary300: '#4F8BE6',
        primary500: '#0F52BA',
        primary700: '#013B95',
        primary900: '#021A40'
      }
    },
    [ETheme.Red]: {
      selectedPalette: ETheme.Red,
      colors: {
        ...basicColors,
        error: '#D43939',
        gold: '#8D7E76',
        typography: '#29121B',
        gray50: '#F6F5F5',
        gray100: '#B8ADB1',
        gray300: '#948289',
        gray500: '#63545A',
        gray700: '#3D3135',
        neutral50: '#FDFBFA',
        neutral100: '#FBF5F2',
        neutral300: '#F9F0EC',
        neutral500: '#D9C7BD',
        primary25: '#FBF4F6',
        primary50: '#FFEAF2',
        primary100: '#F7BFD4',
        primary300: '#F3639E',
        primary500: '#E0115F',
        primary700: '#850837',
        primary900: '#2F0213'
      }
    },
    [ETheme.Green]: {
      selectedPalette: ETheme.Green,
      colors: {
        ...basicColors,
        error: '#FF4949',
        gold: '#8D7A76',
        typography: '#384343',
        gray50: '#F3FFFF',
        gray100: '#C4C8C8',
        gray300: '#889090',
        gray500: '#546363',
        gray700: '#313D3D',
        neutral50: '#FDFBFB',
        neutral100: '#FEFEFE',
        neutral300: '#FBF9F8',
        neutral500: '#E5D6D3',
        primary25: '#F3FFFF',
        primary50: '#DDFCFC',
        primary100: '#BAF6F6',
        primary300: '#45DFDF',
        primary500: '#008080',
        primary700: '#085555',
        primary900: '#032929'
      }
    }
  },
  // Dark mode palette colors.
  //
  // These are true dark surfaces (not a copy of the light ramp): backgrounds
  // collapse toward near-black while keeping the role ordering screens rely on
  // (canvas `neutral50` is the deepest, `neutral100` cards sit above the
  // `neutral300` screen base, `neutral500` are visible hairlines). Muted greys
  // are lightened so secondary text stays legible, and `primary500`/`primary100`
  // are brightened so accents and the melody contour still read on the dark
  // Skia canvases.
  dark: {
    [ETheme.Blue]: {
      selectedPalette: ETheme.Blue,
      colors: {
        ...basicColors,
        error: '#FF6B6B',
        gold: '#CBB98C',
        typography: '#ECEEF2',
        gray50: '#2A2E36',
        gray100: '#5C626D',
        gray300: '#9BA1AD',
        gray500: '#B3B9C4',
        gray700: '#D6DAE1',
        neutral50: '#0E1116',
        neutral100: '#1B1F27',
        neutral300: '#13161C',
        neutral500: '#363B46',
        primary25: '#0F1B2E',
        primary50: '#14294A',
        primary100: '#5E8FD6',
        primary300: '#4F8BE6',
        primary500: '#3D7BE0',
        primary700: '#7DA9EE',
        primary900: '#C3D9F8'
      }
    },
    [ETheme.Red]: {
      selectedPalette: ETheme.Red,
      colors: {
        ...basicColors,
        error: '#FF6B6B',
        gold: '#CBB08C',
        typography: '#F3EAEE',
        gray50: '#322A2E',
        gray100: '#6D5C62',
        gray300: '#AD9BA2',
        gray500: '#C4B3B9',
        gray700: '#E1D6DA',
        neutral50: '#140E11',
        neutral100: '#241B1F',
        neutral300: '#1A1316',
        neutral500: '#46363B',
        primary25: '#2E0F1B',
        primary50: '#4A1429',
        primary100: '#E68AAE',
        primary300: '#F3639E',
        primary500: '#EC3F76',
        primary700: '#F78CB1',
        primary900: '#FBC9D9'
      }
    },
    [ETheme.Green]: {
      selectedPalette: ETheme.Green,
      colors: {
        ...basicColors,
        error: '#FF6B6B',
        gold: '#BFC79C',
        typography: '#E9F0EE',
        gray50: '#2A322F',
        gray100: '#5C6D67',
        gray300: '#9BADA7',
        gray500: '#B3C4BE',
        gray700: '#D6E1DD',
        neutral50: '#0C1212',
        neutral100: '#18211F',
        neutral300: '#101715',
        neutral500: '#34433F',
        primary25: '#0E2929',
        primary50: '#134A4A',
        primary100: '#5FD0D0',
        primary300: '#45DFDF',
        primary500: '#13A3A3',
        primary700: '#7DEEEE',
        primary900: '#C3F7F7'
      }
    }
  }
};

/**
 * Design system dimensions and spacing
 *
 * New values must be copied from to ../types/theme.d.ts
 * need to change this to reduce errors.
 */
export const dimensions: IThemeDimensions = {
  radii: {
    [2]: 2,
    [4]: 4,
    [10]: 10,
    [32]: 32,
    rounded: 9999
  },
  spaces: {
    [1]: 1,
    [2]: 2,
    [4]: 4,
    [6]: 6,
    [8]: 8,
    [12]: 12,
    [16]: 16,
    [20]: 20,
    [24]: 24,
    [28]: 28,
    [32]: 32,
    [48]: 48
  },
  heights: {
    [14]: 14,
    [24]: 24,
    [32]: 32,
    [40]: 40,
    [56]: 56,
    [64]: 64,
    [72]: 72,
    [80]: 80,
    [90]: 90
  },
  widths: {
    [32]: 32,
    [56]: 56,
    [128]: 128
  },
  icons: {
    [12]: 12,
    [14]: 14,
    [16]: 16,
    [20]: 20,
    [24]: 24,
    [28]: 28,
    [32]: 32,
    [36]: 36,
    [42]: 42,
    [128]: 128,
    [256]: 256
  }
};

/**
 * Design system typography
 */
export const fonts: Record<FontFamilyKeys, FontFamilies> = {
  primaryRegular: 'GillSans',
  primarySemibold: 'GillSans-Bold',
  primaryBold: 'Futura-Bold'
};

export const typography: IThemeTypography = {
  h1: {
    fontFamily: fonts.primaryBold,
    fontWeight: '700',
    fontSize: 24,
    lineHeight: 34
  },
  h2: {
    fontFamily: fonts.primaryBold,
    fontWeight: '700',
    fontSize: 18,
    lineHeight: 20
  },
  h3: {
    fontFamily: fonts.primaryBold,
    fontWeight: '700',
    fontSize: 16,
    lineHeight: 19
  },
  h4: {
    fontFamily: fonts.primaryBold,
    fontWeight: '600',
    fontSize: 14,
    lineHeight: 22
  },
  h5: {
    fontFamily: fonts.primaryBold,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '700'
  },
  h6: {
    fontFamily: fonts.primaryBold,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '700'
  },
  label: {
    fontFamily: fonts.primaryBold,
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 19
  },
  paragraph: {
    fontFamily: fonts.primaryRegular,
    fontWeight: '500',
    fontSize: 14,
    lineHeight: 20
  },
  smallParagraph: {
    fontFamily: fonts.primaryBold,
    fontWeight: '600',
    fontSize: 9,
    lineHeight: 12
  },
  button: {
    fontFamily: fonts.primarySemibold,
    fontWeight: '600',
    fontSize: 12,
    lineHeight: 20
  }
};

export const effects = {
  shadow: {
    shadowColor: basicColors.black,
    shadowOffset: {
      height: 0,
      width: 0
    },
    shadowRadius: dimensions.radii[4],
    shadowOpacity: 0.18
  },
  altShadow: {
    shadowColor: basicColors.black,
    shadowOffset: {
      height: dimensions.spaces[2],
      width: 0
    },
    shadowRadius: dimensions.radii[2],
    shadowOpacity: 0.25
  }
};

export const alpha = (color: ColorValue | string, alpha: number) => {
  const opacity = Math.round(Math.min(Math.max(alpha || 1, 0), 1) * 255);
  return color.toString() + opacity.toString(16).toUpperCase();
};
