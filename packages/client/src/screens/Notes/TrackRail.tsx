/**
 * The mutes, riding down the left edge of the graph (INV-NOTES-142).
 *
 * They lived in a sheet reached from the top bar, which is the wrong place
 * for them: silencing a track is done WHILE listening and looking at the
 * graph, and a control that has to be opened first interrupts the thing it is
 * for.
 *
 * Fixed beside the drawing rather than inside its scroll, so it is the same
 * distance from every part of the take. Flush against it, because the two are
 * one instrument — a gap would read as two panels and the rail would stop
 * being the graph's edge and start being a sidebar.
 *
 * One row per track the note actually has. A row for a track that would make
 * no sound is a control that lies (INT-NOTES-026).
 *
 * The snap toggle sits at the foot of it, below a rule. It is not a track and
 * does not sound: it decides where an edit lands (INV-NOTES-143), and putting
 * it in the same column keeps everything that governs the graph on the
 * graph's own edge.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../../theme';
import { useTranslation } from '../../i18n';
import { Icon } from '../../components/Icon';
import { TRACK_TITLES, type PlaybackMix, type TrackName } from './playbackTracks';

/** How wide the rail is. Enough for a thumb, and no more than the graph can spare. */
export const TRACK_RAIL_WIDTH = 38;

export interface TrackRailProps {
  /** Which tracks this note has, in the order they are drawn. */
  tracks: readonly TrackName[];
  mix: PlaybackMix;
  height: number;
  onToggle: (track: TrackName, isAudible: boolean) => void;
  /** Whether an edit lands on the grid (INV-NOTES-143). */
  isSnapping: boolean;
  onSnapping: (snap: boolean) => void;
}

/** The letter a track is known by here, where there is no room for a word. */
const INITIAL: Record<string, string> = {
  take: 'T',
  chords: 'C',
  bass: 'B',
  melody: 'M',
  rhythm: 'R',
  layers: 'L',
  count: '♩'
};

export function TrackRail({
  tracks,
  mix,
  height,
  onToggle,
  isSnapping,
  onSnapping
}: TrackRailProps): React.JSX.Element | null {
  const { colors } = useTheme();
  const { t } = useTranslation();
  if (tracks.length === 0) {
    return null;
  }

  return (
    <View
      testID="track-rail"
      style={[
        styles.rail,
        { width: TRACK_RAIL_WIDTH, height, backgroundColor: colors.neutral100 }
      ]}
    >
      {tracks.map((track) => {
        const isAudible = mix[track];
        return (
          <Pressable
            key={track}
            accessibilityRole="switch"
            accessibilityState={{ checked: isAudible }}
            accessibilityLabel={TRACK_TITLES[track]}
            testID={`rail-${track}`}
            onPress={() => onToggle(track, !isAudible)}
            style={styles.row}
          >
            <Text
              style={[
                styles.initial,
                { color: isAudible ? colors.primary500 : colors.gray300 }
              ]}
            >
              {INITIAL[track] ?? track[0].toUpperCase()}
            </Text>
            {/* The silenced state is drawn rather than implied: a letter that
                is merely dimmer reads as unimportant, not as off. */}
            {isAudible ? null : (
              <Icon name="speakerOff" size={11} color={colors.gray300} />
            )}
          </Pressable>
        );
      })}

      <View style={[styles.rule, { backgroundColor: colors.neutral500 }]} />

      <Pressable
        accessibilityRole="switch"
        accessibilityState={{ checked: isSnapping }}
        accessibilityLabel={t('notes.snapToGrid')}
        testID="rail-snap"
        onPress={() => onSnapping(!isSnapping)}
        style={styles.row}
      >
        <Icon
          name="grid"
          size={16}
          color={isSnapping ? colors.primary500 : colors.gray300}
        />
      </Pressable>
    </View>
  );
}

export default TrackRail;

const styles = StyleSheet.create({
  // No radius on the right and no margin: it meets the drawing exactly.
  rail: {
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
    paddingVertical: 6,
    alignItems: 'center',
    gap: 2
  },
  row: { alignItems: 'center', paddingVertical: 6, width: '100%' },
  // What sounds, and what governs the drawing, are different questions.
  rule: { height: StyleSheet.hairlineWidth, width: '60%', marginVertical: 4 },
  initial: { fontSize: 15, fontWeight: '700' }
});
