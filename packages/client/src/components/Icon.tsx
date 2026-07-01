/**
 * Icon — vector icons drawn with Skia from SVG path data.
 *
 * Every glyph is a 24×24 SVG path string rendered through the Skia canvas that
 * already powers the app's visuals. This keeps icons resolution-independent and,
 * crucially, fully shippable over-the-air: there are no native vector drawables,
 * asset catalogues, or font files to rebuild — changing or adding an icon is a
 * pure-JS bundle change.
 *
 * Replaces the previous text-glyph approach (e.g. a "⚙︎" rendered as <Text/>),
 * which rendered inconsistently across platforms and fonts.
 */
import React, { useMemo } from 'react';
import { View } from 'react-native';
import { Canvas, Group, Path, Skia } from '@shopify/react-native-skia';

export type IconName =
  | 'mic'
  | 'practice'
  | 'notes'
  | 'dashboard'
  | 'settings';

/** Material-style filled glyphs, authored on a 24×24 viewbox. */
const ICON_PATHS: Record<IconName, string> = {
  // Microphone — used for the app mark / practice tab.
  mic: 'M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5-3c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z',
  practice:
    'M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5-3c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z',
  // Single eighth-note — the Notes tab.
  notes:
    'M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z',
  // Ascending bars — the Dashboard tab.
  dashboard: 'M4 9h4v11H4zm6-5h4v16h-4zm6 8h4v8h-4z',
  // Cog — Account & Settings.
  settings:
    'M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z'
};

const VIEWBOX = 24;

export interface IconProps {
  name: IconName;
  /** Square edge length in px (defaults to a 24pt glyph). */
  size?: number;
  /** Fill colour — pass a theme colour from the call site. */
  color: string;
}

/**
 * Render a single vector glyph. The path is parsed once per name and scaled from
 * its 24×24 authoring box to {@link size}.
 */
export function Icon({ name, size = 24, color }: IconProps): React.JSX.Element {
  const path = useMemo(() => Skia.Path.MakeFromSVGString(ICON_PATHS[name]), [name]);
  const scale = size / VIEWBOX;

  if (path == null) {
    // Defensive: an unparsable path should never blank the layout.
    return <View style={{ width: size, height: size }} />;
  }

  return (
    <Canvas style={{ width: size, height: size }}>
      <Group transform={[{ scale }]}>
        <Path path={path} color={color} style="fill" />
      </Group>
    </Canvas>
  );
}

export default Icon;
