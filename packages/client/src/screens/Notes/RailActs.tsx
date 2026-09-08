/**
 * What the foot opens into: the acts that remake the graph (INV-NOTES-230).
 *
 * Three things that change what is drawn rather than what is heard — sing a
 * bass line under the tune, read the take again, put the chords on the graph
 * or take them off. They were three controls in three places, all of them
 * below the graph or behind a sheet, and all three are about the picture.
 *
 * Each the same width as the next, so the row reads as a row. That is why the
 * chords are a keyboard rather than a word (INV-NOTES-231).
 *
 * None of them touch what was done by hand: a re-read keeps the corrections
 * and replays them (INV-NOTES-116), and asking for the chords again replays
 * the decisions made about them (INV-NOTES-022).
 */
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '../../components/Icon';
import { useTheme } from '../../theme';
import { useTranslation } from '../../i18n';

/** One act's width, in px. The same for each, whatever it draws. */
export const ACT_WIDTH = 42;

/** The record disc, smaller than the list's but the same thing. */
const DISC = 18;

export interface RailActsProps {
  /** Sing a bass line under the tune (INV-NOTES-071). */
  isRecording: boolean;
  onRecord: () => void;
  /** Read the take again with what the reader can do now (INV-NOTES-116). */
  isRereading: boolean;
  onReread: () => void;
  /** Put the chords on the graph, or take them off (INV-NOTES-231). */
  hasChords: boolean;
  onChords: () => void;
}

export function RailActs({
  isRecording,
  onRecord,
  isRereading,
  onReread,
  hasChords,
  onChords
}: RailActsProps): React.JSX.Element {
  const { colors } = useTheme();
  const { t } = useTranslation();

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('notes.actRecordBass')}
        accessibilityState={{ selected: isRecording }}
        testID="act-record"
        onPress={onRecord}
        style={({ pressed }) => [styles.act, { opacity: pressed ? 0.5 : 1 }]}
      >
        {/* A disc filled solid in the palette's red, like the one over the
            list: a record control, not an accent. It squares off while it is
            running, which is the shape everything stops with. */}
        <View
          style={[
            styles.disc,
            {
              backgroundColor: colors.error,
              borderRadius: isRecording ? 3 : DISC / 2
            }
          ]}
        />
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('notes.actReread')}
        accessibilityState={{ busy: isRereading }}
        testID="act-reread"
        disabled={isRereading}
        onPress={onReread}
        style={({ pressed }) => [styles.act, { opacity: pressed ? 0.5 : 1 }]}
      >
        {isRereading ? (
          <ActivityIndicator size="small" color={colors.gray300} />
        ) : (
          <Icon name="reset" size={19} color={colors.gray300} />
        )}
      </Pressable>

      <Pressable
        accessibilityRole="switch"
        accessibilityLabel={t('notes.actChords')}
        accessibilityState={{ checked: hasChords }}
        testID="act-chords"
        onPress={onChords}
        style={({ pressed }) => [styles.act, { opacity: pressed ? 0.5 : 1 }]}
      >
        <Icon
          name="piano"
          size={20}
          color={hasChords ? colors.primary500 : colors.gray300}
        />
      </Pressable>
    </>
  );
}

export default RailActs;

const styles = StyleSheet.create({
  act: {
    width: ACT_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch'
  },
  disc: { width: DISC, height: DISC }
});
