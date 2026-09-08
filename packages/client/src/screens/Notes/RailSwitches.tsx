/**
 * The mutes, and the grid under them — the scrolling part of the rail.
 *
 * One row per track the note actually has. A row for a track that would make
 * no sound is a control that lies (INT-NOTES-026). A muted row is drawn by
 * its colour alone; a glyph as well was saying the same thing twice in a
 * column 38 points wide.
 *
 * The grid sits below a rule: it is not a track and does not sound, it decides
 * where an edit lands (INV-NOTES-143) — but keeping it in the same column
 * keeps everything that governs the graph on the graph's own edge
 * (INV-NOTES-142).
 *
 * These scroll, and nothing below them does (INV-NOTES-233): what the rail
 * has to hold does not depend on how tall the drawing beside it is, and a note
 * with every track has more switches than a short graph has room for.
 */
import React, { useCallback, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Icon } from '../../components/Icon';
import { useTheme } from '../../theme';
import { useTranslation } from '../../i18n';
import { TRACK_TITLES, type PlaybackMix, type TrackName } from './playbackTracks';

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

export interface RailSwitchesProps {
  /** Which tracks this note has, in the order they are drawn. */
  tracks: readonly TrackName[];
  mix: PlaybackMix;
  onToggle: (track: TrackName, isAudible: boolean) => void;
  /** Whether an edit lands on the grid (INV-NOTES-143). */
  isSnapping: boolean;
  onSnapping: (snap: boolean) => void;
}

export function RailSwitches({
  tracks,
  mix,
  onToggle,
  isSnapping,
  onSnapping
}: RailSwitchesProps): React.JSX.Element {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const scroll = useRef<ScrollView>(null);

  /**
   * How much room these got and how much they need, in px.
   *
   * Refs rather than state: neither changes anything drawn, and the two
   * arrive in either order — whichever lands second is the one that knows
   * whether there is more than fits.
   */
  const room = useRef(0);
  const content = useRef(0);

  /**
   * Say once, as it appears, that there is more than fits.
   *
   * A column 38 points wide cannot carry a standing mark, and a clipped letter
   * reads as a letter rather than as a list continuing — so the bar is flashed
   * the way iOS flashes it, at the one moment it is worth something. Only when
   * there is actually more: a bar over a list that fits promises something
   * that is not there.
   */
  const sayIfMore = useCallback(() => {
    if (content.current > room.current) {
      scroll.current?.flashScrollIndicators();
    }
  }, []);

  return (
    <ScrollView
      ref={scroll}
      testID="rail-switches"
      style={styles.scroll}
      contentContainerStyle={styles.content}
      onLayout={(e) => {
        room.current = e.nativeEvent.layout.height;
        sayIfMore();
      }}
      onContentSizeChange={(_, h) => {
        content.current = h;
        sayIfMore();
      }}
      showsVerticalScrollIndicator
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

      {/* What sounds, and what governs the drawing, are different questions. */}
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
    </ScrollView>
  );
}

export default RailSwitches;

const styles = StyleSheet.create({
  // Takes the room left over rather than asking for any: it is the one part
  // of the column that can give way.
  scroll: { flexGrow: 1, flexShrink: 1, width: '100%' },
  content: { alignItems: 'center', gap: 2 },
  row: { alignItems: 'center', paddingVertical: 6, width: '100%' },
  rule: { height: StyleSheet.hairlineWidth, width: '60%', marginVertical: 4 },
  initial: { fontSize: 15, fontWeight: '700' }
});
