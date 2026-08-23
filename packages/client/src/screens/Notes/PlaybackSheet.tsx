/**
 * PlaybackSheet — everything that decides what a press will sound.
 *
 * The controls were scattered down the page, each beside whatever it was
 * built for, so setting up a listen meant scrolling past the graph and back.
 * They answer one question — what am I about to hear — and belong together,
 * off the page until asked for (INT-NOTES-021).
 *
 * Nothing in here starts a sound. The transport is still the only thing that
 * does, so opening the sheet to look is never a way to lose your place.
 */
import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

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
    <Modal
      transparent
      animationType="slide"
      visible={isOpen}
      onRequestClose={onClose}
    >
      {/* The scrim closes it. A sheet with only one way out is a sheet people
          are wary of opening. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close playback options"
        style={styles.scrim}
        onPress={onClose}
      />
      <View
        style={[
          styles.sheet,
          { backgroundColor: colors.neutral50, borderColor: colors.neutral500 }
        ]}
      >
        <View style={styles.grabber}>
          <View style={[styles.grip, { backgroundColor: colors.neutral500 }]} />
        </View>
        <View style={styles.head}>
          <Text style={[styles.title, { color: colors.typography }]}>
            {title}
          </Text>
          <Text
            accessibilityRole="button"
            onPress={onClose}
            style={[styles.done, { color: colors.primary500 }]}
          >
            Done
          </Text>
        </View>
        {/* Scrolls, because a note with every track and a register control is
            taller than a short phone in landscape has room for. */}
        <ScrollView contentContainerStyle={styles.body}>{children}</ScrollView>
      </View>
    </Modal>
  );
}

export default PlaybackSheet;

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.4)' },
  sheet: {
    borderTopWidth: 1,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 28,
    maxHeight: '70%'
  },
  grabber: { alignItems: 'center', paddingTop: 8 },
  grip: { width: 36, height: 4, borderRadius: 2, opacity: 0.6 },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10
  },
  title: { fontSize: 16, fontWeight: '700' },
  done: { fontSize: 15, fontWeight: '600' },
  body: { paddingHorizontal: 20, paddingTop: 8, gap: 4 }
});
