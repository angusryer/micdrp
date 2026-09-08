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
 * The snap toggle sits below a rule: it is not a track and does not sound, it
 * decides where an edit lands (INV-NOTES-143), but keeping it in the same
 * column keeps everything that governs the graph on the graph's own edge
 * (INV-NOTES-142).
 *
 * Below everything, RailBelow: the door onto what governs the graph
 * (INV-NOTES-229), the question mark that says what all of this means
 * (INV-NOTES-232), and the rewind. Then the foot the take is played from
 * (INV-NOTES-227) — the column's colour turns right along the bottom to hold
 * it, so it reads as the graph's edge continuing rather than a control
 * dropped on the drawing.
 *
 * A muted row is drawn by its colour alone. A glyph as well was saying the
 * same thing twice in a column 38 points wide.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { RailFoot, RAIL_FOOT_HEIGHT, type RailFootProps } from './RailFoot';
import { RailBelow } from './RailBelow';
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
  /** Open what governs the graph from outside it (INV-NOTES-229). */
  onMenu?: () => void;
  /** Say what every mark on this column means (INV-NOTES-232). */
  onHelp?: () => void;
  /** Back to the beginning, directly above the play control. */
  onRewind?: () => void;
  /** The take, played from the foot of the column (INV-NOTES-227). */
  transport?: RailFootProps | null;
}

/**
 * The letter a track is known by here, where there is no room for a word.
 *
 * Exported because the legend draws the same letters (INV-NOTES-232), and a
 * legend with its own copy of them is a legend that can disagree with the
 * rail it describes.
 */
export const TRACK_INITIAL: Record<string, string> = {
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
  onSnapping,
  onMenu,
  onHelp,
  onRewind,
  transport
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
        {
          width: TRACK_RAIL_WIDTH,
          height,
          backgroundColor: colors.neutral100,
          // Room for the foot, which is drawn out of the flow.
          paddingBottom: transport != null ? RAIL_FOOT_HEIGHT : 6
        }
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
              {TRACK_INITIAL[track] ?? track[0].toUpperCase()}
            </Text>
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

      <RailBelow onMenu={onMenu} onHelp={onHelp} onRewind={onRewind} />

      {transport != null ? <RailFoot {...transport} /> : null}
    </View>
  );
}

export default TrackRail;

const styles = StyleSheet.create({
  // No radius on the right and no margin: it meets the drawing exactly.
  //
  // Raised over the drawing, because the foot reaches out past the column
  // and the drawing is painted after it. Without this the take's transport
  // is behind the graph and cannot be pressed at all.
  rail: {
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
    paddingVertical: 6,
    alignItems: 'center',
    gap: 2,
    zIndex: 1,
    elevation: 1
  },
  row: { alignItems: 'center', paddingVertical: 6, width: '100%' },
  // What sounds, and what governs the drawing, are different questions.
  rule: { height: StyleSheet.hairlineWidth, width: '60%', marginVertical: 4 },
  initial: { fontSize: 15, fontWeight: '700' }
});
