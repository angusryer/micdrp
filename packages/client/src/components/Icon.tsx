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
  | 'settings'
  | 'play'
  | 'pause'
  | 'rewind'
  | 'stop'
  | 'options'
  | 'details';

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
  // Transport pair. The triangle sits a touch right of centre so it reads as
  // centred inside a circle, which is where these two are used (INV-NOTES-030).
  play: 'M8 5v14l11-7z',
  pause: 'M6 5h4v14H6zm8 0h4v14h-4z',
  // Two triangles pointing back into a bar: goes back over a passage rather
  // than to the very start, which is what a press actually does
  // (INT-NOTES-020).
  rewind: 'M18 6v12l-8.5-6L18 6zM9 6v12L4 12l5-6z',
  // A square, not a pair of bars: what it ends cannot be resumed, only
  // started again from the top (INV-NOTES-031).
  stop: 'M6 6h12v12H6z',
  // Sliders — opens the playback options (INV-NOTES-075). Deliberately not
  // the cog below: that one means the app's settings, and these are choices
  // about one take.
  // Lines of text beside a mark — the conventional "details" or "list"
  // glyph, so it is recognised rather than read (INV-NOTES-075).
  details:
    'M3 5h18v2H3V5zm0 6h12v2H3v-2zm0 6h18v2H3v-2zm15-6h3v2h-3v-2z',
  options:
    'M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z',
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
