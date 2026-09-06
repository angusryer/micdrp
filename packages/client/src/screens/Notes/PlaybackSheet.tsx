/**
 * PlaybackSheet — everything that decides what a press will sound.
 *
 * The controls were scattered down the page, each beside whatever it was
 * built for, so setting up a listen meant scrolling past the graph and back.
 * They answer one question — what am I about to hear — and belong together,
 * off the page until asked for (INT-NOTES-021).
 *
 * The one Sheet, told how to behave (INV-NOTES-181). Two stops: what the
 * content needs, and nine tenths of the screen for when it is dragged up.
 * Dimmed, because nothing behind it is being watched while these are set.
 *
 * Nothing in here starts a sound. The transport is still the only thing that
 * does, so opening the sheet to look is never a way to lose your place.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Sheet } from '../../components/Sheet';
import { useTheme } from '../../theme';

export interface PlaybackSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function PlaybackSheet({
  isOpen,
  onClose,
  title,
  children
}: PlaybackSheetProps): React.JSX.Element {
  const { colors } = useTheme();

  return (
    <Sheet
      name="playback-options"
      isOpen={isOpen}
      onClose={onClose}
      // One height, because this one dims what is behind it
      // (INV-NOTES-214). Offering two left the background scaled back and
      // frozen part-way, ignoring the grab handle until the sheet was
      // dismissed outright — the glyph guide dims and offers one height and
      // animates correctly, and the sheets that offer two are undimmed and
      // so have no background transition to get wrong.
      detents={['auto']}
      // Which means a long list of tracks scrolls rather than being dragged
      // taller. Off by default, and that default is why the analysis sheet
      // could not be scrolled (INV-NOTES-194).
      isScrolling
      background={colors.neutral50}
    >
      <View style={styles.body}>
        <Text style={[styles.title, { color: colors.typography }]}>
          {title}
        </Text>
        <View style={styles.rows}>{children}</View>
      </View>
    </Sheet>
  );
}

export default PlaybackSheet;

const styles = StyleSheet.create({
  body: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 32 },
  title: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  rows: { gap: 4 }
});
