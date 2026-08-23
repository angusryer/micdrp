/**
 * PlaybackSheet — everything that decides what a press will sound.
 *
 * The controls were scattered down the page, each beside whatever it was
 * built for, so setting up a listen meant scrolling past the graph and back.
 * They answer one question — what am I about to hear — and belong together,
 * off the page until asked for (INT-NOTES-021).
 *
 * A real sheet, not a Modal wearing one. The previous version drew its own
 * grabber inside a ScrollView, which is the one place a grabber cannot work:
 * dragging it scrolled the body and never moved the sheet. TrueSheet's
 * grabber lives in the sheet chrome outside the scroll, so it pans and
 * dismisses the way a sheet is expected to (INV-NOTES-077).
 *
 * The dimming behind it is the system's, which means it appears with the
 * presentation rather than sliding up as part of the sheet — the sheet moves
 * and the ground behind it does not.
 *
 * Nothing in here starts a sound. The transport is still the only thing that
 * does, so opening the sheet to look is never a way to lose your place.
 */
import React, { useEffect, useRef } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { TrueSheet } from '@lodev09/react-native-true-sheet';

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
  const { height } = useWindowDimensions();
  const sheet = useRef<TrueSheet>(null);

  // Driven from a boolean rather than a ref handed to callers: every caller
  // here already has "is it open" in state, and a second way of saying the
  // same thing is a second thing to keep in step.
  useEffect(() => {
    if (isOpen) {
      void sheet.current?.present();
    } else {
      void sheet.current?.dismiss();
    }
  }, [isOpen]);

  return (
    <TrueSheet
      ref={sheet}
      name="playback-options"
      // Two stops: what the content needs, and nine tenths of the screen for
      // when it is dragged up. Dragging below the first dismisses.
      detents={['auto', 0.9]}
      // The native grabber, in the sheet chrome outside the scroll. A handle
      // inside the ScrollView only scrolls the body and never pans the sheet,
      // which is exactly what the hand-drawn one did.
      grabber
      grabberOptions={{ topMargin: 12 }}
      cornerRadius={16}
      backgroundColor={colors.neutral50}
      // Fired after the native dismiss, however it happened — the grabber
      // dragged down, a tap outside, or our own dismiss() — so the caller's
      // boolean never disagrees with what is on screen.
      onDidDismiss={onClose}
    >
      <ScrollView
        style={{ maxHeight: Math.round(height * 0.86) }}
        contentContainerStyle={styles.body}
        contentInsetAdjustmentBehavior="never"
      >
        <Text style={[styles.title, { color: colors.typography }]}>
          {title}
        </Text>
        <View style={styles.rows}>{children}</View>
      </ScrollView>
    </TrueSheet>
  );
}

export default PlaybackSheet;

const styles = StyleSheet.create({
  body: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 32 },
  title: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  rows: { gap: 4 }
});
