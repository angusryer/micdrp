/**
 * The record control, floating over the note list (VIEW-NOTES-001).
 *
 * A disc filled solid in the palette's red — a record control, not an accent.
 * No inner glyph: a light dot inside the disc reads as a hole against the
 * cream canvas, which made the button look like a stroked ring rather than a
 * filled circle.
 *
 * It opens the recording view rather than starting a capture where it stands.
 * A take begun on a browsing page has nowhere to draw what is being heard and
 * nowhere to put the beat button, which is the thing a singer most wants
 * their hands on while singing (INV-NOTES-137).
 *
 * Over the list rather than in it, so it is in the same place whatever has
 * been scrolled to; the list carries the clearance below so the last card is
 * reachable.
 */
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '../../theme';
import { useTranslation } from '../../i18n';

/** How far the disc sits above the bottom edge, in px. */
const BOTTOM_INSET = 20;

/** How wide the disc is, in px. Large: it is the one thing this page does. */
const SIZE = 68;

/**
 * How much room the list must leave below its last card.
 *
 * The disc, its inset, and a card's own margin — so the last card clears the
 * button rather than ending underneath it.
 */
export const RECORD_BUTTON_CLEARANCE = SIZE + BOTTOM_INSET + 16;

export interface RecordButtonProps {
  onPress: () => void;
}

export function RecordButton({ onPress }: RecordButtonProps): React.JSX.Element {
  const { colors } = useTheme();
  const { t } = useTranslation();

  return (
    <View pointerEvents="box-none" style={styles.layer}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('record.startRecording')}
        testID="open-record"
        onPress={onPress}
        style={({ pressed }) => [
          styles.disc,
          { backgroundColor: colors.error, opacity: pressed ? 0.8 : 1 }
        ]}
      />
    </View>
  );
}

export default RecordButton;

const styles = StyleSheet.create({
  // Box-none: the layer spans the page so the disc can be centred in it, and
  // every touch that misses the disc goes to the list underneath.
  layer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: BOTTOM_INSET,
    alignItems: 'center'
  },
  disc: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    // Lifted off the list it covers, so it reads as over rather than in.
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6
  }
});
