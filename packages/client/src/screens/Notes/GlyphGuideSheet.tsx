/**
 * What each glyph on a track's card means.
 *
 * The controls are glyphs so the sheet reads as a set of dials rather than a
 * page of prose, but a glyph nobody can name is a control nobody will press.
 * The words did not go away; they went behind the info mark, where they cost
 * nothing until they are wanted (INV-NOTES-086).
 *
 * The same glyph is drawn here as on the card — not a picture of it — so the
 * guide cannot come to describe an icon the card no longer has.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Icon, type IconName } from '../../components/Icon';
import { Sheet } from '../../components/Sheet';
import { useTheme } from '../../theme';
import type { TrackName } from './playbackTracks';

interface GlyphNote {
  icon: IconName;
  name: string;
  what: string;
}

const SHARED: GlyphNote[] = [
  {
    icon: 'speaker',
    name: 'Speaker',
    what: 'Silences this track without turning it off — the slider keeps whatever you set.'
  }
];

const BY_TRACK: Partial<Record<TrackName, GlyphNote[]>> = {
  melody: [
    {
      icon: 'grid',
      name: 'Snap to the beat',
      what: 'Hear the melody on the beat grid instead of where it was actually sung.'
    },
    {
      icon: 'eye',
      name: 'Draw on the grid',
      what: 'Draw it that way too. A wrong snap is plain in the picture and almost inaudible in a short take, which is why they are asked separately.'
    },
    {
      icon: 'speaker',
      name: 'Hear a note as you drag it',
      what: 'Every semitone a drag crosses sounds as it is reached, so moving a note is its own audition.'
    }
  ]
};

const SLIDERS: Partial<Record<TrackName, string | null>> = {
  chords: 'The lower slider moves the chords by whole octaves. Down for headphones, up for the phone speaker, which has almost nothing in the low register.',
  melody: 'The lower slider moves the melody by whole octaves, centred on the register you sang it in.'
};

export interface GlyphGuideSheetProps {
  track: TrackName | null;
  onClose: () => void;
  /**
   * What was measured of the take, and what the mix did about it
   * (INV-NOTES-141).
   *
   * Shown on the take, because the balance every other track starts at is
   * derived from this and there was no way to see it. A take whose
   * loudness was never measured reads as unmeasured rather than as
   * silent — they are different claims and only one is about the singing
   * (INV-PITCH-020).
   */
  measured?: { sungDb: number | null; takeMakeUp: number };
}

/** How loud the take was sung, in the words a person would use. */
function sungLine(measured: { sungDb: number | null; takeMakeUp: number }): string {
  if (measured.sungDb == null) {
    return 'Nothing measured how loud this take was sung, so the other tracks start where they always do. Reading the take again measures it.';
  }
  const lift =
    measured.takeMakeUp > 1.05
      ? ` It is being brought up ${measured.takeMakeUp.toFixed(1)}× to sit with the tracks read from it.`
      : ' It is loud enough to sit with the tracks read from it as recorded.';
  return `Sung at ${measured.sungDb.toFixed(1)} dB.${lift}`;
}

export function GlyphGuideSheet({
  track,
  onClose,
  measured
}: GlyphGuideSheetProps): React.JSX.Element {
  const { colors } = useTheme();

  // A track with nothing of its own gets the shared glyphs and no more: most
  // have none, and listing an empty entry per track is the drift the registry
  // exists to prevent (INV-NOTES-121).
  const glyphs = track ? [...SHARED, ...(BY_TRACK[track] ?? [])] : [];
  const slider = track ? (SLIDERS[track] ?? null) : null;

  return (
    <Sheet
      name="glyph-guide"
      isOpen={track != null}
      onClose={onClose}
      background={colors.neutral50}
    >
      <View style={styles.body}>
        <Text style={[styles.title, { color: colors.typography }]}>
          What these do
        </Text>
        {track === 'take' && measured != null ? (
          <Text
            testID="take-measured"
            style={[styles.slider, { color: colors.gray300 }]}
          >
            {sungLine(measured)}
          </Text>
        ) : null}
        <Text style={[styles.slider, { color: colors.gray300 }]}>
          The top slider is how loud this track sits in the mix.
        </Text>
        {slider ? (
          <Text style={[styles.slider, { color: colors.gray300 }]}>
            {slider}
          </Text>
        ) : null}

        {glyphs.map((glyph) => (
          <View key={`${glyph.icon}-${glyph.name}`} style={styles.row}>
            <View style={[styles.chip, { borderColor: colors.neutral500 }]}>
              <Icon name={glyph.icon} size={18} color={colors.primary500} />
            </View>
            <View style={styles.words}>
              <Text style={[styles.name, { color: colors.typography }]}>
                {glyph.name}
              </Text>
              <Text style={[styles.what, { color: colors.gray300 }]}>
                {glyph.what}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </Sheet>
  );
}

export default GlyphGuideSheet;

const styles = StyleSheet.create({
  body: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 28 },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 10 },
  slider: { fontSize: 12, lineHeight: 17, marginBottom: 10 },
  row: { flexDirection: 'row', gap: 12, marginTop: 12 },
  chip: {
    borderWidth: 1,
    borderRadius: 10,
    width: 38,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center'
  },
  words: { flex: 1 },
  name: { fontSize: 13, fontWeight: '700' },
  what: { fontSize: 12, lineHeight: 17, marginTop: 2 }
});
